/**
 * The `AiError` module provides comprehensive, provider-agnostic error handling
 * for AI operations.
 *
 * This module uses the `reason` pattern where `AiError` is a top-level
 * wrapper error containing `module`, `method`, and a `reason` field that holds
 * the semantic error. This design enables ergonomic error handling while
 * preserving rich context about failures.
 *
 * ## Semantic Error Categories
 *
 * - **RateLimitError** - Request throttled (429s, provider-specific limits)
 * - **QuotaExhaustedError** - Account/billing limits reached
 * - **AuthenticationError** - Invalid/expired credentials
 * - **ContentPolicyError** - Input/output violated content policy
 * - **ModelUnavailableError** - Model not available/deprecated
 * - **ContextLengthError** - Token limit exceeded
 * - **InvalidRequestError** - Malformed request parameters
 * - **ProviderInternalError** - Provider-side failures (5xx)
 * - **AiTimeoutError** - Request timeout
 * - **NetworkError** - Transport-level failures
 * - **OutputParseError** - LLM output parsing failures
 * - **AiUnknownError** - Catch-all for unknown errors
 *
 * ## Retryability
 *
 * Each reason type has an `isRetryable` getter indicating whether the error is
 * transient. Some errors also provide a `retryAfter` duration hint.
 *
 * @example
 * ```ts
 * import { Effect, Match } from "effect"
 * import type { AiError } from "effect/unstable/ai"
 *
 * // Handle errors using Match on the reason
 * const handleAiError = Match.type<AiError.AiError>().pipe(
 *   Match.when(
 *     { reason: { _tag: "RateLimitError" } },
 *     (err) => Effect.logWarning(`Rate limited, retry after ${err.retryAfter}`)
 *   ),
 *   Match.when(
 *     { reason: { _tag: "AuthenticationError" } },
 *     (err) => Effect.logError(`Auth failed: ${err.reason.kind}`)
 *   ),
 *   Match.when(
 *     { reason: { isRetryable: true } },
 *     (err) => Effect.logWarning(`Transient error, retrying: ${err.message}`)
 *   ),
 *   Match.orElse((err) => Effect.logError(`Permanent error: ${err.message}`))
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Duration, Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * // Create an AiError with a reason
 * const error = AiError.make({
 *   module: "OpenAI",
 *   method: "completion",
 *   reason: new AiError.RateLimitError({
 *     limit: "requests",
 *     retryAfter: Duration.seconds(60)
 *   })
 * })
 *
 * console.log(error.isRetryable) // true
 * console.log(error.message) // "OpenAI.completion: Rate limit exceeded (requests). Retry after 1 minute"
 * ```
 *
 * @since 4.0.0
 */
import * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import { format } from "../../Formatter.ts"
import * as Predicate from "../../Predicate.ts"
import { redact } from "../../Redactable.ts"
import * as Schema from "../../Schema.ts"
import type * as HttpClientError from "../http/HttpClientError.ts"

const LegacyTypeId = "~effect/unstable/ai/AiError" as const

const httpClientReasonLabel = (tag: string) => tag.endsWith("Error") ? tag.slice(0, -5) : tag

// =============================================================================
// Http Request Error
// =============================================================================

/**
 * Schema for HTTP request details used in error reporting.
 *
 * Captures comprehensive information about HTTP requests that failed,
 * enabling detailed error analysis and debugging.
 *
 * @example
 * ```ts
 * import type { AiError } from "effect/unstable/ai"
 *
 * const requestDetails: typeof AiError.HttpRequestDetails.Type = {
 *   method: "POST",
 *   url: "https://api.openai.com/v1/completions",
 *   urlParams: [["model", "gpt-4"], ["stream", "false"]],
 *   hash: "#section1",
 *   headers: { "Content-Type": "application/json" }
 * }
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export const HttpRequestDetails = Schema.Struct({
  method: Schema.Literals(["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"]),
  url: Schema.String,
  urlParams: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
  hash: Schema.UndefinedOr(Schema.String),
  headers: Schema.Record(Schema.String, Schema.String)
}).annotate({ identifier: "HttpRequestDetails" })

/**
 * Error that occurs during HTTP request processing.
 *
 * This error is raised when issues arise before receiving an HTTP response,
 * such as network connectivity problems, request encoding issues, or invalid
 * URLs.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const handleNetworkError = Effect.gen(function*() {
 *   const error = new AiError.HttpRequestError({
 *     module: "OpenAI",
 *     method: "createCompletion",
 *     reason: "Transport",
 *     request: {
 *       method: "POST",
 *       url: "https://api.openai.com/v1/completions",
 *       urlParams: [],
 *       hash: undefined,
 *       headers: { "Content-Type": "application/json" }
 *     },
 *     description: "Connection timeout after 30 seconds"
 *   })
 *
 *   console.log(error.message)
 *   // "Transport: Connection timeout after 30 seconds (POST https://api.openai.com/v1/completions)"
 * })
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class HttpRequestError extends Schema.ErrorClass<HttpRequestError>(
  "effect/ai/AiError/HttpRequestError"
)({
  _tag: Schema.tag("HttpRequestError"),
  module: Schema.String,
  method: Schema.String,
  reason: Schema.Literals(["Transport", "Encode", "InvalidUrl"]),
  request: HttpRequestDetails,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [LegacyTypeId] = LegacyTypeId

  /**
   * Creates an HttpRequestError from a platform HttpClientError.
   *
   * @example
   * ```ts
   * import { AiError } from "effect/unstable/ai"
   * import type { HttpClientError } from "effect/unstable/http"
   *
   * declare const platformError: HttpClientError.HttpClientError
   *
   * const aiError = AiError.HttpRequestError.fromRequestError({
   *   module: "ChatGPT",
   *   method: "sendMessage",
   *   error: platformError
   * })
   * ```
   *
   * @since 4.0.0
   * @category constructors
   */
  static fromRequestError({ error, ...params }: {
    readonly module: string
    readonly method: string
    readonly error: HttpClientError.HttpClientError
  }): HttpRequestError {
    const reason = error.reason as HttpClientError.RequestError
    return new HttpRequestError({
      ...params,
      cause: error,
      description: reason.description,
      reason: httpClientReasonLabel(reason._tag) as "Transport" | "Encode" | "InvalidUrl",
      request: {
        hash: reason.request.hash,
        headers: redact(reason.request.headers) as any,
        method: reason.request.method,
        url: reason.request.url,
        urlParams: Array.from(reason.request.urlParams)
      }
    })
  }

  override get message(): string {
    const methodAndUrl = `${this.request.method} ${this.request.url}`

    let baseMessage = this.description
      ? `${this.reason}: ${this.description}`
      : `${this.reason}: An HTTP request error occurred.`

    baseMessage += ` (${methodAndUrl})`

    let suggestion = ""
    switch (this.reason) {
      case "Encode": {
        suggestion += "Check that the request body data is properly formatted and matches the expected content type."
        break
      }

      case "InvalidUrl": {
        suggestion += "Verify that the URL format is correct and that all required parameters have been provided."
        suggestion += " Check for any special characters that may need encoding."
        break
      }

      case "Transport": {
        suggestion += "Check your network connection and verify that the requested URL is accessible."
        break
      }
    }

    baseMessage += `\n\n${suggestion}`

    return baseMessage
  }
}

// =============================================================================
// Http Response Error
// =============================================================================

/**
 * Schema for HTTP response details used in error reporting.
 *
 * Captures essential information about HTTP responses that caused errors,
 * including status codes and headers for debugging purposes.
 *
 * @example
 * ```ts
 * import type { AiError } from "effect/unstable/ai"
 *
 * const responseDetails: typeof AiError.HttpResponseDetails.Type = {
 *   status: 429,
 *   headers: {
 *     "Content-Type": "application/json",
 *     "X-RateLimit-Remaining": "0",
 *     "Retry-After": "60"
 *   }
 * }
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export const HttpResponseDetails = Schema.Struct({
  status: Schema.Number,
  headers: Schema.Record(Schema.String, Schema.String)
}).annotate({ identifier: "HttpResponseDetails" })

// =============================================================================
// Supporting Schemas
// =============================================================================

/**
 * Metadata about the AI provider that originated an error.
 *
 * @since 4.0.0
 * @category schemas
 */
export const ProviderMetadata = Schema.Struct({
  name: Schema.String,
  errorCode: Schema.optional(Schema.String),
  errorType: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  raw: Schema.optional(Schema.Unknown)
}).annotate({ identifier: "ProviderMetadata" })

/**
 * Token usage information from AI operations.
 *
 * @since 4.0.0
 * @category schemas
 */
export const UsageInfo = Schema.Struct({
  promptTokens: Schema.optional(Schema.Number),
  completionTokens: Schema.optional(Schema.Number),
  totalTokens: Schema.optional(Schema.Number)
}).annotate({ identifier: "UsageInfo" })

/**
 * Combined HTTP context for error reporting.
 *
 * @since 4.0.0
 * @category schemas
 */
export const HttpContext = Schema.Struct({
  request: HttpRequestDetails,
  response: Schema.optional(HttpResponseDetails),
  body: Schema.optional(Schema.String)
}).annotate({ identifier: "HttpContext" })

// =============================================================================
// Reason Classes
// =============================================================================

/**
 * Error indicating the request was rate limited.
 *
 * Rate limit errors are always retryable. When `retryAfter` is provided,
 * callers should wait that duration before retrying.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const rateLimitError = new AiError.RateLimitError({
 *   limit: "requests",
 *   remaining: 0,
 *   retryAfter: Duration.seconds(60)
 * })
 *
 * console.log(rateLimitError.isRetryable) // true
 * console.log(rateLimitError.message) // "Rate limit exceeded (requests). Retry after 1 minute"
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class RateLimitError extends Schema.ErrorClass<RateLimitError>(
  "effect/ai/AiError/RateLimitError"
)({
  _tag: Schema.tag("RateLimitError"),
  retryAfter: Schema.optional(Schema.Duration),
  limit: Schema.optional(Schema.String),
  remaining: Schema.optional(Schema.Number),
  resetAt: Schema.optional(Schema.DateTimeUtc),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Rate limit errors are always retryable.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return true
  }

  override get message(): string {
    let msg = "Rate limit exceeded"
    if (this.limit) msg += ` (${this.limit})`
    if (this.retryAfter) msg += `. Retry after ${Duration.format(this.retryAfter)}`
    return msg
  }
}

/**
 * Error indicating account or billing limits have been reached.
 *
 * Quota exhausted errors are not retryable without user action.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const quotaError = new AiError.QuotaExhaustedError({
 *   quotaType: "tokens"
 * })
 *
 * console.log(quotaError.isRetryable) // false
 * console.log(quotaError.message)
 * // "Quota exhausted (tokens). Check your account billing and usage limits."
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class QuotaExhaustedError extends Schema.ErrorClass<QuotaExhaustedError>(
  "effect/ai/AiError/QuotaExhaustedError"
)({
  _tag: Schema.tag("QuotaExhaustedError"),
  quotaType: Schema.optional(Schema.String),
  resetAt: Schema.optional(Schema.DateTimeUtc),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Quota exhausted errors require user action and are not retryable.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return false
  }

  override get message(): string {
    let msg = "Quota exhausted"
    if (this.quotaType) msg += ` (${this.quotaType})`
    if (this.resetAt) msg += `. Resets at ${this.resetAt}`
    return `${msg}. Check your account billing and usage limits.`
  }
}

/**
 * Error indicating authentication or authorization failure.
 *
 * Authentication errors are never retryable without credential changes.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const authError = new AiError.AuthenticationError({
 *   kind: "InvalidKey"
 * })
 *
 * console.log(authError.isRetryable) // false
 * console.log(authError.message)
 * // "InvalidKey: Verify your API key is correct"
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class AuthenticationError extends Schema.ErrorClass<AuthenticationError>(
  "effect/ai/AiError/AuthenticationError"
)({
  _tag: Schema.tag("AuthenticationError"),
  kind: Schema.Literals(["InvalidKey", "ExpiredKey", "MissingKey", "InsufficientPermissions", "Unknown"]),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Authentication errors require credential changes and are not retryable.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return false
  }

  override get message(): string {
    const suggestions: Record<string, string> = {
      InvalidKey: "Verify your API key is correct",
      ExpiredKey: "Your API key has expired. Generate a new one",
      MissingKey: "No API key provided. Set the appropriate environment variable",
      InsufficientPermissions: "Your API key lacks required permissions",
      Unknown: "Authentication failed. Check your credentials"
    }
    return `${this.kind}: ${suggestions[this.kind]}`
  }
}

/**
 * Error indicating content policy violation.
 *
 * Content policy errors are never retryable without content changes.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const policyError = new AiError.ContentPolicyError({
 *   violationType: "hate",
 *   flaggedInput: true
 * })
 *
 * console.log(policyError.isRetryable) // false
 * console.log(policyError.message)
 * // "Content policy violation: hate in input"
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class ContentPolicyError extends Schema.ErrorClass<ContentPolicyError>(
  "effect/ai/AiError/ContentPolicyError"
)({
  _tag: Schema.tag("ContentPolicyError"),
  violationType: Schema.optional(Schema.String),
  flaggedInput: Schema.optional(Schema.Boolean),
  flaggedOutput: Schema.optional(Schema.Boolean),
  flaggedContent: Schema.optional(Schema.String),
  categories: Schema.optional(Schema.Array(Schema.String)),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Content policy errors require content changes and are not retryable.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return false
  }

  override get message(): string {
    let msg = "Content policy violation"
    if (this.violationType) msg += `: ${this.violationType}`
    if (this.flaggedInput) msg += " in input"
    if (this.flaggedOutput) msg += " in output"
    return msg
  }
}

/**
 * Error indicating the requested model is unavailable.
 *
 * Model unavailable errors are retryable only for temporary conditions
 * like `Overloaded` or `Maintenance`.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const modelError = new AiError.ModelUnavailableError({
 *   model: "gpt-5",
 *   kind: "NotFound",
 *   alternativeModels: ["gpt-4", "gpt-4-turbo"]
 * })
 *
 * console.log(modelError.isRetryable) // false
 * console.log(modelError.message)
 * // "Model 'gpt-5' unavailable: NotFound. Try: gpt-4, gpt-4-turbo"
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class ModelUnavailableError extends Schema.ErrorClass<ModelUnavailableError>(
  "effect/ai/AiError/ModelUnavailableError"
)({
  _tag: Schema.tag("ModelUnavailableError"),
  model: Schema.String,
  kind: Schema.Literals(["NotFound", "Deprecated", "Overloaded", "Maintenance", "Unknown"]),
  alternativeModels: Schema.optional(Schema.Array(Schema.String)),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Model unavailable errors are retryable only for temporary conditions.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return this.kind === "Overloaded" || this.kind === "Maintenance"
  }

  override get message(): string {
    let msg = `Model '${this.model}' unavailable: ${this.kind}`
    if (this.alternativeModels && this.alternativeModels.length > 0) {
      msg += `. Try: ${this.alternativeModels.join(", ")}`
    }
    return msg
  }
}

/**
 * Error indicating the request exceeded the model's context length.
 *
 * Context length errors require reducing input size and are not retryable.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const contextError = new AiError.ContextLengthError({
 *   maxTokens: 8192,
 *   requestedTokens: 12000
 * })
 *
 * console.log(contextError.isRetryable) // false
 * console.log(contextError.message)
 * // "Context length exceeded: requested 12000 tokens, max 8192. Reduce input size or use a model with larger context window."
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class ContextLengthError extends Schema.ErrorClass<ContextLengthError>(
  "effect/ai/AiError/ContextLengthError"
)({
  _tag: Schema.tag("ContextLengthError"),
  maxTokens: Schema.optional(Schema.Number),
  requestedTokens: Schema.optional(Schema.Number),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Context length errors require reducing input and are not retryable.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return false
  }

  override get message(): string {
    let msg = "Context length exceeded"
    if (this.requestedTokens && this.maxTokens) {
      msg += `: requested ${this.requestedTokens} tokens, max ${this.maxTokens}`
    }
    return `${msg}. Reduce input size or use a model with larger context window.`
  }
}

/**
 * Error indicating the request had invalid or malformed parameters.
 *
 * Invalid request errors require fixing the request and are not retryable.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const invalidRequestError = new AiError.InvalidRequestError({
 *   parameter: "temperature",
 *   constraint: "must be between 0 and 2",
 *   description: "Temperature value 5 is out of range"
 * })
 *
 * console.log(invalidRequestError.isRetryable) // false
 * console.log(invalidRequestError.message)
 * // "Invalid request: parameter 'temperature' must be between 0 and 2. Temperature value 5 is out of range"
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class InvalidRequestError extends Schema.ErrorClass<InvalidRequestError>(
  "effect/ai/AiError/InvalidRequestError"
)({
  _tag: Schema.tag("InvalidRequestError"),
  parameter: Schema.optional(Schema.String),
  constraint: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Invalid request errors require fixing the request and are not retryable.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return false
  }

  override get message(): string {
    let msg = "Invalid request"
    if (this.parameter) msg += `: parameter '${this.parameter}'`
    if (this.constraint) msg += ` ${this.constraint}`
    if (this.description) msg += `. ${this.description}`
    return msg
  }
}

/**
 * Error indicating the AI provider experienced an internal error.
 *
 * Provider internal errors are typically transient and are retryable.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const providerError = new AiError.ProviderInternalError({
 *   retryAfter: Duration.seconds(30)
 * })
 *
 * console.log(providerError.isRetryable) // true
 * console.log(providerError.message)
 * // "Provider internal error. Retry after 30 seconds. This is likely temporary."
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class ProviderInternalError extends Schema.ErrorClass<ProviderInternalError>(
  "effect/ai/AiError/ProviderInternalError"
)({
  _tag: Schema.tag("ProviderInternalError"),
  retryAfter: Schema.optional(Schema.Duration),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Provider internal errors are typically transient and are retryable.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return true
  }

  override get message(): string {
    let msg = "Provider internal error"
    if (this.provider?.name) msg = `${this.provider.name} internal error`
    if (this.retryAfter) msg += `. Retry after ${Duration.format(this.retryAfter)}`
    return `${msg}. This is likely temporary.`
  }
}

/**
 * Error indicating a request timeout.
 *
 * Timeout errors are typically transient and are retryable.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const timeoutError = new AiError.AiTimeoutError({
 *   phase: "Response",
 *   duration: Duration.seconds(30)
 * })
 *
 * console.log(timeoutError.isRetryable) // true
 * console.log(timeoutError.message)
 * // "Response timeout after 30 seconds"
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class AiTimeoutError extends Schema.ErrorClass<AiTimeoutError>(
  "effect/ai/AiError/AiTimeoutError"
)({
  _tag: Schema.tag("AiTimeoutError"),
  phase: Schema.Literals(["Connection", "Request", "Response"]),
  duration: Schema.optional(Schema.Duration),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Timeout errors are typically transient and are retryable.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return true
  }

  override get message(): string {
    let msg = `${this.phase} timeout`
    if (this.duration) msg += ` after ${Duration.format(this.duration)}`
    return msg
  }
}

/**
 * Error indicating a network-level failure.
 *
 * Network errors are typically transient and are retryable.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const networkError = new AiError.NetworkError({
 *   kind: "ConnectionRefused"
 * })
 *
 * console.log(networkError.isRetryable) // true
 * console.log(networkError.message)
 * // "ConnectionRefused: Check network connectivity and firewall settings"
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class NetworkError extends Schema.ErrorClass<NetworkError>(
  "effect/ai/AiError/NetworkError"
)({
  _tag: Schema.tag("NetworkError"),
  kind: Schema.Literals(["ConnectionRefused", "DnsLookupFailed", "TlsError", "Unknown"]),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Network errors are typically transient and are retryable.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return true
  }

  override get message(): string {
    const suggestions: Record<string, string> = {
      ConnectionRefused: "Check network connectivity and firewall settings",
      DnsLookupFailed: "Verify the API endpoint hostname is correct",
      TlsError: "TLS/SSL handshake failed. Check certificate validity",
      Unknown: "Network error occurred. Check your connection"
    }
    return `${this.kind}: ${suggestions[this.kind]}`
  }
}

/**
 * Error indicating failure to parse LLM output.
 *
 * Output parse errors are retryable since LLM outputs are non-deterministic.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const parseError = new AiError.OutputParseError({
 *   rawOutput: '{"invalid": json}',
 *   expectedSchema: "UserResponse"
 * })
 *
 * console.log(parseError.isRetryable) // true
 * console.log(parseError.message)
 * // "Failed to parse LLM output into expected schema"
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class OutputParseError extends Schema.ErrorClass<OutputParseError>(
  "effect/ai/AiError/OutputParseError"
)({
  _tag: Schema.tag("OutputParseError"),
  rawOutput: Schema.optional(Schema.String),
  expectedSchema: Schema.optional(Schema.String),
  provider: Schema.optional(ProviderMetadata),
  usage: Schema.optional(UsageInfo),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Output parse errors are retryable since LLM outputs are non-deterministic.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return true
  }

  /**
   * Creates an OutputParseError from a Schema error.
   *
   * @example
   * ```ts
   * import { Schema } from "effect"
   * import { AiError } from "effect/unstable/ai"
   *
   * declare const schemaError: Schema.SchemaError
   *
   * const parseError = AiError.OutputParseError.fromSchemaError({
   *   rawOutput: "invalid json",
   *   error: schemaError
   * })
   * ```
   *
   * @since 4.0.0
   * @category constructors
   */
  static fromSchemaError(params: {
    readonly rawOutput?: string
    readonly error: Schema.SchemaError
  }): OutputParseError {
    return new OutputParseError({
      rawOutput: params.rawOutput,
      cause: params.error
    })
  }

  override get message(): string {
    return "Failed to parse LLM output into expected schema"
  }
}

/**
 * Catch-all error for unknown or unexpected errors.
 *
 * Unknown errors are not retryable by default since the cause is unknown.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const unknownError = new AiError.AiUnknownError({
 *   description: "An unexpected error occurred"
 * })
 *
 * console.log(unknownError.isRetryable) // false
 * console.log(unknownError.message)
 * // "An unexpected error occurred"
 * ```
 *
 * @since 4.0.0
 * @category reason
 */
export class AiUnknownError extends Schema.ErrorClass<AiUnknownError>(
  "effect/ai/AiError/AiUnknownError"
)({
  _tag: Schema.tag("AiUnknownError"),
  description: Schema.optional(Schema.String),
  provider: Schema.optional(ProviderMetadata),
  http: Schema.optional(HttpContext),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * Unknown errors are not retryable by default.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return false
  }

  override get message(): string {
    return this.description ?? "Unknown error"
  }
}

// =============================================================================
// AiErrorReason Union
// =============================================================================

/**
 * Union type of all semantic error reasons that can occur during AI operations.
 *
 * Each reason type provides:
 * - Semantic categorization of the failure mode
 * - `isRetryable` getter indicating if the error is transient
 * - Optional `retryAfter` duration for rate limit/throttling errors
 * - Rich context including provider metadata and HTTP details
 *
 * @since 4.0.0
 * @category models
 */
export type AiErrorReason =
  | RateLimitError
  | QuotaExhaustedError
  | AuthenticationError
  | ContentPolicyError
  | ModelUnavailableError
  | ContextLengthError
  | InvalidRequestError
  | ProviderInternalError
  | AiTimeoutError
  | NetworkError
  | OutputParseError
  | AiUnknownError

/**
 * Schema for validating and parsing AI error reasons.
 *
 * @since 4.0.0
 * @category schemas
 */
export const AiErrorReason: Schema.Union<[
  typeof RateLimitError,
  typeof QuotaExhaustedError,
  typeof AuthenticationError,
  typeof ContentPolicyError,
  typeof ModelUnavailableError,
  typeof ContextLengthError,
  typeof InvalidRequestError,
  typeof ProviderInternalError,
  typeof AiTimeoutError,
  typeof NetworkError,
  typeof OutputParseError,
  typeof AiUnknownError
]> = Schema.Union([
  RateLimitError,
  QuotaExhaustedError,
  AuthenticationError,
  ContentPolicyError,
  ModelUnavailableError,
  ContextLengthError,
  InvalidRequestError,
  ProviderInternalError,
  AiTimeoutError,
  NetworkError,
  OutputParseError,
  AiUnknownError
])

// =============================================================================
// Top-Level AiError
// =============================================================================

const TypeId = "~effect/unstable/ai/AiError/AiError" as const

/**
 * Top-level AI error wrapper using the `reason` pattern.
 *
 * This error wraps semantic error reasons and provides:
 * - `module` and `method` context for where the error occurred
 * - `reason` field containing the semantic error type
 * - Delegated `isRetryable` and `retryAfter` to the underlying reason
 *
 * Use with `Effect.catchReason` for ergonomic error handling:
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * declare const aiOperation: Effect.Effect<string, AiError.AiError>
 *
 * // Handle specific reason types
 * const handled = aiOperation.pipe(
 *   Effect.catchTag("AiError", (error) => {
 *     if (error.reason._tag === "RateLimitError") {
 *       return Effect.succeed(`Retry after ${error.retryAfter}`)
 *     }
 *     return Effect.fail(error)
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class AiError extends Schema.ErrorClass<AiError>(
  "effect/ai/AiError/AiError"
)({
  _tag: Schema.tag("AiError"),
  module: Schema.String,
  method: Schema.String,
  reason: AiErrorReason
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * Delegates to the underlying reason's `isRetryable` getter.
   *
   * @since 4.0.0
   */
  get isRetryable(): boolean {
    return this.reason.isRetryable
  }

  /**
   * Delegates to the underlying reason's `retryAfter` if present.
   *
   * @since 4.0.0
   */
  get retryAfter(): Duration.Duration | undefined {
    return "retryAfter" in this.reason ? this.reason.retryAfter : undefined
  }

  override get message(): string {
    return `${this.module}.${this.method}: ${this.reason.message}`
  }
}

/**
 * Type guard to check if a value is an `AiError`.
 *
 * @param u - The value to check
 * @returns `true` if the value is an `AiError`, `false` otherwise
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const someError = new Error("generic error")
 * const aiError = AiError.make({
 *   module: "Test",
 *   method: "example",
 *   reason: new AiError.RateLimitError({})
 * })
 *
 * console.log(AiError.isAiError(someError)) // false
 * console.log(AiError.isAiError(aiError)) // true
 * ```
 *
 * @since 4.0.0
 * @category guards
 */
export const isAiError = (u: unknown): u is AiError => Predicate.hasProperty(u, TypeId)

/**
 * Creates an `AiError` with the given reason.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const error = AiError.make({
 *   module: "OpenAI",
 *   method: "completion",
 *   reason: new AiError.RateLimitError({
 *     limit: "requests",
 *     retryAfter: Duration.seconds(60)
 *   })
 * })
 *
 * console.log(error.message)
 * // "OpenAI.completion: Rate limit exceeded (requests). Retry after 1 minute"
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make = (params: {
  readonly module: string
  readonly method: string
  readonly reason: AiErrorReason
}): AiError => new AiError(params)

/**
 * Maps HTTP status codes to semantic error reasons.
 *
 * Provider packages can use this as a base for provider-specific mapping.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const reason = AiError.reasonFromHttpStatus({
 *   status: 429,
 *   body: { error: "Rate limit exceeded" }
 * })
 *
 * console.log(reason._tag) // "RateLimitError"
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const reasonFromHttpStatus = (params: {
  readonly status: number
  readonly body?: unknown
  readonly http?: typeof HttpContext.Type
  readonly provider?: typeof ProviderMetadata.Type
}): AiErrorReason => {
  const { status, body, http, provider } = params
  switch (status) {
    case 400:
      return new InvalidRequestError({ http, provider, cause: body })
    case 401:
      return new AuthenticationError({ kind: "InvalidKey", http, provider, cause: body })
    case 403:
      return new AuthenticationError({ kind: "InsufficientPermissions", http, provider, cause: body })
    case 408:
      return new AiTimeoutError({ phase: "Request", http, provider, cause: body })
    case 429:
      return new RateLimitError({ http, provider, cause: body })
    default:
      if (status >= 500) {
        return new ProviderInternalError({ http, provider, cause: body })
      }
      return new AiUnknownError({ http, provider, cause: body })
  }
}

// =============================================================================
// Deprecated Error Types (To Be Removed in Phase 5)
// =============================================================================

/**
 * Error that occurs during HTTP response processing.
 *
 * This error is thrown when issues arise after receiving an HTTP response,
 * such as unexpected status codes, response decoding failures, or empty
 * response bodies.
 *
 * @example
 * ```ts
 * import { AiError } from "effect/unstable/ai"
 *
 * const responseError = new AiError.HttpResponseError({
 *   module: "OpenAI",
 *   method: "createCompletion",
 *   reason: "StatusCode",
 *   request: {
 *     method: "POST",
 *     url: "https://api.openai.com/v1/completions",
 *     urlParams: [],
 *     hash: undefined,
 *     headers: { "Content-Type": "application/json" }
 *   },
 *   response: {
 *     status: 429,
 *     headers: { "X-RateLimit-Remaining": "0" }
 *   },
 *   description: "Rate limit exceeded"
 * })
 *
 * console.log(responseError.message)
 * // "StatusCode: Rate limit exceeded (429 POST https://api.openai.com/v1/completions)"
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class HttpResponseError extends Schema.ErrorClass<HttpResponseError>(
  "effect/ai/AiError/HttpResponseError"
)({
  _tag: Schema.tag("HttpResponseError"),
  module: Schema.String,
  method: Schema.String,
  request: HttpRequestDetails,
  response: HttpResponseDetails,
  body: Schema.optional(Schema.String),
  reason: Schema.Literals(["StatusCode", "Decode", "EmptyBody"]),
  description: Schema.optional(Schema.String)
}) {
  /**
   * @since 4.0.0
   */
  readonly [LegacyTypeId] = LegacyTypeId

  /**
   * Creates an HttpResponseError from a platform HttpClientError.
   *
   * @example
   * ```ts
   * import { AiError } from "effect/unstable/ai"
   * import type { HttpClientError } from "effect/unstable/http"
   *
   * declare const platformError: HttpClientError.HttpClientError
   *
   * const aiError = AiError.HttpResponseError.fromResponseError({
   *   module: "OpenAI",
   *   method: "completion",
   *   error: platformError
   * })
   * ```
   *
   * @since 4.0.0
   * @category constructors
   */
  static fromResponseError({ error, ...params }: {
    readonly module: string
    readonly method: string
    readonly error: HttpClientError.HttpClientError
  }): Effect.Effect<never, HttpResponseError> {
    const reason = error.reason as HttpClientError.ResponseError
    let body: Effect.Effect<unknown, HttpClientError.HttpClientError> = Effect.void
    const contentType = reason.response.headers["content-type"] ?? ""
    if (contentType.includes("application/json")) {
      body = reason.response.json
    } else if (contentType.includes("text/") || contentType.includes("urlencoded")) {
      body = reason.response.text
    }
    return Effect.flatMap(
      Effect.matchEffect(body, {
        onFailure: Effect.succeed,
        onSuccess: Effect.succeed
      }),
      (body) =>
        Effect.fail(
          new HttpResponseError({
            ...params,
            description: reason.description,
            reason: httpClientReasonLabel(reason._tag) as "StatusCode" | "Decode" | "EmptyBody",
            request: {
              hash: reason.request.hash,
              headers: redact(reason.request.headers) as any,
              method: reason.request.method,
              url: reason.request.url,
              urlParams: Array.from(reason.request.urlParams)
            },
            response: {
              headers: redact(reason.response.headers) as any,
              status: reason.response.status
            },
            body: format(redact(body))
          })
        )
    )
  }

  override get message(): string {
    const methodUrlStatus = `${this.response.status} ${this.request.method} ${this.request.url}`

    let baseMessage = this.description
      ? `${this.reason}: ${this.description}`
      : `${this.reason}: An HTTP response error occurred.`

    baseMessage += ` (${methodUrlStatus})`

    let suggestion = ""
    switch (this.reason) {
      case "Decode": {
        suggestion += "The response format does not match what is expected. " +
          "Verify API version compatibility, check response content-type, " +
          "and/or examine if the endpoint schema has changed."
        break
      }
      case "EmptyBody": {
        suggestion += "The response body was empty. This may indicate a server " +
          "issue, API version mismatch, or the endpoint may have changed its response format."
        break
      }
      case "StatusCode": {
        suggestion += getStatusCodeSuggestion(this.response.status)
        break
      }
    }

    baseMessage += `\n\n${suggestion}`

    if (Predicate.isNotUndefined(this.body)) {
      baseMessage += `\n\nResponse Body: ${this.body}`
    }

    return baseMessage
  }
}

// =============================================================================
// Malformed Input Error
// =============================================================================

/**
 * Error thrown when input data doesn't match the expected format or schema.
 *
 * This error occurs when the data provided to an AI operation fails validation,
 * is missing required fields, or doesn't conform to the expected structure.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const validateInput = Effect.fnUntraced(function*(data: unknown) {
 *   if (typeof data === "string" && data.length > 0) {
 *     return data
 *   }
 *   return yield* new AiError.MalformedInput({
 *     module: "ChatBot",
 *     method: "processMessage",
 *     description: "Input must be a non-empty string"
 *   })
 * })
 *
 * const program = validateInput("").pipe(
 *   Effect.catchTag("MalformedInput", (error) => {
 *     console.log(`Input validation failed: ${error.description}`)
 *     return Effect.succeed("Please provide a valid message")
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class MalformedInput extends Schema.ErrorClass<MalformedInput>(
  "effect/ai/AiError/MalformedInput"
)({
  _tag: Schema.tag("MalformedInput"),
  module: Schema.String,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [LegacyTypeId] = LegacyTypeId
}

// =============================================================================
// Malformed Output Error
// =============================================================================

/**
 * Error thrown when output data can't be parsed or validated.
 *
 * This error occurs when AI service responses don't match the expected format,
 * contain invalid data structures, or fail schema validation during parsing.
 *
 * @example
 * ```ts
 * import { Effect, Schema } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const ResponseSchema = Schema.Struct({
 *   message: Schema.String,
 *   tokens: Schema.Number
 * })
 *
 * const parseResponse = (data: unknown) =>
 *   Schema.decodeUnknownEffect(ResponseSchema)(data).pipe(
 *     Effect.mapError((schemaError) =>
 *       new AiError.MalformedOutput({
 *         module: "OpenAI",
 *         method: "completion",
 *         description: "Response doesn't match expected schema",
 *         cause: schemaError
 *       })
 *     )
 *   )
 *
 * const program = parseResponse({ invalid: "data" }).pipe(
 *   Effect.catchTag("MalformedOutput", (error) => {
 *     console.log(`Parsing failed: ${error.description}`)
 *     return Effect.succeed({ message: "Error", tokens: 0 })
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class MalformedOutput extends Schema.ErrorClass<MalformedOutput>(
  "effect/ai/AiError/MalformedOutput"
)({
  _tag: Schema.tag("MalformedOutput"),
  module: Schema.String,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [LegacyTypeId] = LegacyTypeId

  /**
   * Creates a MalformedOutput error from a Schema ParseError.
   *
   * @example
   * ```ts
   * import { Effect, Schema } from "effect"
   * import { AiError } from "effect/unstable/ai"
   *
   * const UserSchema = Schema.Struct({
   *   name: Schema.String,
   *   age: Schema.Number
   * })
   *
   * const parseUser = (data: unknown) =>
   *   Schema.decodeUnknownEffect(UserSchema)(data).pipe(
   *     Effect.mapError((parseError) =>
   *       AiError.MalformedOutput.fromSchemaError({
   *         module: "UserService",
   *         method: "parseUserData",
   *         error: parseError
   *       })
   *     )
   *   )
   * ```
   *
   * @since 4.0.0
   * @category constructors
   */
  static fromSchemaError({ error, ...params }: {
    readonly module: string
    readonly method: string
    readonly description?: string
    readonly error: Schema.SchemaError
  }): MalformedOutput {
    // TODO(Max): enhance
    return new MalformedOutput({
      ...params,
      cause: error
    })
  }
}

// =============================================================================
// Unknown Error
// =============================================================================

/**
 * Catch-all error for unexpected runtime errors in AI operations.
 *
 * This error is used when an unexpected exception occurs that doesn't fit
 * into the other specific error categories. It provides context about where
 * the error occurred and preserves the original cause for debugging.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiError } from "effect/unstable/ai"
 *
 * const riskyOperation = () => {
 *   try {
 *     // Some operation that might throw
 *     throw new Error("Unexpected network issue")
 *   } catch (cause) {
 *     return Effect.fail(
 *       new AiError.UnknownError({
 *         module: "ChatService",
 *         method: "sendMessage",
 *         description: "An unexpected error occurred during message processing",
 *         cause
 *       })
 *     )
 *   }
 * }
 *
 * const program = riskyOperation().pipe(
 *   Effect.catchTag("UnknownError", (error) => {
 *     console.log(error.message)
 *     // "ChatService.sendMessage: An unexpected error occurred during message processing"
 *     return Effect.succeed("Service temporarily unavailable")
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category schemas
 */
export class UnknownError extends Schema.ErrorClass<UnknownError>(
  "effect/ai/AiError/UnknownError"
)({
  _tag: Schema.tag("UnknownError"),
  module: Schema.String,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [LegacyTypeId] = LegacyTypeId

  /**
   * @since 4.0.0
   */
  override get message(): string {
    const moduleMethod = `${this.module}.${this.method}`
    return Predicate.isUndefined(this.description)
      ? `${moduleMethod}: An error occurred`
      : `${moduleMethod}: ${this.description}`
  }
}

// =============================================================================
// Utilities
// =============================================================================

const getStatusCodeSuggestion = (statusCode: number): string => {
  if (statusCode >= 400 && statusCode < 500) {
    switch (statusCode) {
      case 400:
        return "Bad Request - Check request parameters, headers, and body format against API documentation."
      case 401:
        return "Unauthorized - Verify API key, authentication credentials, or token expiration."
      case 403:
        return "Forbidden - Check API permissions, usage limits, or resource access rights."
      case 404:
        return "Not Found - Verify the endpoint URL, API version, and resource identifiers."
      case 408:
        return "Request Timeout - Consider increasing timeout duration or implementing retry logic."
      case 422:
        return "Unprocessable Entity - Check request data validation, required fields, and data formats."
      case 429:
        return "Rate Limited - Implement exponential backoff or reduce request frequency."
      default:
        return "Client error - Review request format, parameters, and API documentation."
    }
  } else if (statusCode >= 500) {
    return "Server error - This is likely temporary. Implement retry logic with exponential backoff."
  } else {
    return "Check API documentation for this status code."
  }
}
