import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect } from "effect"
import { AiError } from "effect/unstable/ai"

describe("AiError", () => {
  describe("isAiError", () => {
    it("returns true for AI errors", () => {
      const error = new AiError.RateLimitError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        limitType: "requests_per_minute"
      })
      assert.isTrue(AiError.isAiError(error))
    })

    it("returns false for plain errors", () => {
      const error = new Error("not an AI error")
      assert.isFalse(AiError.isAiError(error))
    })
  })

  describe("isRetryable", () => {
    it("returns true for RateLimitError", () => {
      const error = new AiError.RateLimitError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        limitType: "requests_per_minute"
      })
      assert.isTrue(AiError.isRetryable(error))
    })

    it("returns false for QuotaExceededError", () => {
      const error = new AiError.QuotaExceededError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        quotaType: "monthly_spend"
      })
      assert.isFalse(AiError.isRetryable(error))
    })

    it("returns true for ProviderError", () => {
      const error = new AiError.ProviderError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        statusCode: 500
      })
      assert.isTrue(AiError.isRetryable(error))
    })

    it("returns false for AuthenticationError", () => {
      const error = new AiError.AuthenticationError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        reason: "invalid_key"
      })
      assert.isFalse(AiError.isRetryable(error))
    })
  })

  describe("isToolError", () => {
    it("returns true for ToolNotFoundError", () => {
      const error = new AiError.ToolNotFoundError({
        operation: "toolCall",
        provider: "openai",
        timestamp: new Date(),
        toolName: "unknown_tool",
        availableTools: ["tool1", "tool2"]
      })
      assert.isTrue(AiError.isToolError(error))
    })

    it("returns true for ToolParameterError", () => {
      const error = new AiError.ToolParameterError({
        operation: "toolCall",
        provider: "openai",
        timestamp: new Date(),
        toolName: "my_tool",
        toolCallId: "call_123",
        parameters: {},
        validationError: "missing required field"
      })
      assert.isTrue(AiError.isToolError(error))
    })

    it("returns false for RateLimitError", () => {
      const error = new AiError.RateLimitError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        limitType: "requests_per_minute"
      })
      assert.isFalse(AiError.isToolError(error))
    })
  })

  describe("RateLimitError", () => {
    it("has correct code", () => {
      const error = new AiError.RateLimitError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        limitType: "requests_per_minute"
      })
      assert.strictEqual(error.code, AiError.AiErrorCode.RATE_LIMITED)
    })

    it("computes retryAfter from retryAfterMs", () => {
      const error = new AiError.RateLimitError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        limitType: "requests_per_minute",
        retryAfterMs: 5000
      })
      assert.deepStrictEqual(error.retryAfter, Duration.millis(5000))
    })

    it("has suggestion", () => {
      const error = new AiError.RateLimitError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        limitType: "requests_per_minute"
      })
      assert.include(error.suggestion, "exponential backoff")
    })
  })

  describe("QuotaExceededError", () => {
    it("is NOT retryable", () => {
      const error = new AiError.QuotaExceededError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        quotaType: "monthly_spend"
      })
      assert.isFalse(error.isRetryable)
    })

    it("has correct code", () => {
      const error = new AiError.QuotaExceededError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        quotaType: "monthly_spend"
      })
      assert.strictEqual(error.code, AiError.AiErrorCode.QUOTA_EXCEEDED)
    })
  })

  describe("TokenLimitExceededError", () => {
    it("computes overage", () => {
      const error = new AiError.TokenLimitExceededError({
        operation: "generateText",
        provider: "openai",
        model: "gpt-4",
        timestamp: new Date(),
        requestedTokens: 10000,
        maxTokens: 8192
      })
      assert.strictEqual(error.overage, 1808)
    })

    it("suggestion includes overage", () => {
      const error = new AiError.TokenLimitExceededError({
        operation: "generateText",
        provider: "openai",
        model: "gpt-4",
        timestamp: new Date(),
        requestedTokens: 10000,
        maxTokens: 8192
      })
      assert.include(error.suggestion, "1808")
    })
  })

  describe("ContentFilteredError", () => {
    it("computes triggeredCategories", () => {
      const error = new AiError.ContentFilteredError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        filterType: "output",
        categories: {
          hate: { filtered: false },
          sexual: { filtered: true, severity: "high" },
          violence: { filtered: true, severity: "medium" }
        }
      })
      assert.deepStrictEqual(error.triggeredCategories, ["sexual", "violence"])
    })

    it("returns empty array when no categories", () => {
      const error = new AiError.ContentFilteredError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        filterType: "output"
      })
      assert.deepStrictEqual(error.triggeredCategories, [])
    })
  })

  describe("ToolParameterError", () => {
    it("isLLMRecoverable is true", () => {
      const error = new AiError.ToolParameterError({
        operation: "toolCall",
        provider: "openai",
        timestamp: new Date(),
        toolName: "my_tool",
        toolCallId: "call_123",
        parameters: { invalid: "params" },
        validationError: "missing required field"
      })
      assert.isTrue(error.isLLMRecoverable)
    })
  })

  describe("ToolExecutionError", () => {
    it("isLLMRecoverable is false", () => {
      const error = new AiError.ToolExecutionError({
        operation: "toolExecution",
        provider: "openai",
        timestamp: new Date(),
        toolName: "my_tool",
        toolCallId: "call_123",
        parameters: {},
        executionError: new Error("tool failed")
      })
      assert.isFalse(error.isLLMRecoverable)
    })
  })

  describe("catchTag pattern matching", () => {
    it.effect("can catch RateLimitError", () =>
      Effect.gen(function*() {
        const error = new AiError.RateLimitError({
          operation: "generateText",
          provider: "openai",
          timestamp: new Date(),
          limitType: "requests_per_minute",
          retryAfterMs: 1000
        })

        const result = yield* Effect.fail(error).pipe(
          Effect.catchTag("RateLimitError", (e) => Effect.succeed(`caught: ${e.limitType}`))
        )

        assert.strictEqual(result, "caught: requests_per_minute")
      }))

    it.effect("can catch multiple tags with catchTags", () =>
      Effect.gen(function*() {
        const rateLimitError = new AiError.RateLimitError({
          operation: "generateText",
          provider: "openai",
          timestamp: new Date(),
          limitType: "requests_per_minute"
        })

        const quotaError = new AiError.QuotaExceededError({
          operation: "generateText",
          provider: "openai",
          timestamp: new Date(),
          quotaType: "monthly_spend"
        })

        const handleError = (e: AiError.AiError) =>
          Effect.fail(e).pipe(
            Effect.catchTags({
              RateLimitError: (e) => Effect.succeed(`rate limited: ${e.limitType}`),
              QuotaExceededError: (e) => Effect.succeed(`quota exceeded: ${e.quotaType}`)
            })
          )

        const result1 = yield* handleError(rateLimitError)
        assert.strictEqual(result1, "rate limited: requests_per_minute")

        const result2 = yield* handleError(quotaError)
        assert.strictEqual(result2, "quota exceeded: monthly_spend")
      }))
  })

  describe("error message formatting", () => {
    it("RateLimitError includes limit info", () => {
      const error = new AiError.RateLimitError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        limitType: "requests_per_minute",
        limit: 100
      })
      assert.include(error.message, "requests_per_minute")
      assert.include(error.message, "100")
    })

    it("TokenLimitExceededError includes model and token counts", () => {
      const error = new AiError.TokenLimitExceededError({
        operation: "generateText",
        provider: "openai",
        model: "gpt-4",
        timestamp: new Date(),
        requestedTokens: 10000,
        maxTokens: 8192
      })
      assert.include(error.message, "gpt-4")
      assert.include(error.message, "10000")
      assert.include(error.message, "8192")
    })

    it("AuthenticationError includes reason", () => {
      const error = new AiError.AuthenticationError({
        operation: "generateText",
        provider: "openai",
        timestamp: new Date(),
        reason: "expired_key"
      })
      assert.include(error.message, "expired_key")
    })
  })

  describe("mapping utilities", () => {
    describe("parseErrorBody", () => {
      it("parses OpenAI error format", () => {
        const body = {
          error: {
            code: "rate_limit_exceeded",
            type: "rate_limit",
            message: "Rate limit exceeded",
            param: "model"
          }
        }
        const parsed = AiError.parseErrorBody(body)
        assert.strictEqual(parsed.code, "rate_limit_exceeded")
        assert.strictEqual(parsed.type, "rate_limit")
        assert.strictEqual(parsed.message, "Rate limit exceeded")
        assert.strictEqual(parsed.param, "model")
      })

      it("parses Anthropic error format", () => {
        const body = {
          type: "error",
          message: "Overloaded"
        }
        const parsed = AiError.parseErrorBody(body)
        assert.strictEqual(parsed.type, "error")
        assert.strictEqual(parsed.message, "Overloaded")
      })

      it("handles null/undefined", () => {
        assert.deepStrictEqual(AiError.parseErrorBody(null), {})
        assert.deepStrictEqual(AiError.parseErrorBody(undefined), {})
      })
    })

    describe("extractRequestId", () => {
      it("extracts x-request-id", () => {
        const headers = { "x-request-id": "req_123" }
        assert.strictEqual(AiError.extractRequestId(headers), "req_123")
      })

      it("extracts request-id fallback", () => {
        const headers = { "request-id": "req_456" }
        assert.strictEqual(AiError.extractRequestId(headers), "req_456")
      })

      it("returns undefined when missing", () => {
        const headers = {}
        assert.isUndefined(AiError.extractRequestId(headers))
      })
    })

    describe("extractRetryAfterMs", () => {
      it("parses seconds", () => {
        const headers = { "retry-after": "30" }
        assert.strictEqual(AiError.extractRetryAfterMs(headers), 30000)
      })

      it("returns undefined when missing", () => {
        const headers = {}
        assert.isUndefined(AiError.extractRetryAfterMs(headers))
      })
    })

    describe("extractRateLimitInfo", () => {
      it("extracts OpenAI rate limit headers", () => {
        const headers = {
          "x-ratelimit-limit-requests": "100",
          "x-ratelimit-remaining-requests": "50"
        }
        const info = AiError.extractRateLimitInfo(headers)
        assert.strictEqual(info.limit, 100)
        assert.strictEqual(info.remaining, 50)
      })
    })

    describe("fromRequestError", () => {
      it("maps transport error to ConnectionError", () => {
        const mockRequest = {
          method: "POST",
          url: "https://api.openai.com/v1/chat/completions",
          urlParams: new URLSearchParams(),
          hash: undefined,
          headers: {}
        }

        const requestError = {
          _tag: "RequestError" as const,
          request: mockRequest,
          reason: "Transport" as const,
          description: "ECONNREFUSED"
        } as unknown as Parameters<typeof AiError.fromRequestError>[1]

        const result = AiError.fromRequestError(
          { operation: "generateText", provider: "openai" },
          requestError
        )

        assert.strictEqual(result._tag, "ConnectionError")
        if (result._tag === "ConnectionError") {
          assert.strictEqual(result.connectionType, "tcp")
          assert.strictEqual(result.targetHost, "api.openai.com")
        }
      })

      it("maps timeout to TimeoutError", () => {
        const mockRequest = {
          method: "POST",
          url: "https://api.openai.com/v1/chat/completions",
          urlParams: new URLSearchParams(),
          hash: undefined,
          headers: {}
        }

        const requestError = {
          _tag: "RequestError" as const,
          request: mockRequest,
          reason: "Transport" as const,
          description: "Request timeout after 30000ms"
        } as unknown as Parameters<typeof AiError.fromRequestError>[1]

        const result = AiError.fromRequestError(
          { operation: "generateText", provider: "openai" },
          requestError
        )

        assert.strictEqual(result._tag, "TimeoutError")
        if (result._tag === "TimeoutError") {
          assert.strictEqual(result.timeoutType, "total")
        }
      })
    })
  })
})
