/**
 * @since 4.0.0
 */
import * as Predicate from "./Predicate.ts"
import * as Rec from "./Record.ts"

/**
 * @since 4.0.0
 */
export interface JsonSchema {
  [x: string]: unknown
}

/**
 * @since 4.0.0
 */
export type Target = "draft-07" | "draft-2020-12" | "openapi-3.1"

/**
 * @since 4.0.0
 */
export type Source = Target | "openapi-3.0"

/**
 * @since 4.0.0
 */
export type Type = "string" | "number" | "boolean" | "array" | "object" | "null" | "integer"

/**
 * @since 4.0.0
 */
export interface Definitions extends Record<string, JsonSchema> {} // TODO: replace `JsonSchema` with `JsonSchema`

/**
 * @since 4.0.0
 */
export interface Document<S extends Source> {
  readonly source: S
  readonly schema: JsonSchema
  readonly definitions: Definitions
}

/**
 * @since 4.0.0
 */
export function getMetaSchemaUri(target: Target) {
  switch (target) {
    case "draft-07":
      return "http://json-schema.org/draft-07/schema"
    case "draft-2020-12":
    case "openapi-3.1":
      return "https://json-schema.org/draft/2020-12/schema"
  }
}

/**
 * Convert a Draft 07 JSON Schema to a Draft 2020-12 JSON Schema.
 *
 * Notes:
 * - `$schema` is stripped at every level.
 * - `definitions` is renamed to `$defs`.
 * - Tuple validation (`items: []`) becomes `prefixItems`, and `additionalItems`
 *   becomes `items` when present.
 * - `$ref` fragments pointing at `#/definitions/...` are rewritten to `#/$defs/...`.
 *
 * @since 4.0.0
 */
export function fromDraft07(schema: JsonSchema | boolean): JsonSchema | boolean {
  return recur(schema) as JsonSchema | boolean

  function recur(node: unknown): unknown {
    if (typeof node === "boolean" || !Predicate.isObject(node)) return node

    const out: Record<string, unknown> = {}

    // Special handling needs access to both keys
    let items: unknown = undefined
    let additionalItems: unknown = undefined
    let definitions: unknown = undefined

    for (const key of Object.keys(node)) {
      const value = node[key]

      switch (key) {
        // Strip $schema everywhere
        case "$schema":
          break

        // Rewrite local refs to definitions -> $defs
        case "$ref": {
          out.$ref = typeof value === "string"
            ? value.replace(/^#\/definitions\//g, "#/$defs/")
            : value
          break
        }

        // Rename to $defs after recursion (so we can recurse into the values)
        case "definitions": {
          definitions = value
          break
        }

        // Special handling after the loop (needs both)
        case "items": {
          items = value
          break
        }
        case "additionalItems": {
          additionalItems = value
          break
        }

        // schema arrays
        case "allOf":
        case "anyOf":
        case "oneOf": {
          if (Array.isArray(value)) {
            out[key] = value.map(recur)
          } else {
            out[key] = value
          }
          break
        }

        // single subschema
        case "not":
        case "if":
        case "then":
        case "else":
        case "contains":
        case "propertyNames":
        case "additionalProperties":
        case "unevaluatedProperties":
        case "unevaluatedItems": {
          out[key] = recur(value)
          break
        }

        // maps of subschemas
        case "properties":
        case "patternProperties":
        case "$defs":
        case "dependentSchemas": {
          if (Predicate.isObject(value)) {
            out[key] = Rec.map(value, recur)
          } else {
            out[key] = value
          }
          break
        }

        default: {
          // For unknown keywords, keep the value as-is.
          out[key] = value
          break
        }
      }
    }

    // definitions -> $defs
    if (Predicate.isObject(definitions)) {
      out.$defs = Rec.map(definitions, recur)
    }

    // items/additionalItems -> prefixItems/items (2020-12)
    if (items !== undefined) {
      if (Array.isArray(items)) {
        out.prefixItems = items.map(recur)
        // In 2020-12, `items` is the post-tuple schema (old `additionalItems`)
        if (additionalItems !== undefined) {
          out.items = recur(additionalItems)
        }
      } else {
        // Old `items` as a single schema remains `items`
        out.items = recur(items)
        // `additionalItems` is not valid in 2020-12; drop it.
      }
    }
    // If there was additionalItems without tuple-form items, drop it.

    return out
  }
}

/**
 * Convert an OpenAPI 3.0 Schema Object to a JSON Schema Draft 2020-12 shape.
 *
 * This is a best-effort conversion focused on the main OpenAPI 3.0 differences:
 *
 * 1. First, it normalizes the schema using {@link fromDraft07}. In practice this is
 *    used to:
 *    - strip `$schema` everywhere
 *    - rename `definitions` to `$defs`
 *    - rewrite local `$ref` fragments `#/definitions/...` to `#/$defs/...`
 *    - convert tuple form `items: []` / `additionalItems` into
 *      `prefixItems` / `items` (when applicable)
 *
 * 2. Then it applies OpenAPI 3.0-specific rewrites in-place:
 *
 *    - `nullable: true`
 *      - if `enum` is present: adds `null` to the enum (if missing)
 *      - else if `type` is a string: widens to `type: [type, "null"]`
 *      - else if `type` is an array: appends `"null"` if missing
 *      - else: wraps the schema as `anyOf: [schema, { type: "null" }]`
 *      - `nullable: false` is removed
 *
 *    - Draft-04/OpenAPI boolean exclusivity:
 *      - `exclusiveMinimum: true` + `minimum: number` -> `exclusiveMinimum: minimum` and deletes `minimum`
 *      - `exclusiveMaximum: true` + `maximum: number` -> `exclusiveMaximum: maximum` and deletes `maximum`
 *      - `exclusiveMinimum: false` / `exclusiveMaximum: false` are removed
 *      - boolean exclusivity without a numeric bound is removed
 *
 * Traversal notes:
 * - The conversion walks arrays and objects to find these keywords.
 * - Vendor extension objects (keys starting with `x-`) are treated as opaque:
 *   their values are not traversed or rewritten.
 *
 * @since 4.0.0
 */
export function fromOpenApi3_0(schema: JsonSchema | boolean): JsonSchema | boolean {
  const out = fromDraft07(schema)
  walk(out)
  return out

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const v of node) {
        walk(v)
      }
    } else if (Predicate.isObject(node)) {
      // recurse first (post-order)
      for (const k of Object.keys(node)) {
        if (k.startsWith("x-")) {
          continue
        }
        const v = node[k]
        if (Array.isArray(v) || Predicate.isObject(v)) {
          walk(v)
        }
      }

      // OpenAPI 3.0 boolean form -> 2020-12 numeric form (or drop)
      const exMin = node.exclusiveMinimum
      if (typeof exMin === "boolean") {
        if (exMin === true && typeof node.minimum === "number") {
          node.exclusiveMinimum = node.minimum
          delete node.minimum
        } else {
          delete node.exclusiveMinimum
        }
      }

      const exMax = node.exclusiveMaximum
      if (typeof exMax === "boolean") {
        if (exMax === true && typeof node.maximum === "number") {
          node.exclusiveMaximum = node.maximum
          delete node.maximum
        } else {
          delete node.exclusiveMaximum
        }
      }

      // nullable -> widen enum/type, otherwise wrap in anyOf
      if (node.nullable === true) {
        delete node.nullable

        if (Array.isArray(node.enum)) {
          if (!node.enum.includes(null)) {
            node.enum.push(null)
          }
        } else {
          const t = node.type
          if (typeof t === "string") {
            if (t !== "null") {
              node.type = [t, "null"]
            }
          } else if (Array.isArray(t)) {
            if (!t.includes("null")) {
              t.push("null")
            }
          } else {
            // fallback: wrap the schema
            const original = { ...node }
            for (const k of Object.keys(node)) {
              delete node[k]
            }
            node.anyOf = [original, { type: "null" }]
          }
        }
      }

      if (node.nullable === false) {
        delete node.nullable
      }
    }
  }
}
