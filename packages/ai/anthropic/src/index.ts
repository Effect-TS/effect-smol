/**
 * @since 1.0.0
 */

// @barrel: Auto-generated exports. Do not edit manually.

/**
 * Anthropic Client module for interacting with Anthropic's API.
 *
 * Provides a type-safe, Effect-based client for Anthropic operations including
 * messages and streaming responses.
 *
 * @since 1.0.0
 */
export * as AnthropicClient from "./AnthropicClient.ts"

/**
 * @since 1.0.0
 */
export * as AnthropicConfig from "./AnthropicConfig.ts"

/**
 * Anthropic error metadata augmentation.
 *
 * Provides Anthropic-specific metadata fields for AI error types through module
 * augmentation, enabling typed access to Anthropic error details.
 *
 * @since 1.0.0
 */
export * as AnthropicError from "./AnthropicError.ts"

/**
 * @since 1.0.0
 */
export * as AnthropicLanguageModel from "./AnthropicLanguageModel.ts"

/**
 * Provides a codec transformation for Anthropic structured output.
 *
 * Anthropic's API has specific constraints on JSON schema support that differ
 * from the full JSON Schema specification. This module transforms Effect
 * `Schema.Codec` types into a form compatible with Anthropic's structured
 * output requirements by:
 *
 * - Converting tuples to objects with string keys (tuples are unsupported)
 * - Converting optional properties to nullable unions (`T | null`)
 * - Converting index signatures (records) to arrays of key-value pairs
 * - Converting `oneOf` unions to `anyOf` unions
 * - Stripping unsupported annotations and preserving only Anthropic-compatible
 *   formats and descriptions
 *
 * @since 1.0.0
 */
export * as AnthropicStructuredOutput from "./AnthropicStructuredOutput.ts"

/**
 * Anthropic telemetry attributes for OpenTelemetry integration.
 *
 * Provides Anthropic-specific GenAI telemetry attributes following OpenTelemetry
 * semantic conventions, extending the base GenAI attributes with Anthropic-specific
 * request and response metadata.
 *
 * @since 1.0.0
 */
export * as AnthropicTelemetry from "./AnthropicTelemetry.ts"

/**
 * Anthropic provider-defined tools for use with the LanguageModel.
 *
 * Provides tools that are natively supported by Anthropic's API, including
 * Bash, Code Execution, Computer Use, Memory, and Text Editor functionality.
 *
 * @since 1.0.0
 */
export * as AnthropicTool from "./AnthropicTool.ts"

/**
 * @since 1.0.0
 */
export * as Generated from "./Generated.ts"
