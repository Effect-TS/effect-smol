/**
 * @since 4.0.0
 */
import * as Combiner from "../../Combiner.ts"
import type * as JsonSchema from "../../JsonSchema.ts"
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
 * - [ROOT_OBJECT_REQUIRED]: Root must be an object.
 * - [ONE_OF -> ANY_OF]: Rewrite `oneOf` to `anyOf`.
 * - [MERGE_ALL_OF]: Merge allOf into a single schema.
 * - [ADD_REQUIRED_PROPERTY]: Add required property.
 * - [UNSUPPORTED_PROPERTY_KEY]: Remove unsupported property keys.
 * - [SET_ADDITIONAL_PROPERTIES_TO_FALSE]: Set `additionalProperties` to false.
 * - [CONST -> ENUM]: Rewrite `const` to `enum`.
 *
 * @see https://platform.openai.com/docs/guides/structured-outputs/supported-schemas?type-restrictions=string-restrictions#supported-schemas
 *
 * @since 4.0.0
 */
export const openAi: Rewriter = (document) => {
  return {
    source: document.source,
    schema: top(document.schema, ["schema"]),
    definitions: Rec.map(document.definitions, (value) => recur(value, ["definitions"]))
  }

  function top(schema: JsonSchema.JsonSchema, path: Path): JsonSchema.JsonSchema {
    // [ROOT_OBJECT_REQUIRED]
    if (schema.type !== "object") {
      const value = getDefaultSchema(schema)
      return value
    }
    return recur(schema, path)
  }

  function recur(schema: JsonSchema.JsonSchema, path: Path): JsonSchema.JsonSchema
  function recur(schema: JsonSchema.JsonSchema | boolean, path: Path): JsonSchema.JsonSchema | boolean
  function recur(schema: JsonSchema.JsonSchema | boolean, path: Path): JsonSchema.JsonSchema | boolean {
    if (typeof schema === "boolean") return schema
    // anyOf
    if (Array.isArray(schema.anyOf)) {
      const value = whitelistProperties(schema, path, ["anyOf"])
      // recursively rewrite members
      const anyOf = schema.anyOf.map((value, i: number) => recur(value, [...path, "anyOf", i]))
      value.anyOf = anyOf
      return value
    }

    // [ONE_OF -> ANY_OF]
    if (Array.isArray(schema.oneOf)) {
      const value = whitelistProperties(schema, path, ["oneOf"])
      // recursively rewrite members
      const anyOf = schema.oneOf.map((value, i: number) => recur(value, [...path, "oneOf", i]))
      value.anyOf = anyOf
      delete value.oneOf
      return recur(value, path)
    }

    // [MERGE_ALL_OF]
    if (Array.isArray(schema.allOf)) {
      const { allOf, ...rest } = schema
      const value = allOf.reduce((acc, curr) => combine(acc, curr), rest)
      return recur(value, path)
    }

    // type: "string", "number", "integer", "boolean"
    if (
      schema.type === "string"
      || schema.type === "number"
      || schema.type === "integer"
      || schema.type === "boolean"
    ) {
      return whitelistProperties(schema, path, ["type", "enum"])
    }

    // type: "array"
    if (schema.type === "array") {
      const value: any = whitelistProperties(schema, path, ["type", "items", "prefixItems"])
      // recursively rewrite prefixItems
      if (value.prefixItems) {
        value.prefixItems = value.prefixItems.map((value: JsonSchema.JsonSchema, i: number) =>
          recur(value, [...path, "prefixItems", i])
        )
      }
      // recursively rewrite items
      if (value.items) {
        value.items = recur(value.items, [...path, "items"])
      }
      return value
    }

    // type: "object"
    if (schema.type === "object") {
      const value: any = whitelistProperties(
        schema,
        path,
        ["type", "properties", "required", "additionalProperties"]
      )

      // recursively rewrite properties
      if (value.properties !== undefined) {
        value.properties = Rec.map(
          value.properties,
          (value: JsonSchema.JsonSchema, key: string) => recur(value, [...path, "properties", key])
        )

        // [ADD_REQUIRED_PROPERTY]
        const keys = Object.keys(value.properties)
        value.required = value.required !== undefined ? [...value.required] : []
        if (value.required.length < keys.length) {
          const required = new Set(value.required)
          for (const key of keys) {
            if (!required.has(key)) {
              value.required.push(key)
              const property = value.properties[key]
              const type = property.type
              if (typeof type === "string") {
                property.type = [type, "null"] as any
              } else {
                if (Array.isArray(property.anyOf)) {
                  value.properties[key] = {
                    ...property,
                    "anyOf": [...property.anyOf, { "type": "null" }]
                  }
                } else {
                  value.properties[key] = { "anyOf": [property, { "type": "null" }] }
                }
              }
            }
          }
        }
      }

      // [SET_ADDITIONAL_PROPERTIES_TO_FALSE]
      if (value.additionalProperties !== false) {
        value.additionalProperties = false
      }

      return value
    }

    // $refs
    if (schema.$ref !== undefined) {
      return schema
    }

    // [CONST -> ENUM]
    if (schema.const !== undefined) {
      const value: any = whitelistProperties(schema, path, ["const"])
      value.enum = [schema.const]
      delete value.const
      return value
    }

    const value = getDefaultSchema(schema)
    return value
  }
}

function whitelistProperties(
  schema: JsonSchema.JsonSchema,
  path: Path,
  whitelist: Iterable<string>
): any {
  const out = { ...schema }
  const w = new Set([...whitelist, ...["description", "title", "default", "examples"]])
  for (const key of Object.keys(schema)) {
    if (w.has(key)) continue
    delete out[key]
  }
  return out
}

function combine(a: JsonSchema.JsonSchema, b: JsonSchema.JsonSchema): JsonSchema.JsonSchema {
  const out = { ...a }
  for (const key of Object.keys(b)) {
    if (key in combiners) {
      out[key] = combiners[key as keyof typeof combiners].combine(a[key], b[key])
    } else {
      out[key] = b[key]
    }
  }
  return out
}

const join = UndefinedOr.getReducer(Combiner.make<unknown>((a, b) => {
  if (typeof a !== "string") return b
  if (typeof b !== "string") return a
  a = a.trim()
  b = b.trim()
  if (a === "") return b
  if (b === "") return a
  return `${a}, ${b}`
}))

const concat = UndefinedOr.getReducer(Combiner.make<unknown>((a, b) => {
  if (!Array.isArray(a)) return b
  if (!Array.isArray(b)) return a
  return [...a, ...b]
}))

const combiners = {
  type: UndefinedOr.getReducer(Combiner.last()),
  description: join,
  title: join,
  default: UndefinedOr.getReducer(Combiner.last()),
  examples: concat
}

function getDefaultSchema(schema: JsonSchema.JsonSchema): Schema.JsonObject {
  const out: Schema.MutableJsonObject = {
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": false
  }
  if (typeof schema.description === "string") out.description = schema.description
  if (typeof schema.title === "string") out.title = schema.title
  return out
}
