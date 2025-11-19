/**
 * @since 4.0.0
 */
import * as Arr from "../collections/Array.ts"
import * as Predicate from "../data/Predicate.ts"
import { format } from "../interfaces/Inspectable.ts"
import type * as Annotations from "./Annotations.ts"
import type * as Schema from "./Schema.ts"

/**
 * @since 4.0.0
 */
export function make(schema: unknown, options?: {
  readonly target: Annotations.JsonSchema.Target
  readonly definitions?: Schema.JsonSchema.Definitions | undefined
}): string {
  const definitions = options?.definitions ?? {}
  return go(schema, { definitions })
}

const Never = "Schema.Never"
const Unknown = "Schema.Unknown"

function Union(members: ReadonlyArray<string>, mode: "anyOf" | "oneOf"): string {
  return `Schema.Union([${members.join(", ")}]${mode === "oneOf" ? ", { mode: \"oneOf\" }" : ""})`
}

interface GoOptions {
  readonly definitions: Schema.JsonSchema.Definitions
}

function go(schema: unknown, options: GoOptions): string {
  if (Predicate.isBoolean(schema)) {
    return schema ? Unknown : Never
  }
  if (Predicate.isObject(schema)) {
    return checksAndAnnotations(schema, options)
  }
  return Unknown
}

function getAnnotations(schema: Record<string, unknown>): ReadonlyArray<string> {
  const annotations: Array<string> = []
  if (Predicate.isString(schema.title)) {
    annotations.push(`title: "${schema.title}"`)
  }
  if (Predicate.isString(schema.description)) {
    annotations.push(`description: "${schema.description}"`)
  }
  if (Predicate.isString(schema.default)) {
    annotations.push(`default: ${format(schema.default)}`)
  }
  if (Arr.isArray(schema.examples)) {
    annotations.push(`examples: [${schema.examples.map((example) => format(example)).join(", ")}]`)
  }
  return annotations
}

function getChecks(schema: Record<string, unknown>): Array<string> {
  const checks: Array<string> = []
  if (Predicate.isNumber(schema.minLength)) {
    checks.push(`Schema.isMinLength(${schema.minLength})`)
  }
  if (Predicate.isNumber(schema.maxLength)) {
    checks.push(`Schema.isMaxLength(${schema.maxLength})`)
  }
  if (Arr.isArray(schema.allOf)) {
    for (const member of schema.allOf) {
      if (Predicate.isObject(member)) {
        const c = getChecks(member)
        if (c.length > 0) {
          const a = getAnnotations(member)
          if (a.length > 0) {
            c[c.length - 1] = c[c.length - 1].substring(0, c[c.length - 1].length - 1) + `, { ${a.join(", ")} })`
          }
          c.forEach((check) => checks.push(check))
        }
      }
    }
  }
  return checks
}

function checksAndAnnotations(schema: Record<string, unknown>, options: GoOptions): string {
  let out = base(schema, options)
  const c = getChecks(schema)
  const a = getAnnotations(schema)
  if (a.length > 0) {
    out += `.annotate({ ${a.join(", ")} })`
  }
  if (c.length > 0) {
    out += `.check(${c.join(", ")})`
  }
  return out
}

function baseByType(type: unknown): string {
  if (Predicate.isString(type)) {
    switch (type) {
      case "null":
        return "Schema.Null"
      case "string":
        return "Schema.String"
      case "number":
        return "Schema.Number"
      case "integer":
        return "Schema.Int"
      case "boolean":
        return "Schema.Boolean"
      case "object":
        return "Schema.Struct({})"
      case "array":
        return "Schema.Tuple([])"
    }
  }
  return Unknown
}

function base(schema: Record<string, unknown>, options: GoOptions): string {
  if ("type" in schema) {
    if (Arr.isArray(schema.type)) {
      return Union(schema.type.map(baseByType), "anyOf")
    }
    return baseByType(schema.type)
  }
  if (Arr.isArray(schema.anyOf)) {
    if (schema.anyOf.length === 0) return Never
    return Union(schema.anyOf.map((schema) => go(schema, options)), "anyOf")
  }
  if (Arr.isArray(schema.oneOf)) {
    if (schema.oneOf.length === 0) return Never
    return Union(schema.oneOf.map((schema) => go(schema, options)), "oneOf")
  }
  if (Predicate.isObject(schema.not) && Object.keys(schema.not).length === 0) {
    return Never
  }
  if (Predicate.isString(schema.$ref)) {
    const identifier = getIdentifierFromRef(schema.$ref)
    if (identifier === undefined) {
      throw new Error(`Invalid $ref: ${schema.$ref}`)
    }
    return go(options.definitions[identifier], options) + `.annotate({ identifier: "${identifier}" })`
  }
  return Unknown
}

function getIdentifierFromRef(ref: string): string | undefined {
  return ref.split("/").pop()
}
