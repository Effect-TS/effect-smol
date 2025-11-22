/**
 * @since 4.0.0
 */
import { format } from "../data/Formatter.ts"
import { isObject } from "../data/Predicate.ts"
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
  if (typeof schema === "boolean") {
    return schema ? Unknown : Never
  }
  if (isObject(schema)) {
    return getAnnotationsAndChecks(schema, options)
  }
  return Unknown
}

function getAnnotations(schema: Record<string, unknown>): ReadonlyArray<string> {
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

function getChecks(schema: Record<string, unknown>): Array<string> {
  const out: Array<string> = []
  if (typeof schema.minLength === "number") {
    out.push(`Schema.isMinLength(${schema.minLength})`)
  }
  if (typeof schema.maxLength === "number") {
    out.push(`Schema.isMaxLength(${schema.maxLength})`)
  }
  if (Array.isArray(schema.allOf)) {
    for (const member of schema.allOf) {
      if (isObject(member)) {
        const checks = getChecks(member)
        if (checks.length > 0) {
          const a = getAnnotations(member)
          if (a.length > 0) {
            checks[checks.length - 1] = checks[checks.length - 1].substring(0, checks[checks.length - 1].length - 1) +
              `, { ${a.join(", ")} })`
          }
          checks.forEach((check) => out.push(check))
        }
      }
    }
  }
  return out
}

function getAnnotationsAndChecks(schema: Record<string, unknown>, options: GoOptions): string {
  let out = base(schema, options)
  const check = getChecks(schema)
  const annotations = getAnnotations(schema)
  if (annotations.length > 0) {
    out += `.annotate({ ${annotations.join(", ")} })`
  }
  if (check.length > 0) {
    out += `.check(${check.join(", ")})`
  }
  return out
}

function baseByType(type: unknown): string {
  if (typeof type === "string") {
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
    if (Array.isArray(schema.type)) {
      return Union(schema.type.map(baseByType), "anyOf")
    }
    return baseByType(schema.type)
  }
  if (Array.isArray(schema.anyOf)) {
    if (schema.anyOf.length === 0) return Never
    return Union(schema.anyOf.map((schema) => go(schema, options)), "anyOf")
  }
  if (Array.isArray(schema.oneOf)) {
    if (schema.oneOf.length === 0) return Never
    return Union(schema.oneOf.map((schema) => go(schema, options)), "oneOf")
  }
  if (isObject(schema.not) && Object.keys(schema.not).length === 0) {
    return Never
  }
  if (typeof schema.$ref === "string") {
    const identifier = getIdentifierFromRef(schema.$ref)
    if (identifier === undefined) {
      throw new Error(`Invalid $ref: ${schema.$ref}`)
    }
    const definition: Schema.JsonSchema.Schema | undefined = options.definitions[identifier]
    if (definition === undefined) {
      throw new Error(`Definition not found for $ref: ${schema.$ref}`)
    }
    return go(definition, options) + `.annotate({ identifier: "${identifier}" })`
  }
  return Unknown
}

function getIdentifierFromRef(ref: string): string | undefined {
  const last = ref.split("/").pop()
  if (last !== undefined) {
    return unescapeJsonPointer(last)
  }
}

function unescapeJsonPointer(identifier: string) {
  return identifier.replace(/~0/ig, "~").replace(/~1/ig, "/")
}
