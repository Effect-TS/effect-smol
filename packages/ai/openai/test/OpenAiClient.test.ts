import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Redacted, Schema, Stream } from "effect"
import type * as AiError from "effect/unstable/ai/AiError"
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
  readonly request?: HttpClientRequest.HttpClientRequest
}): HttpClientResponse.HttpClientResponse => {
  const request = options.request ?? HttpClientRequest.get("/")
  const json = JSON.stringify(options.body)
  return HttpClientResponse.fromWeb(
    request,
    new Response(json, {
      status: options.status,
      headers: { "content-type": "application/json" }
    })
  )
}

const makeMockHttpClient = (
  handler: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse>
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
// Tests
// =============================================================================

describe("OpenAiClient", () => {
  describe("make", () => {
    it.effect("constructs client with required options", () =>
      Effect.gen(function*() {
        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        })
        assert.isNotNull(client.client)
        assert.isFunction(client.createResponse)
        assert.isFunction(client.createResponseStream)
        assert.isFunction(client.createEmbedding)
        assert.isFunction(client.streamRequest)
      }).pipe(
        Effect.provide(Layer.succeed(
          HttpClient.HttpClient,
          makeMockHttpClient(() => Effect.succeed(makeMockResponse({ status: 200, body: {} })))
        ))
      ))

    it.effect("sets Bearer token from apiKey", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined
        const mockClient = makeMockHttpClient((request) => {
          capturedRequest = request
          return Effect.succeed(makeMockResponse({ status: 200, body: {}, request }))
        })

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("sk-test-12345")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        // Call method and ignore response parsing errors - we only care about the request
        yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(Effect.ignore)

        assert.isDefined(capturedRequest)
        const authHeader = capturedRequest!.headers["authorization"]
        assert.strictEqual(authHeader, "Bearer sk-test-12345")
      }))

    it.effect("prepends default URL", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined
        const mockClient = makeMockHttpClient((request) => {
          capturedRequest = request
          return Effect.succeed(makeMockResponse({ status: 200, body: {}, request }))
        })

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(Effect.ignore)

        assert.isDefined(capturedRequest)
        assert.isTrue(capturedRequest!.url.startsWith("https://api.openai.com/v1"))
      }))

    it.effect("uses custom apiUrl when provided", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined
        const mockClient = makeMockHttpClient((request) => {
          capturedRequest = request
          return Effect.succeed(makeMockResponse({ status: 200, body: {}, request }))
        })

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key"),
          apiUrl: "https://custom.api.com/v2"
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(Effect.ignore)

        assert.isDefined(capturedRequest)
        assert.isTrue(capturedRequest!.url.startsWith("https://custom.api.com/v2"))
      }))

    it.effect("sets OpenAI-Organization header when organizationId provided", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined
        const mockClient = makeMockHttpClient((request) => {
          capturedRequest = request
          return Effect.succeed(makeMockResponse({ status: 200, body: {}, request }))
        })

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key"),
          organizationId: Redacted.make("org-12345")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(Effect.ignore)

        assert.isDefined(capturedRequest)
        assert.strictEqual(capturedRequest!.headers["openai-organization"], "org-12345")
      }))

    it.effect("sets OpenAI-Project header when projectId provided", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined
        const mockClient = makeMockHttpClient((request) => {
          capturedRequest = request
          return Effect.succeed(makeMockResponse({ status: 200, body: {}, request }))
        })

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key"),
          projectId: Redacted.make("proj-67890")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(Effect.ignore)

        assert.isDefined(capturedRequest)
        assert.strictEqual(capturedRequest!.headers["openai-project"], "proj-67890")
      }))

    it.effect("applies transformClient option", () =>
      Effect.gen(function*() {
        let transformApplied = false
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({ status: 200, body: {}, request }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key"),
          transformClient: (client) => {
            transformApplied = true
            return client
          }
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(Effect.ignore)
        assert.isTrue(transformApplied)
      }))
  })

  describe("layer", () => {
    it.effect("creates working service", () =>
      Effect.gen(function*() {
        const client = yield* OpenAiClient.OpenAiClient
        assert.isNotNull(client.client)
      }).pipe(
        Effect.provide(OpenAiClient.layer({
          apiKey: Redacted.make("test-key")
        })),
        Effect.provide(Layer.succeed(
          HttpClient.HttpClient,
          makeMockHttpClient(() => Effect.succeed(makeMockResponse({ status: 200, body: {} })))
        ))
      ))
  })

  describe("error mapping", () => {
    it.effect("maps 400 status to InvalidRequestError reason", () =>
      Effect.gen(function*() {
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({
            status: 400,
            body: { error: { message: "Bad request" } },
            request
          }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        const result = yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(
          Effect.flip
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.module, "OpenAiClient")
        assert.strictEqual(result.method, "createResponse")
        assert.strictEqual(result.reason._tag, "InvalidRequestError")
      }))

    it.effect("maps 401 status to AuthenticationError reason", () =>
      Effect.gen(function*() {
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({
            status: 401,
            body: { error: { message: "Invalid API key" } },
            request
          }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        const result = yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(
          Effect.flip
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "AuthenticationError")
        assert.strictEqual((result.reason as AiError.AuthenticationError).kind, "InvalidKey")
      }))

    it.effect("maps 403 status to AuthenticationError with InsufficientPermissions", () =>
      Effect.gen(function*() {
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({
            status: 403,
            body: { error: { message: "Access denied" } },
            request
          }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        const result = yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(
          Effect.flip
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "AuthenticationError")
        assert.strictEqual((result.reason as AiError.AuthenticationError).kind, "InsufficientPermissions")
      }))

    it.effect("maps 429 status to RateLimitError reason", () =>
      Effect.gen(function*() {
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({
            status: 429,
            body: { error: { message: "Rate limit exceeded" } },
            request
          }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        const result = yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(
          Effect.flip
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "RateLimitError")
        assert.isTrue(result.isRetryable)
      }))

    it.effect("maps 5xx status to ProviderInternalError reason", () =>
      Effect.gen(function*() {
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({
            status: 500,
            body: { error: { message: "Internal server error" } },
            request
          }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        const result = yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(
          Effect.flip
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "ProviderInternalError")
        assert.isTrue(result.isRetryable)
      }))

    it.effect("maps schema error to OutputParseError reason", () =>
      Effect.gen(function*() {
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({
            status: 200,
            body: { invalid: "response" },
            request
          }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        const result = yield* client.createResponse({ model: "gpt-4o", input: "test" }).pipe(
          Effect.flip
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.method, "createResponse")
        assert.strictEqual(result.reason._tag, "OutputParseError")
      }))
  })

  describe("createEmbedding", () => {
    it.effect("maps 400 error to AiError", () =>
      Effect.gen(function*() {
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({
            status: 400,
            body: { error: { message: "Invalid model" } },
            request
          }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        const result = yield* client.createEmbedding({
          model: "invalid-model",
          input: "test"
        }).pipe(Effect.flip)

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.method, "createEmbedding")
        assert.strictEqual(result.reason._tag, "InvalidRequestError")
      }))

    it.effect("maps 429 error to RateLimitError", () =>
      Effect.gen(function*() {
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({
            status: 429,
            body: { error: { message: "Rate limit exceeded" } },
            request
          }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        const result = yield* client.createEmbedding({
          model: "text-embedding-ada-002",
          input: "test"
        }).pipe(Effect.flip)

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "RateLimitError")
      }))
  })

  describe("createResponseStream", () => {
    it.effect("maps HTTP error before stream starts", () =>
      Effect.gen(function*() {
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({
            status: 500,
            body: { error: { message: "Server error" } },
            request
          }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        const result = yield* client.createResponseStream({
          model: "gpt-4o",
          input: "test"
        }).pipe(
          Stream.runDrain,
          Effect.flip
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.reason._tag, "ProviderInternalError")
      }))
  })

  describe("streamRequest", () => {
    const TestEvent = Schema.Struct({
      type: Schema.String,
      value: Schema.Number
    })

    it.effect("maps ResponseError correctly", () =>
      Effect.gen(function*() {
        const mockClient = makeMockHttpClient((request) =>
          Effect.succeed(makeMockResponse({
            status: 429,
            body: { error: { message: "Rate limited" } },
            request
          }))
        )

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("test-key")
        }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mockClient)))

        const request = HttpClientRequest.post("/test")
        const result = yield* client.streamRequest(request, TestEvent).pipe(
          Stream.runDrain,
          Effect.flip
        )

        assert.strictEqual(result._tag, "AiError")
        assert.strictEqual(result.method, "streamRequest")
        assert.strictEqual(result.reason._tag, "RateLimitError")
      }))
  })
})
