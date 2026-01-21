import * as OpenAiError from "@effect/ai-openai/OpenAiError"
import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect } from "effect"
import type * as AiError from "effect/unstable/ai/AiError"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

// =============================================================================
// Mock Helpers
// =============================================================================

const makeMockResponse = (options: {
  readonly status: number
  readonly body: unknown
  readonly headers?: Record<string, string>
  readonly request?: HttpClientRequest.HttpClientRequest
}): HttpClientResponse.HttpClientResponse => {
  const request = options.request ?? HttpClientRequest.get("/")
  const json = JSON.stringify(options.body)
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...options.headers
  }
  return HttpClientResponse.fromWeb(
    request,
    new Response(json, {
      status: options.status,
      headers
    })
  )
}

const makeResponseError = (options: {
  readonly status: number
  readonly body: unknown
  readonly headers?: Record<string, string>
}): HttpClientError.ResponseError => {
  const request = HttpClientRequest.post("/test")
  const response = makeMockResponse({ ...options, request })
  return new HttpClientError.ResponseError({
    reason: "StatusCode",
    request,
    response
  })
}

// =============================================================================
// parseRateLimitHeaders Tests
// =============================================================================

describe("OpenAiError", () => {
  describe("parseRateLimitHeaders", () => {
    it("parses all headers present", () => {
      const headers = {
        "x-ratelimit-limit-requests": "10000",
        "x-ratelimit-remaining-requests": "9999",
        "x-ratelimit-reset-requests": "6ms",
        "x-ratelimit-reset-tokens": "30ms",
        "retry-after": "60"
      }

      const result = OpenAiError.parseRateLimitHeaders(headers)

      assert.strictEqual(result.limit, "10000")
      assert.strictEqual(result.remaining, 9999)
      assert.strictEqual(result.resetRequests, "6ms")
      assert.strictEqual(result.resetTokens, "30ms")
      assert.deepStrictEqual(result.retryAfter, Duration.seconds(60))
    })

    it("handles partial headers", () => {
      const headers = {
        "x-ratelimit-limit-requests": "5000",
        "retry-after": "30"
      }

      const result = OpenAiError.parseRateLimitHeaders(headers)

      assert.strictEqual(result.limit, "5000")
      assert.isUndefined(result.remaining)
      assert.isUndefined(result.resetRequests)
      assert.isUndefined(result.resetTokens)
      assert.deepStrictEqual(result.retryAfter, Duration.seconds(30))
    })

    it("handles no headers", () => {
      const headers = {}

      const result = OpenAiError.parseRateLimitHeaders(headers)

      assert.isUndefined(result.limit)
      assert.isUndefined(result.remaining)
      assert.isUndefined(result.resetRequests)
      assert.isUndefined(result.resetTokens)
      assert.isUndefined(result.retryAfter)
    })

    it("handles invalid retry-after value", () => {
      const headers = {
        "retry-after": "invalid"
      }

      const result = OpenAiError.parseRateLimitHeaders(headers)

      assert.isUndefined(result.retryAfter)
    })
  })

  // =============================================================================
  // buildHttpContext Tests
  // =============================================================================

  describe("buildHttpContext", () => {
    it("builds context from request only", () => {
      const request = HttpClientRequest.post("/v1/responses").pipe(
        HttpClientRequest.setHeader("Content-Type", "application/json")
      )

      const result = OpenAiError.buildHttpContext({ request })

      assert.strictEqual(result.request.method, "POST")
      assert.strictEqual(result.request.url, "/v1/responses")
      assert.isUndefined(result.response)
      assert.isUndefined(result.body)
    })

    it("builds context with response", () => {
      const request = HttpClientRequest.post("/v1/responses")
      const response = makeMockResponse({
        status: 429,
        body: {},
        request
      })

      const result = OpenAiError.buildHttpContext({ request, response })

      assert.strictEqual(result.request.method, "POST")
      assert.strictEqual(result.response?.status, 429)
    })

    it("redacts sensitive headers", () => {
      const request = HttpClientRequest.post("/v1/responses").pipe(
        HttpClientRequest.setHeader("Authorization", "Bearer sk-secret"),
        HttpClientRequest.setHeader("X-Api-Key", "secret-key"),
        HttpClientRequest.setHeader("Content-Type", "application/json")
      )

      const result = OpenAiError.buildHttpContext({ request })

      assert.strictEqual(result.request.headers["authorization"], "<redacted>")
      assert.strictEqual(result.request.headers["x-api-key"], "<redacted>")
      assert.strictEqual(result.request.headers["content-type"], "application/json")
    })

    it("includes body when provided", () => {
      const request = HttpClientRequest.post("/v1/responses")

      const result = OpenAiError.buildHttpContext({
        request,
        body: "{\"error\": \"test\"}"
      })

      assert.strictEqual(result.body, "{\"error\": \"test\"}")
    })
  })

  // =============================================================================
  // buildProviderMetadata Tests
  // =============================================================================

  describe("buildProviderMetadata", () => {
    it("sets provider name to OpenAI", () => {
      const result = OpenAiError.buildProviderMetadata({})

      assert.strictEqual(result.name, "OpenAI")
    })

    it("includes error code when provided", () => {
      const result = OpenAiError.buildProviderMetadata({
        errorCode: "rate_limit_exceeded"
      })

      assert.strictEqual(result.errorCode, "rate_limit_exceeded")
    })

    it("includes all metadata fields", () => {
      const result = OpenAiError.buildProviderMetadata({
        errorCode: "invalid_api_key",
        errorType: "authentication_error",
        requestId: "req_abc123",
        raw: { error: { message: "test" } }
      })

      assert.strictEqual(result.name, "OpenAI")
      assert.strictEqual(result.errorCode, "invalid_api_key")
      assert.strictEqual(result.errorType, "authentication_error")
      assert.strictEqual(result.requestId, "req_abc123")
      assert.deepStrictEqual(result.raw, { error: { message: "test" } })
    })

    it("handles null error code", () => {
      const result = OpenAiError.buildProviderMetadata({
        errorCode: null
      })

      assert.isUndefined(result.errorCode)
    })
  })

  // =============================================================================
  // mapOpenAiErrorCode Tests
  // =============================================================================

  describe("mapOpenAiErrorCode", () => {
    const baseParams = {
      headers: {},
      provider: OpenAiError.buildProviderMetadata({}),
      http: OpenAiError.buildHttpContext({ request: HttpClientRequest.get("/") })
    }

    describe("rate limit errors", () => {
      it("maps rate_limit_exceeded code to RateLimitError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "rate_limit_exceeded",
          type: "requests",
          message: "Rate limit reached",
          status: 429
        })

        assert.strictEqual(result._tag, "RateLimitError")
      })

      it("maps 429 status to RateLimitError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "tokens",
          message: "Too many requests",
          status: 429
        })

        assert.strictEqual(result._tag, "RateLimitError")
      })

      it("extracts rate limit info from headers", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          headers: {
            "x-ratelimit-limit-requests": "1000",
            "x-ratelimit-remaining-requests": "0",
            "retry-after": "30"
          },
          code: "rate_limit_exceeded",
          type: "requests",
          message: "Rate limit reached",
          status: 429
        })

        assert.strictEqual(result._tag, "RateLimitError")
        const rateLimitError = result as AiError.RateLimitError
        assert.strictEqual(rateLimitError.limit, "1000")
        assert.strictEqual(rateLimitError.remaining, 0)
        assert.deepStrictEqual(rateLimitError.retryAfter, Duration.seconds(30))
      })
    })

    describe("quota errors", () => {
      it("maps insufficient_quota to QuotaExhaustedError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "insufficient_quota",
          type: "invalid_request_error",
          message: "You exceeded your current quota",
          status: 402 // Payment Required
        })

        assert.strictEqual(result._tag, "QuotaExhaustedError")
        const quotaError = result as AiError.QuotaExhaustedError
        assert.strictEqual(quotaError.quotaType, "tokens")
      })

      it("maps billing_hard_limit_reached to QuotaExhaustedError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "billing_hard_limit_reached",
          type: "invalid_request_error",
          message: "Billing limit reached",
          status: 402 // Payment Required
        })

        assert.strictEqual(result._tag, "QuotaExhaustedError")
        const quotaError = result as AiError.QuotaExhaustedError
        assert.strictEqual(quotaError.quotaType, "billing")
      })
    })

    describe("authentication errors", () => {
      it("maps invalid_api_key to AuthenticationError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "invalid_api_key",
          type: "authentication_error",
          message: "Invalid API key",
          status: 401
        })

        assert.strictEqual(result._tag, "AuthenticationError")
        const authError = result as AiError.AuthenticationError
        assert.strictEqual(authError.kind, "InvalidKey")
      })

      it("maps incorrect_api_key to AuthenticationError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "incorrect_api_key",
          type: "authentication_error",
          message: "Incorrect API key",
          status: 401
        })

        assert.strictEqual(result._tag, "AuthenticationError")
        const authError = result as AiError.AuthenticationError
        assert.strictEqual(authError.kind, "InvalidKey")
      })

      it("maps 401 status to AuthenticationError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "authentication_error",
          message: "Unauthorized",
          status: 401
        })

        assert.strictEqual(result._tag, "AuthenticationError")
      })

      it("maps permission_error type to AuthenticationError with InsufficientPermissions", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "permission_error",
          message: "Permission denied",
          status: 403
        })

        assert.strictEqual(result._tag, "AuthenticationError")
        const authError = result as AiError.AuthenticationError
        assert.strictEqual(authError.kind, "InsufficientPermissions")
      })

      it("maps 403 status to AuthenticationError with InsufficientPermissions", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "invalid_request_error",
          message: "Access denied",
          status: 403
        })

        assert.strictEqual(result._tag, "AuthenticationError")
        const authError = result as AiError.AuthenticationError
        assert.strictEqual(authError.kind, "InsufficientPermissions")
      })
    })

    describe("context length errors", () => {
      it("maps context_length_exceeded to ContextLengthError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "context_length_exceeded",
          type: "invalid_request_error",
          message:
            "This model's maximum context length is 8192 tokens. However, your messages resulted in 12000 tokens.",
          status: 400
        })

        assert.strictEqual(result._tag, "ContextLengthError")
        const contextError = result as AiError.ContextLengthError
        assert.strictEqual(contextError.maxTokens, 8192)
        assert.strictEqual(contextError.requestedTokens, 12000)
      })

      it("maps max_tokens_exceeded to ContextLengthError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "max_tokens_exceeded",
          type: "invalid_request_error",
          message: "Maximum tokens exceeded",
          status: 400
        })

        assert.strictEqual(result._tag, "ContextLengthError")
      })

      it("handles message without token counts", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "context_length_exceeded",
          type: "invalid_request_error",
          message: "Context length exceeded",
          status: 400
        })

        assert.strictEqual(result._tag, "ContextLengthError")
        const contextError = result as AiError.ContextLengthError
        assert.isUndefined(contextError.maxTokens)
        assert.isUndefined(contextError.requestedTokens)
      })
    })

    describe("model errors", () => {
      it("maps model_not_found to ModelUnavailableError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "model_not_found",
          type: "invalid_request_error",
          message: "The model 'gpt-5-turbo' does not exist",
          status: 404
        })

        assert.strictEqual(result._tag, "ModelUnavailableError")
        const modelError = result as AiError.ModelUnavailableError
        assert.strictEqual(modelError.kind, "NotFound")
      })

      it("maps model_overloaded to ModelUnavailableError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "model_overloaded",
          type: "server_error",
          message: "The model is currently overloaded",
          status: 503
        })

        assert.strictEqual(result._tag, "ModelUnavailableError")
        const modelError = result as AiError.ModelUnavailableError
        assert.strictEqual(modelError.kind, "Overloaded")
      })
    })

    describe("content policy errors", () => {
      it("maps content_policy_violation to ContentPolicyError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "content_policy_violation",
          type: "invalid_request_error",
          message: "Your request was rejected due to content policy violation",
          status: 400
        })

        assert.strictEqual(result._tag, "ContentPolicyError")
        const policyError = result as AiError.ContentPolicyError
        assert.strictEqual(policyError.violationType, "content_policy_violation")
        assert.isTrue(policyError.flaggedInput)
      })

      it("maps safety_system to ContentPolicyError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "safety_system",
          type: "invalid_request_error",
          message: "Safety system triggered",
          status: 400
        })

        assert.strictEqual(result._tag, "ContentPolicyError")
        const policyError = result as AiError.ContentPolicyError
        assert.strictEqual(policyError.violationType, "safety_system")
      })
    })

    describe("invalid request errors", () => {
      it("maps invalid_request_error type to InvalidRequestError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "invalid_request_error",
          message: "Invalid request parameters",
          status: 400
        })

        assert.strictEqual(result._tag, "InvalidRequestError")
        const requestError = result as AiError.InvalidRequestError
        assert.strictEqual(requestError.description, "Invalid request parameters")
      })

      it("maps 400 status to InvalidRequestError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "unknown",
          message: "Bad request",
          status: 400
        })

        assert.strictEqual(result._tag, "InvalidRequestError")
      })
    })

    describe("server errors", () => {
      it("maps server_error type to ProviderInternalError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "server_error",
          message: "Internal server error",
          status: 500
        })

        assert.strictEqual(result._tag, "ProviderInternalError")
      })

      it("maps 500 status to ProviderInternalError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "unknown",
          message: "Internal error",
          status: 500
        })

        assert.strictEqual(result._tag, "ProviderInternalError")
      })

      it("maps 502 status to ProviderInternalError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "unknown",
          message: "Bad gateway",
          status: 502
        })

        assert.strictEqual(result._tag, "ProviderInternalError")
      })

      it("maps 503 status to ProviderInternalError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "unknown",
          message: "Service unavailable",
          status: 503
        })

        assert.strictEqual(result._tag, "ProviderInternalError")
      })
    })

    describe("timeout errors", () => {
      it("maps 408 status to AiTimeoutError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: null,
          type: "unknown",
          message: "Request timeout",
          status: 408
        })

        assert.strictEqual(result._tag, "AiTimeoutError")
        const timeoutError = result as AiError.AiTimeoutError
        assert.strictEqual(timeoutError.phase, "Request")
      })
    })

    describe("unknown errors", () => {
      it("maps unknown codes to AiUnknownError", () => {
        const result = OpenAiError.mapOpenAiErrorCode({
          ...baseParams,
          code: "unknown_code",
          type: "unknown_type",
          message: "Unknown error occurred",
          status: 418
        })

        assert.strictEqual(result._tag, "AiUnknownError")
        const unknownError = result as AiError.AiUnknownError
        assert.strictEqual(unknownError.description, "Unknown error occurred")
      })
    })
  })

  // =============================================================================
  // mapResponseError Tests
  // =============================================================================

  describe("mapResponseError", () => {
    it.effect("maps rate limit error with OpenAI body", () =>
      Effect.gen(function*() {
        const error = makeResponseError({
          status: 429,
          body: {
            error: {
              message: "Rate limit reached for gpt-4",
              type: "requests",
              code: "rate_limit_exceeded"
            }
          },
          headers: {
            "x-ratelimit-limit-requests": "1000",
            "retry-after": "60"
          }
        })

        const result = yield* OpenAiError.mapResponseError(error, "createResponse").pipe(Effect.flip)

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.module, "OpenAiClient")
        assert.strictEqual(result.method, "createResponse")
        assert.strictEqual(result.reason._tag, "RateLimitError")
      }))

    it.effect("maps authentication error with OpenAI body", () =>
      Effect.gen(function*() {
        const error = makeResponseError({
          status: 401,
          body: {
            error: {
              message: "Invalid API key provided",
              type: "authentication_error",
              code: "invalid_api_key"
            }
          }
        })

        const result = yield* OpenAiError.mapResponseError(error, "createResponse").pipe(Effect.flip)

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "AuthenticationError")
        const authError = result.reason as AiError.AuthenticationError
        assert.strictEqual(authError.provider?.name, "OpenAI")
        assert.strictEqual(authError.provider?.errorCode, "invalid_api_key")
      }))

    it.effect("maps context length error with token info", () =>
      Effect.gen(function*() {
        const error = makeResponseError({
          status: 400,
          body: {
            error: {
              message:
                "This model's maximum context length is 8192 tokens. However, your messages resulted in 12000 tokens.",
              type: "invalid_request_error",
              code: "context_length_exceeded",
              param: "messages"
            }
          }
        })

        const result = yield* OpenAiError.mapResponseError(error, "createResponse").pipe(Effect.flip)

        assert.strictEqual(result.reason._tag, "ContextLengthError")
        const contextError = result.reason as AiError.ContextLengthError
        assert.strictEqual(contextError.maxTokens, 8192)
        assert.strictEqual(contextError.requestedTokens, 12000)
      }))

    it.effect("falls back to status-based mapping for invalid body", () =>
      Effect.gen(function*() {
        const error = makeResponseError({
          status: 500,
          body: { invalid: "response structure" }
        })

        const result = yield* OpenAiError.mapResponseError(error, "createResponse").pipe(Effect.flip)

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "ProviderInternalError")
      }))

    it.effect("extracts request ID from headers", () =>
      Effect.gen(function*() {
        const error = makeResponseError({
          status: 400,
          body: {
            error: {
              message: "Invalid request",
              type: "invalid_request_error"
            }
          },
          headers: {
            "x-request-id": "req_abc123"
          }
        })

        const result = yield* OpenAiError.mapResponseError(error, "createResponse").pipe(Effect.flip)

        assert.strictEqual(result.reason._tag, "InvalidRequestError")
        const requestError = result.reason as AiError.InvalidRequestError
        assert.strictEqual(requestError.provider?.requestId, "req_abc123")
      }))

    it.effect("includes HTTP context in error", () =>
      Effect.gen(function*() {
        const error = makeResponseError({
          status: 400,
          body: {
            error: {
              message: "Invalid request",
              type: "invalid_request_error"
            }
          }
        })

        const result = yield* OpenAiError.mapResponseError(error, "createResponse").pipe(Effect.flip)

        assert.strictEqual(result.reason._tag, "InvalidRequestError")
        const requestError = result.reason as AiError.InvalidRequestError
        assert.isDefined(requestError.http)
        assert.strictEqual(requestError.http?.request.method, "POST")
        assert.strictEqual(requestError.http?.response?.status, 400)
      }))

    it.effect("includes raw body in provider metadata", () =>
      Effect.gen(function*() {
        const rawBody = {
          error: {
            message: "Test error",
            type: "test_type",
            code: "test_code"
          }
        }

        const error = makeResponseError({
          status: 400,
          body: rawBody
        })

        const result = yield* OpenAiError.mapResponseError(error, "createResponse").pipe(Effect.flip)

        assert.strictEqual(result.reason._tag, "InvalidRequestError")
        const requestError = result.reason as AiError.InvalidRequestError
        assert.deepStrictEqual(requestError.provider?.raw, rawBody)
      }))

    it.effect("uses dual function signature", () =>
      Effect.gen(function*() {
        const error = makeResponseError({
          status: 429,
          body: {
            error: {
              message: "Rate limit",
              type: "requests",
              code: "rate_limit_exceeded"
            }
          }
        })

        // Test curried form
        const curriedResult = yield* OpenAiError.mapResponseError("createResponse")(error).pipe(Effect.flip)
        assert.strictEqual(curriedResult.reason._tag, "RateLimitError")

        // Test direct form
        const directResult = yield* OpenAiError.mapResponseError(error, "createResponse").pipe(Effect.flip)
        assert.strictEqual(directResult.reason._tag, "RateLimitError")
      }))
  })
})
