import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect, Schema } from "effect"
import { AiError } from "effect/unstable/ai"

describe("AiError", () => {
  describe("reason types", () => {
    describe("RateLimitError", () => {
      it("should be retryable", () => {
        const error = new AiError.RateLimitError({
          limit: "requests",
          remaining: 0
        })
        assert.isTrue(error.isRetryable)
      })

      it("should format message with limit", () => {
        const error = new AiError.RateLimitError({ limit: "requests" })
        assert.match(error.message, /Rate limit exceeded \(requests\)/)
      })

      it("should format message with retryAfter", () => {
        const error = new AiError.RateLimitError({
          retryAfter: Duration.seconds(60)
        })
        assert.match(error.message, /Retry after/)
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.RateLimitError({})
        assert.strictEqual(error._tag, "RateLimitError")
      })
    })

    describe("QuotaExhaustedError", () => {
      it("should not be retryable", () => {
        const error = new AiError.QuotaExhaustedError({ quotaType: "tokens" })
        assert.isFalse(error.isRetryable)
      })

      it("should format message with quotaType", () => {
        const error = new AiError.QuotaExhaustedError({ quotaType: "tokens" })
        assert.match(error.message, /Quota exhausted \(tokens\)/)
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.QuotaExhaustedError({})
        assert.strictEqual(error._tag, "QuotaExhaustedError")
      })
    })

    describe("AuthenticationError", () => {
      it("should not be retryable", () => {
        const error = new AiError.AuthenticationError({ kind: "InvalidKey" })
        assert.isFalse(error.isRetryable)
      })

      it("should format message based on kind", () => {
        const invalidKey = new AiError.AuthenticationError({ kind: "InvalidKey" })
        assert.match(invalidKey.message, /InvalidKey/)

        const expiredKey = new AiError.AuthenticationError({ kind: "ExpiredKey" })
        assert.match(expiredKey.message, /ExpiredKey/)

        const missingKey = new AiError.AuthenticationError({ kind: "MissingKey" })
        assert.match(missingKey.message, /MissingKey/)

        const insufficientPermissions = new AiError.AuthenticationError({ kind: "InsufficientPermissions" })
        assert.match(insufficientPermissions.message, /InsufficientPermissions/)
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.AuthenticationError({ kind: "Unknown" })
        assert.strictEqual(error._tag, "AuthenticationError")
      })
    })

    describe("ContentPolicyError", () => {
      it("should not be retryable", () => {
        const error = new AiError.ContentPolicyError({ violationType: "hate" })
        assert.isFalse(error.isRetryable)
      })

      it("should format message with violation details", () => {
        const error = new AiError.ContentPolicyError({
          violationType: "hate",
          flaggedInput: true
        })
        assert.match(error.message, /Content policy violation/)
        assert.match(error.message, /hate/)
        assert.match(error.message, /in input/)
      })

      it("should include flaggedContent when provided", () => {
        const error = new AiError.ContentPolicyError({
          flaggedContent: "offensive content"
        })
        assert.strictEqual(error.flaggedContent, "offensive content")
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.ContentPolicyError({})
        assert.strictEqual(error._tag, "ContentPolicyError")
      })
    })

    describe("ModelUnavailableError", () => {
      it("should be retryable for Overloaded", () => {
        const error = new AiError.ModelUnavailableError({
          model: "gpt-4",
          kind: "Overloaded"
        })
        assert.isTrue(error.isRetryable)
      })

      it("should be retryable for Maintenance", () => {
        const error = new AiError.ModelUnavailableError({
          model: "gpt-4",
          kind: "Maintenance"
        })
        assert.isTrue(error.isRetryable)
      })

      it("should not be retryable for NotFound", () => {
        const error = new AiError.ModelUnavailableError({
          model: "gpt-5",
          kind: "NotFound"
        })
        assert.isFalse(error.isRetryable)
      })

      it("should not be retryable for Deprecated", () => {
        const error = new AiError.ModelUnavailableError({
          model: "text-davinci-003",
          kind: "Deprecated"
        })
        assert.isFalse(error.isRetryable)
      })

      it("should format message with alternatives", () => {
        const error = new AiError.ModelUnavailableError({
          model: "gpt-5",
          kind: "NotFound",
          alternativeModels: ["gpt-4", "gpt-4-turbo"]
        })
        assert.match(error.message, /gpt-5/)
        assert.match(error.message, /Try: gpt-4, gpt-4-turbo/)
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.ModelUnavailableError({
          model: "test",
          kind: "Unknown"
        })
        assert.strictEqual(error._tag, "ModelUnavailableError")
      })
    })

    describe("ContextLengthError", () => {
      it("should not be retryable", () => {
        const error = new AiError.ContextLengthError({
          maxTokens: 8192,
          requestedTokens: 12000
        })
        assert.isFalse(error.isRetryable)
      })

      it("should format message with token counts", () => {
        const error = new AiError.ContextLengthError({
          maxTokens: 8192,
          requestedTokens: 12000
        })
        assert.match(error.message, /requested 12000 tokens/)
        assert.match(error.message, /max 8192/)
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.ContextLengthError({})
        assert.strictEqual(error._tag, "ContextLengthError")
      })
    })

    describe("InvalidRequestError", () => {
      it("should not be retryable", () => {
        const error = new AiError.InvalidRequestError({
          parameter: "temperature",
          constraint: "must be between 0 and 2"
        })
        assert.isFalse(error.isRetryable)
      })

      it("should format message with parameter details", () => {
        const error = new AiError.InvalidRequestError({
          parameter: "temperature",
          constraint: "must be between 0 and 2",
          description: "Value 5 is invalid"
        })
        assert.match(error.message, /parameter 'temperature'/)
        assert.match(error.message, /must be between 0 and 2/)
        assert.match(error.message, /Value 5 is invalid/)
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.InvalidRequestError({})
        assert.strictEqual(error._tag, "InvalidRequestError")
      })
    })

    describe("ProviderInternalError", () => {
      it("should be retryable", () => {
        const error = new AiError.ProviderInternalError({})
        assert.isTrue(error.isRetryable)
      })

      it("should format message with provider name", () => {
        const error = new AiError.ProviderInternalError({
          provider: { name: "OpenAI" }
        })
        assert.match(error.message, /OpenAI internal error/)
      })

      it("should format message with retryAfter", () => {
        const error = new AiError.ProviderInternalError({
          retryAfter: Duration.seconds(30)
        })
        assert.match(error.message, /Retry after/)
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.ProviderInternalError({})
        assert.strictEqual(error._tag, "ProviderInternalError")
      })
    })

    describe("AiTimeoutError", () => {
      it("should be retryable", () => {
        const error = new AiError.AiTimeoutError({ phase: "Response" })
        assert.isTrue(error.isRetryable)
      })

      it("should format message with phase and duration", () => {
        const error = new AiError.AiTimeoutError({
          phase: "Response",
          duration: Duration.seconds(30)
        })
        assert.match(error.message, /Response timeout/)
        assert.match(error.message, /after/)
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.AiTimeoutError({ phase: "Connection" })
        assert.strictEqual(error._tag, "AiTimeoutError")
      })
    })

    describe("NetworkError", () => {
      it("should be retryable", () => {
        const error = new AiError.NetworkError({ kind: "ConnectionRefused" })
        assert.isTrue(error.isRetryable)
      })

      it("should format message based on kind", () => {
        const connRefused = new AiError.NetworkError({ kind: "ConnectionRefused" })
        assert.match(connRefused.message, /ConnectionRefused/)

        const dnsError = new AiError.NetworkError({ kind: "DnsLookupFailed" })
        assert.match(dnsError.message, /DnsLookupFailed/)

        const tlsError = new AiError.NetworkError({ kind: "TlsError" })
        assert.match(tlsError.message, /TlsError/)
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.NetworkError({ kind: "Unknown" })
        assert.strictEqual(error._tag, "NetworkError")
      })
    })

    describe("OutputParseError", () => {
      it("should be retryable", () => {
        const error = new AiError.OutputParseError({
          rawOutput: '{"invalid": json}'
        })
        assert.isTrue(error.isRetryable)
      })

      it("should store raw output", () => {
        const rawOutput = '{"invalid": json}'
        const error = new AiError.OutputParseError({ rawOutput })
        assert.strictEqual(error.rawOutput, rawOutput)
      })

      it.effect("should create from SchemaError", () =>
        Effect.gen(function* () {
          const TestSchema = Schema.Struct({ name: Schema.String })
          const result = yield* Effect.exit(Schema.decodeUnknownEffect(TestSchema)({ name: 123 }))

          if (result._tag === "Failure") {
            const cause = result.cause
            if ("error" in cause && Schema.isSchemaError(cause.error)) {
              const parseError = AiError.OutputParseError.fromSchemaError({
                rawOutput: '{"name": 123}',
                error: cause.error
              })
              assert.strictEqual(parseError._tag, "OutputParseError")
              assert.strictEqual(parseError.rawOutput, '{"name": 123}')
            }
          }
        })
      )

      it("should have _tag set correctly", () => {
        const error = new AiError.OutputParseError({})
        assert.strictEqual(error._tag, "OutputParseError")
      })
    })

    describe("AiUnknownError", () => {
      it("should not be retryable", () => {
        const error = new AiError.AiUnknownError({})
        assert.isFalse(error.isRetryable)
      })

      it("should format message with description", () => {
        const error = new AiError.AiUnknownError({
          description: "Something unexpected happened"
        })
        assert.strictEqual(error.message, "Something unexpected happened")
      })

      it("should use default message without description", () => {
        const error = new AiError.AiUnknownError({})
        assert.strictEqual(error.message, "Unknown error")
      })

      it("should have _tag set correctly", () => {
        const error = new AiError.AiUnknownError({})
        assert.strictEqual(error._tag, "AiUnknownError")
      })
    })
  })

  describe("delegation", () => {
    it("should delegate isRetryable to reason", () => {
      const retryableError = new AiError.AiError({
        module: "OpenAI",
        method: "completion",
        reason: new AiError.RateLimitError({})
      })
      assert.isTrue(retryableError.isRetryable)

      const nonRetryableError = new AiError.AiError({
        module: "OpenAI",
        method: "completion",
        reason: new AiError.AuthenticationError({ kind: "InvalidKey" })
      })
      assert.isFalse(nonRetryableError.isRetryable)
    })

    it("should delegate retryAfter to reason", () => {
      const errorWithRetryAfter = new AiError.AiError({
        module: "OpenAI",
        method: "completion",
        reason: new AiError.RateLimitError({
          retryAfter: Duration.seconds(60)
        })
      })
      assert.isDefined(errorWithRetryAfter.retryAfter)

      const errorWithoutRetryAfter = new AiError.AiError({
        module: "OpenAI",
        method: "completion",
        reason: new AiError.AuthenticationError({ kind: "InvalidKey" })
      })
      assert.isUndefined(errorWithoutRetryAfter.retryAfter)
    })

    it("should format message with module, method, and reason", () => {
      const error = new AiError.AiError({
        module: "OpenAI",
        method: "completion",
        reason: new AiError.RateLimitError({ limit: "requests" })
      })
      assert.match(error.message, /OpenAI\.completion:/)
      assert.match(error.message, /Rate limit exceeded/)
    })

    it("should have _tag set correctly", () => {
      const error = new AiError.AiError({
        module: "Test",
        method: "test",
        reason: new AiError.AiUnknownError({})
      })
      assert.strictEqual(error._tag, "AiError")
    })
  })

  describe("constructors", () => {
    describe("make", () => {
      it("should create AiError", () => {
        const error = AiError.make({
          module: "OpenAI",
          method: "completion",
          reason: new AiError.RateLimitError({ limit: "tokens" })
        })
        assert.strictEqual(error._tag, "AiError")
        assert.strictEqual(error.module, "OpenAI")
        assert.strictEqual(error.method, "completion")
        assert.strictEqual(error.reason._tag, "RateLimitError")
      })
    })

    describe("reasonFromHttpStatus", () => {
      it("should map 400 to InvalidRequestError", () => {
        const reason = AiError.reasonFromHttpStatus({ status: 400 })
        assert.strictEqual(reason._tag, "InvalidRequestError")
      })

      it("should map 401 to AuthenticationError with InvalidKey", () => {
        const reason = AiError.reasonFromHttpStatus({ status: 401 })
        assert.strictEqual(reason._tag, "AuthenticationError")
        if (reason._tag === "AuthenticationError") {
          assert.strictEqual(reason.kind, "InvalidKey")
        }
      })

      it("should map 403 to AuthenticationError with InsufficientPermissions", () => {
        const reason = AiError.reasonFromHttpStatus({ status: 403 })
        assert.strictEqual(reason._tag, "AuthenticationError")
        if (reason._tag === "AuthenticationError") {
          assert.strictEqual(reason.kind, "InsufficientPermissions")
        }
      })

      it("should map 408 to AiTimeoutError", () => {
        const reason = AiError.reasonFromHttpStatus({ status: 408 })
        assert.strictEqual(reason._tag, "AiTimeoutError")
      })

      it("should map 429 to RateLimitError", () => {
        const reason = AiError.reasonFromHttpStatus({ status: 429 })
        assert.strictEqual(reason._tag, "RateLimitError")
      })

      it("should map 5xx to ProviderInternalError", () => {
        assert.strictEqual(AiError.reasonFromHttpStatus({ status: 500 })._tag, "ProviderInternalError")
        assert.strictEqual(AiError.reasonFromHttpStatus({ status: 502 })._tag, "ProviderInternalError")
        assert.strictEqual(AiError.reasonFromHttpStatus({ status: 503 })._tag, "ProviderInternalError")
      })

      it("should map unknown status to AiUnknownError", () => {
        const reason = AiError.reasonFromHttpStatus({ status: 418 })
        assert.strictEqual(reason._tag, "AiUnknownError")
      })

      it("should include body in cause", () => {
        const body = { error: "rate limit" }
        const reason = AiError.reasonFromHttpStatus({ status: 429, body })
        assert.strictEqual(reason.cause, body)
      })
    })
  })

  describe("type guards", () => {
    describe("isAiError", () => {
      it("should return true for AiError", () => {
        const error = new AiError.AiError({
          module: "Test",
          method: "test",
          reason: new AiError.AiUnknownError({})
        })
        assert.isTrue(AiError.isAiError(error))
      })

      it("should return false for non-AiError values", () => {
        assert.isFalse(AiError.isAiError(new Error("regular error")))
        assert.isFalse(AiError.isAiError(null))
        assert.isFalse(AiError.isAiError(undefined))
        assert.isFalse(AiError.isAiError({ _tag: "FakeError" }))
      })

      it("should return false for legacy error types", () => {
        const legacyError = new AiError.UnknownError({
          module: "Test",
          method: "test"
        })
        assert.isFalse(AiError.isAiError(legacyError))

        const httpRequestError = new AiError.HttpRequestError({
          module: "Test",
          method: "test",
          reason: "Transport",
          request: {
            method: "GET",
            url: "https://example.com",
            urlParams: [],
            hash: undefined,
            headers: {}
          }
        })
        assert.isFalse(AiError.isAiError(httpRequestError))
      })
    })
  })

  describe("supporting schemas", () => {
    describe("ProviderMetadata", () => {
      it.effect("should encode and decode roundtrip", () =>
        Effect.gen(function* () {
          const metadata = {
            name: "OpenAI",
            errorCode: "rate_limit_exceeded",
            errorType: "rate_limit",
            requestId: "req_123abc"
          }
          const encoded = yield* Schema.encodeEffect(AiError.ProviderMetadata)(metadata)
          const decoded = yield* Schema.decodeEffect(AiError.ProviderMetadata)(encoded)
          assert.deepStrictEqual(decoded, metadata)
        })
      )
    })

    describe("UsageInfo", () => {
      it.effect("should encode and decode roundtrip", () =>
        Effect.gen(function* () {
          const usage = {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150
          }
          const encoded = yield* Schema.encodeEffect(AiError.UsageInfo)(usage)
          const decoded = yield* Schema.decodeEffect(AiError.UsageInfo)(encoded)
          assert.deepStrictEqual(decoded, usage)
        })
      )
    })

    describe("HttpContext", () => {
      it.effect("should encode and decode roundtrip", () =>
        Effect.gen(function* () {
          const context = {
            request: {
              method: "POST" as const,
              url: "https://api.example.com/v1/chat",
              urlParams: [["model", "gpt-4"]] as Array<[string, string]>,
              hash: undefined,
              headers: { "Content-Type": "application/json" }
            },
            response: {
              status: 200,
              headers: { "Content-Type": "application/json" }
            },
            body: '{"result": "success"}'
          }
          const encoded = yield* Schema.encodeEffect(AiError.HttpContext)(context)
          const decoded = yield* Schema.decodeEffect(AiError.HttpContext)(encoded)
          assert.deepStrictEqual(decoded, context)
        })
      )
    })
  })

  describe("schema roundtrip", () => {
    it.effect("RateLimitError roundtrip", () =>
      Effect.gen(function* () {
        const error = new AiError.RateLimitError({
          limit: "requests",
          remaining: 0,
          retryAfter: Duration.seconds(60)
        })
        const encoded = yield* Schema.encodeEffect(AiError.RateLimitError)(error)
        const decoded = yield* Schema.decodeEffect(AiError.RateLimitError)(encoded)
        assert.strictEqual(decoded._tag, "RateLimitError")
        assert.strictEqual(decoded.limit, "requests")
        assert.strictEqual(decoded.remaining, 0)
      })
    )

    it.effect("AiErrorReason union roundtrip", () =>
      Effect.gen(function* () {
        const rateLimitError: AiError.AiErrorReason = new AiError.RateLimitError({
          limit: "tokens"
        })
        const encoded = yield* Schema.encodeEffect(AiError.AiErrorReason)(rateLimitError)
        const decoded = yield* Schema.decodeEffect(AiError.AiErrorReason)(encoded)
        assert.strictEqual(decoded._tag, "RateLimitError")

        const authError: AiError.AiErrorReason = new AiError.AuthenticationError({
          kind: "ExpiredKey"
        })
        const authEncoded = yield* Schema.encodeEffect(AiError.AiErrorReason)(authError)
        const authDecoded = yield* Schema.decodeEffect(AiError.AiErrorReason)(authEncoded)
        assert.strictEqual(authDecoded._tag, "AuthenticationError")
      })
    )

    it.effect("AiError roundtrip", () =>
      Effect.gen(function* () {
        const error = new AiError.AiError({
          module: "OpenAI",
          method: "completion",
          reason: new AiError.RateLimitError({ limit: "requests" })
        })
        const encoded = yield* Schema.encodeEffect(AiError.AiError)(error)
        const decoded = yield* Schema.decodeEffect(AiError.AiError)(encoded)
        assert.strictEqual(decoded._tag, "AiError")
        assert.strictEqual(decoded.module, "OpenAI")
        assert.strictEqual(decoded.method, "completion")
        assert.strictEqual(decoded.reason._tag, "RateLimitError")
      })
    )
  })
})
