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
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as Number from "effect/Number"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import * as AiError from "effect/unstable/ai/AiError"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

// =============================================================================
// OpenAI Error Response Schema
// =============================================================================

/**
 * Schema for parsing standard OpenAI error response bodies.
 *
 * @since 1.0.0
 * @category schemas
 */
export const OpenAiErrorBody = Schema.Struct({
  error: Schema.Struct({
    message: Schema.String,
    type: Schema.String,
    param: Schema.optional(Schema.NullOr(Schema.String)),
    code: Schema.optional(Schema.NullOr(Schema.String))
  })
})

/**
 * Known OpenAI error codes.
 *
 * @since 1.0.0
 * @category models
 */
export type OpenAiErrorCode =
  | "rate_limit_exceeded"
  | "insufficient_quota"
  | "billing_hard_limit_reached"
  | "invalid_api_key"
  | "incorrect_api_key"
  | "context_length_exceeded"
  | "max_tokens_exceeded"
  | "model_not_found"
  | "model_overloaded"
  | "content_policy_violation"
  | "safety_system"
  | "invalid_request_error"
  | "invalid_parameter_value"

/**
 * Known OpenAI error types.
 *
 * @since 1.0.0
 * @category models
 */
export type OpenAiErrorType =
  | "authentication_error"
  | "invalid_request_error"
  | "permission_error"
  | "server_error"
  | "requests"
  | "tokens"

// =============================================================================
// Rate Limit Header Parsing
// =============================================================================

/**
 * Rate limit information extracted from OpenAI response headers.
 *
 * @since 1.0.0
 * @category models
 */
export interface RateLimitInfo {
  readonly limit: string | undefined
  readonly remaining: number | undefined
  readonly resetRequests: string | undefined
  readonly resetTokens: string | undefined
  readonly retryAfter: Duration.Duration | undefined
}

/**
 * Parses rate limit information from OpenAI response headers.
 *
 * @since 1.0.0
 * @category utilities
 */
export const parseRateLimitHeaders = (headers: Record<string, string>): RateLimitInfo => {
  const retryAfterRaw = headers["retry-after"]
  let retryAfter: Duration.Duration | undefined
  if (Predicate.isNotUndefined(retryAfterRaw)) {
    const parsed = Number.parse(retryAfterRaw)
    if (Predicate.isNotUndefined(parsed)) {
      retryAfter = Duration.seconds(parsed)
    }
  }

  const remainingRaw = headers["x-ratelimit-remaining-requests"]
  const remaining = Predicate.isNotUndefined(remainingRaw)
    ? Number.parse(remainingRaw)
    : undefined

  return {
    limit: headers["x-ratelimit-limit-requests"],
    remaining,
    resetRequests: headers["x-ratelimit-reset-requests"],
    resetTokens: headers["x-ratelimit-reset-tokens"],
    retryAfter
  }
}

// =============================================================================
// HTTP Context Builder
// =============================================================================

const sensitiveHeaders = new Set([
  "authorization",
  "x-api-key",
  "api-key",
  "openai-api-key"
])

const redactHeaders = (headers: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.has(key.toLowerCase())) {
      result[key] = "<redacted>"
    } else {
      result[key] = String(value)
    }
  }
  return result
}

/**
 * Builds HTTP context for error reporting.
 *
 * @since 1.0.0
 * @category utilities
 */
export const buildHttpContext = (params: {
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response?: HttpClientResponse.HttpClientResponse
  readonly body?: string
}): typeof AiError.HttpContext.Type => ({
  request: {
    method: params.request.method,
    url: params.request.url,
    urlParams: Array.from(params.request.urlParams),
    hash: params.request.hash,
    headers: redactHeaders(params.request.headers as Record<string, string>)
  },
  response: Predicate.isNotUndefined(params.response)
    ? {
      status: params.response.status,
      headers: redactHeaders(params.response.headers as Record<string, string>)
    }
    : undefined,
  body: params.body
})

// =============================================================================
// Provider Metadata Builder
// =============================================================================

/**
 * Builds provider metadata for OpenAI errors.
 *
 * @since 1.0.0
 * @category utilities
 */
export const buildProviderMetadata = (params: {
  readonly errorCode?: string | null
  readonly errorType?: string
  readonly requestId?: string
  readonly raw?: unknown
}): typeof AiError.ProviderMetadata.Type => ({
  name: "OpenAI",
  errorCode: Predicate.isNotNullish(params.errorCode) ? params.errorCode : undefined,
  errorType: params.errorType,
  requestId: params.requestId,
  raw: params.raw
})

// =============================================================================
// Error Code Mapping
// =============================================================================

/**
 * Maps OpenAI error codes and types to AiErrorReason.
 *
 * @since 1.0.0
 * @category utilities
 */
export const mapOpenAiErrorCode = (params: {
  readonly code: string | null | undefined
  readonly type: string
  readonly message: string
  readonly status: number
  readonly headers: Record<string, string>
  readonly provider: typeof AiError.ProviderMetadata.Type
  readonly http: typeof AiError.HttpContext.Type
}): AiError.AiErrorReason => {
  const { code, type, message, status, headers, provider, http } = params
  const rateLimitInfo = parseRateLimitHeaders(headers)

  // Rate limit errors
  if (code === "rate_limit_exceeded" || status === 429) {
    return new AiError.RateLimitError({
      limit: rateLimitInfo.limit ?? type,
      remaining: rateLimitInfo.remaining,
      retryAfter: rateLimitInfo.retryAfter,
      provider,
      http
    })
  }

  // Quota/billing errors
  if (code === "insufficient_quota" || code === "billing_hard_limit_reached") {
    return new AiError.QuotaExhaustedError({
      quotaType: code === "insufficient_quota" ? "tokens" : "billing",
      provider,
      http
    })
  }

  // Authentication errors
  if (code === "invalid_api_key" || code === "incorrect_api_key" || status === 401) {
    return new AiError.AuthenticationError({
      kind: "InvalidKey",
      provider,
      http
    })
  }

  if (type === "authentication_error") {
    return new AiError.AuthenticationError({
      kind: "InvalidKey",
      provider,
      http
    })
  }

  if (type === "permission_error" || status === 403) {
    return new AiError.AuthenticationError({
      kind: "InsufficientPermissions",
      provider,
      http
    })
  }

  // Context length errors
  if (code === "context_length_exceeded" || code === "max_tokens_exceeded") {
    const tokenMatch = message.match(/(\d+)\s*tokens.*?(\d+)/i)
    return new AiError.ContextLengthError({
      maxTokens: tokenMatch ? parseInt(tokenMatch[1], 10) : undefined,
      requestedTokens: tokenMatch ? parseInt(tokenMatch[2], 10) : undefined,
      provider,
      http
    })
  }

  // Model errors
  if (code === "model_not_found") {
    const modelMatch = message.match(/model[:\s]+['"]?([^'".\s]+)['"]?/i)
    return new AiError.ModelUnavailableError({
      model: modelMatch ? modelMatch[1] : "unknown",
      kind: "NotFound",
      provider,
      http
    })
  }

  if (code === "model_overloaded") {
    const modelMatch = message.match(/model[:\s]+['"]?([^'".\s]+)['"]?/i)
    return new AiError.ModelUnavailableError({
      model: modelMatch ? modelMatch[1] : "unknown",
      kind: "Overloaded",
      provider,
      http
    })
  }

  // Content policy errors
  if (code === "content_policy_violation" || code === "safety_system") {
    return new AiError.ContentPolicyError({
      violationType: code,
      flaggedInput: true,
      provider,
      http
    })
  }

  // Invalid request errors
  if (type === "invalid_request_error" || status === 400) {
    return new AiError.InvalidRequestError({
      description: message,
      provider,
      http
    })
  }

  // Server errors
  if (type === "server_error" || status >= 500) {
    return new AiError.ProviderInternalError({
      provider,
      http
    })
  }

  // Request timeout
  if (status === 408) {
    return new AiError.AiTimeoutError({
      phase: "Request",
      provider,
      http
    })
  }

  // Fallback to unknown error
  return new AiError.AiUnknownError({
    description: message,
    provider,
    http
  })
}

// =============================================================================
// Main Error Mapping Function
// =============================================================================

/**
 * Maps an HTTP response error to an AiError with granular error reasons.
 *
 * @since 1.0.0
 * @category utilities
 */
export const mapResponseError: {
  (method: string): (error: HttpClientError.ResponseError) => Effect.Effect<never, AiError.AiError>
  (error: HttpClientError.ResponseError, method: string): Effect.Effect<never, AiError.AiError>
} = dual<
  (method: string) => (error: HttpClientError.ResponseError) => Effect.Effect<never, AiError.AiError>,
  (error: HttpClientError.ResponseError, method: string) => Effect.Effect<never, AiError.AiError>
>(2, (error, method) =>
  Effect.gen(function*() {
    const response = error.response
    const request = error.request
    const status = response.status
    const headers = response.headers as Record<string, string>

    // Try to parse the response body as JSON
    const bodyResult = yield* Effect.result(response.json)
    const rawBody = Result.isSuccess(bodyResult) ? bodyResult.success : undefined

    // Try to decode the body as an OpenAI error
    const decoded = Schema.decodeUnknownOption(OpenAiErrorBody)(rawBody)

    // Extract request ID from headers
    const requestId = headers["x-request-id"]

    // Build HTTP context
    const bodyStr = Predicate.isNotUndefined(rawBody) ? JSON.stringify(rawBody) : undefined
    const http = buildHttpContext({
      request,
      response,
      ...(Predicate.isNotUndefined(bodyStr) ? { body: bodyStr } : {})
    })

    if (Option.isSome(decoded)) {
      const errorBody = decoded.value.error
      const provider = buildProviderMetadata({
        errorCode: errorBody.code ?? null,
        errorType: errorBody.type,
        requestId,
        raw: rawBody
      })

      const reason = mapOpenAiErrorCode({
        code: errorBody.code,
        type: errorBody.type,
        message: errorBody.message,
        status,
        headers,
        provider,
        http
      })

      return yield* Effect.fail(AiError.make({
        module: "OpenAiClient",
        method,
        reason
      }))
    }

    // Fallback: use status-based mapping when body parsing fails
    const provider = buildProviderMetadata({
      requestId,
      raw: rawBody
    })

    const reason = AiError.reasonFromHttpStatus({
      status,
      body: rawBody,
      http,
      provider
    })

    return yield* Effect.fail(AiError.make({
      module: "OpenAiClient",
      method,
      reason
    }))
  }))
