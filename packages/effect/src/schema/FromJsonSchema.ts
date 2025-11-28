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
import type * as Anno from "./Annotations.ts"
import type * as Schema from "./Schema.ts"

type Target = Anno.JsonSchema.Target
type Fragment = Schema.JsonSchema.Fragment

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
export type Generation = {
  readonly runtime: string
  readonly types: Types
  readonly imports: ReadonlySet<string>
}

/**
 * @since 4.0.0
 */
export function makeGeneration(runtime: string, types: Types, imports: ReadonlySet<string> = emptySet): Generation {
  return { runtime, types, imports }
}

/**
 * @since 4.0.0
 */
export type GenerateOptions = {
  readonly resolver?: Resolver | undefined
  readonly target?: Target | undefined
}

/**
 * @since 4.0.0
 */
export type Resolver = (identifier: string) => Generation

/**
 * @since 4.0.0
 */
export function generate(schema: unknown, options?: GenerateOptions): Generation {
  return parse(schema, {
    target: options?.target ?? "draft-07"
  }).toGeneration(options?.resolver ?? resolvers.identity)
}

/**
 * @since 4.0.0
 */
export const resolvers: Record<"identity" | "suspend", Resolver> = {
  identity: (identifier: string) => {
    return {
      runtime: identifier,
      types: makeTypes(identifier),
      imports: emptySet
    }
  },
  suspend: (identifier: string) => {
    return {
      runtime: `Schema.suspend((): Schema.Codec<${identifier}> => ${identifier})`,
      types: makeTypes(identifier),
      imports: emptySet
    }
  }
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
    readonly schema: Schema.JsonSchema.Schema
  }>
  /**
   * The recursive definitions (with no particular order).
   */
  readonly recursives: {
    readonly [identifier: string]: Schema.JsonSchema.Schema
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

  const nonRecursives: Array<{ readonly identifier: string; readonly schema: Schema.JsonSchema.Schema }> = []
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    nonRecursives.push({ identifier: id, schema: definitions[id] })

    for (const next of dependents.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }

  const recursives: Record<string, Schema.JsonSchema.Schema> = {}
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
  const resolver: Resolver = (identifier) => {
    if (recursives.has(identifier)) {
      return resolvers.suspend(identifier)
    }
    return resolvers.identity(identifier)
  }
  const opts: GenerateOptions = {
    ...options,
    resolver
  }
  return ts.nonRecursives.concat(
    Object.entries(ts.recursives).map(([identifier, schema]) => ({ identifier, schema }))
  ).map(({ identifier, schema }) => {
    const output = generate(schema, opts)
    return {
      identifier,
      generation: {
        runtime: output.runtime + `.annotate({ "identifier": ${format(identifier)} })`,
        types: output.types,
        imports: output.imports
      }
    }
  })
}

type Annotations = {
  readonly description?: string | undefined
  readonly title?: string | undefined
  readonly examples?: ReadonlyArray<unknown> | undefined
  readonly default?: unknown | undefined
  readonly format?: string | undefined
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
  parseChecks(_: Fragment): AST {
    return this
  }
  combine(that: AST): AST {
    return that
  }
  toGeneration(_: Resolver): Generation {
    return {
      runtime: "Schema.Unknown" + renderAnnotations(this),
      types: makeTypes("unknown"),
      imports: emptySet
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
  parseChecks(_: Fragment): AST {
    return this
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(_: Resolver): Generation {
    return {
      runtime: "Schema.Never" + renderAnnotations(this),
      types: makeTypes("never"),
      imports: emptySet
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
  parseChecks(_: Fragment): AST {
    return this
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(resolver: Resolver): Generation {
    return new Never(this.annotations).toGeneration(resolver)
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
  parseChecks(_: Fragment): AST {
    return this
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(_: Resolver): Generation {
    return {
      runtime: "Schema.Null" + renderAnnotations(this),
      types: makeTypes("null"),
      imports: emptySet
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
  static parseChecks(f: Fragment): Array<StringCheck> {
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
  parseChecks(f: Fragment): AST {
    return new String([...this.checks, ...String.parseChecks(f)], this.contentSchema, this.annotations)
  }
  renderChecks(): string {
    return renderChecks(this.checks, (c) => {
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
  toGeneration(resolver: Resolver): Generation {
    const suffix = this.renderChecks() + renderAnnotations(this)
    if (this.contentSchema !== undefined) {
      const contentSchema = this.contentSchema.toGeneration(resolver)
      return {
        runtime: `Schema.fromJsonString(${contentSchema.runtime})` + suffix,
        types: makeTypes(
          contentSchema.types.Type,
          "string",
          contentSchema.types.DecodingServices,
          contentSchema.types.EncodingServices
        ),
        imports: emptySet
      }
    }
    return {
      runtime: "Schema.String" + suffix,
      types: makeTypes("string"),
      imports: emptySet
    }
  }
}

function renderChecks<A>(checks: ReadonlyArray<A>, f: (a: A) => string): string {
  return checks.length === 0 ? "" : `.check(${checks.map(f).join(", ")})`
}

function renderAnnotations(ast: AST): string {
  const entries = Object.entries(ast.annotations)

  if (entries.length === 0) return ""

  return `.annotate({ ${entries.map(([key, value]) => `${formatPropertyKey(key)}: ${format(value)}`).join(", ")} })`
}

type NumberCheck =
  | { readonly _tag: "greaterThanOrEqualTo"; readonly value: number }
  | { readonly _tag: "lessThanOrEqualTo"; readonly value: number }
  | { readonly _tag: "greaterThan"; readonly value: number }
  | { readonly _tag: "lessThan"; readonly value: number }
  | { readonly _tag: "multipleOf"; readonly value: number }

class Number {
  static parseChecks(f: Fragment): Array<NumberCheck> {
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
  parseChecks(f: Fragment): AST {
    return new Number(this.isInteger, [...this.checks, ...Number.parseChecks(f)], this.annotations)
  }
  renderChecks(): string {
    return renderChecks(this.checks, (c) => {
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
  toGeneration(_: Resolver): Generation {
    return {
      runtime: (this.isInteger ? "Schema.Int" : "Schema.Number") + this.renderChecks() + renderAnnotations(this),
      types: makeTypes("number"),
      imports: emptySet
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
  parseChecks(_: Fragment): AST {
    return this
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(_: Resolver): Generation {
    return {
      runtime: "Schema.Boolean" + renderAnnotations(this),
      types: makeTypes("boolean"),
      imports: emptySet
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
  parseChecks(_: Fragment): AST {
    return this
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(_: Resolver): Generation {
    return {
      runtime: `Schema.Literal(${format(this.value)})` + renderAnnotations(this),
      types: makeTypes(format(this.value)),
      imports: emptySet
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
  parseChecks(_: Fragment): AST {
    return this
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(_: Resolver): Generation {
    const values = this.values.map((v) => format(v))
    if (values.length === 1) {
      return {
        runtime: `Schema.Literal(${values[0]})` + renderAnnotations(this),
        types: makeTypes(values[0]),
        imports: emptySet
      }
    } else {
      return {
        runtime: `Schema.Literals([${values.join(", ")}])` + renderAnnotations(this),
        types: makeTypes(values.join(" | ")),
        imports: emptySet
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
  static parseChecks(f: Fragment): Array<ArraysCheck> {
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
        return c.value > len
      }
      return true
    })
    this.annotations = annotations
  }
  annotate(annotations: Annotations): Arrays {
    return new Arrays(this.elements, this.rest, this.checks, annotationsCombiner.combine(this.annotations, annotations))
  }
  parseChecks(schema: Fragment): AST {
    return new Arrays(this.elements, this.rest, [...this.checks, ...Arrays.parseChecks(schema)], this.annotations)
  }
  renderChecks(): string {
    return renderChecks(this.checks, (c) => {
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
  toGeneration(resolver: Resolver): Generation {
    const es = this.elements.map((e): ElementIR => ({
      value: e.ast.toGeneration(resolver),
      isOptional: e.isOptional
    }))
    const rest = this.rest?.toGeneration(resolver)
    const el = renderElements(es)

    const suffix = this.renderChecks() + renderAnnotations(this)

    if (es.length === 0 && rest === undefined) {
      return {
        runtime: `Schema.Tuple([])` + suffix,
        types: makeTypes("readonly []"),
        imports: emptySet
      }
    }

    if (es.length === 0 && rest !== undefined) {
      return {
        runtime: `Schema.Array(${rest.runtime})` + suffix,
        types: makeTypes(
          `ReadonlyArray<${rest.types.Type}>`,
          `ReadonlyArray<${rest.types.Encoded}>`,
          rest.types.DecodingServices,
          rest.types.EncodingServices
        ),
        imports: rest.imports
      }
    }

    if (rest === undefined) {
      return {
        runtime: `Schema.Tuple([${el.runtime}])` + suffix,
        types: makeTypes(
          `readonly [${el.types.Type}]`,
          `readonly [${el.types.Encoded}]`,
          el.types.DecodingServices,
          el.types.EncodingServices
        ),
        imports: el.imports
      }
    }

    return {
      runtime: `Schema.TupleWithRest(Schema.Tuple([${el.runtime}]), [${rest.runtime}])` + suffix,
      types: makeTypes(
        `readonly [${el.types.Type}, ...Array<${rest.types.Type}>]`,
        `readonly [${el.types.Encoded}, ...Array<${rest.types.Encoded}>]`,
        joinServices([el.types.DecodingServices, rest.types.DecodingServices]),
        joinServices([el.types.EncodingServices, rest.types.EncodingServices])
      ),
      imports: ReadonlySetReducer.combine(el.imports, rest.imports)
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
    imports: ReadonlySetReducer.combineAll(es.map((e) => e.value.imports))
  }
}

function join<A>(values: ReadonlyArray<A>, f: (a: A) => string): string {
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
  static parseChecks(f: Fragment): Array<ObjectsCheck> {
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
  parseChecks(f: Fragment): AST {
    return new Objects(
      this.properties,
      this.indexSignatures,
      [...this.checks, ...Objects.parseChecks(f)],
      this.annotations
    )
  }
  renderChecks(): string {
    return renderChecks(this.checks, (c) => {
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
  toGeneration(resolver: Resolver): Generation {
    const ps: ReadonlyArray<PropertyGen> = this.properties.map((p) => ({
      key: p.key,
      value: p.value.toGeneration(resolver),
      isOptional: p.isOptional
    }))

    const iss: ReadonlyArray<IndexSignatureGen> = this.indexSignatures.map((is) => ({
      key: is.key.toGeneration(resolver),
      value: is.value.toGeneration(resolver)
    }))

    const p = renderProperties(ps)
    const i = renderIndexSignatures(iss)

    const suffix = this.renderChecks() + renderAnnotations(this)

    // 1) Only properties -> Struct
    if (iss.length === 0) {
      return {
        runtime: `Schema.Struct({ ${p.runtime} })` + suffix,
        types: makeTypes(
          `{ ${p.types.Type} }`,
          `{ ${p.types.Encoded} }`,
          p.types.DecodingServices,
          p.types.EncodingServices
        ),
        imports: p.imports
      }
    }

    // 2) Only one index signature and no properties -> Record
    if (ps.length === 0 && iss.length === 1) {
      const is = iss[0]
      return {
        runtime: indexSignatureRuntime(is) + suffix,
        types: makeTypes(
          `{ ${renderIndexSignature(is.key.types.Type, is.value.types.Type)} }`,
          `{ ${renderIndexSignature(is.key.types.Encoded, is.value.types.Encoded)} }`,
          joinServices([is.key.types.DecodingServices, is.value.types.DecodingServices]),
          joinServices([is.key.types.EncodingServices, is.value.types.EncodingServices])
        ),
        imports: indexSignatureImports(is)
      }
    }

    // 3) Properties + index signatures -> StructWithRest
    return {
      runtime: `Schema.StructWithRest(Schema.Struct({ ${p.runtime} }), [${i.runtime}])` + suffix,
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
      imports: ReadonlySetReducer.combineAll([p.imports, i.imports])
    }
  }
}

function renderProperties(ps: ReadonlyArray<PropertyGen>): Generation {
  return {
    runtime: ps.map((p) => `${formatPropertyKey(p.key)}: ${optionalRuntime(p.isOptional, p.value.runtime)}`).join(", "),
    types: makeTypes(
      join(ps, (p) => renderProperty(p.isOptional, p.key, p.value.types.Type)),
      join(ps, (p) => renderProperty(p.isOptional, p.key, p.value.types.Encoded)),
      joinServices(ps.map((p) => p.value.types.DecodingServices)),
      joinServices(ps.map((p) => p.value.types.EncodingServices))
    ),
    imports: ReadonlySetReducer.combineAll(ps.map((p) => p.value.imports))
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
    imports: ReadonlySetReducer.combineAll(iss.map(indexSignatureImports))
  }
}

function renderIndexSignature(key: string, value: string): string {
  return `readonly [x: ${key}]: ${value}`
}

function indexSignatureRuntime(is: IndexSignatureGen) {
  return `Schema.Record(${is.key.runtime}, ${is.value.runtime})`
}

function indexSignatureImports(is: IndexSignatureGen): ReadonlySet<string> {
  return ReadonlySetReducer.combine(is.key.imports, is.value.imports)
}

type PropertyGen = {
  readonly key: string
  readonly value: Generation
  readonly isOptional: boolean
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
  parseChecks(_: Fragment): AST {
    return this
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
  toGeneration(resolver: Resolver): Generation {
    const members = this.members.map((m) => m.toGeneration(resolver))
    return {
      runtime:
        `Schema.Union([${members.map((m) => m.runtime).join(", ")}]${
          this.mode === "oneOf" ? `, { mode: "oneOf" }` : ""
        })` + renderAnnotations(this),
      types: makeTypes(
        members.map((m) => m.types.Type).join(" | "),
        members.map((m) => m.types.Encoded).join(" | "),
        joinServices(members.map((m) => m.types.DecodingServices)),
        joinServices(members.map((m) => m.types.EncodingServices))
      ),
      imports: ReadonlySetReducer.combineAll(members.map((m) => m.imports))
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
  parseChecks(_: Fragment): AST {
    return this
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(resolver: Resolver): Generation {
    const generation = resolver(this.identifier)
    return {
      runtime: generation.runtime + renderAnnotations(this),
      types: generation.types,
      imports: generation.imports
    }
  }
}

interface RecurOptions {
  readonly target: Target
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

function parseFragment(schema: Fragment, options: RecurOptions): AST {
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
function normalize(schema: Fragment): Fragment {
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

function handleType(type: Schema.JsonSchema.Type, schema: Fragment, options: RecurOptions): AST {
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

function collectProperties(schema: Fragment, options: RecurOptions): Array<Property> {
  if (isObject(schema.properties)) {
    const required = Array.isArray(schema.required) ? schema.required : []
    return Object.entries(schema.properties).map(([key, v]) =>
      new Property(!required.includes(key), key, parse(v, options))
    )
  }
  return []
}

function collectIndexSignatures(schema: Fragment, options: RecurOptions): Array<IndexSignature> {
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

function collectElements(schema: Fragment, options: RecurOptions): ReadonlyArray<unknown> | undefined {
  switch (options.target) {
    case "draft-07":
      return Array.isArray(schema.items) ? schema.items : undefined
    case "2020-12":
    case "oas3.1":
      return Array.isArray(schema.prefixItems) ? schema.prefixItems : undefined
  }
}

function collectRest(schema: Fragment, options: RecurOptions): Fragment | boolean | undefined {
  switch (options.target) {
    case "draft-07":
      return isObject(schema.items) || (typeof schema.items === "boolean")
        ? schema.items
        : isObject(schema.additionalItems) || (typeof schema.additionalItems === "boolean")
        ? schema.additionalItems
        : undefined
    case "2020-12":
    case "oas3.1":
      return isObject(schema.items) || (typeof schema.items === "boolean")
        ? schema.items
        : undefined
  }
}

function collectAnnotations(schema: Fragment, ast: AST): Annotations | undefined {
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
