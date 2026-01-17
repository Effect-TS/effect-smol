/**
 * The `AiError` module provides comprehensive error handling for AI operations.
 *
 * This module defines a rich hierarchy of error types that can occur when
 * working with AI services. Each error type provides:
 *
 * - **Rich context**: Operation, provider, model, request ID, timestamp
 * - **Retry guidance**: `isRetryable` flag and `retryAfter` duration
 * - **User-actionable suggestions**: Clear guidance on how to resolve issues
 * - **Machine-readable codes**: Stable `code` field for programmatic handling
 *
 * ## Error Categories
 *
 * - **Network**: `ConnectionError`, `TimeoutError`
 * - **Authentication**: `AuthenticationError`, `PermissionDeniedError`
 * - **Rate Limiting**: `RateLimitError` (retryable), `QuotaExceededError` (NOT retryable)
 * - **Input Validation**: `InvalidRequestError`, `TokenLimitExceededError`
 * - **Content Safety**: `ContentFilteredError`, `ContentPolicyViolationError`
 * - **Model**: `ModelNotFoundError`, `ModelOverloadedError`
 * - **Tool**: `ToolNotFoundError`, `ToolParameterError`, `ToolExecutionError`, `ToolResultEncodingError`
 * - **Streaming**: `StreamInterruptedError`
 * - **Response**: `MalformedResponseError`, `EmptyResponseError`
 * - **Provider**: `ProviderError`
 * - **Unknown**: `UnknownError`
 *
 * ## Critical: Rate Limit vs Quota
 *
 * OpenAI returns HTTP 429 for BOTH rate limits AND billing quota issues.
 * The error code in the response body distinguishes them:
 * - `rate_limit_exceeded` → `RateLimitError` (retryable with backoff)
 * - `insufficient_quota` → `QuotaExceededError` (NOT retryable - billing action needed)
 *
 * @example
 * ```ts
 * import { Effect, Duration, Schedule } from "effect"
 * import { AiError, LanguageModel } from "effect/unstable/ai"
 *
 * const program = LanguageModel.generateText({
 *   prompt: "Explain quantum computing"
 * }).pipe(
 *   Effect.catchTags({
 *     // Retryable errors with backoff
 *     RateLimitError: (e) =>
 *       Effect.delay(e.retryAfter ?? Duration.seconds(30)).pipe(
 *         Effect.andThen(program)
 *       ),
 *     ModelOverloadedError: (e) =>
 *       Effect.delay(e.retryAfter).pipe(
 *         Effect.andThen(program)
 *       ),
 *
 *     // Non-retryable - escalate
 *     AuthenticationError: (e) =>
 *       Effect.logError("API key issue:", e).pipe(
 *         Effect.andThen(Effect.fail(e))
 *       ),
 *     QuotaExceededError: (e) =>
 *       Effect.logError("Billing quota exceeded:", e).pipe(
 *         Effect.andThen(Effect.fail(e))
 *       ),
 *
 *     // Token limit - truncate and retry
 *     TokenLimitExceededError: (e) =>
 *       Effect.logWarning(`Reduce by ${e.overage} tokens`).pipe(
 *         Effect.andThen(Effect.fail(e))
 *       ),
 *
 *     // Content safety
 *     ContentFilteredError: (e) =>
 *       Effect.succeed({ text: "Content unavailable due to safety filters." }),
 *   })
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Schedule, Duration } from "effect"
 * import { AiError, LanguageModel } from "effect/unstable/ai"
 *
 * // Simple retry for all retryable errors
 * const withRetry = LanguageModel.generateText({
 *   prompt: "Hello"
 * }).pipe(
 *   Effect.retry({
 *     while: (e) => AiError.isAiError(e) && e.isRetryable,
 *     times: 3,
 *     schedule: Schedule.exponential(Duration.seconds(1))
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 */
import * as Duration from "../../Duration.ts"
import * as Predicate from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"

/**
 * @since 1.0.0
 * @category Type Ids
 */
export const TypeId: TypeId = "~effect/unstable/ai/AiError"

/**
 * @since 1.0.0
 * @category Type Ids
 */
export type TypeId = "~effect/unstable/ai/AiError"

/**
 * Type guard to check if a value is an AI error.
 *
 * @param u - The value to check
 * @returns `true` if the value is an `AiError`, `false` otherwise
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const someError = new Error("generic error")
 *
 * console.log(AiError.isAiError(someError)) // false
 * ```
 *
 * @since 1.0.0
 * @category Guards
 */
export const isAiError = (u: unknown): u is AiError => Predicate.hasProperty(u, TypeId)

/**
 * Check if an AI error is retryable.
 *
 * @param error - The AI error to check
 * @returns `true` if the error is retryable, `false` otherwise
 *
 * @example
 * ```ts
 * import { Effect, Schedule, Duration } from "effect"
 * import { AiError, LanguageModel } from "effect/unstable/ai"
 *
 * const program = LanguageModel.generateText({ prompt: "Hello" }).pipe(
 *   Effect.retry({
 *     while: AiError.isRetryable,
 *     times: 3,
 *     schedule: Schedule.exponential(Duration.seconds(1))
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Guards
 */
export const isRetryable = (error: AiError): boolean => {
  // Legacy errors don't have isRetryable property
  if ("isRetryable" in error) {
    return error.isRetryable
  }
  return false
}

/**
 * Check if an error is a tool-related error.
 *
 * @param error - The AI error to check
 * @returns `true` if the error is tool-related, `false` otherwise
 *
 * @since 1.0.0
 * @category Guards
 */
export const isToolError = (
  error: AiError
): error is ToolNotFoundError | ToolParameterError | ToolExecutionError | ToolResultEncodingError => {
  switch (error._tag) {
    case "ToolNotFoundError":
    case "ToolParameterError":
    case "ToolExecutionError":
    case "ToolResultEncodingError":
      return true
    default:
      return false
  }
}

// =============================================================================
// Common
// =============================================================================

/**
 * Operations that can fail with AI errors.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const AiOperation: Schema.Literals<[
  "generateText",
  "streamText",
  "generateObject",
  "streamObject",
  "generateEmbedding",
  "toolCall",
  "toolExecution",
  "tokenize",
  "truncate"
]> = Schema.Literals([
  "generateText",
  "streamText",
  "generateObject",
  "streamObject",
  "generateEmbedding",
  "toolCall",
  "toolExecution",
  "tokenize",
  "truncate"
])

/**
 * @since 1.0.0
 * @category Models
 */
export type AiOperation = typeof AiOperation.Type

/**
 * AI providers supported by the SDK.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const AiProvider: Schema.Literals<[
  "openai",
  "anthropic",
  "google",
  "bedrock",
  "azure",
  "ollama",
  "unknown"
]> = Schema.Literals([
  "openai",
  "anthropic",
  "google",
  "bedrock",
  "azure",
  "ollama",
  "unknown"
])

/**
 * @since 1.0.0
 * @category Models
 */
export type AiProvider = typeof AiProvider.Type

/**
 * Machine-readable, API-stable error codes.
 *
 * These codes are stable across versions. Removing a code is a breaking change.
 *
 * @since 1.0.0
 * @category Models
 */
export const AiErrorCode = {
  // Network
  CONNECTION_FAILED: "CONNECTION_FAILED",
  TIMEOUT: "TIMEOUT",

  // Authentication
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  PERMISSION_DENIED: "PERMISSION_DENIED",

  // Rate Limiting (CRITICAL: These are distinct!)
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",

  // Input Validation
  INVALID_REQUEST: "INVALID_REQUEST",
  TOKEN_LIMIT_EXCEEDED: "TOKEN_LIMIT_EXCEEDED",

  // Content Safety
  CONTENT_FILTERED: "CONTENT_FILTERED",
  CONTENT_POLICY_VIOLATION: "CONTENT_POLICY_VIOLATION",

  // Model/Resource
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  MODEL_OVERLOADED: "MODEL_OVERLOADED",

  // Tool Errors
  TOOL_NOT_FOUND: "TOOL_NOT_FOUND",
  TOOL_PARAMETER_INVALID: "TOOL_PARAMETER_INVALID",
  TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",
  TOOL_RESULT_ENCODING_FAILED: "TOOL_RESULT_ENCODING_FAILED",

  // Streaming
  STREAM_INTERRUPTED: "STREAM_INTERRUPTED",

  // Response
  MALFORMED_RESPONSE: "MALFORMED_RESPONSE",
  EMPTY_RESPONSE: "EMPTY_RESPONSE",

  // Server
  PROVIDER_ERROR: "PROVIDER_ERROR",

  // Unknown
  UNKNOWN_ERROR: "UNKNOWN_ERROR"
} as const

/**
 * @since 1.0.0
 * @category Models
 */
export type AiErrorCode = typeof AiErrorCode[keyof typeof AiErrorCode]

/**
 * Schema for error codes.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const AiErrorCodeSchema: Schema.Literals<[
  "CONNECTION_FAILED",
  "TIMEOUT",
  "AUTHENTICATION_FAILED",
  "PERMISSION_DENIED",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "INVALID_REQUEST",
  "TOKEN_LIMIT_EXCEEDED",
  "CONTENT_FILTERED",
  "CONTENT_POLICY_VIOLATION",
  "MODEL_NOT_FOUND",
  "MODEL_OVERLOADED",
  "TOOL_NOT_FOUND",
  "TOOL_PARAMETER_INVALID",
  "TOOL_EXECUTION_FAILED",
  "TOOL_RESULT_ENCODING_FAILED",
  "STREAM_INTERRUPTED",
  "MALFORMED_RESPONSE",
  "EMPTY_RESPONSE",
  "PROVIDER_ERROR",
  "UNKNOWN_ERROR"
]> = Schema.Literals([
  "CONNECTION_FAILED",
  "TIMEOUT",
  "AUTHENTICATION_FAILED",
  "PERMISSION_DENIED",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "INVALID_REQUEST",
  "TOKEN_LIMIT_EXCEEDED",
  "CONTENT_FILTERED",
  "CONTENT_POLICY_VIOLATION",
  "MODEL_NOT_FOUND",
  "MODEL_OVERLOADED",
  "TOOL_NOT_FOUND",
  "TOOL_PARAMETER_INVALID",
  "TOOL_EXECUTION_FAILED",
  "TOOL_RESULT_ENCODING_FAILED",
  "STREAM_INTERRUPTED",
  "MALFORMED_RESPONSE",
  "EMPTY_RESPONSE",
  "PROVIDER_ERROR",
  "UNKNOWN_ERROR"
])

// =============================================================================
// Authentication Errors
// =============================================================================

/**
 * Error raised when authentication fails (HTTP 401).
 *
 * This error occurs when the API key is invalid, expired, or missing.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("AuthenticationError", (e) => {
 *     console.log(`Authentication failed: ${e.reason}`)
 *     return Effect.fail(e) // Cannot retry - need valid credentials
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class AuthenticationError extends Schema.ErrorClass<AuthenticationError>(
  "effect/ai/AiError/AuthenticationError"
)({
  _tag: Schema.tag("AuthenticationError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  reason: Schema.Literals(["invalid_key", "expired_key", "missing_key", "invalid_format"]),
  keyPrefix: Schema.optional(Schema.String),
  providerDetails: Schema.optional(Schema.Unknown)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.AUTHENTICATION_FAILED

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  get suggestion(): string {
    switch (this.reason) {
      case "invalid_key":
        return "Verify your API key is correct. Check for typos or regenerate the key in your provider dashboard."
      case "expired_key":
        return "Your API key has expired. Generate a new key in your provider dashboard."
      case "missing_key":
        return "No API key was provided. Set the API key in your environment or configuration."
      case "invalid_format":
        return "The API key format is invalid. Ensure you're using the correct key type for this API."
    }
  }

  override get message(): string {
    const prefix = this.keyPrefix ? ` (key: ${this.keyPrefix}...)` : ""
    return `Authentication failed: ${this.reason}${prefix}. ${this.suggestion}`
  }
}

/**
 * Error raised when permission is denied (HTTP 403).
 *
 * This error occurs when the authenticated user lacks permission to access
 * the requested resource or perform the requested operation.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("PermissionDeniedError", (e) => {
 *     console.log(`Permission denied for ${e.resource}`)
 *     return Effect.fail(e) // Cannot retry - need different permissions
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class PermissionDeniedError extends Schema.ErrorClass<PermissionDeniedError>(
  "effect/ai/AiError/PermissionDeniedError"
)({
  _tag: Schema.tag("PermissionDeniedError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  resource: Schema.optional(Schema.String),
  requiredPermission: Schema.optional(Schema.String),
  providerDetails: Schema.optional(Schema.Unknown)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.PERMISSION_DENIED

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion =
    "Check your API key permissions, account tier, and access to the requested resource. You may need to upgrade your plan or request access."

  override get message(): string {
    const resource = this.resource ? ` for resource "${this.resource}"` : ""
    const permission = this.requiredPermission ? ` (requires: ${this.requiredPermission})` : ""
    return `Permission denied${resource}${permission}. ${this.suggestion}`
  }
}

// =============================================================================
// Content Filter Errors
// =============================================================================

/**
 * Schema for content filter results from providers.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const ContentFilterCategory = Schema.Struct({
  filtered: Schema.Boolean,
  severity: Schema.optional(Schema.Literals(["safe", "low", "medium", "high"]))
})

/**
 * @since 1.0.0
 * @category Models
 */
export type ContentFilterCategory = typeof ContentFilterCategory.Type

/**
 * Schema for all content filter categories.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const ContentFilterResult = Schema.Struct({
  hate: Schema.optional(ContentFilterCategory),
  sexual: Schema.optional(ContentFilterCategory),
  violence: Schema.optional(ContentFilterCategory),
  selfHarm: Schema.optional(ContentFilterCategory),
  harassment: Schema.optional(ContentFilterCategory)
})

/**
 * @since 1.0.0
 * @category Models
 */
export type ContentFilterResult = typeof ContentFilterResult.Type

/**
 * Error raised when content is filtered by safety system.
 *
 * This error occurs when the provider's content safety system blocks
 * input or output content. The `categories` field provides details about
 * which safety categories were triggered.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("ContentFilteredError", (e) => {
 *     console.log(`Content filtered: ${e.triggeredCategories.join(", ")}`)
 *     return Effect.succeed({ text: "Content unavailable due to safety filters." })
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class ContentFilteredError extends Schema.ErrorClass<ContentFilteredError>(
  "effect/ai/AiError/ContentFilteredError"
)({
  _tag: Schema.tag("ContentFilteredError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  filterType: Schema.Literals(["input", "output"]),
  categories: Schema.optional(ContentFilterResult),
  providerDetails: Schema.optional(Schema.Unknown)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.CONTENT_FILTERED

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * List of content categories that triggered the filter.
   *
   * @since 1.0.0
   */
  get triggeredCategories(): Array<string> {
    if (this.categories === undefined) return []
    const result: Array<string> = []
    const cats = this.categories
    if (cats.hate?.filtered) result.push("hate")
    if (cats.sexual?.filtered) result.push("sexual")
    if (cats.violence?.filtered) result.push("violence")
    if (cats.selfHarm?.filtered) result.push("selfHarm")
    if (cats.harassment?.filtered) result.push("harassment")
    return result
  }

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  get suggestion(): string {
    const cats = this.triggeredCategories
    if (cats.length > 0) {
      return `Content was filtered for: ${
        cats.join(", ")
      }. Review and modify the ${this.filterType} content to comply with safety guidelines.`
    }
    return `Content was filtered by ${this.provider}'s safety system. Review and modify the ${this.filterType} content.`
  }

  override get message(): string {
    return this.suggestion
  }
}

/**
 * Error raised when content violates usage policies.
 *
 * This error occurs when content violates the provider's usage policies,
 * which may be broader than content safety filters.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("ContentPolicyViolationError", (e) => {
 *     console.error(`Policy violation: ${e.policyMessage}`)
 *     return Effect.fail(e)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class ContentPolicyViolationError extends Schema.ErrorClass<ContentPolicyViolationError>(
  "effect/ai/AiError/ContentPolicyViolationError"
)({
  _tag: Schema.tag("ContentPolicyViolationError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  policyCode: Schema.optional(Schema.String),
  policyMessage: Schema.optional(Schema.String),
  providerDetails: Schema.optional(Schema.Unknown)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.CONTENT_POLICY_VIOLATION

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion = "The request violates the provider's usage policies. Review their acceptable use policy."

  override get message(): string {
    const policy = this.policyMessage ?? this.policyCode
    const detail = policy ? `: ${policy}` : ""
    return `Content policy violation${detail}. ${this.suggestion}`
  }
}

// =============================================================================
// Input Errors
// =============================================================================

/**
 * Error raised when request is malformed (HTTP 400).
 *
 * This error occurs when the request contains invalid parameters, malformed
 * data, or doesn't conform to the API's expected format.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("InvalidRequestError", (e) => {
 *     console.log(`Invalid request: ${e.parameter} - ${e.validationMessage}`)
 *     return Effect.fail(e) // Cannot retry without fixing the request
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class InvalidRequestError extends Schema.ErrorClass<InvalidRequestError>(
  "effect/ai/AiError/InvalidRequestError"
)({
  _tag: Schema.tag("InvalidRequestError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  parameter: Schema.optional(Schema.String),
  expectedType: Schema.optional(Schema.String),
  actualValue: Schema.optional(Schema.Unknown),
  validationMessage: Schema.optional(Schema.String),
  providerDetails: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.INVALID_REQUEST

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion = "Review request parameters against API documentation. Check data types and required fields."

  override get message(): string {
    const param = this.parameter ? ` (parameter: ${this.parameter})` : ""
    const validation = this.validationMessage ? `: ${this.validationMessage}` : ""
    return `Invalid request${param}${validation}. ${this.suggestion}`
  }
}

/**
 * Error raised when token limit is exceeded.
 *
 * This is a special case of invalid request that provides token-specific
 * context including the requested tokens, maximum tokens, and the overage.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("TokenLimitExceededError", (e) => {
 *     console.log(`Token limit exceeded by ${e.overage} tokens`)
 *     console.log(e.suggestion)
 *     // Truncate input and retry
 *     return truncateAndRetry(e.overage)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class TokenLimitExceededError extends Schema.ErrorClass<TokenLimitExceededError>(
  "effect/ai/AiError/TokenLimitExceededError"
)({
  _tag: Schema.tag("TokenLimitExceededError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.String,
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  requestedTokens: Schema.Number,
  maxTokens: Schema.Number,
  inputTokens: Schema.optional(Schema.Number),
  outputTokens: Schema.optional(Schema.Number),
  providerDetails: Schema.optional(Schema.Unknown)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.TOKEN_LIMIT_EXCEEDED

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * Number of tokens over the limit.
   *
   * @since 1.0.0
   */
  get overage(): number {
    return this.requestedTokens - this.maxTokens
  }

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  get suggestion(): string {
    return `Reduce input by at least ${this.overage} tokens. Consider using a model with larger context window (current: ${this.model} with ${this.maxTokens} max) or truncating/summarizing input.`
  }

  override get message(): string {
    return `Token limit exceeded: requested ${this.requestedTokens} tokens but model "${this.model}" has maximum of ${this.maxTokens} tokens. ${this.suggestion}`
  }
}

// =============================================================================
// Model Errors
// =============================================================================

/**
 * Error raised when model is not found (HTTP 404).
 *
 * This error occurs when the requested model doesn't exist or is not
 * accessible to your account.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("ModelNotFoundError", (e) => {
 *     console.log(`Model not found: ${e.model}`)
 *     if (e.availableModels) {
 *       console.log(`Available: ${e.availableModels.join(", ")}`)
 *     }
 *     return Effect.fail(e)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class ModelNotFoundError extends Schema.ErrorClass<ModelNotFoundError>(
  "effect/ai/AiError/ModelNotFoundError"
)({
  _tag: Schema.tag("ModelNotFoundError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.String,
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  availableModels: Schema.optional(Schema.Array(Schema.String)),
  providerDetails: Schema.optional(Schema.Unknown)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.MODEL_NOT_FOUND

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  get suggestion(): string {
    if (this.availableModels !== undefined && this.availableModels.length > 0) {
      const models = this.availableModels.slice(0, 5).join(", ")
      const more = this.availableModels.length > 5 ? "..." : ""
      return `Model "${this.model}" not found. Available models: ${models}${more}`
    }
    return `Model "${this.model}" not found. Check the model name and your access permissions.`
  }

  override get message(): string {
    return this.suggestion
  }
}

/**
 * Error raised when model is overloaded (HTTP 529/503).
 *
 * This error occurs when the model is experiencing high load and cannot
 * process your request. This is typically a transient condition.
 *
 * @example
 * ```ts
 * import { Effect, Duration } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("ModelOverloadedError", (e) => {
 *     const delay = e.retryAfter
 *     console.log(`Model overloaded. Retrying after ${delay}`)
 *     return Effect.delay(delay).pipe(Effect.andThen(program))
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class ModelOverloadedError extends Schema.ErrorClass<ModelOverloadedError>(
  "effect/ai/AiError/ModelOverloadedError"
)({
  _tag: Schema.tag("ModelOverloadedError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  retryAfterMs: Schema.optional(Schema.Number),
  providerDetails: Schema.optional(Schema.Unknown)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.MODEL_OVERLOADED

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = true

  /**
   * Suggested retry delay.
   *
   * @since 1.0.0
   */
  get retryAfter(): Duration.Duration {
    return this.retryAfterMs !== undefined
      ? Duration.millis(this.retryAfterMs)
      : Duration.seconds(30)
  }

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion = "The model is currently overloaded. Retry with exponential backoff or try a different model."

  override get message(): string {
    const model = this.model ? ` Model: ${this.model}.` : ""
    return `Model overloaded.${model} ${this.suggestion}`
  }
}

// =============================================================================
// Network Errors
// =============================================================================

/**
 * Error raised when network connection fails.
 *
 * This error occurs when the SDK cannot establish a connection to the AI
 * provider, such as DNS failures, TCP connection failures, or TLS errors.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("ConnectionError", (e) => {
 *     console.log(`Connection failed to ${e.targetHost}: ${e.connectionType}`)
 *     return Effect.retry(program)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class ConnectionError extends Schema.ErrorClass<ConnectionError>(
  "effect/ai/AiError/ConnectionError"
)({
  _tag: Schema.tag("ConnectionError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  connectionType: Schema.Literals(["dns", "tcp", "tls", "unknown"]),
  targetHost: Schema.String,
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.CONNECTION_FAILED

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = true

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  get suggestion(): string {
    switch (this.connectionType) {
      case "dns":
        return "Check DNS resolution and network configuration. Verify the hostname is correct."
      case "tcp":
        return "Check network connectivity. Verify firewall rules allow outbound connections."
      case "tls":
        return "Check TLS/SSL configuration. Verify certificates are valid and trusted."
      default:
        return "Check network connectivity and verify the API endpoint is accessible."
    }
  }

  override get message(): string {
    return `Connection failed to ${this.targetHost} (${this.connectionType}): ${this.suggestion}`
  }
}

/**
 * Error raised when request times out.
 *
 * This error occurs when a request to the AI provider takes longer than the
 * configured timeout duration.
 *
 * @example
 * ```ts
 * import { Effect, Duration } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("TimeoutError", (e) => {
 *     console.log(`Request timed out after ${e.timeoutMs}ms (${e.timeoutType})`)
 *     return Effect.retry(program)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class TimeoutError extends Schema.ErrorClass<TimeoutError>(
  "effect/ai/AiError/TimeoutError"
)({
  _tag: Schema.tag("TimeoutError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  timeoutType: Schema.Literals(["connect", "read", "write", "total"]),
  timeoutMs: Schema.Number,
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.TIMEOUT

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = true

  /**
   * Suggested retry delay.
   *
   * @since 1.0.0
   */
  get retryAfter(): Duration.Duration {
    return Duration.seconds(5)
  }

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  get suggestion(): string {
    return "Consider increasing timeout duration or check for network latency issues. For large requests, streaming may help."
  }

  override get message(): string {
    return `Request timed out after ${this.timeoutMs}ms (${this.timeoutType}). ${this.suggestion}`
  }
}

// =============================================================================
// Provider Errors
// =============================================================================

/**
 * Error raised for provider-side failures (HTTP 500/502).
 *
 * This error occurs when the AI provider experiences an internal error.
 * These are typically transient and can be retried.
 *
 * @example
 * ```ts
 * import { Effect, Duration, Schedule } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("ProviderError", (e) => {
 *     if (e.isRetryable) {
 *       return Effect.retry(program, {
 *         times: 3,
 *         schedule: Schedule.exponential(Duration.seconds(1))
 *       })
 *     }
 *     return Effect.fail(e)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class ProviderError extends Schema.ErrorClass<ProviderError>(
  "effect/ai/AiError/ProviderError"
)({
  _tag: Schema.tag("ProviderError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  statusCode: Schema.Number,
  providerMessage: Schema.optional(Schema.String),
  providerDetails: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.PROVIDER_ERROR

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = true

  /**
   * Suggested retry delay based on status code.
   *
   * @since 1.0.0
   */
  get retryAfter(): Duration.Duration {
    return this.statusCode === 503 ? Duration.seconds(30) : Duration.seconds(5)
  }

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion = "Provider server error. Implement exponential backoff retry strategy."

  override get message(): string {
    const msg = this.providerMessage ? `: ${this.providerMessage}` : ""
    return `Provider error (HTTP ${this.statusCode})${msg}. ${this.suggestion}`
  }
}

// =============================================================================
// Rate Limit Errors
// =============================================================================

/**
 * Error raised when rate limit is exceeded (HTTP 429) - RETRYABLE.
 *
 * This error occurs when you've exceeded the provider's rate limits for
 * requests or tokens per time period. Rate limits reset after a period.
 *
 * **CRITICAL**: This is different from `QuotaExceededError`! Rate limits
 * reset automatically; quotas require billing action.
 *
 * @example
 * ```ts
 * import { Effect, Duration } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("RateLimitError", (e) => {
 *     const delay = e.retryAfter ?? Duration.seconds(30)
 *     console.log(`Rate limited. Retrying after ${delay}`)
 *     return Effect.delay(delay).pipe(Effect.andThen(program))
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class RateLimitError extends Schema.ErrorClass<RateLimitError>(
  "effect/ai/AiError/RateLimitError"
)({
  _tag: Schema.tag("RateLimitError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  limitType: Schema.Literals([
    "requests_per_minute",
    "requests_per_day",
    "tokens_per_minute",
    "tokens_per_day",
    "concurrent",
    "unknown"
  ]),
  limit: Schema.optional(Schema.Number),
  remaining: Schema.optional(Schema.Number),
  resetAt: Schema.optional(Schema.Date),
  retryAfterMs: Schema.optional(Schema.Number),
  providerDetails: Schema.optional(Schema.Unknown)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.RATE_LIMITED

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = true

  /**
   * Suggested retry delay based on provider's Retry-After header or defaults.
   *
   * @since 1.0.0
   */
  get retryAfter(): Duration.Duration | undefined {
    return this.retryAfterMs !== undefined ? Duration.millis(this.retryAfterMs) : undefined
  }

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion =
    "Implement exponential backoff retry. Consider reducing request frequency or upgrading your API tier."

  override get message(): string {
    const limit = this.limit !== undefined ? ` (limit: ${this.limit})` : ""
    const reset = this.resetAt ? ` Resets at: ${this.resetAt.toISOString()}` : ""
    return `Rate limit exceeded: ${this.limitType}${limit}.${reset} ${this.suggestion}`
  }
}

/**
 * Error raised when billing quota is exceeded (HTTP 429) - NOT RETRYABLE.
 *
 * This error occurs when you've exceeded your billing quota or spending
 * limit. Unlike rate limits, quotas require user action (adding payment
 * method or increasing limits) to resolve.
 *
 * **CRITICAL**: OpenAI returns HTTP 429 for BOTH rate limits AND billing
 * quota issues. The error code in the response body distinguishes them:
 * - `rate_limit_exceeded` → Use `RateLimitError` (retryable)
 * - `insufficient_quota` → Use `QuotaExceededError` (NOT retryable)
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("QuotaExceededError", (e) => {
 *     console.error(`Quota exceeded! ${e.suggestion}`)
 *     // DO NOT retry - user must add billing
 *     return Effect.fail(e)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class QuotaExceededError extends Schema.ErrorClass<QuotaExceededError>(
  "effect/ai/AiError/QuotaExceededError"
)({
  _tag: Schema.tag("QuotaExceededError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  quotaType: Schema.Literals(["monthly_spend", "token_budget", "request_budget", "unknown"]),
  limit: Schema.optional(Schema.Number),
  used: Schema.optional(Schema.Number),
  resetAt: Schema.optional(Schema.Date),
  providerDetails: Schema.optional(Schema.Unknown)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.QUOTA_EXCEEDED

  /**
   * Whether this error is retryable.
   *
   * **CRITICAL**: This is NOT retryable. User must take billing action.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion =
    "Your billing quota has been exceeded. Add a payment method or increase spending limits in your provider dashboard."

  override get message(): string {
    const usage = this.limit !== undefined && this.used !== undefined
      ? ` (used: ${this.used}/${this.limit})`
      : ""
    return `Quota exceeded: ${this.quotaType}${usage}. ${this.suggestion}`
  }
}

// =============================================================================
// Response Errors
// =============================================================================

/**
 * Error raised when response cannot be parsed.
 *
 * This error occurs when the AI provider returns a response that cannot
 * be parsed according to the expected format or schema.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("MalformedResponseError", (e) => {
 *     console.log(`Failed to parse response: ${e.expectedFormat}`)
 *     // Retry - provider might return valid response next time
 *     return Effect.retry(program)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class MalformedResponseError extends Schema.ErrorClass<MalformedResponseError>(
  "effect/ai/AiError/MalformedResponseError"
)({
  _tag: Schema.tag("MalformedResponseError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  expectedFormat: Schema.optional(Schema.String),
  actualContent: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.MALFORMED_RESPONSE

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = true

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion = "Response could not be parsed. This may be a provider issue - consider retrying."

  override get message(): string {
    const format = this.expectedFormat ? ` Expected: ${this.expectedFormat}.` : ""
    return `Malformed response from ${this.provider}.${format} ${this.suggestion}`
  }
}

/**
 * Error raised when response is empty.
 *
 * This error occurs when the AI provider returns an empty response
 * with no content.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("EmptyResponseError", (e) => {
 *     console.log(`Empty response, finish reason: ${e.finishReason}`)
 *     return Effect.retry(program)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class EmptyResponseError extends Schema.ErrorClass<EmptyResponseError>(
  "effect/ai/AiError/EmptyResponseError"
)({
  _tag: Schema.tag("EmptyResponseError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  finishReason: Schema.optional(Schema.String)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.EMPTY_RESPONSE

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = true

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion = "No content was generated. Check your prompt and retry."

  override get message(): string {
    const reason = this.finishReason ? ` Finish reason: ${this.finishReason}.` : ""
    return `Empty response from ${this.provider}.${reason} ${this.suggestion}`
  }
}

// =============================================================================
// Streaming Errors
// =============================================================================

/**
 * Error raised when stream is interrupted.
 *
 * This error occurs when a streaming response is interrupted before
 * completion. The `partialContent` field contains any content that was
 * received before the interruption.
 *
 * @example
 * ```ts
 * import { Effect, Duration } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some streaming AI operation
 * }).pipe(
 *   Effect.catchTag("StreamInterruptedError", (e) => {
 *     if (e.partialContent) {
 *       console.log(`Partial content received: ${e.partialContent}`)
 *       // Optionally use partial content
 *     }
 *     // Retry the request
 *     return Effect.delay(e.retryAfter).pipe(Effect.andThen(program))
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class StreamInterruptedError extends Schema.ErrorClass<StreamInterruptedError>(
  "effect/ai/AiError/StreamInterruptedError"
)({
  _tag: Schema.tag("StreamInterruptedError"),
  operation: Schema.Literals(["streamText", "streamObject"]),
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  partialContent: Schema.optional(Schema.String),
  tokensGenerated: Schema.optional(Schema.Number),
  interruptReason: Schema.Literals(["network", "timeout", "server_error", "client_abort", "unknown"]),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.STREAM_INTERRUPTED

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = true

  /**
   * Suggested retry delay.
   *
   * @since 1.0.0
   */
  get retryAfter(): Duration.Duration {
    return Duration.seconds(5)
  }

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  get suggestion(): string {
    if (this.partialContent !== undefined) {
      return "Stream was interrupted but partial content was received. Consider retrying or using the partial result."
    }
    return "Stream was interrupted before receiving content. Retry the request."
  }

  override get message(): string {
    const tokens = this.tokensGenerated !== undefined ? ` (${this.tokensGenerated} tokens received)` : ""
    return `Stream interrupted: ${this.interruptReason}${tokens}. ${this.suggestion}`
  }
}

// =============================================================================
// Tool Call Errors
// =============================================================================

/**
 * Error raised when tool is not found in toolkit.
 *
 * This error occurs when the LLM requests a tool that doesn't exist in
 * the provided toolkit.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation with tools
 * }).pipe(
 *   Effect.catchTag("ToolNotFoundError", (e) => {
 *     console.log(`Tool not found: ${e.toolName}`)
 *     console.log(`Available: ${e.availableTools.join(", ")}`)
 *     return Effect.fail(e)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class ToolNotFoundError extends Schema.ErrorClass<ToolNotFoundError>(
  "effect/ai/AiError/ToolNotFoundError"
)({
  _tag: Schema.tag("ToolNotFoundError"),
  operation: Schema.tag("toolCall"),
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  toolName: Schema.String,
  availableTools: Schema.Array(Schema.String)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.TOOL_NOT_FOUND

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  get suggestion(): string {
    return `Tool "${this.toolName}" not found. Available tools: ${this.availableTools.join(", ")}`
  }

  override get message(): string {
    return this.suggestion
  }
}

/**
 * Error raised when tool parameters from LLM are invalid.
 *
 * This error occurs when the LLM provides parameters that don't match
 * the tool's expected schema. This error can often be recovered by
 * returning the error to the LLM for correction.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation with tools
 * }).pipe(
 *   Effect.catchTag("ToolParameterError", (e) => {
 *     if (e.isLLMRecoverable) {
 *       // Return error to LLM for correction
 *       return retryWithErrorFeedback(e)
 *     }
 *     return Effect.fail(e)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class ToolParameterError extends Schema.ErrorClass<ToolParameterError>(
  "effect/ai/AiError/ToolParameterError"
)({
  _tag: Schema.tag("ToolParameterError"),
  operation: Schema.tag("toolCall"),
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  toolName: Schema.String,
  toolCallId: Schema.String,
  parameters: Schema.Unknown,
  validationError: Schema.String,
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.TOOL_PARAMETER_INVALID

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * Whether this error can be recovered by returning it to the LLM.
   *
   * LLMs can often correct parameter errors when given feedback about
   * what went wrong.
   *
   * @since 1.0.0
   */
  readonly isLLMRecoverable = true

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion = "LLM provided invalid tool parameters. Consider returning this error to the LLM for correction."

  override get message(): string {
    return `Invalid parameters for tool "${this.toolName}": ${this.validationError}. ${this.suggestion}`
  }
}

/**
 * Error raised when tool execution fails.
 *
 * This error occurs when a tool handler throws an error during execution.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation with tools
 * }).pipe(
 *   Effect.catchTag("ToolExecutionError", (e) => {
 *     console.error(`Tool ${e.toolName} failed:`, e.executionError)
 *     return Effect.fail(e)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class ToolExecutionError extends Schema.ErrorClass<ToolExecutionError>(
  "effect/ai/AiError/ToolExecutionError"
)({
  _tag: Schema.tag("ToolExecutionError"),
  operation: Schema.tag("toolExecution"),
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  toolName: Schema.String,
  toolCallId: Schema.String,
  parameters: Schema.Unknown,
  executionError: Schema.Unknown,
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.TOOL_EXECUTION_FAILED

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * Whether this error can be recovered by returning it to the LLM.
   *
   * Unlike parameter errors, execution failures are typically not the
   * LLM's fault and returning them may not help.
   *
   * @since 1.0.0
   */
  readonly isLLMRecoverable = false

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion = "Tool execution failed. Check the tool implementation and input parameters."

  override get message(): string {
    return `Tool "${this.toolName}" execution failed. ${this.suggestion}`
  }
}

/**
 * Error raised when tool result cannot be encoded.
 *
 * This error occurs when the tool handler returns a result that cannot
 * be encoded according to the tool's success/failure schema.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation with tools
 * }).pipe(
 *   Effect.catchTag("ToolResultEncodingError", (e) => {
 *     console.error(`Failed to encode result for tool ${e.toolName}`)
 *     return Effect.fail(e)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class ToolResultEncodingError extends Schema.ErrorClass<ToolResultEncodingError>(
  "effect/ai/AiError/ToolResultEncodingError"
)({
  _tag: Schema.tag("ToolResultEncodingError"),
  operation: Schema.tag("toolExecution"),
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  toolName: Schema.String,
  toolCallId: Schema.String,
  result: Schema.Unknown,
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.TOOL_RESULT_ENCODING_FAILED

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion = "Tool result could not be encoded. Check the tool's success/failure schema."

  override get message(): string {
    return `Failed to encode result for tool "${this.toolName}". ${this.suggestion}`
  }
}

// =============================================================================
// Unknown Errors
// =============================================================================

/**
 * Catch-all error for unexpected failures.
 *
 * This error is used when an unexpected exception occurs that doesn't fit
 * into the other specific error categories.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   // ... some AI operation
 * }).pipe(
 *   Effect.catchTag("UnknownError", (e) => {
 *     console.error(`Unexpected error: ${e.message}`)
 *     return Effect.fail(e)
 *   })
 * )
 * ```
 *
 * @since 1.0.0
 * @category Errors
 */
export class UnknownError extends Schema.ErrorClass<UnknownError>(
  "effect/ai/AiError/UnknownError"
)({
  _tag: Schema.tag("UnknownError"),
  operation: AiOperation,
  provider: AiProvider,
  model: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  timestamp: Schema.Date,
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 1.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Machine-readable error code.
   *
   * @since 1.0.0
   */
  readonly code = AiErrorCode.UNKNOWN_ERROR

  /**
   * Whether this error is retryable.
   *
   * @since 1.0.0
   */
  readonly isRetryable = false

  /**
   * User-actionable suggestion for resolving this error.
   *
   * @since 1.0.0
   */
  readonly suggestion = "An unexpected error occurred. Check the error details and provider documentation."

  override get message(): string {
    return `Unknown error during ${this.operation} with ${this.provider}. ${this.suggestion}`
  }
}

// =============================================================================
// AiError
// =============================================================================

/**
 * Union type representing all possible AI operation errors.
 *
 * This type encompasses all error cases that can occur during AI operations,
 * providing a comprehensive error handling surface for applications.
 *
 * @since 1.0.0
 * @category Models
 */
export type AiError =
  // Network errors
  | ConnectionError
  | TimeoutError
  // Authentication errors
  | AuthenticationError
  | PermissionDeniedError
  // Rate limiting errors
  | RateLimitError
  | QuotaExceededError
  // Input validation errors
  | InvalidRequestError
  | TokenLimitExceededError
  // Content safety errors
  | ContentFilteredError
  | ContentPolicyViolationError
  // Model errors
  | ModelNotFoundError
  | ModelOverloadedError
  // Tool errors
  | ToolNotFoundError
  | ToolParameterError
  | ToolExecutionError
  | ToolResultEncodingError
  // Streaming errors
  | StreamInterruptedError
  // Response errors
  | MalformedResponseError
  | EmptyResponseError
  // Provider errors
  | ProviderError
  // Unknown errors
  | UnknownError

/**
 * Schema for validating and parsing AI errors.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const AiError: Schema.Union<[
  typeof ConnectionError,
  typeof TimeoutError,
  typeof AuthenticationError,
  typeof PermissionDeniedError,
  typeof RateLimitError,
  typeof QuotaExceededError,
  typeof InvalidRequestError,
  typeof TokenLimitExceededError,
  typeof ContentFilteredError,
  typeof ContentPolicyViolationError,
  typeof ModelNotFoundError,
  typeof ModelOverloadedError,
  typeof ToolNotFoundError,
  typeof ToolParameterError,
  typeof ToolExecutionError,
  typeof ToolResultEncodingError,
  typeof StreamInterruptedError,
  typeof MalformedResponseError,
  typeof EmptyResponseError,
  typeof ProviderError,
  typeof UnknownError
]> = Schema.Union([
  ConnectionError,
  TimeoutError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  QuotaExceededError,
  InvalidRequestError,
  TokenLimitExceededError,
  ContentFilteredError,
  ContentPolicyViolationError,
  ModelNotFoundError,
  ModelOverloadedError,
  ToolNotFoundError,
  ToolParameterError,
  ToolExecutionError,
  ToolResultEncodingError,
  StreamInterruptedError,
  MalformedResponseError,
  EmptyResponseError,
  ProviderError,
  UnknownError
])
