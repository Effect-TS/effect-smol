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
export interface Definitions extends Record<string, JsonSchema | boolean> {}

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
export const META_SCHEMA_URI_DRAFT_07 = "http://json-schema.org/draft-07/schema"

/**
 * @since 4.0.0
 */
export const META_SCHEMA_URI_DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema"

/**
 * @since 4.0.0
 */
export function fromDocumentDraft07(document: Document<"draft-07">): Document<"draft-2020-12"> {
  return {
    source: "draft-2020-12",
    schema: fromSchemaDraft07(document.schema),
    definitions: Rec.map(document.definitions, (d) => fromSchemaDraft07(d))
  }
}

/**
 * @since 4.0.0
 */
export function fromDocumentOpenApi3_0(document: Document<"openapi-3.0">): Document<"openapi-3.1"> {
  return {
    source: "openapi-3.1",
    schema: fromSchemaOpenApi3_0(document.schema),
    definitions: Rec.map(document.definitions, (d) => fromSchemaOpenApi3_0(d))
  }
}

/**
 * Convert a Draft-07 JSON Schema into a Draft 2020-12-shaped schema.
 *
 * Notes / deliberate behavior:
 * - Strips `$schema` at every level (you are migrating drafts).
 * - Rewrites `$ref` only when it points at the root collection: `#/definitions` -> `#/$defs`.
 *   (This is a "root-only" strategy; nested `definitions` are treated as regular property names.)
 * - Renames root-level `definitions` to `$defs` and merges with any existing `$defs`
 *   (when both exist, `$defs` takes precedence on key collisions).
 * - Drops tuple keywords not representable in 2020-12: for Draft-07 tuples,
 *   `items: [..]` becomes `prefixItems`, and `additionalItems` becomes `items`.
 * - Transforms Draft-07 `dependencies` into `dependentSchemas` and `dependentRequired`.
 * - Strips unknown keywords everywhere (including `x-*` vendor extensions).
 *
 * @since 4.0.0
 */
export function fromSchemaDraft07(schema: JsonSchema): JsonSchema
export function fromSchemaDraft07(schema: JsonSchema | boolean): JsonSchema | boolean
export function fromSchemaDraft07(schema: JsonSchema | boolean): JsonSchema | boolean {
  return recur(schema, true) as JsonSchema | boolean

  function recur(node: unknown, isRoot: boolean): unknown {
    // Base case: Booleans and non-objects pass through
    if (typeof node === "boolean" || !Predicate.isObject(node)) {
      return node
    }

    const out: Record<string, unknown> = {}

    // Deterministic merges independent of input key order
    let defsFromDefinitions: Record<string, unknown> | undefined
    let defsFrom$defs: Record<string, unknown> | undefined

    let tupleItems: unknown = undefined
    let tupleAdditionalItems: unknown = undefined

    for (const key of Object.keys(node)) {
      const value = node[key]

      // Strip unknown keywords (including x-* vendor extensions)
      if (!ALLOWED_KEYWORDS.has(key)) {
        continue
      }

      switch (key) {
        // Strip $schema everywhere as we are moving to a new draft
        case "$schema":
          break

        // Pointer rewriting (root collection only)
        case "$ref":
          out.$ref = typeof value === "string"
            ? value.replace(/^#\/definitions(?=\/|$)/, "#/$defs")
            : value
          break

        // Root-only definitions -> $defs
        case "definitions":
          if (isRoot) {
            defsFromDefinitions = mapSchemaMap(value)
          } else {
            // Treat as a schema-map so we don't strip the map keys (e.g. "A")
            out.definitions = mapSchemaMap(value) ?? value
          }
          break

        case "$defs":
          defsFrom$defs = mapSchemaMap(value)
          break

        // Collect tuple keywords for post-loop processing
        case "items":
          tupleItems = value
          break
        case "additionalItems":
          tupleAdditionalItems = value
          break

        // Schema arrays
        case "allOf":
        case "anyOf":
        case "oneOf":
        case "prefixItems":
          out[key] = Array.isArray(value) ? value.map((v) => recur(v, false)) : value
          break

        // Schema maps
        case "properties":
        case "patternProperties":
        case "dependentSchemas":
          out[key] = Predicate.isObject(value) ? Rec.map(value, (v) => recur(v, false)) : value
          break

        // dependentRequired is a map of string -> string[]
        case "dependentRequired":
          out[key] = Predicate.isObject(value) ? { ...value } : value
          break

        // Single sub-schemas
        case "not":
        case "if":
        case "then":
        case "else":
        case "contains":
        case "propertyNames":
        case "additionalProperties":
        case "unevaluatedItems":
        case "unevaluatedProperties":
          out[key] = recur(value, false)
          break

        // Draft-07 dependencies -> 2020-12 dependentSchemas / dependentRequired
        case "dependencies": {
          if (Predicate.isObject(value)) {
            const schemas: Record<string, unknown> = {}
            const required: Record<string, unknown> = {}
            let hasSchemas = false
            let hasRequired = false

            for (const depKey of Object.keys(value)) {
              const depValue = value[depKey]
              if (Array.isArray(depValue)) {
                required[depKey] = depValue
                hasRequired = true
              } else {
                schemas[depKey] = recur(depValue, false)
                hasSchemas = true
              }
            }

            if (hasSchemas) {
              // Explicit dependentSchemas wins on collisions
              const existing = Predicate.isObject(out.dependentSchemas)
                ? out.dependentSchemas
                : undefined
              out.dependentSchemas = existing ? { ...schemas, ...existing } : schemas
            }
            if (hasRequired) {
              // Explicit dependentRequired wins on collisions
              const existing = Predicate.isObject(out.dependentRequired)
                ? out.dependentRequired
                : undefined
              out.dependentRequired = existing ? { ...required, ...existing } : required
            }
          }
          break
        }

        // Known non-schema keywords: copy as-is
        default:
          out[key] = value
          break
      }
    }

    // Deterministic $defs merge: definitions first, then $defs (so explicit $defs wins)
    if (defsFromDefinitions !== undefined || defsFrom$defs !== undefined) {
      out.$defs = { ...(defsFromDefinitions ?? {}), ...(defsFrom$defs ?? {}) }
    }

    // Transform items/additionalItems (Draft-07 tuples) -> prefixItems/items (2020-12)
    if (tupleItems !== undefined) {
      if (Array.isArray(tupleItems)) {
        out.prefixItems = tupleItems.map((v) => recur(v, false))
        if (tupleAdditionalItems !== undefined) {
          out.items = recur(tupleAdditionalItems, false)
        }
      } else {
        // items as a single schema remains 'items'
        out.items = recur(tupleItems, false)
      }
    }

    return out

    function mapSchemaMap(value: unknown): Record<string, unknown> | undefined {
      if (!Predicate.isObject(value)) return undefined
      return Rec.map(value, (v) => recur(v, false))
    }
  }
}

/**
 * Convert an OpenAPI 3.0 Schema Object into a JSON Schema Draft 2020-12-shaped schema.
 *
 * Notes / deliberate behavior:
 * - Performs OpenAPI-specific normalization first (without mutating the input):
 *   - `nullable: true` is converted into JSON Schema form (type widening / enum widening / `anyOf` fallback).
 *   - Draft-04-style numeric exclusivity (`exclusiveMinimum: true`) becomes numeric form.
 * - Then runs the Draft-07 -> 2020-12 migration (`fromDraft07`), which:
 *   - rewrites `#/definitions` refs to `#/$defs`,
 *   - converts root `definitions` to `$defs`,
 *   - converts tuples / dependencies,
 *   - strips unknown keywords everywhere (including `x-*` vendor extensions).
 *
 * @since 4.0.0
 */
export function fromSchemaOpenApi3_0(schema: JsonSchema): JsonSchema
export function fromSchemaOpenApi3_0(schema: JsonSchema | boolean): JsonSchema | boolean
export function fromSchemaOpenApi3_0(schema: JsonSchema | boolean): JsonSchema | boolean {
  const normalized = recur(schema) as JsonSchema | boolean
  return fromSchemaDraft07(normalized)

  function recur(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(recur)
    if (typeof node === "boolean" || !Predicate.isObject(node)) return node

    // Copy first (no mutation). Unknown keys are stripped later by fromDraft07.
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(node)) {
      const v = node[k]
      if (Array.isArray(v) || Predicate.isObject(v)) {
        out[k] = recur(v)
      } else {
        out[k] = v
      }
    }

    // Handle numeric exclusivity (Draft-04 style -> numeric form)
    const exclusivityAdjusted = handleExclusivity(out)

    // Handle nullable (OpenAPI 3.0 style -> JSON Schema style)
    if (exclusivityAdjusted.nullable === true) {
      const withoutNullable = { ...exclusivityAdjusted }
      delete withoutNullable.nullable
      return handleNullable(withoutNullable)
    }
    if (exclusivityAdjusted.nullable === false) {
      const withoutNullable = { ...exclusivityAdjusted }
      delete withoutNullable.nullable
      return withoutNullable
    }

    return exclusivityAdjusted
  }

  function handleExclusivity(node: Record<string, unknown>): Record<string, unknown> {
    let out = node

    if (typeof out.exclusiveMinimum === "boolean") {
      if (out.exclusiveMinimum === true && typeof out.minimum === "number") {
        out = { ...out, exclusiveMinimum: out.minimum }
        delete out.minimum
      } else {
        out = { ...out }
        delete out.exclusiveMinimum
      }
    }

    if (typeof out.exclusiveMaximum === "boolean") {
      if (out.exclusiveMaximum === true && typeof out.maximum === "number") {
        out = { ...out, exclusiveMaximum: out.maximum }
        delete out.maximum
      } else {
        out = { ...out }
        delete out.exclusiveMaximum
      }
    }

    return out
  }

  function handleNullable(node: Record<string, unknown>): Record<string, unknown> {
    // Priority 1: Enums (add null; widen type if present)
    if (Array.isArray(node.enum)) {
      const nextEnum = node.enum.includes(null) ? node.enum : [...node.enum, null]
      return widenType({ ...node, enum: nextEnum })
    }

    // Priority 2: Standard types (widen)
    if (node.type !== undefined) {
      return widenType({ ...node })
    }

    // Priority 3: Fallback (wrap in anyOf)
    // Preserve pointer/identity + metadata at the root so later draft-migration can
    // lift `definitions` -> `$defs` and keep refs stable.
    const preserved: Record<string, unknown> = {}
    const original: Record<string, unknown> = {}

    for (const k of Object.keys(node)) {
      if (PRESERVED_ROOT_KEYS_FOR_NULLABLE_FALLBACK.has(k)) preserved[k] = node[k]
      else original[k] = node[k]
    }

    return {
      ...preserved,
      anyOf: [original, { type: "null" }]
    }
  }

  function widenType(node: Record<string, unknown>): Record<string, unknown> {
    const t = node.type
    if (typeof t === "string") {
      if (t === "null") return node
      return { ...node, type: [t, "null"] }
    }
    if (Array.isArray(t)) {
      if (t.includes("null")) return node
      return { ...node, type: [...t, "null"] }
    }
    return node
  }
}

const PRESERVED_ROOT_KEYS_FOR_NULLABLE_FALLBACK = new Set<string>([
  // Pointer / identity
  "$id",
  "$anchor",
  "$defs",
  "$schema",
  "$comment",
  // Draft-07 legacy collection (preserve so fromDraft07 can lift it to $defs)
  "definitions",
  // Human-facing metadata
  "title",
  "description",
  "default",
  "examples",
  // Common OpenAPI-ish annotations
  "deprecated",
  "readOnly",
  "writeOnly"
])

const ALLOWED_KEYWORDS = new Set<string>([
  // Core
  "$id",
  "$schema",
  "$ref",
  "$comment",
  "$defs",
  "$anchor",
  "$recursiveAnchor",
  "$recursiveRef",
  "$dynamicAnchor",
  "$dynamicRef",
  "$vocabulary",

  // Draft-07 legacy collection
  "definitions",

  // Meta / annotations
  "title",
  "description",
  "default",
  "examples",
  "deprecated",
  "readOnly",
  "writeOnly",

  // OpenAPI keyword that we normalize away in fromOpenApi3_0
  "nullable",

  // Validation / general
  "type",
  "enum",
  "const",

  // Numeric
  "multipleOf",
  "maximum",
  "minimum",
  "exclusiveMaximum",
  "exclusiveMinimum",

  // String
  "maxLength",
  "minLength",
  "pattern",
  "format",
  "contentMediaType",
  "contentEncoding",
  "contentSchema",

  // Array
  "items",
  "additionalItems",
  "prefixItems",
  "maxItems",
  "minItems",
  "uniqueItems",
  "contains",
  "unevaluatedItems",

  // Object
  "maxProperties",
  "minProperties",
  "required",
  "properties",
  "patternProperties",
  "additionalProperties",
  "propertyNames",
  "dependencies",
  "dependentSchemas",
  "dependentRequired",
  "unevaluatedProperties",

  // Combinators / conditionals
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else"
])
