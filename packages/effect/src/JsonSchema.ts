/**
 * @since 4.0.0
 */
import * as Arr from "./Array.ts"
import { unescapeToken } from "./JsonPointer.ts"
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
export type Dialect = "draft-07" | "draft-2020-12" | "openapi-3.1" | "openapi-3.0"

/**
 * @since 4.0.0
 */
export type Type = "string" | "number" | "boolean" | "array" | "object" | "null" | "integer"

/**
 * @since 4.0.0
 */
export interface Definitions extends Record<string, JsonSchema> {}

/**
 * Internal representation:
 * - `schema` is the root schema *without* the root definitions collection.
 * - Root definitions are stored in `definitions` and referenced via:
 *   - `#/$defs/<name>` for Draft-2020-12
 *   - `#/definitions/<name>` for Draft-07
 *   - `#/components/schemas/<name>` for OpenAPI 3.1 and OpenAPI 3.0
 *
 * @since 4.0.0
 */
export interface Document<D extends Dialect> {
  readonly dialect: D
  readonly schema: JsonSchema
  readonly definitions: Definitions
}

/**
 * @since 4.0.0
 */
export interface MultiDocument<D extends Dialect> {
  readonly dialect: D
  readonly schemas: readonly [JsonSchema, ...Array<JsonSchema>]
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

const RE_DEFINITIONS = /^#\/definitions(?=\/|$)/
const RE_DEFS = /^#\/\$defs(?=\/|$)/
const RE_COMPONENTS_SCHEMAS = /^#\/components\/schemas(?=\/|$)/

/**
 * @since 4.0.0
 */
export function fromSchemaDraft07(js: JsonSchema): Document<"draft-2020-12"> {
  let definitions: Definitions | undefined

  const schema = walk(js, true) as JsonSchema
  return {
    dialect: "draft-2020-12",
    schema,
    definitions: definitions ?? {}
  }

  function walk(node: unknown, isRoot: boolean): unknown {
    if (Array.isArray(node)) return node.map((v) => walk(v, false))
    if (!Predicate.isObject(node)) return node

    const out: Record<string, unknown> = {}

    let prefixItems: unknown = undefined
    let additionalItems: unknown = undefined

    for (const k of Object.keys(node)) {
      const v = node[k]

      switch (k) {
        case "$ref":
          out.$ref = typeof v === "string" ? v.replace(RE_DEFINITIONS, "#/$defs") : v
          break

        case "definitions": {
          const mapped = walk_object(v, walk)
          if (isRoot) {
            definitions = mapped as Definitions | undefined
          } else {
            out.definitions = mapped ?? v
          }
          break
        }

        case "items":
          prefixItems = v
          break
        case "additionalItems":
          additionalItems = v
          break

        case "properties":
        case "patternProperties": {
          const mapped = walk_object(v, walk)
          out[k] = mapped ?? v
          break
        }

        case "additionalProperties":
        case "propertyNames":
          out[k] = walk(v, false)
          break

        case "allOf":
        case "anyOf":
        case "oneOf":
          out[k] = Array.isArray(v) ? v.map((x) => walk(x, false)) : v
          break

        case "type":
        case "required":
        case "enum":
        case "const":
        case "title":
        case "description":
        case "default":
        case "examples":
        case "format":
        case "readOnly":
        case "writeOnly":
        case "pattern":
        case "minimum":
        case "maximum":
        case "exclusiveMinimum":
        case "exclusiveMaximum":
        case "minLength":
        case "maxLength":
        case "minItems":
        case "maxItems":
        case "minProperties":
        case "maxProperties":
        case "multipleOf":
        case "uniqueItems":
          out[k] = v
          break

        default:
          break
      }
    }

    // Draft-07 tuples -> 2020-12 tuples
    if (prefixItems !== undefined) {
      if (Array.isArray(prefixItems)) {
        out.prefixItems = prefixItems.map((x) => walk(x, false))
        if (additionalItems !== undefined) out.items = walk(additionalItems, false)
      } else {
        out.items = walk(prefixItems, false)
      }
    }

    return out
  }
}

/**
 * @since 4.0.0
 */
export function fromSchemaDraft2020_12(js: JsonSchema): Document<"draft-2020-12"> {
  const { $defs, ...schema } = js
  return {
    dialect: "draft-2020-12",
    schema,
    definitions: Predicate.isObject($defs) ? ($defs as Definitions) : {}
  }
}

/**
 * @since 4.0.0
 */
export function fromSchemaOpenApi3_1(js: JsonSchema): Document<"draft-2020-12"> {
  const schema = rewrite_refs(js, (ref) => ref.replace(RE_COMPONENTS_SCHEMAS, "#/$defs")) as JsonSchema
  return fromSchemaDraft2020_12(schema)
}

/**
 * @since 4.0.0
 */
export function fromSchemaOpenApi3_0(schema: JsonSchema): Document<"draft-2020-12"> {
  const normalized = normalize_OpenApi3_0_to_Draft07(schema)
  return fromSchemaDraft07(normalized as JsonSchema)
}

/**
 * @since 4.0.0
 */
export function toDocumentDraft07(document: Document<"draft-2020-12">): Document<"draft-07"> {
  return {
    dialect: "draft-07",
    schema: toSchemaDraft07(document.schema),
    definitions: Rec.map(document.definitions, toSchemaDraft07)
  }
}

/**
 * @since 4.0.0
 */
export function toSchemaDraft07(schema: JsonSchema): JsonSchema {
  return rewrite(schema)

  function rewrite(node: unknown): JsonSchema {
    return walk(rewrite_refs(node, (ref) => ref.replace(RE_DEFS, "#/definitions")), true) as JsonSchema
  }

  function walk(node: unknown, _isRoot: boolean): unknown {
    if (Array.isArray(node)) return node.map((v) => walk(v, false))
    if (!Predicate.isObject(node)) return node

    const src = node as Record<string, unknown>
    const out: Record<string, unknown> = {}

    let prefixItems: unknown = undefined
    let items: unknown = undefined

    for (const k of Object.keys(src)) {
      const v = src[k]

      switch (k) {
        // We already rewrote $ref via rewrite_refs, so just copy it through.
        case "$ref":
        case "type":
        case "required":
        case "enum":
        case "const":
        case "title":
        case "description":
        case "default":
        case "examples":
        case "format":
        case "pattern":
        case "minimum":
        case "maximum":
        case "exclusiveMinimum":
        case "exclusiveMaximum":
        case "minLength":
        case "maxLength":
        case "minItems":
        case "maxItems":
        case "minProperties":
        case "maxProperties":
        case "multipleOf":
        case "uniqueItems":
          out[k] = v
          break

        // Schema maps
        case "properties":
        case "patternProperties": {
          const mapped = walk_object(v, walk)
          out[k] = mapped ?? v
          break
        }

        // Single subschemas
        case "additionalProperties":
        case "propertyNames":
          out[k] = walk(v, false)
          break

        // Schema arrays
        case "allOf":
        case "anyOf":
        case "oneOf":
          out[k] = Array.isArray(v) ? v.map((x) => walk(x, false)) : v
          break

        // Tuple handling (2020-12 form)
        case "prefixItems":
          prefixItems = v
          break
        case "items":
          items = v
          break

        default:
          // drop everything else (subset)
          break
      }
    }

    // 2020-12 tuples -> Draft-07 tuples
    if (prefixItems !== undefined) {
      if (Array.isArray(prefixItems)) {
        out.items = prefixItems.map((x) => walk(x, false))
        if (items !== undefined) out.additionalItems = walk(items, false)
      } else {
        // Non-standard, but keep a reasonable behavior
        out.items = walk(prefixItems, false)
      }
    } else if (items !== undefined) {
      // Regular items schema stays as items
      out.items = walk(items, false)
    }

    return out
  }
}

/**
 * @since 4.0.0
 */
export function toMultiDocumentOpenApi3_1(multiDocument: MultiDocument<"draft-2020-12">): MultiDocument<"openapi-3.1"> {
  const keyMap = new Map<string, string>()
  for (const key of Object.keys(multiDocument.definitions)) {
    const sanitized = sanitizeOpenApiComponentsSchemasKey(key)
    if (sanitized !== key) {
      keyMap.set(key, sanitized)
    }
  }

  function rewrite(schema: JsonSchema): JsonSchema {
    return rewrite_refs(schema, ($ref) => {
      const tokens = $ref.split("/")
      if (tokens.length > 0) {
        const identifier = unescapeToken(tokens[tokens.length - 1])
        const sanitized = keyMap.get(identifier)
        if (sanitized !== undefined) {
          $ref = tokens.slice(0, -1).join("/") + "/" + sanitized
        }
      }
      return $ref.replace(RE_DEFS, "#/components/schemas")
    }) as JsonSchema
  }

  return {
    dialect: "openapi-3.1",
    schemas: Arr.map(multiDocument.schemas, rewrite),
    definitions: Rec.mapEntries(
      multiDocument.definitions,
      (definition, key) => [keyMap.get(key) ?? key, rewrite(definition)]
    )
  }
}

/** @internal */
export const VALID_OPEN_API_COMPONENTS_SCHEMAS_KEY_REGEXP = /^[a-zA-Z0-9.\-_]+$/

/**
 * Returns a sanitized key for an OpenAPI component schema.
 * Should match the `^[a-zA-Z0-9.\-_]+$` regular expression.
 *
 * @internal
 */
export function sanitizeOpenApiComponentsSchemasKey(s: string): string {
  if (s.length === 0) return "_"
  if (VALID_OPEN_API_COMPONENTS_SCHEMAS_KEY_REGEXP.test(s)) return s

  const out: Array<string> = []

  for (const ch of s) {
    const code = ch.codePointAt(0)
    if (
      code !== undefined &&
      ((code >= 48 && code <= 57) || // 0-9
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        code === 46 || // .
        code === 45 || // -
        code === 95) // _
    ) {
      out.push(ch)
    } else {
      out.push("_")
    }
  }

  return out.join("")
}

function rewrite_refs(node: unknown, f: ($ref: string) => string): unknown {
  if (Array.isArray(node)) return node.map((v) => rewrite_refs(v, f))
  if (!Predicate.isObject(node)) return node

  const out: Record<string, unknown> = {}

  for (const k of Object.keys(node)) {
    const v = node[k]

    if (k === "$ref") {
      out[k] = typeof v === "string" ? f(v) : v
    } else if (Array.isArray(v) || Predicate.isObject(v)) {
      out[k] = rewrite_refs(v, f)
    } else {
      out[k] = v
    }
  }

  return out
}

function walk_object(
  value: unknown,
  walk: (node: unknown, isRoot: boolean) => unknown
): Record<string, unknown> | undefined {
  if (!Predicate.isObject(value)) return undefined
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(value)) out[k] = walk(value[k], false)
  return out
}

function normalize_OpenApi3_0_to_Draft07(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalize_OpenApi3_0_to_Draft07)
  if (!Predicate.isObject(node)) return node

  const src = node as Record<string, unknown>
  let out: Record<string, unknown> = {}

  for (const k of Object.keys(src)) {
    const v = src[k]
    if (k === "$ref" && typeof v === "string") {
      out[k] = v.replace(RE_COMPONENTS_SCHEMAS, "#/definitions")
    } else if (k === "example") {
      if (src.examples === undefined) {
        out.examples = [v]
      }
    } else if (Array.isArray(v) || Predicate.isObject(v)) {
      out[k] = normalize_OpenApi3_0_to_Draft07(v)
    } else {
      out[k] = v
    }
  }

  // Draft-04-style numeric exclusivity booleans
  out = adjust_exclusivity(out)

  // OpenAPI 3.0 nullable
  if (out.nullable === true) {
    out = apply_nullable(out)
  }
  delete out.nullable

  return out
}

function adjust_exclusivity(node: Record<string, unknown>): Record<string, unknown> {
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

function apply_nullable(node: Record<string, unknown>): Record<string, unknown> {
  // enum widening
  if (Array.isArray(node.enum)) {
    return widen_type({
      ...node,
      enum: node.enum.includes(null) ? node.enum : [...node.enum, null]
    })
  }

  // type widening
  if (node.type !== undefined) return widen_type(node)

  // const === null
  if (node.const === null) return node

  // fallback
  return { anyOf: [node, { type: "null" }] }
}

function widen_type(node: Record<string, unknown>): Record<string, unknown> {
  const t = node.type
  if (typeof t === "string") return t === "null" ? node : { ...node, type: [t, "null"] }
  if (Array.isArray(t)) return t.includes("null") ? node : { ...node, type: [...t, "null"] }
  return node
}

/**
 * @since 4.0.0
 */
export function resolve$ref($ref: string, definitions: Definitions): JsonSchema | undefined {
  const tokens = $ref.split("/")
  if (tokens.length > 0) {
    const identifier = unescapeToken(tokens[tokens.length - 1])
    const definition = definitions[identifier]
    if (definition !== undefined) {
      return definition
    }
  }
}

/**
 * @since 4.0.0
 */
export function resolveTopLevel$ref(document: Document<"draft-2020-12">): Document<"draft-2020-12"> {
  if (typeof document.schema.$ref === "string") {
    const schema = resolve$ref(document.schema.$ref, document.definitions)
    if (schema !== undefined) {
      return { ...document, schema }
    }
  }
  return document
}
