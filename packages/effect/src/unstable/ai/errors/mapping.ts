/**
 * HTTP error mapping utilities for AI providers.
 *
 * This module provides utilities to convert HTTP client errors into semantic
 * AI errors with proper retry guidance and context.
 *
 * CRITICAL: OpenAI returns HTTP 429 for BOTH rate limits AND billing quota.
 * The error code in the response body must be checked to distinguish them:
 * - `rate_limit_exceeded` → `RateLimitError` (retryable)
 * - `insufficient_quota` → `QuotaExceededError` (NOT retryable)
 *
 * @since 4.0.0
 */
import * as Effect from "../../../Effect.ts"
import type * as HttpClientError from "../../http/HttpClientError.ts"
import { AuthenticationError, PermissionDeniedError } from "./auth.ts"
import type { AiOperation, AiProvider } from "./common.ts"
import { InvalidRequestError, TokenLimitExceededError } from "./input.ts"
import { ModelNotFoundError, ModelOverloadedError } from "./model.ts"
import { ConnectionError, TimeoutError } from "./network.ts"
import { ProviderError } from "./provider.ts"
import { QuotaExceededError, RateLimitError } from "./ratelimit.ts"
import { UnknownError } from "./unknown.ts"

/**
 * Common fields for error mapping.
 *
 * @since 4.0.0
 * @category models
 */
export interface MappingContext {
  readonly operation: AiOperation
  readonly provider: AiProvider
  readonly model?: string | undefined
}

/**
 * Parsed error body from provider response.
 *
 * @since 4.0.0
 * @category models
 */
export interface ParsedErrorBody {
  readonly code?: string | undefined
  readonly type?: string | undefined
  readonly message?: string | undefined
  readonly param?: string | undefined
}

/**
 * Parse the response body to extract error information.
 *
 * @since 4.0.0
 * @category utilities
 */
export const parseErrorBody = (
  body: unknown
): ParsedErrorBody => {
  if (body === null || body === undefined) {
    return {}
  }
  if (typeof body === "object") {
    const obj = body as Record<string, unknown>
    // OpenAI format: { error: { code, type, message, param } }
    if ("error" in obj && typeof obj.error === "object" && obj.error !== null) {
      const error = obj.error as Record<string, unknown>
      return {
        code: typeof error.code === "string" ? error.code : undefined,
        type: typeof error.type === "string" ? error.type : undefined,
        message: typeof error.message === "string" ? error.message : undefined,
        param: typeof error.param === "string" ? error.param : undefined
      }
    }
    // Anthropic format: { type, message }
    return {
      code: typeof obj.code === "string" ? obj.code : undefined,
      type: typeof obj.type === "string" ? obj.type : undefined,
      message: typeof obj.message === "string" ? obj.message : undefined
    }
  }
  return {}
}

/**
 * Extract request ID from response headers.
 *
 * @since 4.0.0
 * @category utilities
 */
export const extractRequestId = (
  headers: Record<string, string>
): string | undefined => {
  return headers["x-request-id"] ??
    headers["request-id"] ??
    headers["x-amzn-requestid"]
}

/**
 * Extract retry-after duration from headers (in milliseconds).
 *
 * @since 4.0.0
 * @category utilities
 */
export const extractRetryAfterMs = (
  headers: Record<string, string>
): number | undefined => {
  const retryAfter = headers["retry-after"]
  if (retryAfter === undefined) return undefined

  // Check if it's a number (seconds)
  const seconds = Number(retryAfter)
  if (!Number.isNaN(seconds)) {
    return seconds * 1000
  }

  // Check if it's an HTTP date
  const date = Date.parse(retryAfter)
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now())
  }

  return undefined
}

/**
 * Extract rate limit information from headers.
 *
 * @since 4.0.0
 * @category utilities
 */
export const extractRateLimitInfo = (
  headers: Record<string, string>
): {
  readonly limit: number | undefined
  readonly remaining: number | undefined
  readonly resetAt: Date | undefined
} => {
  const limit = headers["x-ratelimit-limit-requests"] ??
    headers["x-ratelimit-limit-tokens"] ??
    headers["ratelimit-limit"]
  const remaining = headers["x-ratelimit-remaining-requests"] ??
    headers["x-ratelimit-remaining-tokens"] ??
    headers["ratelimit-remaining"]
  const reset = headers["x-ratelimit-reset-requests"] ??
    headers["x-ratelimit-reset-tokens"] ??
    headers["ratelimit-reset"]

  return {
    limit: limit !== undefined ? Number(limit) : undefined,
    remaining: remaining !== undefined ? Number(remaining) : undefined,
    resetAt: reset !== undefined ? new Date(reset) : undefined
  }
}

/**
 * Determine limit type from headers or error body.
 *
 * @since 4.0.0
 * @category utilities
 */
export const determineLimitType = (
  headers: Record<string, string>,
  errorBody: ParsedErrorBody
): "requests_per_minute" | "requests_per_day" | "tokens_per_minute" | "tokens_per_day" | "concurrent" | "unknown" => {
  // Check headers first
  if (headers["x-ratelimit-limit-requests"] !== undefined) {
    return "requests_per_minute"
  }
  if (headers["x-ratelimit-limit-tokens"] !== undefined) {
    return "tokens_per_minute"
  }

  // Check error message
  const message = errorBody.message?.toLowerCase() ?? ""
  if (message.includes("tokens per minute") || message.includes("tpm")) {
    return "tokens_per_minute"
  }
  if (message.includes("tokens per day") || message.includes("tpd")) {
    return "tokens_per_day"
  }
  if (message.includes("requests per minute") || message.includes("rpm")) {
    return "requests_per_minute"
  }
  if (message.includes("requests per day") || message.includes("rpd")) {
    return "requests_per_day"
  }
  if (message.includes("concurrent")) {
    return "concurrent"
  }

  return "unknown"
}

/**
 * Type for all possible AI errors that can result from HTTP response error mapping.
 *
 * @since 4.0.0
 * @category models
 */
export type ResponseMappedError =
  | AuthenticationError
  | PermissionDeniedError
  | RateLimitError
  | QuotaExceededError
  | InvalidRequestError
  | TokenLimitExceededError
  | ModelNotFoundError
  | ModelOverloadedError
  | ProviderError
  | UnknownError

/**
 * Map an HTTP response error to a semantic AI error.
 *
 * CRITICAL: This function handles the rate limit vs quota distinction.
 * OpenAI returns HTTP 429 for both cases - the error code distinguishes them.
 *
 * @since 4.0.0
 * @category mapping
 */
export const fromResponseError = (
  context: MappingContext,
  error: HttpClientError.ResponseError
): Effect.Effect<never, ResponseMappedError> => {
  const status = error.response.status
  const headers = error.response.headers
  const requestId = extractRequestId(headers)
  const timestamp = new Date()

  // Parse response body for error details
  return Effect.matchEffect(error.response.json, {
    onFailure: () => Effect.succeed(undefined),
    onSuccess: Effect.succeed
  }).pipe(
    Effect.flatMap((bodyResult): Effect.Effect<never, ResponseMappedError> => {
      const body = parseErrorBody(bodyResult)

      // Route based on status code
      switch (status) {
        case 401:
          return Effect.fail(new AuthenticationError({
            ...context,
            requestId,
            timestamp,
            reason: determineAuthReason(body),
            providerDetails: body
          }))

        case 403:
          return Effect.fail(new PermissionDeniedError({
            ...context,
            requestId,
            timestamp,
            resource: body.param,
            providerDetails: body
          }))

        case 404:
          // Could be model not found or endpoint not found
          if (context.model !== undefined || body.param === "model") {
            return Effect.fail(new ModelNotFoundError({
              operation: context.operation,
              provider: context.provider,
              model: context.model ?? body.param ?? "unknown",
              requestId,
              timestamp,
              providerDetails: body
            }))
          }
          return Effect.fail(new InvalidRequestError({
            ...context,
            requestId,
            timestamp,
            parameter: body.param,
            validationMessage: body.message ?? "Resource not found",
            providerDetails: body
          }))

        case 429:
          // CRITICAL: Distinguish rate limit from quota exceeded
          return handle429Error(context, headers, body, requestId, timestamp)

        case 400:
          return handle400Error(context, body, requestId, timestamp)

        case 503:
          return Effect.fail(new ModelOverloadedError({
            operation: context.operation,
            provider: context.provider,
            model: context.model,
            requestId,
            timestamp,
            retryAfterMs: extractRetryAfterMs(headers),
            providerDetails: body
          }))

        default:
          // 5xx errors -> ProviderError
          if (status >= 500) {
            return Effect.fail(new ProviderError({
              ...context,
              requestId,
              timestamp,
              statusCode: status,
              providerMessage: body.message,
              providerDetails: body
            }))
          }

          // Other 4xx errors -> InvalidRequestError
          if (status >= 400 && status < 500) {
            return Effect.fail(new InvalidRequestError({
              ...context,
              requestId,
              timestamp,
              parameter: body.param,
              validationMessage: body.message ?? `HTTP ${status}`,
              providerDetails: body
            }))
          }

          // Unexpected status -> UnknownError
          return Effect.fail(new UnknownError({
            ...context,
            requestId,
            timestamp,
            cause: new Error(body.message ?? `Unexpected HTTP status: ${status}`)
          }))
      }
    })
  )
}

/**
 * Handle HTTP 429 errors by distinguishing rate limits from quota exceeded.
 *
 * @since 4.0.0
 * @category mapping
 */
const handle429Error = (
  context: MappingContext,
  headers: Record<string, string>,
  body: ParsedErrorBody,
  requestId: string | undefined,
  timestamp: Date
): Effect.Effect<never, RateLimitError | QuotaExceededError> => {
  // CRITICAL: Check error code to distinguish rate limit from quota
  // OpenAI uses these codes:
  // - "rate_limit_exceeded" → retryable rate limit
  // - "insufficient_quota" → NOT retryable (billing issue)
  const code = body.code?.toLowerCase()

  if (code === "insufficient_quota" || code === "billing_hard_limit_reached") {
    return Effect.fail(new QuotaExceededError({
      ...context,
      requestId,
      timestamp,
      quotaType: "monthly_spend",
      providerDetails: body
    }))
  }

  // Default to rate limit error (retryable)
  const rateLimitInfo = extractRateLimitInfo(headers)
  return Effect.fail(new RateLimitError({
    ...context,
    requestId,
    timestamp,
    limitType: determineLimitType(headers, body),
    limit: rateLimitInfo.limit,
    remaining: rateLimitInfo.remaining,
    resetAt: rateLimitInfo.resetAt,
    retryAfterMs: extractRetryAfterMs(headers),
    providerDetails: body
  }))
}

/**
 * Handle HTTP 400 errors.
 *
 * @since 4.0.0
 * @category mapping
 */
const handle400Error = (
  context: MappingContext,
  body: ParsedErrorBody,
  requestId: string | undefined,
  timestamp: Date
): Effect.Effect<never, InvalidRequestError | TokenLimitExceededError> => {
  const message = body.message?.toLowerCase() ?? ""
  const code = body.code?.toLowerCase()

  // Check for token limit exceeded
  if (
    code === "context_length_exceeded" ||
    message.includes("maximum context length") ||
    message.includes("token limit") ||
    message.includes("context_length")
  ) {
    // Try to extract token counts from message
    const tokenMatch = message.match(/(\d+)\s*tokens.*?maximum.*?(\d+)/i) ??
      message.match(/requested\s*(\d+).*?maximum\s*(\d+)/i)

    const requestedTokens = tokenMatch ? Number(tokenMatch[1]) : 0
    const maxTokens = tokenMatch ? Number(tokenMatch[2]) : 0

    return Effect.fail(new TokenLimitExceededError({
      operation: context.operation,
      provider: context.provider,
      model: context.model ?? "unknown",
      requestId,
      timestamp,
      requestedTokens,
      maxTokens,
      providerDetails: body
    }))
  }

  return Effect.fail(new InvalidRequestError({
    ...context,
    requestId,
    timestamp,
    parameter: body.param,
    validationMessage: body.message ?? "Invalid request",
    providerDetails: body
  }))
}

/**
 * Determine authentication error reason from response body.
 *
 * @since 4.0.0
 * @category utilities
 */
const determineAuthReason = (
  body: ParsedErrorBody
): "invalid_key" | "expired_key" | "missing_key" | "invalid_format" => {
  const message = body.message?.toLowerCase() ?? ""
  const code = body.code?.toLowerCase()

  if (code === "invalid_api_key" || message.includes("invalid")) {
    return "invalid_key"
  }
  if (message.includes("expired")) {
    return "expired_key"
  }
  if (message.includes("missing") || message.includes("not provided")) {
    return "missing_key"
  }
  if (message.includes("format") || message.includes("malformed")) {
    return "invalid_format"
  }

  return "invalid_key"
}

/**
 * Type for all possible AI errors that can result from HTTP request error mapping.
 *
 * @since 4.0.0
 * @category models
 */
export type RequestMappedError =
  | ConnectionError
  | TimeoutError
  | UnknownError

/**
 * Map an HTTP request error to a semantic AI error.
 *
 * @since 4.0.0
 * @category mapping
 */
export const fromRequestError = (
  context: MappingContext,
  error: HttpClientError.RequestError
): RequestMappedError => {
  const timestamp = new Date()

  switch (error.reason) {
    case "Transport":
      // Check if it's a timeout
      if (
        error.description?.toLowerCase().includes("timeout") ||
        error.description?.toLowerCase().includes("timed out")
      ) {
        return new TimeoutError({
          ...context,
          timestamp,
          timeoutType: "total",
          timeoutMs: 30000, // Default, actual value unknown
          cause: error.cause
        })
      }

      // Parse target host from URL
      let targetHost = "unknown"
      try {
        targetHost = new URL(error.request.url).hostname
      } catch {
        targetHost = error.request.url
      }

      return new ConnectionError({
        ...context,
        timestamp,
        connectionType: determineConnectionType(error.description),
        targetHost,
        cause: error.cause
      })

    case "InvalidUrl":
      return new UnknownError({
        ...context,
        timestamp,
        cause: new Error(`Invalid URL: ${error.description ?? error.request.url}`)
      })

    case "Encode":
      return new UnknownError({
        ...context,
        timestamp,
        cause: new Error(`Request encoding failed: ${error.description ?? "unknown"}`)
      })

    default:
      return new UnknownError({
        ...context,
        timestamp,
        cause: new Error(error.description ?? "Unknown request error")
      })
  }
}

/**
 * Determine connection error type from error description.
 *
 * @since 4.0.0
 * @category utilities
 */
const determineConnectionType = (
  description: string | undefined
): "dns" | "tcp" | "tls" | "unknown" => {
  if (description === undefined) return "unknown"

  const lower = description.toLowerCase()
  if (lower.includes("dns") || lower.includes("getaddrinfo") || lower.includes("name resolution")) {
    return "dns"
  }
  if (lower.includes("tls") || lower.includes("ssl") || lower.includes("certificate")) {
    return "tls"
  }
  if (lower.includes("connect") || lower.includes("econnrefused") || lower.includes("econnreset")) {
    return "tcp"
  }

  return "unknown"
}

/**
 * Type for all possible AI errors that can result from HTTP error mapping.
 *
 * @since 4.0.0
 * @category models
 */
export type MappedAiError =
  | ResponseMappedError
  | RequestMappedError
