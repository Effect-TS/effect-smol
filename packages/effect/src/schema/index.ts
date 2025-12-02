/**
 * @since 4.0.0
 */

/**
 * @since 4.0.0
 */
export * as Annotations from "./Annotations.ts"

/**
 * @since 4.0.0
 */
export * as AST from "./AST.ts"

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
export * as FromJsonSchema from "./FromJsonSchema.ts"

/**
 * @since 4.0.0
 */
export * as Getter from "./Getter.ts"

/**
 * @since 4.0.0
 */
export * as Issue from "./Issue.ts"

/**
 * @since 4.0.0
 */
export * as Parser from "./Parser.ts"

/**
 * @since 4.0.0
 */
export * as Schema from "./Schema.ts"

/**
 * @since 4.0.0
 */
export * as StandardSchema from "./StandardSchema.ts"

/**
 * @since 4.0.0
 */
export * as Transformation from "./Transformation.ts"

/**
 * @since 4.0.0
 */
export * as Util from "./Util.ts"
