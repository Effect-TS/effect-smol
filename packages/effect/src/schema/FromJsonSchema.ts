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
export type Output = {
  readonly code: string
  readonly type: string
  readonly dependencies: ReadonlySet<string>
}

const emptySet: ReadonlySet<string> = new Set()

const DependenciesReducer: Reducer.Reducer<ReadonlySet<string>> = Reducer.make<ReadonlySet<string>>(
  (self, that) => new Set([...self, ...that]),
  emptySet
)

/**
 * @since 4.0.0
 */
export function make(schema: unknown, options?: {
  readonly target?: Target | undefined
  readonly seen?: ReadonlySet<string> | undefined
  readonly getIdentifier?: ((identifier: string) => string) | undefined
}): Output {
  return build(schema, {
    target: options?.target ?? "draft-07",
    seen: options?.seen ?? emptySet,
    getIdentifier: options?.getIdentifier ?? getIdentifier
  })
}

function getIdentifier(identifier: string): string {
  return identifier.replace(/[/~]/g, "$")
}

interface GoOptions {
  readonly target: Target
  readonly seen: ReadonlySet<string>
  readonly getIdentifier: (identifier: string) => string
}

function build(schema: unknown, options: GoOptions): Output {
  if (schema === false) return Never
  if (schema === true) return Unknown
  if (!isObject(schema)) return Unknown

  let out = base(schema, options)
  out = applyAnnotations(out, schema)
  out = applyChecks(out, schema, options.target)
  return out
}

function applyAnnotations(out: Output, schema: Fragment): Output {
  const as = collectAnnotations(schema)
  if (as.length === 0) return out
  return { ...out, code: `${out.code}.annotate({ ${as.join(", ")} })` }
}

function collectAnnotations(schema: Fragment): ReadonlyArray<string> {
  const as: Array<string> = []
  if (typeof schema.title === "string") as.push(`title: "${schema.title}"`)
  if (typeof schema.description === "string") as.push(`description: "${schema.description}"`)
  if (schema.default !== undefined) as.push(`default: ${format(schema.default)}`)
  if (Array.isArray(schema.examples)) as.push(`examples: [${schema.examples.map((e) => format(e)).join(", ")}]`)
  return as
}

function applyChecks(out: Output, schema: Fragment, target: Target): Output {
  const cs = collectChecks(schema, target)
  if (cs.length === 0) return out
  return { ...out, code: `${out.code}.check(${cs.join(", ")})` }
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
    return collectElements(schema, target).length > minItems
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

function handleType(type: Schema.JsonSchema.Type): Output {
  return primitives[type]
}

function handleHasType(schema: HasType, options: GoOptions): Output {
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
      const elements = collectElements(schema, options.target).map((item, index) => ({
        value: build(item, options),
        isRequired: index < minItems
      }))
      const rest = collectItem(schema, options.target)
      return array(elements, rest !== undefined ? build(rest, options) : undefined)
    }
  }
}

function collectElements(schema: Fragment, target: Target): ReadonlyArray<Fragment> {
  switch (target) {
    case "draft-07":
      return Array.isArray(schema.items) ? schema.items : []
    case "2020-12":
    case "oas3.1":
      return Array.isArray(schema.prefixItems) ? schema.prefixItems : []
  }
}

function collectItem(schema: Fragment, target: Target): Fragment | boolean | undefined {
  switch (target) {
    case "draft-07":
      return isObject(schema.items)
        ? schema.items
        : isObject(schema.additionalItems) || schema.additionalItems === true
        ? schema.additionalItems
        : undefined
    case "2020-12":
    case "oas3.1":
      return isObject(schema.items)
        ? schema.items
        : undefined
  }
}

function base(schema: Fragment, options: GoOptions): Output {
  if (Array.isArray(schema.type)) {
    return union(schema.type.map(handleType), "anyOf")
  }

  if (schema.const !== undefined) {
    return {
      code: `Schema.Literal(${format(schema.const)})`,
      type: format(schema.const),
      dependencies: emptySet
    }
  }

  if (Array.isArray(schema.enum)) {
    const type = schema.enum.map((e) => format(e)).join(" | ")
    switch (schema.enum.length) {
      case 0:
        return Never
      case 1:
        return {
          code: `Schema.Literal(${format(schema.enum[0])})`,
          type,
          dependencies: emptySet
        }
      default:
        return {
          code: `Schema.Literals([${schema.enum.map((e) => format(e)).join(", ")}])`,
          type,
          dependencies: emptySet
        }
    }
  }

  if (Array.isArray(schema.anyOf)) {
    if (schema.anyOf.length === 0) return Never
    if (isEmptyStruct(schema.anyOf)) return EmptyStruct
    return union(schema.anyOf.map((schema) => build(schema, options)), "anyOf")
  }

  if (Array.isArray(schema.oneOf)) {
    if (schema.oneOf.length === 0) return Never
    if (isEmptyStruct(schema.oneOf)) return EmptyStruct
    return union(schema.oneOf.map((schema) => build(schema, options)), "oneOf")
  }

  if (hasType(schema)) {
    return handleHasType(schema, options)
  }

  if (typeof schema.$ref === "string") {
    const last = schema.$ref.split("/").pop()
    if (last !== undefined) {
      const identifier = options.getIdentifier(unescapeJsonPointer(last))
      const seen = options.seen.has(identifier)
      if (seen) {
        return {
          code: `Schema.suspend((): Schema.Codec<${identifier}> => ${identifier})`,
          type: identifier,
          dependencies: new Set([identifier])
        }
      }
      return {
        code: identifier,
        type: identifier,
        dependencies: new Set([identifier])
      }
    }
    throw new Error(`Invalid $ref: ${schema.$ref}`)
  }

  if (isObject(schema.not) && Object.keys(schema.not).length === 0) {
    return Never
  }

  return Unknown
}

function optionalKeyRuntime(isRequired: boolean, code: string): string {
  return isRequired ? code : `Schema.optionalKey(${code})`
}

function optionalKeyType(isRequired: boolean, type: string): string {
  return isRequired ? type : `${type}?`
}

type Property = {
  readonly key: string
  readonly value: Output
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
  readonly key: Output
  readonly value: Output
}

function collectIndexSignatures(schema: Fragment, options: GoOptions): Array<IndexSignature> {
  if (schema.additionalProperties === true) return [{ key: String, value: Unknown }]
  if (isObject(schema.additionalProperties)) {
    return [{ key: String, value: build(schema.additionalProperties, options) }]
  }
  if (!schema.properties) return [{ key: String, value: Unknown }]
  return []
}

function object(ps: ReadonlyArray<Property>, is: ReadonlyArray<IndexSignature>): Output {
  if (is.length === 0) {
    return struct(ps)
  } else if (ps.length === 0 && is.length === 1) {
    return record(is[0].key, is[0].value)
  } else {
    const s = struct(ps)
    const i = is.map((i) => record(i.key, i.value))
    return {
      code: `Schema.StructWithRest(${s.code}, [${i.map((i) => i.code).join(", ")}])`,
      type: `{ ${stripBraces(s.type)}, ${i.map((i) => stripBraces(i.type)).join(", ")} }`,
      dependencies: DependenciesReducer.combineAll([
        ...ps.map((p) => p.value.dependencies),
        ...i.map((i) => i.dependencies)
      ])
    }
  }
}

// Strip the outer `{` and `}` braces along with any surrounding whitespace
function stripBraces(s: string): string {
  const match = s.trim().match(/^\{\s*(.*?)\s*\}$/)
  return match ? match[1] : s
}

function struct(ps: ReadonlyArray<Property>): Output {
  return {
    code: `Schema.Struct({ ${
      ps.map((p) => `${p.key}: ${optionalKeyRuntime(p.isRequired, p.value.code)}`).join(", ")
    } })`,
    type: `{ ${ps.map((p) => `readonly ${optionalKeyType(p.isRequired, p.key)}: ${p.value.type}`).join(", ")} }`,
    dependencies: DependenciesReducer.combineAll(ps.map((p) => p.value.dependencies))
  }
}

function record(key: Output, value: Output): Output {
  return {
    code: `Schema.Record(${key.code}, ${value.code})`,
    type: `{ readonly [x: ${key.type}]: ${value.type} }`,
    dependencies: DependenciesReducer.combine(key.dependencies, value.dependencies)
  }
}

type Element = {
  readonly value: Output
  readonly isRequired: boolean
}

function array(es: ReadonlyArray<Element>, item: Output | undefined): Output {
  if (item === undefined) {
    return {
      code: `Schema.Tuple([${es.map((e) => optionalKeyRuntime(e.isRequired, e.value.code)).join(", ")}])`,
      type: `readonly [${es.map((e) => optionalKeyType(e.isRequired, e.value.type)).join(", ")}]`,
      dependencies: DependenciesReducer.combineAll(es.map((e) => e.value.dependencies))
    }
  } else if (es.length === 0) {
    return {
      code: `Schema.Array(${item.code})`,
      type: `ReadonlyArray<${item.type}>`,
      dependencies: item.dependencies
    }
  } else {
    return {
      code: `Schema.TupleWithRest(Schema.Tuple([${
        es.map((e) => optionalKeyRuntime(e.isRequired, e.value.code)).join(", ")
      }]), [${item.code}])`,
      type: `readonly [${
        es.map((e) => optionalKeyType(e.isRequired, e.value.type)).join(", ")
      }, ...Array<${item.type}>]`,
      dependencies: DependenciesReducer.combineAll([...es.map((e) => e.value.dependencies), item.dependencies])
    }
  }
}

function union(members: ReadonlyArray<Output>, mode: "anyOf" | "oneOf"): Output {
  return {
    code: `Schema.Union([${members.map((m) => m.code).join(", ")}]${mode === "oneOf" ? `, {mode:"oneOf"}` : ""})`,
    type: members.map((m) => m.type).join(" | "),
    dependencies: DependenciesReducer.combineAll(members.map((m) => m.dependencies))
  }
}

function primitive(code: string, type: string): Output {
  return { code, type, dependencies: emptySet }
}

const Never: Output = primitive("Schema.Never", "never")
const Unknown: Output = primitive("Schema.Unknown", "unknown")
const Null: Output = primitive("Schema.Null", "null")
const String: Output = primitive("Schema.String", "string")
const Number: Output = primitive("Schema.Number", "number")
const Int: Output = primitive("Schema.Int", "number")
const Boolean: Output = primitive("Schema.Boolean", "boolean")
const UnknownRecord: Output = object([], [{ key: String, value: Unknown }])
const UnknownArray: Output = array([], Unknown)
const EmptyStruct: Output = primitive("Schema.Struct({})", "{}")

const primitives = {
  "null": Null,
  "string": String,
  "number": Number,
  "integer": Int,
  "boolean": Boolean,
  "object": UnknownRecord,
  "array": UnknownArray
}

function stripAnnotations(schema: Fragment): Fragment {
  const out: Fragment = { ...schema }
  delete out.title
  delete out.description
  delete out.default
  delete out.examples
  return out
}

function isUnknownRecord(schema: Fragment): boolean {
  return schema.type === "object" && Object.keys(stripAnnotations(schema)).length === 1
}

function isUnknownArray(schema: Fragment): boolean {
  return schema.type === "array" && Object.keys(stripAnnotations(schema)).length === 1
}

function isEmptyStruct(schema: ReadonlyArray<Fragment>): boolean {
  return schema.length === 2 && isUnknownRecord(schema[0]) && isUnknownArray(schema[1])
}

function unescapeJsonPointer(pointer: string): string {
  return pointer.replace(/~0/ig, "~").replace(/~1/ig, "/")
}
