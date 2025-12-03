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
import type * as AST from "./AST.ts"
import type * as Schema from "./Schema.ts"

/**
 * @since 4.0.0
 */
export type Source = Schema.JsonSchema.Target | "openapi-3.0"

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
  /** The runtime code to generate the schema (e.g. `Schema.Struct({ "a": Schema.String })`) */
  readonly runtime: string
  /** The `Type`, `Encoded`, `DecodingServices`, and `EncodingServices` types related to the generated schema */
  readonly types: Types
  /** The JSON Schema annotations found on the JSON Schema (e.g. `{ "description": "a description", "examples": [{ "a": "foo" }] }`) */
  readonly annotations: Annotations
  /** The import declarations needed to generate the schema */
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
export function makeGenerationIdentifier(identifier: string): Generation {
  return makeGeneration(identifier, makeTypes(identifier))
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
 * `ref` is a `/`-separated string that represents a JSON Pointer.
 *
 * Examples:
 * - `"#/definitions/A"` -> `"A"`
 * - `"#/definitions/A/definitions/B"` -> `"A/definitions/B"`
 * - `"#/$defs/A"` -> `"A"`
 * - `"#/$defs/A/$defs/B"` -> `"A/$defs/B"`
 * - `"#/components/schemas/A"` -> `"A"`
 * - `"#/components/schemas/A/$defs/B"` -> `"A/$defs/B"`
 *
 * @since 4.0.0
 */
export type Resolver = (ref: string) => Generation

/**
 * @since 4.0.0
 */
export type GenerateOptions = {
  readonly source: Source
  readonly resolver?: Resolver | undefined
  /**
   * This becomes required if the schema contains references in an `allOf` array
   * because references must be resolved in order to merge the schemas.
   */
  readonly definitions?: Schema.JsonSchema.Definitions | undefined
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
  readonly source: Source
  readonly root: Schema.JsonSchema | undefined
  readonly resolver: Resolver
  readonly extractJsDocs: ((annotations: Annotations) => string) | undefined
  readonly definitions: Schema.JsonSchema.Definitions
  readonly inlineRefs: boolean
  readonly refStack: ReadonlySet<string>
}

/**
 * @since 4.0.0
 */
export function generate(schema: Schema.JsonSchema | boolean, options: GenerateOptions): Generation {
  const extractJsDocs = options.extractJsDocs ?? false
  const recurOptions: RecurOptions = {
    source: options.source,
    root: isObject(schema) ? schema : undefined,
    resolver: options.resolver ?? defaultResolver,
    extractJsDocs: extractJsDocs === true ? defaultExtractJsDocs : extractJsDocs === false ? undefined : extractJsDocs,
    definitions: options.definitions ?? {},
    inlineRefs: false,
    refStack: emptySet
  }
  return parse(schema, recurOptions).toGeneration(recurOptions)
}

const defaultResolver: Resolver = (ref: string) => {
  return makeGeneration(ref, makeTypes(ref))
}

function defaultExtractJsDocs(annotations: Annotations): string {
  if (annotations.description === undefined) return ""
  return `\n/** ${annotations.description} */\n`
}

function renderJsDocs(annotations: Annotations, options: RecurOptions): string {
  if (!options.extractJsDocs) return ""
  return options.extractJsDocs(annotations)
}

function renderAnnotations(annotations: Annotations): string {
  const entries = Object.entries(annotations)

  if (entries.length === 0) return ""

  return `.annotate({ ${entries.map(([key, value]) => `${formatPropertyKey(key)}: ${format(value)}`).join(", ")} })`
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
    readonly ref: string
    readonly schema: Schema.JsonSchema
  }>
  /**
   * The recursive definitions (with no particular order).
   */
  readonly recursives: {
    readonly [ref: string]: Schema.JsonSchema
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
        const last = getRefParts(value.$ref).pop()
        if (last !== undefined && identifierSet.has(last)) {
          refs.add(last)
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

  const nonRecursives: Array<{ readonly ref: string; readonly schema: Schema.JsonSchema }> = []
  for (let i = 0; i < queue.length; i++) {
    const ref = queue[i]
    nonRecursives.push({ ref, schema: definitions[ref] })

    for (const next of dependents.get(ref) ?? []) {
      const deg = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }

  const recursives: Record<string, Schema.JsonSchema> = {}
  for (const ref of recursive) {
    recursives[ref] = definitions[ref]
  }

  return { nonRecursives, recursives }
}

function getRefParts($ref: string): Array<string> {
  return $ref.slice(2).split("/").map(unescapeJsonPointerPart)
}

function unescapeJsonPointerPart(part: string): string {
  return part.replace(/~0/ig, "~").replace(/~1/ig, "/")
}

/**
 * @since 4.0.0
 */
export type DefinitionGeneration = {
  /** The ref of the definition */
  readonly ref: string
  /** The generation of the definition */
  readonly generation: Generation
}

/**
 * @since 4.0.0
 */
export type GenerateDefinitionsOptions = Omit<GenerateOptions, "definitions">

/**
 * Returns an array of DefinitionGeneration values for the given definitions.
 * The definitions are sorted in topological order, so a definition is emitted after the definitions it depends on.
 *
 * The definitions must be passed depending on the source:
 * - draft-07: the `.definitions` property of the schema.
 * - draft-2020-12: the `$defs` property of the schema.
 * - openapi-3.0: the `components.schemas` property of the specification.
 * - openapi-3.1: the `components.schemas` property of the specification.
 *
 * @since 4.0.0
 */
export function generateDefinitions(
  definitions: Schema.JsonSchema.Definitions,
  options: GenerateDefinitionsOptions
): Array<DefinitionGeneration> {
  const ts = topologicalSort(definitions)
  const recursives = new Set(Object.keys(ts.recursives))
  const resolver = options.resolver ?? defaultResolver
  const opts: GenerateDefinitionsOptions = {
    ...options,
    resolver: (ref) => {
      const out = resolver(ref)
      if (recursives.has(ref)) {
        const services = [out.types.Type, out.types.Encoded, out.types.DecodingServices, out.types.EncodingServices]
        if (services[3] === "never") services.pop()
        if (services[2] === "never") services.pop()
        if (services[1] === services[0]) services.pop()
        return makeGeneration(
          `Schema.suspend((): Schema.Codec<${services.join(", ")}> => ${ref})`,
          out.types
        )
      }
      return out
    }
  }
  return ts.nonRecursives.concat(
    Object.entries(ts.recursives).map(([ref, schema]) => ({ ref, schema }))
  ).map(({ ref, schema }) => {
    const output = generate(schema, opts)
    return {
      ref,
      generation: makeGeneration(
        output.runtime + `.annotate({ "identifier": ${format(ref)} })`,
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

const annotationsCombiner: Combiner.Combiner<Annotations> = Struct.getCombiner({
  description: joinReducer,
  title: joinReducer,
  default: UndefinedOr.getReducer(Combiner.last()),
  examples: UndefinedOr.getReducer(Arr.getReducerConcat()),
  format: Combiner.last<string>()
}, {
  omitKeyWhen: isUndefined
}) as any

type AST =
  | Unknown
  | Never
  | Null
  | String
  | Number
  | Boolean
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
  annotate(annotations: Annotations | undefined): Unknown {
    return new Unknown(annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined)
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  combine(that: AST): AST {
    return that.annotate(this.annotations)
  }
  toGeneration(_: RecurOptions): Generation {
    const suffix = renderAnnotations(this.annotations)
    return {
      runtime: "Schema.Unknown" + suffix,
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
  annotate(annotations: Annotations | undefined): Never {
    return new Never(annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined)
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  combine(that: AST): AST {
    const annotations = annotationsCombiner.combine(this.annotations, that.annotations)
    return new Never(annotations)
  }
  toGeneration(_: RecurOptions): Generation {
    const suffix = renderAnnotations(this.annotations)
    return {
      runtime: "Schema.Never" + suffix,
      types: makeTypes("never"),
      annotations: this.annotations,
      importDeclarations: emptySet
    }
  }
}

class Null {
  readonly _tag = "Null"
  readonly annotations: Annotations
  constructor(annotations: Annotations = {}) {
    this.annotations = annotations
  }
  annotate(annotations: Annotations | undefined): Null {
    return new Null(annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined)
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  combine(that: AST): AST {
    const annotations = annotationsCombiner.combine(this.annotations, that.annotations)
    switch (that._tag) {
      case "Null":
        return new Null(annotations)
      default:
        return new Never(annotations)
    }
  }
  toGeneration(_: RecurOptions): Generation {
    const suffix = renderAnnotations(this.annotations)
    return {
      runtime: "Schema.Null" + suffix,
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
  readonly isNullable: boolean
  readonly checks: ReadonlyArray<StringCheck>
  readonly contentSchema: AST | undefined
  readonly annotations: Annotations
  constructor(
    isNullable: boolean,
    checks: ReadonlyArray<StringCheck>,
    contentSchema: AST | undefined,
    annotations: Annotations = {}
  ) {
    this.isNullable = isNullable
    this.checks = checks
    this.contentSchema = contentSchema
    this.annotations = annotations
  }
  annotate(annotations: Annotations | undefined): String {
    return new String(
      this.isNullable,
      this.checks,
      this.contentSchema,
      annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined
    )
  }
  parseChecks(f: Schema.JsonSchema): AST {
    return new String(this.isNullable, [...this.checks, ...String.parseChecks(f)], this.contentSchema, this.annotations)
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
  combine(that: AST, options: RecurOptions): AST {
    const annotations = annotationsCombiner.combine(this.annotations, that.annotations)
    switch (that._tag) {
      case "String":
        return new String(
          this.isNullable && that.isNullable,
          [...this.checks, ...that.checks],
          this.contentSchema === undefined
            ? that.contentSchema
            : that.contentSchema === undefined
            ? this.contentSchema
            : this.contentSchema.combine(that.contentSchema, options),
          annotations
        )
      case "Unknown":
        return new String(this.isNullable, this.checks, this.contentSchema, annotations)
      case "Enum":
        return Enum.make(that.values.filter((v) => typeof v === "string"), annotations)
      case "Union":
        return Union.make(that.members.map((m) => this.combine(m, options)), that.mode, annotations)
      default:
        return new Never(annotations)
    }
  }
  toGeneration(options: RecurOptions): Generation {
    const suffix = this.renderChecks() + renderAnnotations(this.annotations)
    if (this.contentSchema !== undefined) {
      const contentSchema = this.contentSchema.toGeneration(options)
      return {
        runtime: `Schema.fromJsonString(${contentSchema.runtime + suffix})`,
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
      runtime: "Schema.String" + suffix,
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

    if (typeof f.exclusiveMinimum === "number") {
      cs.push({ _tag: "greaterThan", value: f.exclusiveMinimum })
    } else if (f.exclusiveMinimum === true && typeof f.minimum === "number") {
      cs.push({ _tag: "greaterThan", value: f.minimum })
    } else if (typeof f.minimum === "number") {
      cs.push({ _tag: "greaterThanOrEqualTo", value: f.minimum })
    }

    if (typeof f.exclusiveMaximum === "number") {
      cs.push({ _tag: "lessThan", value: f.exclusiveMaximum })
    } else if (f.exclusiveMaximum === true && typeof f.maximum === "number") {
      cs.push({ _tag: "lessThan", value: f.maximum })
    } else if (typeof f.maximum === "number") {
      cs.push({ _tag: "lessThanOrEqualTo", value: f.maximum })
    }

    if (typeof f.multipleOf === "number") cs.push({ _tag: "multipleOf", value: f.multipleOf })
    return cs
  }
  readonly _tag = "Number"
  readonly isNullable: boolean
  readonly isInteger: boolean
  readonly checks: ReadonlyArray<NumberCheck>
  readonly annotations: Annotations
  constructor(
    isNullable: boolean,
    isInteger: boolean,
    checks: ReadonlyArray<NumberCheck>,
    annotations: Annotations = {}
  ) {
    this.isNullable = isNullable
    this.isInteger = isInteger
    this.checks = checks
    this.annotations = annotations
  }
  annotate(annotations: Annotations | undefined): Number {
    return new Number(
      this.isNullable,
      this.isInteger,
      this.checks,
      annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined
    )
  }
  parseChecks(f: Schema.JsonSchema): AST {
    return new Number(this.isNullable, this.isInteger, [...this.checks, ...Number.parseChecks(f)], this.annotations)
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
  combine(that: AST, options: RecurOptions): AST {
    const annotations = annotationsCombiner.combine(this.annotations, that.annotations)
    switch (that._tag) {
      case "Number":
        return new Number(this.isNullable && that.isNullable, this.isInteger || that.isInteger, [
          ...this.checks,
          ...that.checks
        ], annotations)
      case "Unknown":
        return new Number(this.isNullable, this.isInteger, this.checks, annotations)
      case "Enum":
        return Enum.make(that.values.filter((v) => typeof v === "number"), annotations)
      case "Union":
        return Union.make(that.members.map((m) => this.combine(m, options)), that.mode, annotations)
      default:
        return new Never(annotations)
    }
  }
  toGeneration(_: RecurOptions): Generation {
    const suffix = this.renderChecks() + renderAnnotations(this.annotations)
    return {
      runtime: (this.isInteger ? "Schema.Int" : "Schema.Number") + suffix,
      types: makeTypes("number"),
      annotations: this.annotations,
      importDeclarations: emptySet
    }
  }
}

class Boolean {
  readonly _tag = "Boolean"
  readonly isNullable: boolean
  readonly annotations: Annotations
  constructor(isNullable: boolean, annotations: Annotations = {}) {
    this.isNullable = isNullable
    this.annotations = annotations
  }
  annotate(annotations: Annotations | undefined): Boolean {
    return new Boolean(
      this.isNullable,
      annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined
    )
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  combine(that: AST, options: RecurOptions): AST {
    const annotations = annotationsCombiner.combine(this.annotations, that.annotations)
    switch (that._tag) {
      case "Boolean":
        return new Boolean(this.isNullable && that.isNullable, annotations)
      case "Unknown":
        return new Boolean(this.isNullable, annotations)
      case "Enum":
        return Enum.make(that.values.filter((v) => typeof v === "boolean"), annotations)
      case "Union":
        return Union.make(
          that.members.map((m) => this.combine(m, options)),
          that.mode,
          annotations
        )
      default:
        return new Never(annotations)
    }
  }
  toGeneration(_: RecurOptions): Generation {
    const suffix = renderAnnotations(this.annotations)
    return {
      runtime: "Schema.Boolean" + suffix,
      types: makeTypes("boolean"),
      annotations: this.annotations,
      importDeclarations: emptySet
    }
  }
}

function isLiteralValue(value: unknown): value is AST.LiteralValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
}

class Enum {
  static make(values: ReadonlyArray<AST.LiteralValue>, annotations: Annotations = {}): AST {
    if (values.length === 0) return new Never(annotations)
    return new Enum(values, annotations)
  }
  readonly _tag = "Enum"
  readonly values: ReadonlyArray<AST.LiteralValue>
  readonly annotations: Annotations
  private constructor(values: ReadonlyArray<AST.LiteralValue>, annotations: Annotations = {}) {
    this.annotations = annotations
    this.values = values
  }
  annotate(annotations: Annotations | undefined): Enum {
    return new Enum(this.values, annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined)
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  combine(that: AST, options: RecurOptions): AST {
    const annotations = annotationsCombiner.combine(this.annotations, that.annotations)
    switch (that._tag) {
      case "Enum": {
        const intersection = new Set<AST.LiteralValue>()
        const thatValues = new Set(that.values)
        for (const value of this.values) {
          if (thatValues.has(value)) {
            intersection.add(value)
          }
        }
        return Enum.make(Array.from(intersection), annotations)
      }
      case "Unknown":
        return new Enum(this.values, annotations)
      case "String":
        return Enum.make(this.values.filter((v) => typeof v === "string"), annotations)
      case "Number":
        return Enum.make(this.values.filter((v) => typeof v === "number"), annotations)
      case "Boolean":
        return Enum.make(this.values.filter((v) => typeof v === "boolean"), annotations)
      case "Union":
        return Union.make(
          that.members.map((m) => this.combine(m, options)),
          that.mode,
          annotations
        )
      default:
        return new Never(annotations)
    }
  }
  toGeneration(_: RecurOptions): Generation {
    const values = this.values.map((v) => format(v))
    const suffix = renderAnnotations(this.annotations)
    if (values.length === 1) {
      return {
        runtime: `Schema.Literal(${values[0]})` + suffix,
        types: makeTypes(values[0]),
        annotations: this.annotations,
        importDeclarations: emptySet
      }
    } else {
      return {
        runtime: `Schema.Literals([${values.join(", ")}])` + suffix,
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
  annotate(annotations: Annotations | undefined): Element {
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
  readonly isNullable: boolean
  readonly elements: ReadonlyArray<Element>
  readonly rest: AST | undefined
  readonly checks: ReadonlyArray<ArraysCheck>
  readonly annotations: Annotations
  constructor(
    isNullable: boolean,
    elements: ReadonlyArray<Element>,
    rest: AST | undefined,
    checks: ReadonlyArray<ArraysCheck>,
    annotations: Annotations = {}
  ) {
    this.isNullable = isNullable
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
  annotate(annotations: Annotations | undefined): Arrays {
    return new Arrays(
      this.isNullable,
      this.elements,
      this.rest,
      this.checks,
      annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined
    )
  }
  parseChecks(schema: Schema.JsonSchema): AST {
    return new Arrays(
      this.isNullable,
      this.elements,
      this.rest,
      [...this.checks, ...Arrays.parseChecks(schema)],
      this.annotations
    )
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
  combine(that: AST, options: RecurOptions): AST {
    const annotations = annotationsCombiner.combine(this.annotations, that.annotations)
    switch (that._tag) {
      case "Unknown":
        return new Arrays(
          this.isNullable,
          this.elements,
          this.rest,
          this.checks,
          annotations
        )
      case "Arrays": {
        if (this.elements.length > 0 && that.elements.length > 0) {
          return new Never(annotations)
        }
        return new Arrays(
          this.isNullable && that.isNullable,
          this.elements.concat(that.elements),
          this.rest === undefined
            ? that.rest
            : that.rest === undefined
            ? this.rest
            : this.rest.combine(that.rest, options),
          [...this.checks, ...that.checks],
          annotations
        )
      }
      case "Union":
        return Union.make(
          that.members.map((m) => this.combine(m, options)),
          that.mode,
          annotations
        )
      default:
        return new Never(annotations)
    }
  }
  toGeneration(options: RecurOptions): Generation {
    const es = this.elements.map((e): ElementIR => ({
      value: e.ast.toGeneration(options),
      isOptional: e.isOptional
    }))
    const rest = this.rest !== undefined ? this.rest.toGeneration(options) : undefined
    const el = renderElements(es)

    const suffix = this.renderChecks() + renderAnnotations(this.annotations)

    if (es.length === 0 && rest === undefined) {
      return {
        runtime: `Schema.Tuple([])` + suffix,
        types: makeTypes("readonly []"),
        annotations: this.annotations,
        importDeclarations: emptySet
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
        annotations: this.annotations,
        importDeclarations: rest.importDeclarations
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
        annotations: this.annotations,
        importDeclarations: el.importDeclarations
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
  readonly isNullable: boolean
  readonly properties: ReadonlyArray<Property>
  readonly indexSignatures: ReadonlyArray<IndexSignature>
  readonly additionalProperties: boolean
  readonly checks: ReadonlyArray<ObjectsCheck>
  readonly annotations: Annotations
  constructor(
    isNullable: boolean,
    properties: ReadonlyArray<Property>,
    indexSignatures: ReadonlyArray<IndexSignature>,
    additionalProperties: boolean,
    checks: ReadonlyArray<ObjectsCheck>,
    annotations: Annotations = {}
  ) {
    this.isNullable = isNullable
    this.properties = properties
    this.indexSignatures = indexSignatures
    this.additionalProperties = additionalProperties
    this.checks = checks
    this.annotations = annotations
  }
  annotate(annotations: Annotations | undefined): Objects {
    return new Objects(
      this.isNullable,
      this.properties,
      this.indexSignatures,
      this.additionalProperties,
      this.checks,
      annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined
    )
  }
  parseChecks(f: Schema.JsonSchema): AST {
    return new Objects(
      this.isNullable,
      this.properties,
      this.indexSignatures,
      this.additionalProperties,
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
  combine(that: AST, options: RecurOptions): AST {
    const annotations = annotationsCombiner.combine(this.annotations, that.annotations)
    switch (that._tag) {
      case "Unknown":
        return new Objects(
          this.isNullable,
          this.properties,
          this.indexSignatures,
          this.additionalProperties,
          this.checks,
          annotations
        )
      case "Objects":
        return new Objects(
          this.isNullable && that.isNullable,
          this.properties.concat(that.properties),
          this.indexSignatures.concat(that.indexSignatures),
          this.additionalProperties && that.additionalProperties,
          [...this.checks, ...that.checks],
          annotations
        )
      case "Union":
        return Union.make(
          that.members.map((m) => this.combine(m, options)),
          that.mode,
          annotations
        )
      default:
        return new Never(annotations)
    }
  }
  toGeneration(options: RecurOptions): Generation {
    if (this.properties.length === 0 && this.indexSignatures.length === 0) {
      if (this.additionalProperties === false) {
        return new Objects(
          this.isNullable,
          [],
          [new IndexSignature(new String(false, [], undefined), new Never())],
          false,
          this.checks,
          this.annotations
        ).toGeneration(options)
      } else {
        return new Objects(
          this.isNullable,
          [],
          [new IndexSignature(new String(false, [], undefined), new Unknown())],
          false,
          this.checks,
          this.annotations
        ).toGeneration(options)
      }
    }

    const ps: ReadonlyArray<PropertyGen> = this.properties.map((p) => ({
      key: p.key,
      value: p.value.toGeneration(options),
      isOptional: p.isOptional,
      annotations: p.value.annotations
    }))

    const iss: ReadonlyArray<IndexSignatureGen> = this.indexSignatures.map((is) => ({
      key: is.key.toGeneration(options),
      value: is.value.toGeneration(options)
    }))

    const p = renderProperties(ps, options)
    const i = renderIndexSignatures(iss)

    const suffix = this.renderChecks() + renderAnnotations(this.annotations)

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
        annotations: this.annotations,
        importDeclarations: p.importDeclarations
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
        annotations: this.annotations,
        importDeclarations: indexSignatureImports(is)
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
  static make(members: ReadonlyArray<AST>, mode: "anyOf" | "oneOf", annotations: Annotations = {}): AST {
    members = members.filter((m) => m._tag !== "Never")
    if (members.length === 0) return new Never(annotations)
    if (members.length === 1) return members[0].annotate(annotations)
    return new Union(members, mode, annotations)
  }
  readonly _tag = "Union"
  readonly members: ReadonlyArray<AST>
  readonly mode: "anyOf" | "oneOf"
  readonly annotations: Annotations
  private constructor(members: ReadonlyArray<AST>, mode: "anyOf" | "oneOf", annotations: Annotations = {}) {
    this.members = members
    this.mode = mode
    this.annotations = annotations
  }
  annotate(annotations: Annotations | undefined): Union {
    return new Union(
      this.members,
      this.mode,
      annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined
    )
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  combine(that: AST, options: RecurOptions): AST {
    switch (that._tag) {
      case "Union":
        return new Union(
          this.members.concat(that.members),
          this.mode === "oneOf" && that.mode === "oneOf" ? "oneOf" : "anyOf",
          annotationsCombiner.combine(this.annotations, that.annotations)
        )
      default:
        return new Union(this.members.map((m) => m.combine(that, options)), this.mode, this.annotations)
    }
  }
  toGeneration(options: RecurOptions): Generation {
    const members = this.members.map((m) => m.toGeneration(options))
    const runtime = this.members.length === 2 && this.members[1]._tag === "Null" &&
        Object.keys(this.members[1].annotations).length === 0 ?
      `Schema.NullOr(${members[0].runtime})` :
      `Schema.Union([${members.map((m) => m.runtime).join(", ")}]${this.mode === "oneOf" ? `, { mode: "oneOf" }` : ""})`
    const suffix = renderAnnotations(this.annotations)
    return {
      runtime: runtime + suffix,
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
  readonly ref: string
  readonly annotations: Annotations
  constructor(ref: string, annotations: Annotations = {}) {
    this.ref = ref
    this.annotations = annotations
  }
  annotate(annotations: Annotations | undefined): Reference {
    return new Reference(this.ref, annotations ? annotationsCombiner.combine(this.annotations, annotations) : undefined)
  }
  parseChecks(_: Schema.JsonSchema): AST {
    return this
  }
  combine(_: AST): AST {
    return new Never()
  }
  toGeneration(options: RecurOptions): Generation {
    const out = options.resolver(this.ref)
    const suffix = renderAnnotations(this.annotations)
    return {
      runtime: out.runtime + suffix,
      types: out.types,
      annotations: annotationsCombiner.combine(this.annotations, out.annotations),
      importDeclarations: out.importDeclarations
    }
  }
}

function parse(schema: unknown, options: RecurOptions): AST {
  if (schema === false) return new Never()
  if (schema === true) return new Unknown()
  if (!isObject(schema)) return new Unknown()

  let ast = parseFragment(schema, options)

  const annotations = collectAnnotations(schema, ast)
  if (annotations) ast = ast.annotate(annotations)

  ast = ast.parseChecks(schema)

  if (Array.isArray(schema.allOf)) {
    // inline local refs only while parsing members of `allOf`
    const allOfOptions: RecurOptions = { ...options, inlineRefs: true }
    return schema.allOf.map((m) => parse(m, allOfOptions)).reduce(
      (acc, curr) => acc.combine(curr, allOfOptions),
      ast
    )
  }

  if (options.source === "openapi-3.0" && "isNullable" in ast && ast.isNullable === true) {
    ast = NullOr(ast.annotate(undefined)).annotate(ast.annotations)
  }

  return ast
}

function NullOr(ast: AST): AST {
  return Union.make([ast, new Null()], "anyOf")
}

function parseFragment(schema: Schema.JsonSchema, options: RecurOptions): AST {
  if (Array.isArray(schema.anyOf)) {
    return Union.make(schema.anyOf.map((m) => parse(m, options)), "anyOf")
  }
  if (Array.isArray(schema.oneOf)) {
    return Union.make(schema.oneOf.map((m) => parse(m, options)), "oneOf")
  }

  if (Array.isArray(schema.type)) {
    return Union.make(schema.type.filter(isType).map((type) => handleType(type, {}, options)), "anyOf")
  }

  if (schema.const !== undefined) {
    if (isLiteralValue(schema.const)) return Enum.make([schema.const])
    if (schema.const === null) return new Null()
    return new Never()
  }

  if (Array.isArray(schema.enum)) {
    const enums = schema.enum.filter(isLiteralValue)
    const isNullable = schema.enum.some((e) => e === null)
    if (isNullable) return NullOr(Enum.make(enums))
    return Enum.make(enums)
  }

  schema = normalize(schema)

  if (isType(schema.type)) {
    return handleType(schema.type, schema, options)
  }

  if (typeof schema.$ref === "string") {
    const parts = getRefParts(schema.$ref)
    if (Arr.isArrayNonEmpty(parts)) {
      // handle local definitions
      if (options.root !== undefined && (parts[0] === "definitions" || parts[0] === "$defs")) {
        const definition = extractDefinition(options.root, parts)
        if (definition !== undefined && !options.refStack.has(schema.$ref)) {
          const nextStack = new Set(options.refStack)
          nextStack.add(schema.$ref)
          return parse(definition, { ...options, refStack: nextStack })
        }
      }

      const ref = getRef(parts, options.source)
      if (Arr.isArrayNonEmpty(ref)) {
        const definition = extractDefinition(options.definitions, ref)
        if (
          options.inlineRefs &&
          definition !== undefined &&
          !options.refStack.has(schema.$ref)
        ) {
          const nextStack = new Set(options.refStack)
          nextStack.add(schema.$ref)
          return parse(definition, { ...options, refStack: nextStack })
        }
      }

      return new Reference(ref.join("/"))
    } else {
      throw new Error(`Invalid $ref: ${schema.$ref}`)
    }
  }

  return new Unknown()
}

function getRef(parts: readonly [string, ...Array<string>], source: Source): Array<string> {
  switch (source) {
    case "draft-07":
    case "draft-2020-12":
      return parts.slice(1)
    case "openapi-3.0":
    case "openapi-3.1":
      return parts.slice(2)
  }
}

function extractDefinition(
  root: Schema.JsonSchema,
  parts: readonly [string, ...Array<string>]
): Schema.JsonSchema | undefined {
  let current = root
  for (const part of parts) {
    if (isObject(current[part])) {
      current = current[part]
    } else {
      return undefined
    }
  }
  return current
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
        return new String(schema.nullable === true, [], parse(schema.contentSchema, options))
      }
      return new String(schema.nullable === true, [], undefined)
    }
    case "number":
      return new Number(schema.nullable === true, false, [])
    case "integer":
      return new Number(schema.nullable === true, true, [])
    case "boolean":
      return new Boolean(schema.nullable === true)
    case "object": {
      const properties = collectProperties(schema, options)
      const indexSignatures = collectIndexSignatures(schema, options)
      const additionalProperties = schema.additionalProperties === false ? false : true
      return new Objects(schema.nullable === true, properties, indexSignatures, additionalProperties, [])
    }
    case "array": {
      const minItems = typeof schema.minItems === "number" ? schema.minItems : 0
      const elements = collectElements(schema, options).map((item, index): Element =>
        new Element(index + 1 > minItems, parse(item, options))
      )
      const rest = collectRest(schema, options)

      return new Arrays(
        schema.nullable === true,
        elements,
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

  if (isObject(schema.propertyNames)) {
    out.push(new IndexSignature(parse(schema.propertyNames, options), new Unknown()))
  }

  if (isObject(schema.patternProperties)) {
    for (const [pattern, value] of Object.entries(schema.patternProperties)) {
      out.push(
        new IndexSignature(
          new String(false, [makePatternCheck(pattern)], undefined),
          parse(value, options)
        )
      )
    }
  }

  if (isObject(schema.additionalProperties)) {
    out.push(new IndexSignature(new String(false, [], undefined), parse(schema.additionalProperties, options)))
  }

  return out
}

function collectElements(schema: Schema.JsonSchema, options: RecurOptions): ReadonlyArray<unknown> {
  switch (options.source) {
    case "draft-07":
      return Array.isArray(schema.items) ? schema.items : []
    case "draft-2020-12":
    case "openapi-3.1":
      return Array.isArray(schema.prefixItems) ? schema.prefixItems : []
    case "openapi-3.0":
      // no tuples in OpenAPI 3.0 spec, keep undefined
      return []
  }
}

function isJsonSchema(candidate: unknown): candidate is Schema.JsonSchema | boolean {
  return isObject(candidate) || (typeof candidate === "boolean")
}

function collectRest(schema: Schema.JsonSchema, options: RecurOptions): Schema.JsonSchema | boolean | undefined {
  switch (options.source) {
    case "draft-07":
      return isJsonSchema(schema.items)
        ? schema.items
        : isJsonSchema(schema.additionalItems)
        ? schema.additionalItems
        : undefined
    case "draft-2020-12":
    case "openapi-3.1":
      return isJsonSchema(schema.items)
        ? schema.items
        : undefined
    case "openapi-3.0":
      // `items` must be an object in OpenAPI 3.0 spec
      return isObject(schema.items) ? schema.items : undefined
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
  if (Array.isArray(schema.examples)) {
    as.examples = schema.examples
  } else if (schema.example !== undefined) {
    // OpenAPI 3.0 uses `example` (singular). Only use it if defined
    as.examples = [schema.example]
  }
  if (typeof schema.format === "string") as.format = schema.format

  if (Object.keys(as).length === 0) return undefined
  return as
}
