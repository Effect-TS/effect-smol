/**
 * @since 4.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Arr from "../../Array.ts"
import * as Combiner from "../../Combiner.ts"
import { format } from "../../Formatter.ts"
import type { JsonPatchOperation } from "../../JsonPatch.ts"
import type * as JsonSchema from "../../JsonSchema.ts"
import * as Rec from "../../Record.ts"
import type * as Schema from "../../Schema.ts"
import * as Struct from "../../Struct.ts"
import * as UndefinedOr from "../../UndefinedOr.ts"

/**
 * @since 4.0.0
 */
export type Path = readonly ["schema" | "definitions", ...ReadonlyArray<string | number>]

/**
 * @since 4.0.0
 */
export interface RewriterTracer {
  push(change: JsonPatchOperation): void
}

/**
 * @since 4.0.0
 */
export type Rewriter = <S extends JsonSchema.Source>(
  document: JsonSchema.Document<S>,
  tracer?: RewriterTracer
) => JsonSchema.Document<S>

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
export const openAiRewriter: Rewriter = (document, tracer) => {
  return {
    source: document.source,
    schema: top(document.schema, ["schema"]),
    definitions: Rec.map(document.definitions, (value) => recur(value, ["definitions"]))
  }

  function top(schema: JsonSchema.JsonSchema, path: Path): JsonSchema.JsonSchema {
    // [ROOT_OBJECT_REQUIRED]
    if (schema.type !== "object") {
      const value = getDefaultSchema(schema)
      tracer?.push({
        op: "replace",
        path: formatPath(path),
        value,
        description: "[ROOT_OBJECT_REQUIRED]"
      })
      return value
    }
    return recur(schema, path)
  }

  function recur(schema: JsonSchema.JsonSchema, path: Path): JsonSchema.JsonSchema {
    // anyOf
    if (Array.isArray(schema.anyOf)) {
      const value = whitelistProperties(schema, path, ["anyOf"], tracer)
      // recursively rewrite members
      const anyOf = schema.anyOf.map((value, i: number) => recur(value, [...path, "anyOf", i]))
      value.anyOf = anyOf
      return value
    }

    // [ONE_OF -> ANY_OF]
    if (Array.isArray(schema.oneOf)) {
      const value = whitelistProperties(schema, path, ["oneOf"], tracer)
      // recursively rewrite members
      const anyOf = schema.oneOf.map((value, i: number) => recur(value, [...path, "oneOf", i]))
      value.anyOf = anyOf
      delete value.oneOf
      tracer?.push({
        op: "replace",
        path: formatPath(path),
        value,
        description: "[ONE_OF -> ANY_OF]"
      })
      return value
    }

    // [MERGE_ALL_OF]
    if (Array.isArray(schema.allOf)) {
      const { allOf, ...rest } = schema
      const value = allOf.reduce((acc, curr) => propertiesReducer.combine(acc, curr), rest)
      tracer?.push({
        op: "replace",
        path: formatPath(path),
        value,
        description: `[MERGE_ALL_OF]: ${allOf.length} fragment(s)`
      })
      return recur(value, path)
    }

    // type: "string", "number", "integer", "boolean"
    if (
      schema.type === "string"
      || schema.type === "number"
      || schema.type === "integer"
      || schema.type === "boolean"
    ) {
      return whitelistProperties(schema, path, ["type", "enum"], tracer)
    }

    // type: "array"
    if (schema.type === "array") {
      const value: any = whitelistProperties(schema, path, ["type", "items", "prefixItems"], tracer)
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
        ["type", "properties", "required", "additionalProperties"],
        tracer
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
              tracer?.push({
                op: "add",
                path: formatPath([...path, "required", "-"]),
                value: key,
                description: `[ADD_REQUIRED_PROPERTY]: ${format(key)}`
              })
            }
          }
        }
      }

      // [SET_ADDITIONAL_PROPERTIES_TO_FALSE]
      if (value.additionalProperties !== false) {
        value.additionalProperties = false
        tracer?.push({
          op: "replace",
          path: formatPath([...path, "additionalProperties"]),
          value: false,
          description: "[SET_ADDITIONAL_PROPERTIES_TO_FALSE]"
        })
      }

      return value
    }

    // $refs
    if (schema.$ref !== undefined) {
      return schema
    }

    // [CONST -> ENUM]
    if (schema.const !== undefined) {
      const value: any = whitelistProperties(schema, path, ["const"], tracer)
      value.enum = [schema.const]
      delete value.const
      tracer?.push({
        op: "replace",
        path: formatPath(path),
        value,
        description: "[CONST -> ENUM]"
      })
      return value
    }

    const value = getDefaultSchema(schema)
    tracer?.push({
      op: "replace",
      path: formatPath(path),
      value,
      description: "[UNKNOWN_SCHEMA_TYPE]"
    })
    return value
  }
}

function formatPath(path: Path): string {
  return "/" + path.join("/")
}

function whitelistProperties(
  schema: JsonSchema.JsonSchema,
  path: Path,
  whitelist: Iterable<string>,
  tracer?: RewriterTracer | undefined
): any {
  const out = { ...schema }
  const w = new Set([...whitelist, ...["description", "title", "default", "examples"]])
  for (const key of Object.keys(schema)) {
    if (w.has(key)) continue

    tracer?.push({
      op: "remove",
      path: formatPath([...path, key]),
      description: `[UNSUPPORTED_PROPERTY_KEY]: ${format(key)}`
    })

    delete out[key]
  }
  return out
}

const join = UndefinedOr.getReducer(Combiner.make<string>((a, b) => {
  a = a.trim()
  b = b.trim()
  if (a === "") return b
  if (b === "") return a
  return `${a}, ${b}`
}))

const propertiesReducer = Struct.getReducer({
  type: UndefinedOr.getReducer(Combiner.first<string>()),
  description: join,
  title: join,
  default: UndefinedOr.getReducer(Combiner.last()),
  examples: UndefinedOr.getReducer(Arr.getReducerConcat())
}, {
  omitKeyWhen: Predicate.isUndefined
})

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
