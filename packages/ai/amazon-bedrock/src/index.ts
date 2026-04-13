/**
 * @since 1.0.0
 */

/**
 * Amazon Bedrock Client module for interacting with Amazon Bedrock's API.
 *
 * Provides a type-safe, Effect-based client for Bedrock operations including
 * converse and streaming responses with AWS SigV4 authentication.
 *
 * @since 1.0.0
 */
export * as AmazonBedrockClient from "./AmazonBedrockClient.ts"

/**
 * @since 1.0.0
 */
export * as AmazonBedrockConfig from "./AmazonBedrockConfig.ts"

/**
 * Amazon Bedrock error metadata augmentation.
 *
 * Provides Amazon Bedrock-specific metadata fields for AI error types through
 * module augmentation, enabling typed access to Bedrock error details.
 *
 * @since 1.0.0
 */
export * as AmazonBedrockError from "./AmazonBedrockError.ts"

/**
 * @since 1.0.0
 */
export * as AmazonBedrockLanguageModel from "./AmazonBedrockLanguageModel.ts"

/**
 * Amazon Bedrock API request/response schemas.
 *
 * @since 1.0.0
 */
export * as AmazonBedrockSchema from "./AmazonBedrockSchema.ts"

/**
 * Amazon Bedrock provider-defined tools for use with the LanguageModel.
 *
 * Re-exports Anthropic tools for use with Anthropic models running on
 * Amazon Bedrock.
 *
 * @since 1.0.0
 */
export * as AmazonBedrockTool from "./AmazonBedrockTool.ts"

/**
 * AWS Event Stream encoding parser for Bedrock streaming responses.
 *
 * @since 1.0.0
 */
export * as EventStreamEncoding from "./EventStreamEncoding.ts"
