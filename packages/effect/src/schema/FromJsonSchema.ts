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
import { format } from "../data/Formatter.ts"
import { isObject } from "../data/Predicate.ts"
import * as Reducer from "../data/Reducer.ts"
import type * as Annotations from "./Annotations.ts"
import type * as Schema from "./Schema.ts"

type Target = Annotations.JsonSchema.Target
type Fragment = Schema.JsonSchema.Fragment

/**
 * @since 4.0.0
 */
export type Generation = {
  readonly runtime: string
  readonly type: string
  readonly imports: ReadonlySet<string>
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

/**
 * @since 4.0.0
 */
export type GenerationOptions = {
  readonly resolver?: ((identifier: string) => Generation) | undefined
  readonly target?: Target | undefined
}

/**
 * @since 4.0.0
 */
export const resolvers = {
  identity: (identifier: string) => ({
    runtime: identifier,
    type: identifier,
    imports: emptySet
  }),
  suspend: (identifier: string) => ({
    runtime: `Schema.suspend((): Schema.Codec<${identifier}> => ${identifier})`,
    type: identifier,
    imports: emptySet
  })
}

/**
 * @since 4.0.0
 */
export function generate(schema: unknown, options?: GenerationOptions): Generation {
  return build(schema, {
    resolver: options?.resolver ?? resolvers.identity,
    target: options?.target ?? "draft-07"
  })
}

interface GoOptions {
  readonly resolver: (identifier: string) => Generation
  readonly target: Target
}

function build(schema: unknown, options: GoOptions): Generation {
  if (schema === false) return Never
  if (schema === true) return Unknown
  if (!isObject(schema)) return Unknown

  let out = base(schema, options)
  out = applyAnnotations(out, schema)
  out = applyChecks(out, schema, options.target)
  return out
}

function applyAnnotations(out: Generation, schema: Fragment): Generation {
  const as = collectAnnotations(schema)
  if (as.length === 0) return out
  return { ...out, runtime: `${out.runtime}.annotate({ ${as.join(", ")} })` }
}

function collectAnnotations(schema: Fragment): ReadonlyArray<string> {
  const as: Array<string> = []
  if (typeof schema.title === "string") as.push(`title: "${schema.title}"`)
  if (typeof schema.description === "string") as.push(`description: "${schema.description}"`)
  if (schema.default !== undefined) as.push(`default: ${format(schema.default)}`)
  if (Array.isArray(schema.examples)) as.push(`examples: [${schema.examples.map((e) => format(e)).join(", ")}]`)
  return as
}

function applyChecks(out: Generation, schema: Fragment, target: Target): Generation {
  const cs = collectChecks(schema, target)
  if (cs.length === 0) return out
  return { ...out, runtime: `${out.runtime}.check(${cs.join(", ")})` }
}

function collectChecks(schema: Fragment, target: Target): Array<string> {
  const cs: Array<string> = []

  // String checks
  if (typeof schema.minLength === "number") cs.push(`Schema.isMinLength(${schema.minLength})`)
  if (typeof schema.maxLength === "number") cs.push(`Schema.isMaxLength(${schema.maxLength})`)
  // Escape forward slashes to prevent them from terminating the regex literal delimiter
  if (typeof schema.pattern === "string") cs.push(`Schema.isPattern(/${schema.pattern.replace(/\//g, "\\/")}/)`)

  // Number checks
  if (typeof schema.minimum === "number") cs.push(`Schema.isGreaterThanOrEqualTo(${schema.minimum})`)
  if (typeof schema.maximum === "number") cs.push(`Schema.isLessThanOrEqualTo(${schema.maximum})`)
  if (typeof schema.exclusiveMinimum === "number") cs.push(`Schema.isGreaterThan(${schema.exclusiveMinimum})`)
  if (typeof schema.exclusiveMaximum === "number") cs.push(`Schema.isLessThan(${schema.exclusiveMaximum})`)
  if (typeof schema.multipleOf === "number") cs.push(`Schema.isMultipleOf(${schema.multipleOf})`)

  // Array checks
  if (typeof schema.minItems === "number" && !isTupleWithMoreElementsThan(schema, schema.minItems, target)) {
    // if `schema` is a tuple with more elements that `schema.minItems`
    // then this is already handled by element optionality
    cs.push(`Schema.isMinLength(${schema.minItems})`)
  }
  if (typeof schema.maxItems === "number") cs.push(`Schema.isMaxLength(${schema.maxItems})`)
  if (schema.uniqueItems === true) cs.push(`Schema.isUnique()`)

  // Object checks
  if (typeof schema.minProperties === "number") cs.push(`Schema.isMinProperties(${schema.minProperties})`)
  if (typeof schema.maxProperties === "number") cs.push(`Schema.isMaxProperties(${schema.maxProperties})`)

  // `allOf` checks
  if (Array.isArray(schema.allOf)) {
    for (const member of schema.allOf) {
      if (isObject(member)) {
        const checks = collectChecks(member, target)
        if (checks.length > 0) {
          const annotations = collectAnnotations(member)
          if (annotations.length > 0) {
            checks[checks.length - 1] = checks[checks.length - 1].substring(0, checks[checks.length - 1].length - 1) +
              `, { ${annotations.join(", ")} })`
          }
          checks.forEach((check) => cs.push(check))
        }
      }
    }
  }
  return cs
}

function isTupleWithMoreElementsThan(schema: Fragment, minItems: number, target: Target): boolean {
  if (schema.type === "array") {
    const elements = collectElements(schema, target)
    if (elements !== undefined) return elements.length > minItems
  }
  return false
}

interface HasType extends Fragment {
  readonly type: Schema.JsonSchema.Type
}

const types = ["null", "string", "number", "integer", "boolean", "object", "array"]

function hasType(schema: Fragment): schema is HasType {
  return typeof schema.type === "string" && types.includes(schema.type)
}

function handleType(type: Schema.JsonSchema.Type): Generation {
  return primitives[type]
}

function handleHasType(schema: HasType, options: GoOptions): Generation {
  switch (schema.type) {
    case "null":
    case "string":
    case "number":
    case "integer":
    case "boolean":
      return primitives[schema.type]
    case "object": {
      const properties = collectProperties(schema, options)
      const indexSignatures = collectIndexSignatures(schema, options)
      return object(properties, indexSignatures)
    }
    case "array": {
      const minItems = typeof schema.minItems === "number" ? schema.minItems : Infinity
      const elements = collectElements(schema, options.target)?.map((item, index): Element => ({
        value: build(item, options),
        isRequired: index < minItems
      }))
      const rest = collectRest(schema, options.target)
      return array(
        elements !== undefined ? elements : rest === false ? [] : undefined,
        rest !== undefined && rest !== false ? build(rest, options) : undefined
      )
    }
  }
}

function collectElements(schema: Fragment, target: Target): ReadonlyArray<Fragment> | undefined {
  switch (target) {
    case "draft-07":
      return Array.isArray(schema.items) ? schema.items : undefined
    case "2020-12":
    case "oas3.1":
      return Array.isArray(schema.prefixItems) ? schema.prefixItems : undefined
  }
}

function collectRest(schema: Fragment, target: Target): Fragment | boolean | undefined {
  switch (target) {
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

function base(schema: Fragment, options: GoOptions): Generation {
  if (Array.isArray(schema.type)) {
    return union(schema.type.map(handleType), "anyOf")
  }

  if (schema.const !== undefined) {
    return {
      runtime: `Schema.Literal(${format(schema.const)})`,
      type: format(schema.const),
      imports: emptySet
    }
  }

  if (Array.isArray(schema.enum)) {
    const enums = schema.enum.map((e) => format(e))
    const type = enums.join(" | ")
    switch (schema.enum.length) {
      case 0:
        return Never
      case 1:
        return {
          runtime: `Schema.Literal(${enums})`,
          type,
          imports: emptySet
        }
      default:
        return {
          runtime: `Schema.Literals([${enums.join(", ")}])`,
          type,
          imports: emptySet
        }
    }
  }

  if (Array.isArray(schema.anyOf)) {
    return union(schema.anyOf.map((schema) => build(schema, options)), "anyOf")
  }

  if (Array.isArray(schema.oneOf)) {
    return union(schema.oneOf.map((schema) => build(schema, options)), "oneOf")
  }

  if (hasType(schema)) {
    return handleHasType(schema, options)
  }

  if (typeof schema.$ref === "string") {
    const identifier = extractIdentifier(schema.$ref)
    if (identifier !== undefined) {
      return options.resolver(identifier)
    }
    throw new Error(`Invalid $ref: ${schema.$ref}`)
  }

  if (isObject(schema.not) && Object.keys(schema.not).length === 0) {
    return Never
  }

  return Unknown
}

function extractIdentifier($ref: string): string | undefined {
  const last = $ref.split("/").pop()
  if (last !== undefined) {
    return unescapeJsonPointer(last)
  }
}

function optionalRuntime(isRequired: boolean, code: string): string {
  return isRequired ? code : `Schema.optionalKey(${code})`
}

function optionalType(isRequired: boolean, type: string): string {
  return isRequired ? type : `${type}?`
}

type Property = {
  readonly key: string
  readonly value: Generation
  readonly isRequired: boolean
}

function collectProperties(schema: Fragment, options: GoOptions): Array<Property> {
  const raw = isObject(schema.properties) ? schema.properties : {}
  const required = Array.isArray(schema.required) ? schema.required : []
  return Object.entries(raw).map(([key, v]) => {
    const value = build(v, options)
    return {
      key,
      value,
      isRequired: required.includes(key)
    }
  })
}

type IndexSignature = {
  readonly key: Generation
  readonly value: Generation
}

function collectIndexSignatures(schema: Fragment, options: GoOptions): Array<IndexSignature> {
  if (schema.additionalProperties === true) return [{ key: String, value: Unknown }]
  if (isObject(schema.additionalProperties)) {
    return [{ key: String, value: build(schema.additionalProperties, options) }]
  }
  if (!schema.properties) return [{ key: String, value: Unknown }]
  return []
}

function object(ps: ReadonlyArray<Property>, iss: ReadonlyArray<IndexSignature>): Generation {
  if (iss.length === 0) {
    return {
      runtime: `Schema.Struct({ ${propertiesRuntime(ps)} })`,
      type: `{ ${propertiesType(ps)} }`,
      imports: propertiesImports(ps)
    }
  } else if (ps.length === 0 && iss.length === 1) {
    return {
      runtime: indexSignatureRuntime(iss[0]),
      type: `{ ${indexSignatureType(iss[0])} }`,
      imports: indexSignatureImports(iss[0])
    }
  } else {
    return {
      runtime: `Schema.StructWithRest(Schema.Struct({ ${propertiesRuntime(ps)} }), [${
        iss.map(indexSignatureRuntime).join(", ")
      }])`,
      type: `{ ${propertiesType(ps)}, ${iss.map(indexSignatureType).join(", ")} }`,
      imports: ReadonlySetReducer.combineAll([propertiesImports(ps), ...iss.map(indexSignatureImports)])
    }
  }
}

function propertiesRuntime(ps: ReadonlyArray<Property>): string {
  return ps.map((p) => `${p.key}: ${optionalRuntime(p.isRequired, p.value.runtime)}`).join(", ")
}

function propertiesType(ps: ReadonlyArray<Property>): string {
  return ps.map((p) => `readonly ${optionalType(p.isRequired, p.key)}: ${p.value.type}`).join(", ")
}

function propertiesImports(ps: ReadonlyArray<Property>): ReadonlySet<string> {
  return ReadonlySetReducer.combineAll(ps.map((p) => p.value.imports))
}

function indexSignatureRuntime(is: IndexSignature) {
  return `Schema.Record(${is.key.runtime}, ${is.value.runtime})`
}

function indexSignatureType(is: IndexSignature) {
  return `readonly [x: ${is.key.type}]: ${is.value.type}`
}

function indexSignatureImports(is: IndexSignature): ReadonlySet<string> {
  return ReadonlySetReducer.combine(is.key.imports, is.value.imports)
}

type Element = {
  readonly value: Generation
  readonly isRequired: boolean
}

function array(es: ReadonlyArray<Element> | undefined, rest: Generation | undefined): Generation {
  if (es === undefined) {
    if (rest === undefined) {
      return UnknownArray
    } else {
      return {
        runtime: `Schema.Array(${rest.runtime})`,
        type: `ReadonlyArray<${rest.type}>`,
        imports: rest.imports
      }
    }
  } else {
    if (rest === undefined) {
      return {
        runtime: `Schema.Tuple([${elementsRuntime(es)}])`,
        type: `readonly [${elementsType(es)}]`,
        imports: elementsImports(es)
      }
    } else {
      return {
        runtime: `Schema.TupleWithRest(Schema.Tuple([${elementsRuntime(es)}]), [${rest.runtime}])`,
        type: `readonly [${elementsType(es)}, ...Array<${rest.type}>]`,
        imports: ReadonlySetReducer.combine(elementsImports(es), rest.imports)
      }
    }
  }
}

function elementsRuntime(es: ReadonlyArray<Element>): string {
  return es.map((e) => optionalRuntime(e.isRequired, e.value.runtime)).join(", ")
}

function elementsType(es: ReadonlyArray<Element>): string {
  return `${es.map((e) => optionalType(e.isRequired, e.value.type)).join(", ")}`
}

function elementsImports(es: ReadonlyArray<Element>): ReadonlySet<string> {
  return ReadonlySetReducer.combineAll(es.map((e) => e.value.imports))
}

function union(members: ReadonlyArray<Generation>, mode: "anyOf" | "oneOf"): Generation {
  return {
    runtime: `Schema.Union([${members.map((m) => m.runtime).join(", ")}]${mode === "oneOf" ? `, {mode:"oneOf"}` : ""})`,
    type: members.map((m) => m.type).join(" | "),
    imports: ReadonlySetReducer.combineAll(members.map((m) => m.imports))
  }
}

function primitive(code: string, type: string): Generation {
  return { runtime: code, type, imports: emptySet }
}

const Never: Generation = primitive("Schema.Never", "never")
const Unknown: Generation = primitive("Schema.Unknown", "unknown")
const Null: Generation = primitive("Schema.Null", "null")
const String: Generation = primitive("Schema.String", "string")
const Number: Generation = primitive("Schema.Number", "number")
const Int: Generation = primitive("Schema.Int", "number")
const Boolean: Generation = primitive("Schema.Boolean", "boolean")
const UnknownRecord: Generation = object([], [{ key: String, value: Unknown }])
const UnknownArray: Generation = array(undefined, Unknown)

const primitives = {
  "null": Null,
  "string": String,
  "number": Number,
  "integer": Int,
  "boolean": Boolean,
  "object": UnknownRecord,
  "array": UnknownArray
}

/**
 * @since 4.0.0
 */
export function unescapeJsonPointer(pointer: string): string {
  return pointer.replace(/~0/ig, "~").replace(/~1/ig, "/")
}

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

/**
 * @since 4.0.0
 */
export type GenerationDefinition = {
  readonly identifier: string
  readonly generation: Generation
}

/**
 * @since 4.0.0
 */
export function generateDefinitions(definitions: Schema.JsonSchema.Definitions, options?: {
  readonly target?: Target | undefined
}): Array<GenerationDefinition> {
  const ts = topologicalSort(definitions)
  const recursives = new Set(Object.keys(ts.recursives))
  const resolver = (identifier: string) => {
    if (recursives.has(identifier)) {
      return resolvers.suspend(identifier)
    }
    return resolvers.identity(identifier)
  }
  const opts: GenerationOptions = {
    target: options?.target,
    resolver
  }
  return ts.nonRecursives.concat(
    Object.entries(ts.recursives).map(([identifier, schema]) => ({ identifier, schema }))
  ).map(({ identifier, schema }) => {
    const output = generate(schema, opts)
    return {
      identifier,
      generation: {
        runtime: output.runtime + `.annotate({ identifier: "${identifier}" })`,
        type: output.type,
        imports: output.imports
      }
    }
  })
}
