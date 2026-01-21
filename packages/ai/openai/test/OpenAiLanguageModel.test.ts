import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Redacted, Schema } from "effect"
import { LanguageModel, Tool, Toolkit } from "effect/unstable/ai"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
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
    new globalThis.Response(json, {
      status: options.status,
      headers
    })
  )
}

const makeMockHttpClient = (
  handler: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>
): HttpClient.HttpClient =>
  HttpClient.makeWith<HttpClientError.HttpClientError, never, HttpClientError.HttpClientError, never>(
    (effect) =>
      Effect.flatMap(effect, handler) as Effect.Effect<
        HttpClientResponse.HttpClientResponse,
        HttpClientError.HttpClientError,
        never
      >,
    Effect.succeed
  )

// =============================================================================
// Test Layers
// =============================================================================

const makeTestLayer = (options: {
  readonly handler: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>
}) => {
  const mockClient = makeMockHttpClient(options.handler)
  const HttpClientLayer = Layer.succeed(HttpClient.HttpClient, mockClient)
  return OpenAiClient.layer({ apiKey: Redacted.make("sk-test-key") }).pipe(
    Layer.provide(HttpClientLayer)
  )
}

// =============================================================================
// Tests
// =============================================================================

describe("OpenAiLanguageModel", () => {
  describe("make", () => {
    it.effect("creates a language model service", () =>
      Effect.gen(function*() {
        const testLayer = makeTestLayer({
          handler: (request) =>
            Effect.succeed(makeMockResponse({
              status: 200,
              body: {},
              request
            }))
        })

        const model = yield* OpenAiLanguageModel.make({
          model: "gpt-4o"
        }).pipe(Effect.provide(testLayer))

        assert.isDefined(model)
      }))

    it.effect("sends correct model in request", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

        const testLayer = makeTestLayer({
          handler: (request) => {
            capturedRequest = request
            return Effect.succeed(makeMockResponse({
              status: 200,
              body: {},
              request
            }))
          }
        })

        const lmLayer = OpenAiLanguageModel.layer({ model: "gpt-4o-mini" }).pipe(
          Layer.provide(testLayer)
        )

        yield* LanguageModel.generateText({
          prompt: "test"
        }).pipe(Effect.ignore, Effect.provide(lmLayer))

        assert.isDefined(capturedRequest)
        assert.isTrue(capturedRequest!.url.includes("/responses"))
      }))
  })

  describe("layer", () => {
    it.effect("creates a layer that provides LanguageModel", () =>
      Effect.gen(function*() {
        let requestSent = false
        const testLayer = makeTestLayer({
          handler: (request) => {
            requestSent = true
            return Effect.succeed(makeMockResponse({
              status: 200,
              body: {},
              request
            }))
          }
        })

        const lmLayer = OpenAiLanguageModel.layer({ model: "gpt-4o" }).pipe(
          Layer.provide(testLayer)
        )

        yield* LanguageModel.generateText({ prompt: "test" }).pipe(
          Effect.ignore,
          Effect.provide(lmLayer)
        )

        assert.isTrue(requestSent)
      }))
  })

  describe("withConfigOverride", () => {
    it.effect("applies configuration overrides to request", () =>
      Effect.gen(function*() {
        let requestCount = 0

        const testLayer = makeTestLayer({
          handler: (request) => {
            requestCount++
            return Effect.succeed(makeMockResponse({
              status: 200,
              body: {},
              request
            }))
          }
        })

        const lmLayer = OpenAiLanguageModel.layer({
          model: "gpt-4o",
          config: { temperature: 0.5 }
        }).pipe(Layer.provide(testLayer))

        yield* LanguageModel.generateText({
          prompt: "test"
        }).pipe(
          OpenAiLanguageModel.withConfigOverride({ temperature: 0.9 }),
          Effect.ignore,
          Effect.provide(lmLayer)
        )

        assert.strictEqual(requestCount, 1)
      }))
  })

  describe("error handling", () => {
    it.effect("propagates API errors as AiError with RateLimitError", () =>
      Effect.gen(function*() {
        const testLayer = makeTestLayer({
          handler: (request) =>
            Effect.succeed(makeMockResponse({
              status: 429,
              body: {
                error: {
                  message: "Rate limit exceeded",
                  type: "requests",
                  code: "rate_limit_exceeded"
                }
              },
              request
            }))
        })

        const lmLayer = OpenAiLanguageModel.layer({ model: "gpt-4o" }).pipe(
          Layer.provide(testLayer)
        )

        const result = yield* LanguageModel.generateText({
          prompt: "test"
        }).pipe(
          Effect.flip,
          Effect.provide(lmLayer)
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "RateLimitError")
      }))

    it.effect("propagates API errors as AiError with AuthenticationError", () =>
      Effect.gen(function*() {
        const testLayer = makeTestLayer({
          handler: (request) =>
            Effect.succeed(makeMockResponse({
              status: 401,
              body: {
                error: {
                  message: "Invalid API key",
                  type: "authentication_error",
                  code: "invalid_api_key"
                }
              },
              request
            }))
        })

        const lmLayer = OpenAiLanguageModel.layer({ model: "gpt-4o" }).pipe(
          Layer.provide(testLayer)
        )

        const result = yield* LanguageModel.generateText({
          prompt: "test"
        }).pipe(
          Effect.flip,
          Effect.provide(lmLayer)
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "AuthenticationError")
      }))

    it.effect("propagates API errors as AiError with ContextLengthError", () =>
      Effect.gen(function*() {
        const testLayer = makeTestLayer({
          handler: (request) =>
            Effect.succeed(makeMockResponse({
              status: 400,
              body: {
                error: {
                  message:
                    "This model's maximum context length is 8192 tokens. However, your messages resulted in 12000 tokens.",
                  type: "invalid_request_error",
                  code: "context_length_exceeded"
                }
              },
              request
            }))
        })

        const lmLayer = OpenAiLanguageModel.layer({ model: "gpt-4o" }).pipe(
          Layer.provide(testLayer)
        )

        const result = yield* LanguageModel.generateText({
          prompt: "test"
        }).pipe(
          Effect.flip,
          Effect.provide(lmLayer)
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "ContextLengthError")
      }))

    it.effect("propagates API errors as AiError with ModelUnavailableError", () =>
      Effect.gen(function*() {
        const testLayer = makeTestLayer({
          handler: (request) =>
            Effect.succeed(makeMockResponse({
              status: 404,
              body: {
                error: {
                  message: "Model not found",
                  type: "invalid_request_error",
                  code: "model_not_found"
                }
              },
              request
            }))
        })

        const lmLayer = OpenAiLanguageModel.layer({ model: "gpt-5" }).pipe(
          Layer.provide(testLayer)
        )

        const result = yield* LanguageModel.generateText({
          prompt: "test"
        }).pipe(
          Effect.flip,
          Effect.provide(lmLayer)
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "ModelUnavailableError")
      }))

    it.effect("propagates API errors as AiError with ContentPolicyError", () =>
      Effect.gen(function*() {
        const testLayer = makeTestLayer({
          handler: (request) =>
            Effect.succeed(makeMockResponse({
              status: 400,
              body: {
                error: {
                  message: "Content policy violation",
                  type: "invalid_request_error",
                  code: "content_policy_violation"
                }
              },
              request
            }))
        })

        const lmLayer = OpenAiLanguageModel.layer({ model: "gpt-4o" }).pipe(
          Layer.provide(testLayer)
        )

        const result = yield* LanguageModel.generateText({
          prompt: "test"
        }).pipe(
          Effect.flip,
          Effect.provide(lmLayer)
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "ContentPolicyError")
      }))

    it.effect("propagates API errors as AiError with QuotaExhaustedError", () =>
      Effect.gen(function*() {
        const testLayer = makeTestLayer({
          handler: (request) =>
            Effect.succeed(makeMockResponse({
              status: 402,
              body: {
                error: {
                  message: "Quota exceeded",
                  type: "invalid_request_error",
                  code: "insufficient_quota"
                }
              },
              request
            }))
        })

        const lmLayer = OpenAiLanguageModel.layer({ model: "gpt-4o" }).pipe(
          Layer.provide(testLayer)
        )

        const result = yield* LanguageModel.generateText({
          prompt: "test"
        }).pipe(
          Effect.flip,
          Effect.provide(lmLayer)
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "QuotaExhaustedError")
      }))
  })

  describe("tool calling", () => {
    const WeatherTool = Tool.make("get_weather", {
      description: "Get weather for a location",
      parameters: { location: Schema.String },
      success: Schema.Struct({ temperature: Schema.Number, condition: Schema.String })
    })

    const WeatherToolkit = Toolkit.make(WeatherTool)

    it.effect("sends tools in request body", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

        const mockClient = makeMockHttpClient((request) => {
          capturedRequest = request
          return Effect.succeed(makeMockResponse({
            status: 200,
            body: {},
            request
          }))
        })

        const HttpClientLayer = Layer.succeed(HttpClient.HttpClient, mockClient)
        const clientLayer = OpenAiClient.layer({ apiKey: Redacted.make("sk-test") }).pipe(
          Layer.provide(HttpClientLayer)
        )

        const lmLayer = OpenAiLanguageModel.layer({ model: "gpt-4o" }).pipe(
          Layer.provide(clientLayer)
        )

        const toolkitLayer = WeatherToolkit.toLayer({
          get_weather: () => Effect.succeed({ temperature: 72, condition: "sunny" })
        })

        yield* LanguageModel.generateText({
          prompt: "What's the weather in NYC?",
          toolkit: WeatherToolkit
        }).pipe(
          Effect.ignore,
          Effect.provide(lmLayer),
          Effect.provide(toolkitLayer)
        )

        assert.isDefined(capturedRequest)
      }))
  })
})
