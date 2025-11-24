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
import type * as Annotations from "./Annotations.ts"
import type * as Schema from "./Schema.ts"

/**
 * @since 4.0.0
 */
export type Output = {
  readonly code: string
  readonly type: string
}

/**
 * @since 4.0.0
 */
export function make(schema: unknown, options?: {
  readonly target?: Annotations.JsonSchema.Target | undefined
  readonly seen?: ReadonlySet<string> | undefined
  readonly getIdentifier?: ((identifier: string) => string) | undefined
}): Output {
  return recur(schema, {
    target: options?.target ?? "draft-07",
    seen: options?.seen ?? new Set(),
    getIdentifier: options?.getIdentifier ?? getIdentifier
  })
}

function getIdentifier(identifier: string): string {
  return identifier.replace(/[/~]/g, "$")
}

interface GoOptions {
  readonly target: Annotations.JsonSchema.Target
  readonly seen: ReadonlySet<string>
  readonly getIdentifier: (identifier: string) => string
}

function recur(schema: unknown, options: GoOptions): Output {
  if (typeof schema === "boolean") {
    return schema ? Unknown : Never
  }
  if (isObject(schema)) {
    return handleAnnotationsAndChecks(schema, options)
  }
  return Unknown
}

function getAnnotations(schema: Schema.JsonSchema.Fragment): ReadonlyArray<string> {
  const annotations: Array<string> = []
  if (typeof schema.title === "string") {
    annotations.push(`title: "${schema.title}"`)
  }
  if (typeof schema.description === "string") {
    annotations.push(`description: "${schema.description}"`)
  }
  if (schema.default !== undefined) {
    annotations.push(`default: ${format(schema.default)}`)
  }
  if (Array.isArray(schema.examples)) {
    annotations.push(`examples: [${schema.examples.map((example) => format(example)).join(", ")}]`)
  }
  return annotations
}

function isTupleWithMoreElementsThan(
  schema: Schema.JsonSchema.Fragment,
  minItems: number,
  target: Annotations.JsonSchema.Target
): boolean {
  if (schema.type === "array") {
    return getTupleElements(schema, target).length > minItems
  }
  return false
}

function getChecks(schema: Schema.JsonSchema.Fragment, target: Annotations.JsonSchema.Target): Array<string> {
  const out: Array<string> = []
  // String checks
  if (typeof schema.minLength === "number") {
    out.push(`Schema.isMinLength(${schema.minLength})`)
  }
  if (typeof schema.maxLength === "number") {
    out.push(`Schema.isMaxLength(${schema.maxLength})`)
  }
  if (typeof schema.pattern === "string") {
    // Escape forward slashes to prevent them from terminating the regex literal delimiter
    out.push(`Schema.isPattern(/${schema.pattern.replace(/\//g, "\\/")}/)`)
  }
  // Number checks
  if (typeof schema.minimum === "number") {
    out.push(`Schema.isGreaterThanOrEqualTo(${schema.minimum})`)
  }
  if (typeof schema.maximum === "number") {
    out.push(`Schema.isLessThanOrEqualTo(${schema.maximum})`)
  }
  if (typeof schema.exclusiveMinimum === "number") {
    out.push(`Schema.isGreaterThan(${schema.exclusiveMinimum})`)
  }
  if (typeof schema.exclusiveMaximum === "number") {
    out.push(`Schema.isLessThan(${schema.exclusiveMaximum})`)
  }
  if (typeof schema.multipleOf === "number") {
    out.push(`Schema.isMultipleOf(${schema.multipleOf})`)
  }
  // Array checks
  if (typeof schema.minItems === "number") {
    // if `schema` is a tuple with more elements that `schema.minItems`
    // then this is already handled by element optionality
    if (!isTupleWithMoreElementsThan(schema, schema.minItems, target)) {
      out.push(`Schema.isMinLength(${schema.minItems})`)
    }
  }
  if (typeof schema.maxItems === "number") {
    out.push(`Schema.isMaxLength(${schema.maxItems})`)
  }
  if (schema.uniqueItems === true) {
    out.push(`Schema.isUnique(Equal.equivalence())`)
  }
  // Object checks
  if (typeof schema.minProperties === "number") {
    out.push(`Schema.isMinProperties(${schema.minProperties})`)
  }
  if (typeof schema.maxProperties === "number") {
    out.push(`Schema.isMaxProperties(${schema.maxProperties})`)
  }
  if (Array.isArray(schema.allOf)) {
    for (const member of schema.allOf) {
      if (isObject(member)) {
        const checks = getChecks(member, target)
        if (checks.length > 0) {
          const annotations = getAnnotations(member)
          if (annotations.length > 0) {
            checks[checks.length - 1] = checks[checks.length - 1].substring(0, checks[checks.length - 1].length - 1) +
              `, { ${annotations.join(", ")} })`
          }
          checks.forEach((check) => out.push(check))
        }
      }
    }
  }
  return out
}

function appendCode(out: Output, code: string): Output {
  return {
    ...out,
    code: out.code + code
  }
}

function handleAnnotationsAndChecks(schema: Schema.JsonSchema.Fragment, options: GoOptions): Output {
  let out = base(schema, options)
  const check = getChecks(schema, options.target)
  const annotations = getAnnotations(schema)
  if (annotations.length > 0) {
    out = appendCode(out, `.annotate({ ${annotations.join(", ")} })`)
  }
  if (check.length > 0) {
    out = appendCode(out, `.check(${check.join(", ")})`)
  }
  return out
}

interface HasType extends Schema.JsonSchema.Fragment {
  readonly type: Schema.JsonSchema.Type
}

const types = ["null", "string", "number", "integer", "boolean", "object", "array"]

function hasType(schema: Schema.JsonSchema.Fragment): schema is HasType {
  return typeof schema.type === "string" && types.includes(schema.type)
}

function handleType(type: Schema.JsonSchema.Type): Output {
  return typeMap[type]
}

function handleHasType(schema: HasType, options: GoOptions): Output {
  switch (schema.type) {
    case "null":
    case "string":
    case "number":
    case "integer":
    case "boolean":
      return typeMap[schema.type]
    case "object": {
      if (Object.keys(schema).length === 1) {
        return UnknownRecord
      }
      if (isObject(schema.properties)) {
        const required = Array.isArray(schema.required) ? schema.required : []
        return makeStruct(
          Object.entries(schema.properties).map(([key, value]) => {
            return { key, value: recur(value, options), isRequired: required.includes(key) }
          })
        )
      }
      // TODO: handle StructAndRest
      return UnknownRecord
    }
    case "array": {
      const minItems = typeof schema.minItems === "number" ? schema.minItems : Infinity
      const elements = getTupleElements(schema, options.target)
      switch (options.target) {
        case "draft-07": {
          const rest = isObject(schema.items)
            ? schema.items
            : isObject(schema.additionalItems)
            ? schema.additionalItems
            : undefined
          return array(
            elements.map((item, index) => ({ value: recur(item, options), isRequired: index < minItems })),
            rest !== undefined ? recur(rest, options) : undefined
          )
        }
        case "2020-12":
        case "oas3.1": {
          const rest = isObject(schema.items)
            ? schema.items
            : undefined
          return array(
            elements.map((item, index) => ({ value: recur(item, options), isRequired: index < minItems })),
            rest !== undefined ? recur(rest, options) : undefined
          )
        }
      }
    }
  }
}

function getTupleElements(
  schema: Schema.JsonSchema.Fragment,
  target: Annotations.JsonSchema.Target
): ReadonlyArray<Schema.JsonSchema.Fragment> {
  switch (target) {
    case "draft-07": {
      return Array.isArray(schema.items) ? schema.items : []
    }
    case "2020-12":
    case "oas3.1": {
      return Array.isArray(schema.prefixItems) ? schema.prefixItems : []
    }
  }
}

function base(schema: Schema.JsonSchema.Fragment, options: GoOptions): Output {
  if (Array.isArray(schema.type)) {
    return makeUnion(schema.type.map(handleType), "anyOf")
  }

  if (schema.const !== undefined) {
    return {
      code: `Schema.Literal(${format(schema.const)})`,
      type: format(schema.const)
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
          type
        }
      default:
        return {
          code: `Schema.Literals([${schema.enum.map((e) => format(e)).join(", ")}])`,
          type
        }
    }
  }

  if (Array.isArray(schema.anyOf)) {
    if (schema.anyOf.length === 0) return Never
    if (isEmptyStruct(schema.anyOf)) return EmptyStruct
    return makeUnion(schema.anyOf.map((schema) => recur(schema, options)), "anyOf")
  }

  if (Array.isArray(schema.oneOf)) {
    if (schema.oneOf.length === 0) return Never
    if (isEmptyStruct(schema.oneOf)) return EmptyStruct
    return makeUnion(schema.oneOf.map((schema) => recur(schema, options)), "oneOf")
  }

  // TODO: and "allOf"

  if (hasType(schema)) {
    // TODO: and "allOf"
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
          type: identifier
        }
      }
      return {
        code: identifier,
        type: identifier
      }
    }
    throw new Error(`Invalid $ref: ${schema.$ref}`)
  }

  if (isObject(schema.not) && Object.keys(schema.not).length === 0) {
    return Never
  }

  return Unknown
}

function makeStruct(
  properties: ReadonlyArray<{
    readonly key: string
    readonly value: Output
    readonly isRequired: boolean
  }>
): Output {
  return {
    code: `Schema.Struct({ ${
      properties.map((p) => `${p.key}: ${p.isRequired ? p.value.code : `Schema.optionalKey(${p.value.code})`}`).join(
        ", "
      )
    } })`,
    type: `{ ${properties.map((p) => `readonly ${p.key}${p.isRequired ? "" : "?"}: ${p.value.type}`).join(", ")} }`
  }
}

function optionalKeyRuntime(isRequired: boolean, code: string): string {
  return isRequired ? code : `Schema.optionalKey(${code})`
}

function optionalKeyType(isRequired: boolean, type: string): string {
  return isRequired ? type : `${type}?`
}

function object(
  properties: ReadonlyArray<{
    readonly key: string
    readonly value: Output
    readonly isRequired: boolean
  }>,
  indexSignatures: ReadonlyArray<{ readonly key: Output; readonly value: Output }>
): Output {
  if (indexSignatures.length === 0) {
    return {
      code: `Schema.Struct({ ${
        properties.map((p) => `${p.key}: ${optionalKeyRuntime(p.isRequired, p.value.code)}`).join(
          ", "
        )
      } })`,
      type: `{ ${
        properties.map((p) => `readonly ${optionalKeyType(p.isRequired, p.key)}: ${p.value.type}`).join(", ")
      } }`
    }
  } else if (properties.length === 0) {
    if (indexSignatures.length === 1) {
      const { key, value } = indexSignatures[0]
      return {
        code: `Schema.Record(${key.code}, ${value.code})`,
        type: `Record<${key.type}, ${value.type}>`
      }
    } else {
      throw new Error("Not implemented: ObjectAndRest")
    }
  } else {
    throw new Error("Not implemented: ObjectAndRest")
  }
}

function array(
  elements: ReadonlyArray<{
    readonly value: Output
    readonly isRequired: boolean
  }>,
  item: Output | undefined
): Output {
  if (item === undefined) {
    return {
      code: `Schema.Tuple([${elements.map((e) => optionalKeyRuntime(e.isRequired, e.value.code)).join(", ")}])`,
      type: `readonly [${elements.map((e) => optionalKeyType(e.isRequired, e.value.type)).join(", ")}]`
    }
  } else if (elements.length === 0) {
    return {
      code: `Schema.Array(${item.code})`,
      type: `ReadonlyArray<${item.type}>`
    }
  } else {
    return {
      code: `Schema.TupleWithRest(Schema.Tuple([${
        elements.map((e) => optionalKeyRuntime(e.isRequired, e.value.code)).join(", ")
      }]), [${item.code}])`,
      type: `readonly [${
        elements.map((e) => optionalKeyType(e.isRequired, e.value.type)).join(", ")
      }, ...Array<${item.type}>]`
    }
  }
}

function makeUnion(members: ReadonlyArray<Output>, mode: "anyOf" | "oneOf"): Output {
  return {
    code: `Schema.Union([${members.map((m) => m.code).join(", ")}]${mode === "oneOf" ? `, { mode: "oneOf" }` : ""})`,
    type: members.map((m) => m.type).join(" | ")
  }
}

const Never: Output = { code: "Schema.Never", type: "never" }
const Unknown: Output = { code: "Schema.Unknown", type: "unknown" }
const Null: Output = { code: "Schema.Null", type: "null" }
const String: Output = { code: "Schema.String", type: "string" }
const Number: Output = { code: "Schema.Number", type: "number" }
const Int: Output = { code: "Schema.Int", type: "number" }
const Boolean: Output = { code: "Schema.Boolean", type: "boolean" }
const UnknownRecord: Output = object([], [{ key: String, value: Unknown }])
const UnknownArray: Output = array([], Unknown)
const EmptyStruct: Output = { code: "Schema.Struct({})", type: "{}" }

const typeMap = {
  "null": Null,
  "string": String,
  "number": Number,
  "integer": Int,
  "boolean": Boolean,
  "object": UnknownRecord,
  "array": UnknownArray
}

function stripAnnotations(schema: Schema.JsonSchema.Fragment): Schema.JsonSchema.Fragment {
  const out: Schema.JsonSchema.Fragment = { ...schema }
  delete out.title
  delete out.description
  delete out.default
  delete out.examples
  return out
}

function isUnknownRecord(schema: Schema.JsonSchema.Fragment): boolean {
  return schema.type === "object" && Object.keys(stripAnnotations(schema)).length === 1
}

function isUnknownArray(schema: Schema.JsonSchema.Fragment): boolean {
  return schema.type === "array" && Object.keys(stripAnnotations(schema)).length === 1
}

function isEmptyStruct(schema: ReadonlyArray<Schema.JsonSchema.Fragment>): boolean {
  return schema.length === 2 && isUnknownRecord(schema[0]) && isUnknownArray(schema[1])
}

function unescapeJsonPointer(identifier: string) {
  return identifier.replace(/~0/ig, "~").replace(/~1/ig, "/")
}
