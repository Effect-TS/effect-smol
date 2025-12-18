/**
 * @since 4.0.0
 */

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
export interface Definitions extends Record<string, JsonSchema> {}

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
 * @since 4.0.0
 */
export function fromDraft07(schema: JsonSchema): JsonSchema {
  return schema
}
