import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as Number from "effect/Number"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Redactable from "effect/Redactable"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import * as AiError from "effect/unstable/ai/AiError"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

// =============================================================================
// OpenAI Error Body Schema
// =============================================================================

/** @internal */
export const OpenAiErrorBody = Schema.Struct({
  error: Schema.Struct({
    message: Schema.String,
    type: Schema.String,
    param: Schema.optional(Schema.NullOr(Schema.String)),
    code: Schema.optional(Schema.NullOr(Schema.String))
  })
})

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
  const remaining = Predicate.isNotUndefined(remainingRaw) ? Number.parse(remainingRaw) : undefined
  return {
    limit: headers["x-ratelimit-limit-requests"],
    remaining,
    resetRequests: headers["x-ratelimit-reset-requests"],
    resetTokens: headers["x-ratelimit-reset-tokens"],
    retryAfter
  }
}

// =============================================================================
// Context Builders
// =============================================================================

/** @internal */
export const buildHttpContext = (params: {
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response?: HttpClientResponse.HttpClientResponse
  readonly body?: string
}): typeof AiError.HttpContext.Type => ({
  request: {
    method: params.request.method,
    url: params.request.url,
    urlParams: globalThis.Array.from(params.request.urlParams),
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

/** @internal */
export const buildProviderMetadata = (params: {
  readonly errorCode?: string | null | undefined
  readonly errorType?: string | undefined
  readonly requestId?: string | undefined
  readonly raw?: unknown
}): typeof AiError.ProviderMetadata.Type => ({
  name: "OpenAI",
  errorCode: Predicate.isNotNullish(params.errorCode) ? params.errorCode : undefined,
  errorType: params.errorType,
  requestId: params.requestId,
  raw: params.raw
})

// =============================================================================
// Status Code Mapper
// =============================================================================

/** @internal */
export const mapStatusCodeToReason = (params: {
  readonly status: number
  readonly headers: Record<string, string>
  readonly message: string | undefined
  readonly provider: typeof AiError.ProviderMetadata.Type
  readonly http: typeof AiError.HttpContext.Type
}): AiError.AiErrorReason => {
  const { status, headers, message, provider, http } = params

  switch (status) {
    case 400:
      return new AiError.InvalidRequestError({
        description: message,
        metadata: provider,
        http
      })
    case 401:
      return new AiError.AuthenticationError({
        kind: "InvalidKey",
        metadata: provider,
        http
      })
    case 403:
      return new AiError.AuthenticationError({
        kind: "InsufficientPermissions",
        metadata: provider,
        http
      })
    case 404:
      return new AiError.ModelUnavailableError({
        model: "unknown",
        kind: "NotFound",
        metadata: provider,
        http
      })
    case 408:
      return new AiError.AiTimeoutError({
        phase: "Request",
        metadata: provider,
        http
      })
    case 409:
    case 422:
      return new AiError.InvalidRequestError({
        description: message,
        metadata: provider,
        http
      })
    case 429: {
      const rateLimitInfo = parseRateLimitHeaders(headers)
      return new AiError.RateLimitError({
        ...rateLimitInfo,
        metadata: provider,
        http
      })
    }
    case 504:
      return new AiError.AiTimeoutError({
        phase: "Response",
        metadata: provider,
        http
      })
    default:
      if (status >= 500) {
        return new AiError.ProviderInternalError({
          metadata: provider,
          http
        })
      }
      return new AiError.AiUnknownError({
        description: message,
        metadata: provider,
        http
      })
  }
}

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
>(2, (error, method) =>
  Effect.gen(function*() {
    const response = error.response
    const request = error.request
    const status = response.status
    const headers = response.headers as Record<string, string>

    const bodyResult = yield* Effect.result(response.json)
    const rawBody = Result.isSuccess(bodyResult) ? bodyResult.success : undefined
    const decoded = Schema.decodeUnknownOption(OpenAiErrorBody)(rawBody)

    const requestId = headers["x-request-id"]
    const bodyStr = Predicate.isNotUndefined(rawBody) ? JSON.stringify(rawBody) : undefined

    const http = buildHttpContext({
      request,
      response,
      ...(Predicate.isNotUndefined(bodyStr) ? { body: bodyStr } : {})
    })

    const message = Option.isSome(decoded) ? decoded.value.error.message : undefined

    const provider = buildProviderMetadata({
      errorCode: Option.isSome(decoded) ? decoded.value.error.code : undefined,
      errorType: Option.isSome(decoded) ? decoded.value.error.type : undefined,
      requestId,
      raw: rawBody
    })

    const reason = mapStatusCodeToReason({
      status,
      headers,
      message,
      provider,
      http
    })

    return yield* AiError.make({ module: "OpenAiClient", method, reason })
  }))

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
