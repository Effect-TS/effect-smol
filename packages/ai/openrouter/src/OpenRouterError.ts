/**
 * OpenRouter error metadata augmentation.
 *
 * Provides OpenRouter-specific metadata fields for AI error types through
 * module augmentation, enabling typed access to OpenRouter error details.
 *
 * @since 1.0.0
 */

/**
 * OpenRouter-specific error metadata fields.
 *
 * @since 1.0.0
 * @category models
 */
export type OpenRouterErrorMetadata = {
  /**
   * The error code returned by the API.
   */
  readonly errorCode: string | number | null
  /**
   * The error type returned by the API.
   */
  readonly errorType: string | null
  /**
   * The unique request ID for debugging.
   */
  readonly requestId: string | null
}

/**
 * OpenRouter-specific rate limit metadata fields.
 *
 * @since 1.0.0
 * @category models
 */
export type OpenRouterRateLimitMetadata = OpenRouterErrorMetadata & {
  readonly limit: string | null
  readonly remaining: number | null
  readonly resetRequests: string | null
  readonly resetTokens: string | null
}

declare module "effect/unstable/ai/AiError" {
  export interface RateLimitError {
    readonly metadata: {
      readonly openrouter?: OpenRouterRateLimitMetadata | null
    }
  }

  export interface QuotaExhaustedError {
    readonly metadata: {
      readonly openrouter?: OpenRouterErrorMetadata | null
    }
  }

  export interface AuthenticationError {
    readonly metadata: {
      readonly openrouter?: OpenRouterErrorMetadata | null
    }
  }

  export interface ContentPolicyError {
    readonly metadata: {
      readonly openrouter?: OpenRouterErrorMetadata | null
    }
  }

  export interface InvalidRequestError {
    readonly metadata: {
      readonly openrouter?: OpenRouterErrorMetadata | null
    }
  }

  export interface InternalProviderError {
    readonly metadata: {
      readonly openrouter?: OpenRouterErrorMetadata | null
    }
  }

  export interface InvalidOutputError {
    readonly metadata: {
      readonly openrouter?: OpenRouterErrorMetadata | null
    }
  }

  export interface UnknownError {
    readonly metadata: {
      readonly openrouter?: OpenRouterErrorMetadata | null
    }
  }
}
