import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as Number from "effect/Number"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Redactable from "effect/Redactable"
import * as Schema from "effect/Schema"
import * as AiError from "effect/unstable/ai/AiError"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import type { OpenAiErrorMetadata } from "../OpenAiError.ts"

// =============================================================================
// OpenAI Error Body Schema
// =============================================================================

/** @internal */
export const OpenAiErrorBody = Schema.Struct({
  error: Schema.Struct({
    message: Schema.String,
    type: Schema.optional(Schema.NullOr(Schema.String)),
    param: Schema.optional(Schema.NullOr(Schema.String)),
    code: Schema.optional(Schema.NullOr(Schema.String))
  })
})

// =============================================================================
// Error Mappers
// =============================================================================

/** @internal */
export const mapRequestError = dual<
  (method: string) => (error: HttpClientError.RequestError) => AiError.AiError,
  (error: HttpClientError.RequestError, method: string) => AiError.AiError
>(2, (error, method) =>
  AiError.make({
    module: "OpenAiClient",
    method,
    reason: AiError.NetworkError.fromRequestError(error)
  }))

/** @internal */
export const mapResponseError = dual<
  (method: string) => (error: HttpClientError.ResponseError) => Effect.Effect<never, AiError.AiError>,
  (error: HttpClientError.ResponseError, method: string) => Effect.Effect<never, AiError.AiError>
>(
  2,
  Effect.fnUntraced(function*(error, method) {
    const { request, response, description } = error
    const status = response.status
    const headers = response.headers as Record<string, string>
    const requestId = headers["x-request-id"]

    // The generated client already consumes response.json and stores it in description
    // Try to parse the description as JSON to extract error details
    let json: unknown
    try {
      json = Predicate.isNotUndefined(description) ? JSON.parse(description) : undefined
    } catch {
      json = undefined
    }
    const body = description
    const decoded = Schema.decodeUnknownOption(OpenAiErrorBody)(json)

    const reason = mapStatusCodeToReason({
      status,
      headers,
      message: Option.isSome(decoded) ? decoded.value.error.message : undefined,
      http: buildHttpContext({ request, response, body }),
      metadata: {
        errorCode: Option.isSome(decoded) ? decoded.value.error.code ?? null : null,
        errorType: Option.isSome(decoded) ? decoded.value.error.type ?? null : null,
        requestId: requestId ?? null
      }
    })

    return yield* AiError.make({ module: "OpenAiClient", method, reason })
  })
)

/** @internal */
export const mapSchemaError = dual<
  (method: string) => (error: Schema.SchemaError) => AiError.AiError,
  (error: Schema.SchemaError, method: string) => AiError.AiError
>(2, (error, method) =>
  AiError.make({
    module: "OpenAiClient",
    method,
    reason: AiError.OutputParseError.fromSchemaError({ error })
  }))

// =============================================================================
// Rate Limits
// =============================================================================

/** @internal */
export const parseRateLimitHeaders = (headers: Record<string, string>) => {
  const retryAfterRaw = headers["retry-after"]
  let retryAfter: Duration.Duration | undefined
  if (Predicate.isNotUndefined(retryAfterRaw)) {
    const parsed = Number.parse(retryAfterRaw)
    if (Predicate.isNotUndefined(parsed)) {
      retryAfter = Duration.seconds(parsed)
    }
  }
  const remainingRaw = headers["x-ratelimit-remaining-requests"]
  const remaining = Predicate.isNotUndefined(remainingRaw) ? Number.parse(remainingRaw) ?? null : null
  return {
    retryAfter,
    limit: headers["x-ratelimit-limit-requests"] ?? null,
    remaining,
    resetRequests: headers["x-ratelimit-reset-requests"] ?? null,
    resetTokens: headers["x-ratelimit-reset-tokens"] ?? null
  }
}

// =============================================================================
// HTTP Context
// =============================================================================

/** @internal */
export const buildHttpContext = (params: {
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response?: HttpClientResponse.HttpClientResponse
  readonly body?: string | undefined
}): typeof AiError.HttpContext.Type => ({
  request: {
    method: params.request.method,
    url: params.request.url,
    urlParams: Array.from(params.request.urlParams),
    hash: params.request.hash,
    headers: Redactable.redact(params.request.headers) as Record<string, string>
  },
  response: Predicate.isNotUndefined(params.response)
    ? {
      status: params.response.status,
      headers: Redactable.redact(params.response.headers) as Record<string, string>
    }
    : undefined,
  body: params.body
})

// =============================================================================
// HTTP Status Code
// =============================================================================

/** @internal */
export const mapStatusCodeToReason = ({ status, headers, message, metadata, http }: {
  readonly status: number
  readonly headers: Record<string, string>
  readonly message: string | undefined
  readonly metadata: OpenAiErrorMetadata
  readonly http: typeof AiError.HttpContext.Type
}): AiError.AiErrorReason => {
  switch (status) {
    case 400:
      return new AiError.InvalidRequestError({
        description: message,
        metadata,
        http
      })
    case 401:
      return new AiError.AuthenticationError({
        kind: "InvalidKey",
        metadata,
        http
      })
    case 403:
      return new AiError.AuthenticationError({
        kind: "InsufficientPermissions",
        metadata,
        http
      })
    case 404:
      return new AiError.ModelUnavailableError({
        model: "unknown",
        kind: "NotFound",
        metadata,
        http
      })
    case 408:
      return new AiError.AiTimeoutError({
        phase: "Request",
        metadata,
        http
      })
    case 409:
    case 422:
      return new AiError.InvalidRequestError({
        description: message,
        metadata,
        http
      })
    case 429: {
      // Best-effort detection: OpenAI returns insufficient_quota for billing/quota issues
      if (
        metadata.errorCode === "insufficient_quota" ||
        metadata.errorType === "insufficient_quota"
      ) {
        return new AiError.QuotaExhaustedError({
          metadata: { openai: metadata },
          http
        })
      }
      const { retryAfter, ...rateLimitMetadata } = parseRateLimitHeaders(headers)
      return new AiError.RateLimitError({
        retryAfter,
        metadata: {
          openai: {
            ...metadata,
            ...rateLimitMetadata
          }
        },
        http
      })
    }
    case 504:
      return new AiError.AiTimeoutError({
        phase: "Response",
        metadata,
        http
      })
    default:
      if (status >= 500) {
        return new AiError.ProviderInternalError({
          metadata,
          http
        })
      }
      return new AiError.AiUnknownError({
        description: message,
        metadata,
        http
      })
  }
}
