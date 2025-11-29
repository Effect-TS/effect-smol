/**
 * This module provides functionality to convert JSON Schema fragments into Effect
 * Schema code. It takes a JSON Schema definition and generates the corresponding
 * Effect Schema code string along with its TypeScript type representation.
 *
 * The conversion process handles:
 * - Basic JSON Schema types (string, number, integer, boolean, null, object, array)
 * - Complex types (unions via `anyOf`/`oneOf`, references via `$ref`)
 * - Validation constraints (minLength, maxLength, pattern, minimum, maximum, etc.)
 * - Schema annotations (title, description, default, examples)
 * - Object structures with required/optional properties
 * - Array types with item schemas
 *
 * This is useful for code generation tools that need to convert JSON Schema
 * definitions (e.g., from OpenAPI specifications) into Effect Schema code.
 *
 * @since 4.0.0
 */
import * as Arr from "../collections/Array.ts"
import * as Combiner from "../data/Combiner.ts"
import { format, formatPropertyKey } from "../data/Formatter.ts"
import { isObject, isUndefined } from "../data/Predicate.ts"
import * as Reducer from "../data/Reducer.ts"
import * as Struct from "../data/Struct.ts"
import * as UndefinedOr from "../data/UndefinedOr.ts"
import { type Mutable } from "../types/Types.ts"
import type * as Schema from "./Schema.ts"

/**
 * @since 4.0.0
 */
export type Source = Schema.JsonSchema.Target

/**
 * @since 4.0.0
 */
export type Types = {
  readonly Type: string
  readonly Encoded: string
  readonly DecodingServices: string
  readonly EncodingServices: string
}

/**
 * @since 4.0.0
 */
export function makeTypes(
  Type: string,
  Encoded: string = Type,
  DecodingServices: string = "never",
  EncodingServices: string = "never"
): Types {
  return { Type, Encoded, DecodingServices, EncodingServices }
}

/**
 * @since 4.0.0
 */
export type Annotations = {
  readonly description?: string | undefined
  readonly title?: string | undefined
  readonly examples?: ReadonlyArray<unknown> | undefined
  readonly default?: unknown | undefined
  readonly format?: string | undefined
}

/**
 * @since 4.0.0
 */
export type Generation = {
  readonly runtime: string
  readonly types: Types
  readonly annotations: Annotations
  readonly importDeclarations: ReadonlySet<string>
}

/**
 * @since 4.0.0
 */
export function makeGeneration(
  runtime: string,
  types: Types,
  annotations: Annotations = {},
  importDeclarations: ReadonlySet<string> = emptySet
): Generation {
  return { runtime, types, annotations, importDeclarations }
}

/**
 * @since 4.0.0
 */
export function makeGenerationExtern(
  namespace: string,
  importDeclaration: string
): Generation {
  return makeGeneration(
    namespace,
    makeTypes(
      `typeof ${namespace}["Type"]`,
      `typeof ${namespace}["Encoded"]`,
      `typeof ${namespace}["DecodingServices"]`,
      `typeof ${namespace}["EncodingServices"]`
    ),
    {},
    new Set([importDeclaration])
  )
}

/**
 * @since 4.0.0
 */
export type GenerateOptions = {
  readonly resolver?: Resolver | undefined
  readonly source?: Source | undefined
  /**
   * A function that is called to extract the JavaScript documentation from the
   * annotations.
   *
   * By default the jsDocs are not extracted. You can set it to `true` to
   * extract the jsDocs from the annotations with the default implementation.
   * You can also set it to a function that will be called to extract the jsDocs
   * from the annotations.
   */
  readonly extractJsDocs?: boolean | ((annotations: Annotations) => string) | undefined
}

interface RecurOptions {
  readonly resolver: Resolver
  readonly source: Source
  readonly extractJsDocs: ((annotations: Annotations) => string) | undefined
}

/**
 * @since 4.0.0
 */
export type Resolver = (identifier: string) => Generation

/**
 * @since 4.0.0
 */
export function generate(schema: unknown, options?: GenerateOptions): Generation {
  const extractJsDocs = options?.extractJsDocs ?? false
  const recurOptions: RecurOptions = {
    resolver: options?.resolver ?? identityResolver,
    source: options?.source ?? "draft-2020-12",
    extractJsDocs: extractJsDocs === true ? defaultExtractJsDocs : extractJsDocs === false ? undefined : extractJsDocs
  }
  return toGeneration(parse(schema, recurOptions), recurOptions)
}

function defaultExtractJsDocs(annotations: Annotations): string {
  if (annotations.description === undefined) return ""
  return `\n/** ${annotations.description} */\n`
}

function renderJsDocs(annotations: Annotations, options: RecurOptions): string {
  if (!options.extractJsDocs) return ""
  return options.extractJsDocs(annotations)
}

function toGeneration(ast: AST, options: RecurOptions): Generation {
  const out = ast.toGeneration(options)
  const checks = ast.renderChecks()
  const annotations = renderAnnotations(ast)
  return {
    runtime: out.runtime + checks + annotations,
    types: out.types,
    annotations: out.annotations,
    importDeclarations: out.importDeclarations
  }
}

function renderAnnotations(ast: AST): string {
  const entries = Object.entries(ast.annotations)

  if (entries.length === 0) return ""

  return `.annotate({ ${entries.map(([key, value]) => `${formatPropertyKey(key)}: ${format(value)}`).join(", ")} })`
}

const identityResolver: Resolver = (identifier: string) => {
  return makeGeneration(identifier, makeTypes(identifier))
}

const emptySet: ReadonlySet<string> = new Set()

const ReadonlySetReducer: Reducer.Reducer<ReadonlySet<string>> = Reducer.make<ReadonlySet<string>>(
  (self, that) => {
    if (self.size === 0) return that
    if (that.size === 0) return self
    return new Set([...self, ...that])
  },
  emptySet
)

type TopologicalSort = {
  /**
   * The definitions that are not recursive.
   * The definitions that depends on other definitions are placed after the definitions they depend on
   */
  readonly nonRecursives: ReadonlyArray<{
    readonly identifier: string
    readonly schema: Schema.JsonSchema
  }>
  /**
   * The recursive definitions (with no particular order).
   */
  readonly recursives: {
    readonly [identifier: string]: Schema.JsonSchema
  }
}

/** @internal */
export function topologicalSort(definitions: Schema.JsonSchema.Definitions): TopologicalSort {
  const identifiers = Object.keys(definitions)
  const identifierSet = new Set(identifiers)

  const collectRefs = (root: unknown): Set<string> => {
    const refs = new Set<string>()
    const visited = new WeakSet<object>()
    const stack: Array<unknown> = [root]

    while (stack.length > 0) {
      const value = stack.pop()

      if (Array.isArray(value)) {
        for (const item of value) stack.push(item)
        continue
      }

      if (!isObject(value)) continue
      if (visited.has(value)) continue
      visited.add(value)

      if (typeof value.$ref === "string") {
        const id = extractIdentifier(value.$ref)
        if (id !== undefined && identifierSet.has(id)) {
          refs.add(id)
        }
      }

      for (const v of Object.values(value)) {
        stack.push(v)
      }
    }

    return refs
  }

  // identifier -> internal identifiers it depends on
  const dependencies = new Map<string, Set<string>>(
    identifiers.map((id) => [id, collectRefs(definitions[id])])
  )

  // Mark only nodes that are part of cycles
  const recursive = new Set<string>()
  const state = new Map<string, 0 | 1 | 2>() // 0 = new, 1 = visiting, 2 = done
  const stack: Array<string> = []
  const indexInStack = new Map<string, number>()

  const dfs = (id: string): void => {
    const s = state.get(id) ?? 0
    if (s === 1) {
      const start = indexInStack.get(id)
      if (start !== undefined) {
        for (let i = start; i < stack.length; i++) {
          recursive.add(stack[i])
        }
      }
      return
    }
    if (s === 2) return

    state.set(id, 1)
    indexInStack.set(id, stack.length)
    stack.push(id)

    for (const dep of dependencies.get(id) ?? []) {
      dfs(dep)
    }

    stack.pop()
    indexInStack.delete(id)
    state.set(id, 2)
  }

  for (const id of identifiers) dfs(id)

  // Topologically sort the non-recursive nodes (ignoring edges to recursive nodes)
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, Set<string>>() // dep -> nodes that depend on it

  for (const id of identifiers) {
    if (!recursive.has(id)) {
      inDegree.set(id, 0)
      dependents.set(id, new Set())
    }
  }

  for (const [id, deps] of dependencies) {
    if (recursive.has(id)) continue
    for (const dep of deps) {
      if (recursive.has(dep)) continue
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1)
      dependents.get(dep)?.add(id)
    }
  }

  const queue: Array<string> = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const nonRecursives: Array<{ readonly identifier: string; readonly schema: Schema.JsonSchema }> = []
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    nonRecursives.push({ identifier: id, schema: definitions[id] })

    for (const next of dependents.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }

  const recursives: Record<string, Schema.JsonSchema> = {}
  for (const id of recursive) {
    recursives[id] = definitions[id]
  }

  return { nonRecursives, recursives }
}

function extractIdentifier($ref: string): string | undefined {
  const last = $ref.split("/").pop()
  if (last !== undefined) {
    return unescapeJsonPointer(last)
  }
}

function unescapeJsonPointer(pointer: string): string {
  return pointer.replace(/~0/ig, "~").replace(/~1/ig, "/")
}

/**
 * @since 4.0.0
 */
export type DefinitionGeneration = {
  readonly identifier: string
  readonly generation: Generation
}

/**
 * @since 4.0.0
 */
export function generateDefinitions(
  definitions: Schema.JsonSchema.Definitions,
  options?: GenerateOptions
): Array<DefinitionGeneration> {
  const ts = topologicalSort(definitions)
  const recursives = new Set(Object.keys(ts.recursives))
  const resolver = options?.resolver ?? identityResolver
  const opts: GenerateOptions = {
    ...options,
    resolver: (identifier) => {
      const out = resolver(identifier)
      if (recursives.has(identifier)) {
        const services = [out.types.Type, out.types.Encoded, out.types.DecodingServices, out.types.EncodingServices]
        if (services[3] === "never") services.pop()
        if (services[2] === "never") services.pop()
        if (services[1] === services[0]) services.pop()
        return makeGeneration(
          `Schema.suspend((): Schema.Codec<${services.join(", ")}> => ${identifier})`,
          out.types
        )
      }
      return out
    }
  }
  return ts.nonRecursives.concat(
    Object.entries(ts.recursives).map(([identifier, schema]) => ({ identifier, schema }))
  ).map(({ identifier, schema }) => {
    const output = generate(schema, opts)
    return {
      identifier,
      generation: makeGeneration(
        output.runtime + `.annotate({ "identifier": ${format(identifier)} })`,
        output.types,
        output.annotations,
        output.importDeclarations
      )
    }
  })
}

const joinReducer = UndefinedOr.getReducer(Combiner.make<string>((a, b) => {
  a = a.trim()
  b = b.trim()
  if (a === "") return b
  if (b === "") return a
  return `${a}, ${b}`
}))

const annotationsCombiner: Combiner.Combiner<any> = Struct.getCombiner({
  description: joinReducer,
  title: joinReducer,
  default: UndefinedOr.getReducer(Combiner.last()),
  examples: UndefinedOr.getReducer(Arr.getReducerConcat()),
  format: Combiner.last<string>()
}, {
  omitKeyWhen: isUndefined
})

type AST =
  | Unknown
  | Never
  | Not
  | Null
  | String
  | Number
  | Boolean
  | Const
  | Enum
  | Arrays
  | Objects
  | Union
  | Reference

class Unknown {
  readonly _tag = "Unknown"
  readonly annotations: Annotations
  constructor(annotations: Annotations = {}) {
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Unknown {
    return new Unknown(annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  renderChecks(): string {
    return ""
  }
  combine(that: AST): AST {
    return that
  }
  toGeneration(_: RecurOptions): Generation {
    return {
      runtime: "Schema.Unknown",
      types: makeTypes("unknown"),
      annotations: this.annotations,
      importDeclarations: emptySet
    }
  }
}

class Never {
  readonly _tag = "Never"
  readonly annotations: Annotations
  constructor(annotations: Annotations = {}) {
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Never {
    return new Never(annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  renderChecks(): string {
    return ""
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(_: RecurOptions): Generation {
    return {
      runtime: "Schema.Never",
      types: makeTypes("never"),
      annotations: this.annotations,
      importDeclarations: emptySet
    }
  }
}

class Not {
  readonly _tag = "Not"
  readonly ast: AST
  readonly annotations: Annotations
  constructor(ast: AST, annotations: Annotations = {}) {
    this.ast = ast
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Not {
    return new Not(this.ast, annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  renderChecks(): string {
    return ""
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(options: RecurOptions): Generation {
    return toGeneration(new Never(this.annotations), options)
  }
}

class Null {
  readonly _tag = "Null"
  readonly annotations: Annotations
  constructor(annotations: Annotations = {}) {
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Null {
    return new Null(annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  renderChecks(): string {
    return ""
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(_: RecurOptions): Generation {
    return {
      runtime: "Schema.Null",
      types: makeTypes("null"),
      annotations: this.annotations,
      importDeclarations: emptySet
    }
  }
}

type StringCheck =
  | { readonly _tag: "minLength"; readonly value: number }
  | { readonly _tag: "maxLength"; readonly value: number }
  | { readonly _tag: "pattern"; readonly value: string }

function makePatternCheck(pattern: string): StringCheck {
  return { _tag: "pattern", value: pattern.replace(/\//g, "\\/") }
}

class String {
  static parseChecks(f: Schema.JsonSchema): Array<StringCheck> {
    const cs: Array<StringCheck> = []
    if (typeof f.minLength === "number") cs.push({ _tag: "minLength", value: f.minLength })
    if (typeof f.maxLength === "number") cs.push({ _tag: "maxLength", value: f.maxLength })
    // Escape forward slashes to prevent them from terminating the regex literal delimiter
    if (typeof f.pattern === "string") cs.push(makePatternCheck(f.pattern))
    return cs
  }
  readonly _tag = "String"
  readonly checks: ReadonlyArray<StringCheck>
  readonly contentSchema: AST | undefined
  readonly annotations: Annotations
  constructor(checks: ReadonlyArray<StringCheck>, contentSchema: AST | undefined, annotations: Annotations = {}) {
    this.checks = checks
    this.contentSchema = contentSchema
    this.annotations = annotations
  }
  annotate(annotations: Annotations): String {
    return new String(this.checks, this.contentSchema, annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(f: Schema.JsonSchema): AST {
    return new String([...this.checks, ...String.parseChecks(f)], this.contentSchema, this.annotations)
  }
  renderChecks(): string {
    return renderChecksWith(this.checks, (c) => {
      switch (c._tag) {
        case "minLength":
          return `Schema.isMinLength(${c.value})`
        case "maxLength":
          return `Schema.isMaxLength(${c.value})`
        case "pattern":
          return `Schema.isPattern(/${c.value}/)`
      }
    })
  }
  combine(that: AST): AST {
    switch (that._tag) {
      case "String":
        return new String(
          [...this.checks, ...that.checks],
          this.contentSchema === undefined
            ? that.contentSchema
            : that.contentSchema === undefined
            ? this.contentSchema
            : this.contentSchema.combine(that.contentSchema),
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      case "Unknown":
        return new String(
          this.checks,
          this.contentSchema,
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      default:
        return new Never()
    }
  }
  toGeneration(options: RecurOptions): Generation {
    if (this.contentSchema !== undefined) {
      const contentSchema = toGeneration(this.contentSchema, options)
      return {
        runtime: `Schema.fromJsonString(${contentSchema.runtime})`,
        types: makeTypes(
          contentSchema.types.Type,
          "string",
          contentSchema.types.DecodingServices,
          contentSchema.types.EncodingServices
        ),
        annotations: this.annotations,
        importDeclarations: emptySet
      }
    }
    return {
      runtime: "Schema.String",
      types: makeTypes("string"),
      annotations: this.annotations,
      importDeclarations: emptySet
    }
  }
}

function renderChecksWith<A>(checks: ReadonlyArray<A>, f: (a: A) => string): string {
  return checks.length === 0 ? "" : `.check(${checks.map(f).join(", ")})`
}

type NumberCheck =
  | { readonly _tag: "greaterThanOrEqualTo"; readonly value: number }
  | { readonly _tag: "lessThanOrEqualTo"; readonly value: number }
  | { readonly _tag: "greaterThan"; readonly value: number }
  | { readonly _tag: "lessThan"; readonly value: number }
  | { readonly _tag: "multipleOf"; readonly value: number }

class Number {
  static parseChecks(f: Schema.JsonSchema): Array<NumberCheck> {
    const cs: Array<NumberCheck> = []
    if (typeof f.minimum === "number") cs.push({ _tag: "greaterThanOrEqualTo", value: f.minimum })
    if (typeof f.maximum === "number") cs.push({ _tag: "lessThanOrEqualTo", value: f.maximum })
    if (typeof f.exclusiveMinimum === "number") cs.push({ _tag: "greaterThan", value: f.exclusiveMinimum })
    if (typeof f.exclusiveMaximum === "number") cs.push({ _tag: "lessThan", value: f.exclusiveMaximum })
    if (typeof f.multipleOf === "number") cs.push({ _tag: "multipleOf", value: f.multipleOf })
    return cs
  }
  readonly _tag = "Number"
  readonly isInteger: boolean
  readonly checks: ReadonlyArray<NumberCheck>
  readonly annotations: Annotations
  constructor(
    isInteger: boolean,
    checks: ReadonlyArray<NumberCheck>,
    annotations: Annotations = {}
  ) {
    this.isInteger = isInteger
    this.checks = checks
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Number {
    return new Number(this.isInteger, this.checks, annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(f: Schema.JsonSchema): AST {
    return new Number(this.isInteger, [...this.checks, ...Number.parseChecks(f)], this.annotations)
  }
  renderChecks(): string {
    return renderChecksWith(this.checks, (c) => {
      switch (c._tag) {
        case "greaterThanOrEqualTo":
          return `Schema.isGreaterThanOrEqualTo(${c.value})`
        case "lessThanOrEqualTo":
          return `Schema.isLessThanOrEqualTo(${c.value})`
        case "greaterThan":
          return `Schema.isGreaterThan(${c.value})`
        case "lessThan":
          return `Schema.isLessThan(${c.value})`
        case "multipleOf":
          return `Schema.isMultipleOf(${c.value})`
      }
    })
  }
  combine(that: AST): AST {
    switch (that._tag) {
      case "Number":
        return new Number(
          this.isInteger || that.isInteger,
          [...this.checks, ...that.checks],
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      case "Unknown":
        return new Number(
          this.isInteger,
          this.checks,
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      default:
        return new Never()
    }
  }
  toGeneration(_: RecurOptions): Generation {
    return {
      runtime: this.isInteger ? "Schema.Int" : "Schema.Number",
      types: makeTypes("number"),
      annotations: this.annotations,
      importDeclarations: emptySet
    }
  }
}

class Boolean {
  readonly _tag = "Boolean"
  readonly annotations: Annotations
  constructor(annotations: Annotations = {}) {
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Boolean {
    return new Boolean(annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  renderChecks(): string {
    return ""
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(_: RecurOptions): Generation {
    return {
      runtime: "Schema.Boolean",
      types: makeTypes("boolean"),
      annotations: this.annotations,
      importDeclarations: emptySet
    }
  }
}

class Const {
  readonly _tag = "Const"
  readonly value: unknown
  readonly annotations: Annotations
  constructor(value: unknown, annotations: Annotations = {}) {
    this.annotations = annotations
    this.value = value
  }
  annotate(annotations: Annotations): Const {
    return new Const(this.value, annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  renderChecks(): string {
    return ""
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(_: RecurOptions): Generation {
    return {
      runtime: `Schema.Literal(${format(this.value)})`,
      types: makeTypes(format(this.value)),
      annotations: this.annotations,
      importDeclarations: emptySet
    }
  }
}

class Enum {
  readonly _tag = "Enum"
  readonly values: ReadonlyArray<unknown>
  readonly annotations: Annotations
  constructor(values: ReadonlyArray<unknown>, annotations: Annotations = {}) {
    this.annotations = annotations
    this.values = values
  }
  annotate(annotations: Annotations): Enum {
    return new Enum(this.values, annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  renderChecks(): string {
    return ""
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(_: RecurOptions): Generation {
    const values = this.values.map((v) => format(v))
    if (values.length === 1) {
      return {
        runtime: `Schema.Literal(${values[0]})`,
        types: makeTypes(values[0]),
        annotations: this.annotations,
        importDeclarations: emptySet
      }
    } else {
      return {
        runtime: `Schema.Literals([${values.join(", ")}])`,
        types: makeTypes(values.join(" | ")),
        annotations: this.annotations,
        importDeclarations: emptySet
      }
    }
  }
}

type ArraysCheck =
  | { readonly _tag: "minItems"; readonly value: number }
  | { readonly _tag: "maxItems"; readonly value: number }
  | { readonly _tag: "uniqueItems" }

class Element {
  readonly isOptional: boolean
  readonly ast: AST
  constructor(isOptional: boolean, ast: AST) {
    this.isOptional = isOptional
    this.ast = ast
  }
  annotate(annotations: Annotations): Element {
    return new Element(this.isOptional, this.ast.annotate(annotations))
  }
}

class Arrays {
  static parseChecks(f: Schema.JsonSchema): Array<ArraysCheck> {
    const cs: Array<ArraysCheck> = []
    if (typeof f.minItems === "number") cs.push({ _tag: "minItems", value: f.minItems })
    if (typeof f.maxItems === "number") cs.push({ _tag: "maxItems", value: f.maxItems })
    if (f.uniqueItems === true) cs.push({ _tag: "uniqueItems" })
    return cs
  }
  readonly _tag = "Arrays"
  readonly elements: ReadonlyArray<Element>
  readonly rest: AST | undefined
  readonly checks: ReadonlyArray<ArraysCheck>
  readonly annotations: Annotations
  constructor(
    elements: ReadonlyArray<Element>,
    rest: AST | undefined,
    checks: ReadonlyArray<ArraysCheck>,
    annotations: Annotations = {}
  ) {
    this.elements = elements
    this.rest = rest
    const i = elements.findIndex((e) => e.isOptional)
    const len = i !== -1 ? i : elements.length
    this.checks = checks.filter((c) => {
      if (c._tag === "minItems") {
        return c.value > len && rest !== undefined
      }
      return true
    })
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Arrays {
    return new Arrays(this.elements, this.rest, this.checks, annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(schema: Schema.JsonSchema): AST {
    return new Arrays(this.elements, this.rest, [...this.checks, ...Arrays.parseChecks(schema)], this.annotations)
  }
  renderChecks(): string {
    return renderChecksWith(this.checks, (c) => {
      switch (c._tag) {
        case "minItems":
          return `Schema.isMinLength(${c.value})`
        case "maxItems":
          return `Schema.isMaxLength(${c.value})`
        case "uniqueItems":
          return `Schema.isUnique()`
      }
    })
  }
  combine(that: AST): AST {
    switch (that._tag) {
      case "Unknown":
        return new Arrays(
          this.elements,
          this.rest,
          this.checks,
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      case "Arrays": {
        if (this.elements.length > 0 && that.elements.length > 0) {
          return new Never()
        }
        return new Arrays(
          this.elements.concat(that.elements),
          this.rest === undefined ? that.rest : that.rest === undefined ? this.rest : this.rest.combine(that.rest),
          [...this.checks, ...that.checks],
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      }
      case "Union":
        return new Union(
          that.members.map((m) => this.combine(m)),
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      default:
        return new Never()
    }
  }
  toGeneration(options: RecurOptions): Generation {
    const es = this.elements.map((e): ElementIR => ({
      value: toGeneration(e.ast, options),
      isOptional: e.isOptional
    }))
    const rest = this.rest !== undefined ? toGeneration(this.rest, options) : undefined
    const el = renderElements(es)

    if (es.length === 0 && rest === undefined) {
      return {
        runtime: `Schema.Tuple([])`,
        types: makeTypes("readonly []"),
        annotations: this.annotations,
        importDeclarations: emptySet
      }
    }

    if (es.length === 0 && rest !== undefined) {
      return {
        runtime: `Schema.Array(${rest.runtime})`,
        types: makeTypes(
          `ReadonlyArray<${rest.types.Type}>`,
          `ReadonlyArray<${rest.types.Encoded}>`,
          rest.types.DecodingServices,
          rest.types.EncodingServices
        ),
        annotations: this.annotations,
        importDeclarations: rest.importDeclarations
      }
    }

    if (rest === undefined) {
      return {
        runtime: `Schema.Tuple([${el.runtime}])`,
        types: makeTypes(
          `readonly [${el.types.Type}]`,
          `readonly [${el.types.Encoded}]`,
          el.types.DecodingServices,
          el.types.EncodingServices
        ),
        annotations: this.annotations,
        importDeclarations: el.importDeclarations
      }
    }

    return {
      runtime: `Schema.TupleWithRest(Schema.Tuple([${el.runtime}]), [${rest.runtime}])`,
      types: makeTypes(
        `readonly [${el.types.Type}, ...Array<${rest.types.Type}>]`,
        `readonly [${el.types.Encoded}, ...Array<${rest.types.Encoded}>]`,
        joinServices([el.types.DecodingServices, rest.types.DecodingServices]),
        joinServices([el.types.EncodingServices, rest.types.EncodingServices])
      ),
      annotations: this.annotations,
      importDeclarations: ReadonlySetReducer.combine(el.importDeclarations, rest.importDeclarations)
    }
  }
}

type ElementIR = {
  readonly value: Generation
  readonly isOptional: boolean
}

function renderElements(es: ReadonlyArray<ElementIR>): Generation {
  return {
    runtime: es.map((e) => optionalRuntime(e.isOptional, e.value.runtime)).join(", "),
    types: makeTypes(
      join(es, (e) => addQuestionMark(e.isOptional, e.value.types.Type)),
      join(es, (e) => addQuestionMark(e.isOptional, e.value.types.Encoded)),
      joinServices(es.map((e) => e.value.types.DecodingServices)),
      joinServices(es.map((e) => e.value.types.EncodingServices))
    ),
    annotations: {},
    importDeclarations: ReadonlySetReducer.combineAll(es.map((e) => e.value.importDeclarations))
  }
}

function join<A>(values: ReadonlyArray<A>, f: (a: A, i: number) => string): string {
  return values.map(f).join(", ")
}

function joinServices(services: ReadonlyArray<string>): string {
  const ss = services.filter((s) => s !== "never")
  if (ss.length === 0) return "never"
  return [...new Set(ss)].join(" | ")
}

function optionalRuntime(isOptional: boolean, code: string): string {
  return isOptional ? `Schema.optionalKey(${code})` : code
}

function addQuestionMark(isOptional: boolean, type: string): string {
  return isOptional ? `${type}?` : type
}

type ObjectsCheck =
  | { readonly _tag: "minProperties"; readonly value: number }
  | { readonly _tag: "maxProperties"; readonly value: number }

class Property {
  readonly isOptional: boolean
  readonly key: string
  readonly value: AST
  constructor(isOptional: boolean, key: string, value: AST) {
    this.isOptional = isOptional
    this.key = key
    this.value = value
  }
}

class IndexSignature {
  readonly key: AST
  readonly value: AST
  constructor(key: AST, value: AST) {
    this.key = key
    this.value = value
  }
}

class Objects {
  static parseChecks(f: Schema.JsonSchema): Array<ObjectsCheck> {
    const cs: Array<ObjectsCheck> = []
    if (typeof f.minProperties === "number") cs.push({ _tag: "minProperties", value: f.minProperties })
    if (typeof f.maxProperties === "number") cs.push({ _tag: "maxProperties", value: f.maxProperties })
    return cs
  }
  readonly _tag = "Objects"
  readonly properties: ReadonlyArray<Property>
  readonly indexSignatures: ReadonlyArray<IndexSignature>
  readonly checks: ReadonlyArray<ObjectsCheck>
  readonly annotations: Annotations
  constructor(
    properties: ReadonlyArray<Property>,
    indexSignatures: ReadonlyArray<IndexSignature>,
    checks: ReadonlyArray<ObjectsCheck>,
    annotations: Annotations = {}
  ) {
    this.properties = properties
    this.indexSignatures = indexSignatures
    this.checks = checks
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Objects {
    return new Objects(
      this.properties,
      this.indexSignatures,
      this.checks,
      annotationsCombiner.combine(this.annotations, annotations)
    )
  }
  parseChecks(f: Schema.JsonSchema): AST {
    return new Objects(
      this.properties,
      this.indexSignatures,
      [...this.checks, ...Objects.parseChecks(f)],
      this.annotations
    )
  }
  renderChecks(): string {
    return renderChecksWith(this.checks, (c) => {
      switch (c._tag) {
        case "minProperties":
          return `Schema.isMinProperties(${c.value})`
        case "maxProperties":
          return `Schema.isMaxProperties(${c.value})`
      }
    })
  }
  combine(that: AST): AST {
    switch (that._tag) {
      case "Unknown":
        return new Objects(
          this.properties,
          this.indexSignatures,
          this.checks,
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      case "Objects":
        return new Objects(
          this.properties.concat(that.properties),
          this.indexSignatures.concat(that.indexSignatures),
          [...this.checks, ...that.checks],
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      case "Union":
        return new Union(
          that.members.map((m) => this.combine(m)),
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      default:
        return new Never()
    }
  }
  toGeneration(options: RecurOptions): Generation {
    const ps: ReadonlyArray<PropertyGen> = this.properties.map((p) => ({
      key: p.key,
      value: toGeneration(p.value, options),
      isOptional: p.isOptional,
      annotations: p.value.annotations
    }))

    const iss: ReadonlyArray<IndexSignatureGen> = this.indexSignatures.map((is) => ({
      key: toGeneration(is.key, options),
      value: toGeneration(is.value, options)
    }))

    const p = renderProperties(ps, options)
    const i = renderIndexSignatures(iss)

    // 1) Only properties -> Struct
    if (iss.length === 0) {
      return {
        runtime: `Schema.Struct({ ${p.runtime} })`,
        types: makeTypes(
          `{ ${p.types.Type} }`,
          `{ ${p.types.Encoded} }`,
          p.types.DecodingServices,
          p.types.EncodingServices
        ),
        annotations: this.annotations,
        importDeclarations: p.importDeclarations
      }
    }

    // 2) Only one index signature and no properties -> Record
    if (ps.length === 0 && iss.length === 1) {
      const is = iss[0]
      return {
        runtime: indexSignatureRuntime(is),
        types: makeTypes(
          `{ ${renderIndexSignature(is.key.types.Type, is.value.types.Type)} }`,
          `{ ${renderIndexSignature(is.key.types.Encoded, is.value.types.Encoded)} }`,
          joinServices([is.key.types.DecodingServices, is.value.types.DecodingServices]),
          joinServices([is.key.types.EncodingServices, is.value.types.EncodingServices])
        ),
        annotations: this.annotations,
        importDeclarations: indexSignatureImports(is)
      }
    }

    // 3) Properties + index signatures -> StructWithRest
    return {
      runtime: `Schema.StructWithRest(Schema.Struct({ ${p.runtime} }), [${i.runtime}])`,
      types: ps.length === 0
        ? makeTypes(
          `{ ${i.types.Type} }`,
          `{ ${i.types.Encoded} }`,
          i.types.DecodingServices,
          i.types.EncodingServices
        )
        : makeTypes(
          `{ ${p.types.Type}, ${i.types.Type} }`,
          `{ ${p.types.Encoded}, ${i.types.Encoded} }`,
          joinServices([p.types.DecodingServices, i.types.DecodingServices]),
          joinServices([p.types.EncodingServices, i.types.EncodingServices])
        ),
      annotations: this.annotations,
      importDeclarations: ReadonlySetReducer.combineAll([p.importDeclarations, i.importDeclarations])
    }
  }
}

function renderProperties(ps: ReadonlyArray<PropertyGen>, options: RecurOptions): Generation {
  const descriptions = ps.map((p) => renderJsDocs(p.value.annotations, options))
  return {
    runtime: ps.map((p) => `${formatPropertyKey(p.key)}: ${optionalRuntime(p.isOptional, p.value.runtime)}`).join(
      ", "
    ),
    types: makeTypes(
      join(ps, (p, i) => descriptions[i] + renderProperty(p.isOptional, p.key, p.value.types.Type)),
      join(ps, (p, i) => descriptions[i] + renderProperty(p.isOptional, p.key, p.value.types.Encoded)),
      joinServices(ps.map((p) => p.value.types.DecodingServices)),
      joinServices(ps.map((p) => p.value.types.EncodingServices))
    ),
    annotations: {},
    importDeclarations: ReadonlySetReducer.combineAll(ps.map((p) => p.value.importDeclarations))
  }
}

function renderProperty(isOptional: boolean, key: string, value: string): string {
  return `readonly ${addQuestionMark(isOptional, formatPropertyKey(key))}: ${value}`
}

function renderIndexSignatures(iss: ReadonlyArray<IndexSignatureGen>): Generation {
  return {
    runtime: iss.map(indexSignatureRuntime).join(", "),
    types: makeTypes(
      join(iss, (is) => renderIndexSignature(is.key.types.Type, is.value.types.Type)),
      join(iss, (is) => renderIndexSignature(is.key.types.Encoded, is.value.types.Encoded)),
      joinServices(
        iss.map((is) => is.key.types.DecodingServices).concat(iss.map((is) => is.value.types.DecodingServices))
      ),
      joinServices(
        iss.map((is) => is.key.types.EncodingServices).concat(iss.map((is) => is.value.types.EncodingServices))
      )
    ),
    annotations: {},
    importDeclarations: ReadonlySetReducer.combineAll(iss.map(indexSignatureImports))
  }
}

function renderIndexSignature(key: string, value: string): string {
  return `readonly [x: ${key}]: ${value}`
}

function indexSignatureRuntime(is: IndexSignatureGen) {
  return `Schema.Record(${is.key.runtime}, ${is.value.runtime})`
}

function indexSignatureImports(is: IndexSignatureGen): ReadonlySet<string> {
  return ReadonlySetReducer.combine(is.key.importDeclarations, is.value.importDeclarations)
}

type PropertyGen = {
  readonly key: string
  readonly value: Generation
  readonly isOptional: boolean
  readonly annotations: Annotations | undefined
}

type IndexSignatureGen = {
  readonly key: Generation
  readonly value: Generation
}

class Union {
  readonly _tag = "Union"
  readonly members: ReadonlyArray<AST>
  readonly mode: "anyOf" | "oneOf"
  readonly annotations: Annotations
  constructor(members: ReadonlyArray<AST>, mode: "anyOf" | "oneOf", annotations: Annotations = {}) {
    this.members = members
    this.mode = mode
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Union {
    return new Union(this.members, this.mode, annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  renderChecks(): string {
    return ""
  }
  combine(that: AST): AST {
    switch (that._tag) {
      case "Unknown":
        return new Union(
          this.members,
          this.mode,
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      case "Arrays":
      case "Objects":
        return new Union(
          this.members.map((m) => m.combine(that)),
          this.mode,
          this.annotations
        )
      case "Union":
        return new Union(
          this.members.concat(that.members),
          this.mode === "oneOf" && that.mode === "oneOf" ? "oneOf" : "anyOf",
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      default:
        return new Never()
    }
  }
  toGeneration(options: RecurOptions): Generation {
    const members = this.members.map((m) => toGeneration(m, options))
    return {
      runtime: `Schema.Union([${members.map((m) => m.runtime).join(", ")}]${
        this.mode === "oneOf" ? `, { mode: "oneOf" }` : ""
      })`,
      types: makeTypes(
        members.map((m) => m.types.Type).join(" | "),
        members.map((m) => m.types.Encoded).join(" | "),
        joinServices(members.map((m) => m.types.DecodingServices)),
        joinServices(members.map((m) => m.types.EncodingServices))
      ),
      annotations: this.annotations,
      importDeclarations: ReadonlySetReducer.combineAll(members.map((m) => m.importDeclarations))
    }
  }
}

class Reference {
  readonly _tag = "Reference"
  readonly identifier: string
  readonly annotations: Annotations
  constructor(identifier: string, annotations: Annotations = {}) {
    this.identifier = identifier
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Reference {
    return new Reference(this.identifier, annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  renderChecks(): string {
    return ""
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(options: RecurOptions): Generation {
    const generation = options.resolver(this.identifier)
    return {
      runtime: generation.runtime,
      types: generation.types,
      annotations: this.annotations,
      importDeclarations: generation.importDeclarations
    }
  }
}

function parse(schema: unknown, options: RecurOptions): AST {
  if (schema === false) return new Never()
  if (schema === true) return new Unknown()
  if (isObject(schema)) {
    let ast = parseFragment(schema, options)
    const annotations = collectAnnotations(schema, ast)
    if (annotations) ast = ast.annotate(annotations)
    ast = ast.parseChecks(schema)
    if (Array.isArray(schema.allOf)) {
      return schema.allOf.map((m) => parse(m, options)).reduce((acc, curr) => acc.combine(curr), ast)
    }
    return ast
  }
  return new Unknown()
}

function parseFragment(schema: Schema.JsonSchema, options: RecurOptions): AST {
  if (Array.isArray(schema.anyOf)) {
    return new Union(schema.anyOf.map((m) => parse(m, options)), "anyOf")
  }
  if (Array.isArray(schema.oneOf)) {
    return new Union(schema.oneOf.map((m) => parse(m, options)), "oneOf")
  }

  if (Array.isArray(schema.type)) {
    return new Union(schema.type.filter(isType).map((type) => handleType(type, {}, options)), "anyOf")
  }

  if (schema.const !== undefined) {
    return new Const(schema.const)
  }

  if (Array.isArray(schema.enum)) {
    return new Enum(schema.enum)
  }

  schema = normalize(schema)

  if (isType(schema.type)) {
    return handleType(schema.type, schema, options)
  }

  if (typeof schema.$ref === "string") {
    const identifier = extractIdentifier(schema.$ref)
    if (identifier !== undefined) {
      return new Reference(identifier)
    }
    throw new Error(`Invalid $ref: ${schema.$ref}`)
  }

  if (isObject(schema.not)) {
    return new Not(parse(schema.not, options))
  }

  return new Unknown()
}

const stringKeys = ["minLength", "maxLength", "pattern", "format", "contentMediaType", "contentSchema"]
const numberKeys = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"]
const objectKeys = [
  "properties",
  "required",
  "additionalProperties",
  "patternProperties",
  "propertyNames",
  "minProperties",
  "maxProperties"
]
const arrayKeys = ["items", "prefixItems", "additionalItems", "minItems", "maxItems", "uniqueItems"]

// adds a "type": Type to the schema if it is not present
function normalize(schema: Schema.JsonSchema): Schema.JsonSchema {
  if (schema.type === undefined) {
    if (stringKeys.some((key) => schema[key] !== undefined)) {
      return { ...schema, type: "string" }
    }
    if (numberKeys.some((key) => schema[key] !== undefined)) {
      return { ...schema, type: "number" }
    }
    if (objectKeys.some((key) => schema[key] !== undefined)) {
      return { ...schema, type: "object" }
    }
    if (arrayKeys.some((key) => schema[key] !== undefined)) {
      return { ...schema, type: "array" }
    }
  }
  return schema
}

const types = ["null", "string", "number", "integer", "boolean", "object", "array"]

function isType(type: unknown): type is Schema.JsonSchema.Type {
  return typeof type === "string" && types.includes(type)
}

function handleType(type: Schema.JsonSchema.Type, schema: Schema.JsonSchema, options: RecurOptions): AST {
  switch (type) {
    case "null":
      return new Null()
    case "string": {
      if (schema.contentMediaType !== undefined && schema.contentMediaType === "application/json") {
        return new String([], parse(schema.contentSchema, options))
      }
      return new String([], undefined)
    }
    case "number":
      return new Number(false, [])
    case "integer":
      return new Number(true, [])
    case "boolean":
      return new Boolean()
    case "object": {
      const properties = collectProperties(schema, options)
      const indexSignatures = collectIndexSignatures(schema, options)
      return new Objects(properties, indexSignatures, [])
    }
    case "array": {
      const minItems = typeof schema.minItems === "number" ? schema.minItems : 0
      const elements = collectElements(schema, options)?.map((item, index): Element =>
        new Element(index + 1 > minItems, parse(item, options))
      )
      const rest = collectRest(schema, options)

      return new Arrays(
        elements ?? [],
        rest !== undefined ? rest === false ? undefined : parse(rest, options) : new Unknown(),
        []
      )
    }
  }
}

function collectProperties(schema: Schema.JsonSchema, options: RecurOptions): Array<Property> {
  if (isObject(schema.properties)) {
    const required = Array.isArray(schema.required) ? schema.required : []
    return Object.entries(schema.properties).map(([key, v]) =>
      new Property(!required.includes(key), key, parse(v, options))
    )
  }
  return []
}

function collectIndexSignatures(schema: Schema.JsonSchema, options: RecurOptions): Array<IndexSignature> {
  const out: Array<IndexSignature> = []

  if (isObject(schema.patternProperties)) {
    for (const [pattern, value] of Object.entries(schema.patternProperties)) {
      out.push(
        new IndexSignature(
          new String([makePatternCheck(pattern)], undefined),
          parse(value, options)
        )
      )
    }
  }

  if (isObject(schema.propertyNames)) {
    out.push(new IndexSignature(parse(schema.propertyNames, options), new Unknown()))
  }

  if (schema.additionalProperties === true) {
    out.push(new IndexSignature(new String([], undefined), new Unknown()))
    return out
  }

  if (isObject(schema.additionalProperties)) {
    out.push(new IndexSignature(new String([], undefined), parse(schema.additionalProperties, options)))
    return out
  }

  const hasNoProps = schema.properties === undefined ||
    (isObject(schema.properties) && Object.keys(schema.properties).length === 0)

  if (schema.additionalProperties === false) {
    if (hasNoProps && out.length === 0) {
      out.push(new IndexSignature(new String([], undefined), new Never()))
    }
    return out
  }

  if (hasNoProps && out.length === 0) {
    out.push(new IndexSignature(new String([], undefined), new Unknown()))
  }

  return out
}

function collectElements(schema: Schema.JsonSchema, options: RecurOptions): ReadonlyArray<unknown> | undefined {
  switch (options.source) {
    case "draft-07":
      return Array.isArray(schema.items) ? schema.items : undefined
    case "draft-2020-12":
    case "openapi-3.1":
      return Array.isArray(schema.prefixItems) ? schema.prefixItems : undefined
  }
}

function collectRest(schema: Schema.JsonSchema, options: RecurOptions): Schema.JsonSchema | boolean | undefined {
  switch (options.source) {
    case "draft-07":
      return isObject(schema.items) || (typeof schema.items === "boolean")
        ? schema.items
        : isObject(schema.additionalItems) || (typeof schema.additionalItems === "boolean")
        ? schema.additionalItems
        : undefined
    case "draft-2020-12":
    case "openapi-3.1":
      return isObject(schema.items) || (typeof schema.items === "boolean")
        ? schema.items
        : undefined
  }
}

function collectAnnotations(schema: Schema.JsonSchema, ast: AST): Annotations | undefined {
  const as: Mutable<Annotations> = {}

  if (typeof schema.title === "string") as.title = schema.title
  if (typeof schema.description === "string") {
    if (
      ast._tag !== "String" || ast.contentSchema === undefined ||
      schema.description !== "a string that will be decoded as JSON"
    ) {
      as.description = schema.description
    }
  }
  if (schema.default !== undefined) as.default = schema.default
  if (Array.isArray(schema.examples)) as.examples = schema.examples
  if (typeof schema.format === "string") as.format = schema.format

  if (Object.keys(as).length === 0) return undefined
  return as
}
