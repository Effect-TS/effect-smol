/**
 * @since 1.0.0
 */

// @barrel: Auto-generated exports. Do not edit manually.

/**
 * @since 1.0.0
 */
export * as OpenAiClient from "./OpenAiClient.ts"

/**
 * @since 1.0.0
 */
export * as OpenAiConfig from "./OpenAiConfig.ts"

/**
 * @since 1.0.0
 */
export * as OpenAiError from "./OpenAiError.ts"

/**
 * OpenAI Language Model implementation.
 *
 * Provides a LanguageModel implementation for OpenAI's chat completions API,
 * supporting text generation, structured output, tool calling, and streaming.
 *
 * @since 1.0.0
 */
export * as OpenAiLanguageModel from "./OpenAiLanguageModel.ts"

/**
 * Provides a codec transformation for OpenAI structured output.
 *
 * OpenAI's API has specific constraints on JSON schema support that differ
 * from the full JSON Schema specification. This module transforms Effect
 * `Schema.Codec` types into a form compatible with OpenAI's structured
 * output requirements by:
 *
 * - Converting tuples to objects with string keys (tuples are unsupported)
 * - Converting optional properties to nullable unions (`T | null`)
 * - Converting index signatures (records) to arrays of key-value pairs
 * - Converting `oneOf` unions to `anyOf` unions
 * - Merging multiple regex patterns into a single `pattern` (since OpenAI
 *   does not support `allOf`)
 * - Preserving only OpenAI-compatible formats and descriptions
 *
 * @since 1.0.0
 */
export * as OpenAiStructuredOutput from "./OpenAiStructuredOutput.ts"

/**
 * OpenAI telemetry attributes for OpenTelemetry integration.
 *
 * Provides OpenAI-specific GenAI telemetry attributes following OpenTelemetry
 * semantic conventions, extending the base GenAI attributes with OpenAI-specific
 * request and response metadata.
 *
 * @since 1.0.0
 */
export * as OpenAiTelemetry from "./OpenAiTelemetry.ts"
