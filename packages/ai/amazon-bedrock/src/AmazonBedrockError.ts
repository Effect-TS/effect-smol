/**
 * Amazon Bedrock error metadata augmentation.
 *
 * Provides Amazon Bedrock-specific metadata fields for AI error types through
 * module augmentation, enabling typed access to Bedrock error details.
 *
 * @since 1.0.0
 */

/**
 * @since 1.0.0
 * @category models
 */
export interface AmazonBedrockErrorMetadata {}

declare module "effect/unstable/ai/AiError" {
  export interface InvalidRequestErrorMetadata {
    readonly bedrock?: AmazonBedrockErrorMetadata | null
  }

  export interface AuthenticationErrorMetadata {
    readonly bedrock?: AmazonBedrockErrorMetadata | null
  }

  export interface RateLimitErrorMetadata {
    readonly bedrock?: AmazonBedrockErrorMetadata | null
  }

  export interface InternalProviderErrorMetadata {
    readonly bedrock?: AmazonBedrockErrorMetadata | null
  }

  export interface UnknownErrorMetadata {
    readonly bedrock?: AmazonBedrockErrorMetadata | null
  }
}
