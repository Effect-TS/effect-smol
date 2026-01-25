/**
 * @since 1.0.0
 */

// @barrel: Auto-generated exports. Do not edit manually.

/**
 * Whether or not the response should be included in the value returned from
 * an operation.
 *
 * If set to `true`, a tuple of `[A, HttpClientResponse]` will be returned,
 * where `A` is the success type of the operation.
 *
 * If set to `false`, only the success type of the operation will be returned.
 *
 * @since 1.0.0
 */
export * as Generated from "./Generated.ts"

/**
 * OpenAI Client module for interacting with OpenAI's API.
 *
 * Provides a type-safe, Effect-based client for OpenAI operations including
 * completions, embeddings, and streaming responses.
 *
 * @since 1.0.0
 */
export * as OpenAiClient from "./OpenAiClient.ts"

/**
 * @since 1.0.0
 */
export * as OpenAiConfig from "./OpenAiConfig.ts"

/**
 * OpenAI error mapping module for converting OpenAI API errors to AiError.
 *
 * Provides granular error mapping from OpenAI API responses including:
 * - Error code/type parsing from response bodies
 * - Rate limit header extraction
 * - Provider metadata construction
 * - HTTP context building for debugging
 *
 * @since 1.0.0
 */
export * as OpenAiError from "./OpenAiError.ts"

/**
 * OpenAI Language Model implementation.
 *
 * Provides a LanguageModel implementation for OpenAI's responses API,
 * supporting text generation, structured output, tool calling, and streaming.
 *
 * @since 1.0.0
 */
export * as OpenAiLanguageModel from "./OpenAiLanguageModel.ts"

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

/**
 * OpenAI provider-defined tools for use with the LanguageModel.
 *
 * Provides tools that are natively supported by OpenAI's API, including
 * code interpreter, file search, and web search functionality.
 *
 * @since 1.0.0
 */
export * as OpenAiTool from "./OpenAiTool.ts"
