/**
 * @since 4.0.0
 */
import * as Combiner from "../../Combiner.ts"
import * as JsonSchema from "../../JsonSchema.ts"
import * as Rec from "../../Record.ts"
import type * as Schema from "../../Schema.ts"
import * as UndefinedOr from "../../UndefinedOr.ts"

/**
 * @since 4.0.0
 */
export type Path = readonly ["schema" | "definitions", ...ReadonlyArray<string | number>]

/**
 * @since 4.0.0
 */
export type Rewriter = (document: JsonSchema.Document<"draft-2020-12">) => JsonSchema.Document<"draft-2020-12">

/**
 * Rewrites a JSON Schema to an OpenAI-compatible schema.
 *
 * Rules:
 *
 * - Root must be an object and not a union.
 * - Rewrite `oneOf` to `anyOf`.
 * - Merge `allOf` into a single schema.
 * - Add missing required properties.
 * - Remove unsupported property keys.
 * - Set `additionalProperties` to false.
 * - Rewrite `const` to `enum`.
 *
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas?type-restrictions=string-restrictions#supported-schemas
 *
 * @since 4.0.0
 */
export const openAi: Rewriter = (document) => {
  document = JsonSchema.resolveTopLevel$ref(document)
  const supported = new Set([
    "$ref",
    "type",
    "description",
    "format",
    "anyOf",
    "oneOf",
    "allOf",
    "enum",
    "const",
    "properties",
    "required",
    "additionalProperties",
    "prefixItems",
    "items",
    "multipleOf",
    "maximum",
    "minimum",
    "exclusiveMaximum",
    "exclusiveMinimum",
    "pattern",
    "minItems",
    "maxItems"
  ])

  return {
    dialect: document.dialect,
    schema: top(document.schema),
    definitions: Rec.map(document.definitions, recur)
  }

  function top(schema: JsonSchema.JsonSchema): JsonSchema.JsonSchema {
    // Root must be an object and not a union
    if (schema.type !== "object" || "anyOf" in schema || "oneOf" in schema) return defaultSchema

    return recur(schema)
  }

  function normalize(schema: JsonSchema.JsonSchema): JsonSchema.JsonSchema {
    const out = { ...schema }
    for (const key of Object.keys(schema)) {
      if (supported.has(key)) continue
      delete out[key]
    }
    return out
  }

  function recur(schema: JsonSchema.JsonSchema): JsonSchema.JsonSchema {
    schema = normalize(schema)

    // Merge `allOf` into a single schema
    if (Array.isArray(schema.allOf)) {
      const { allOf, ...rest } = schema
      schema = allOf.reduce((acc, curr) => combine(acc, normalize(curr)), rest)
    }

    // anyOf
    if (Array.isArray(schema.anyOf)) {
      schema.anyOf = schema.anyOf.map(recur)
    }

    // Rewrite `oneOf` to `anyOf`
    if (Array.isArray(schema.oneOf)) {
      schema.anyOf = schema.oneOf.map(recur)
      delete schema.oneOf
    }

    // type: "array"
    if (schema.type === "array") {
      // recursively rewrite prefixItems
      if (Array.isArray(schema.prefixItems)) {
        schema.prefixItems = schema.prefixItems.map(recur)
      }
      // recursively rewrite items
      const items = schema.items as JsonSchema.JsonSchema | undefined
      if (items !== undefined) {
        schema.items = recur(items)
      }
    }

    // type: "object"
    if (schema.type === "object") {
      // recursively rewrite properties
      const ps = schema.properties as Record<string, JsonSchema.JsonSchema> | undefined
      if (ps !== undefined) {
        const properties = Rec.map(ps, recur)

        // Add missing required properties
        const keys = Object.keys(properties)
        const required = Array.isArray(schema.required) ? [...schema.required] : []
        if (required.length < keys.length) {
          const set = new Set(required)
          for (const key of keys) {
            if (!set.has(key)) {
              required.push(key)
              const p = properties[key]
              if (typeof p.type === "string") {
                p.type = [p.type, "null"]
              } else if (Array.isArray(p.type)) {
                if (!p.type.includes("null")) {
                  p.type.push("null")
                }
              } else if (Array.isArray(p.anyOf)) {
                if (!p.anyOf.some((item) => item.type === "null")) {
                  p.anyOf.push({ "type": "null" })
                }
              } else {
                properties[key] = { "anyOf": [p, { "type": "null" }] }
              }
            }
          }
        }
        schema.properties = properties
        schema.required = required
      }

      // Set `additionalProperties` to false
      if (schema.additionalProperties !== false) {
        schema.additionalProperties = false
      }
    }

    // Rewrite `const` to `enum`
    if (schema.const !== undefined) {
      schema.enum = [schema.const]
      delete schema.const
    }

    return schema
  }
}

function combine(a: JsonSchema.JsonSchema, b: JsonSchema.JsonSchema): JsonSchema.JsonSchema {
  const out = { ...a }
  for (const key of Object.keys(b)) {
    if (key === "description") {
      out[key] = join.combine(a[key], b[key])
    } else {
      out[key] = b[key]
    }
  }
  return out
}

const join = UndefinedOr.makeReducer(Combiner.make<unknown>((a, b) => {
  if (typeof a !== "string") return b
  if (typeof b !== "string") return a
  a = a.trim()
  b = b.trim()
  if (a === "") return b
  if (b === "") return a
  return `${a}, ${b}`
}))

const defaultSchema: Schema.JsonObject = {
  "type": "object",
  "properties": {},
  "required": [],
  "additionalProperties": false
}
