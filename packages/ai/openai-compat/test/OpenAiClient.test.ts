import * as OpenAiClient from "@effect/ai-openai-compat/OpenAiClient"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Redacted, Stream } from "effect"
import { HttpClient, type HttpClientError, type HttpClientRequest, HttpClientResponse } from "effect/unstable/http"

describe("OpenAiClient", () => {
  describe("request behavior", () => {
    it.effect("sets auth and OpenAI headers on /responses requests", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("sk-test-key"),
          apiUrl: "https://compat.example.test/v1",
          organizationId: Redacted.make("org_123"),
          projectId: Redacted.make("proj_456")
        }).pipe(
          Effect.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) => {
              capturedRequest = request
              return Effect.succeed(jsonResponse(request, 200, makeResponseBody()))
            })
          ))
        )

        yield* client.createResponse({
          model: "gpt-4o-mini",
          input: "hello"
        })

        assert.isDefined(capturedRequest)
        if (capturedRequest === undefined) {
          return
        }

        assert.isTrue(capturedRequest.url.endsWith("/responses"))
        assert.isTrue(capturedRequest.url.startsWith("https://compat.example.test/v1"))
        assert.strictEqual(capturedRequest.headers["authorization"], "Bearer sk-test-key")
        assert.strictEqual(capturedRequest.headers["openai-organization"], "org_123")
        assert.strictEqual(capturedRequest.headers["openai-project"], "proj_456")
      }))

    it.effect("uses /embeddings path and decodes permissive embedding payloads", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("sk-test-key"),
          apiUrl: "https://compat.example.test/v1"
        }).pipe(
          Effect.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) => {
              capturedRequest = request
              return Effect.succeed(jsonResponse(request, 200, {
                data: [{
                  embedding: "YmFzZTY0LWRhdGE=",
                  index: 0,
                  object: "embedding",
                  vendor_payload: { future_field: true }
                }],
                model: "my-custom-embedding-model",
                object: "list",
                usage: {
                  prompt_tokens: 5,
                  total_tokens: 5
                },
                unknown_top_level: true
              }))
            })
          ))
        )

        const embedding = yield* client.createEmbedding({
          model: "my-custom-embedding-model",
          input: "embed this"
        })

        assert.isDefined(capturedRequest)
        if (capturedRequest === undefined) {
          return
        }

        assert.isTrue(capturedRequest.url.endsWith("/embeddings"))
        assert.strictEqual(embedding.model, "my-custom-embedding-model")
        assert.strictEqual(embedding.data[0]?.index, 0)
        assert.strictEqual(typeof embedding.data[0]?.embedding, "string")
      }))

    it.effect("sets stream=true for createResponseStream and accepts unknown stream events", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("sk-test-key")
        }).pipe(
          Effect.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) => {
              capturedRequest = request
              return Effect.succeed(sseResponse(request, [
                {
                  type: "response.future_event",
                  foo: "bar"
                },
                {
                  type: "response.completed",
                  sequence_number: 2,
                  response: makeResponseBody()
                }
              ]))
            })
          ))
        )

        const eventsChunk = yield* client.createResponseStream({
          model: "gpt-4o-mini",
          input: "hello"
        }).pipe(
          Effect.flatMap(([_, stream]) => Stream.runCollect(stream))
        )

        assert.isDefined(capturedRequest)
        if (capturedRequest === undefined) {
          return
        }

        const body = yield* getRequestBody(capturedRequest)
        assert.strictEqual(body.stream, true)
        assert.isTrue(capturedRequest.url.endsWith("/responses"))

        const events = globalThis.Array.from(eventsChunk)
        assert.strictEqual(events.length, 2)
        assert.strictEqual(events[0]?.type, "response.future_event")
        assert.strictEqual(events[1]?.type, "response.completed")
      }))
  })

  describe("error mapping", () => {
    it.effect("maps 400 responses to InvalidRequestError", () =>
      Effect.gen(function*() {
        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("sk-test-key")
        }).pipe(
          Effect.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) =>
              Effect.succeed(jsonResponse(request, 400, {
                error: {
                  message: "Bad request",
                  type: "invalid_request_error",
                  code: null
                }
              }))
            )
          ))
        )

        const error = yield* client.createResponse({
          model: "gpt-4o-mini",
          input: "hello"
        }).pipe(Effect.flip)

        assert.strictEqual(error._tag, "AiError")
        assert.strictEqual(error.method, "createResponse")
        assert.strictEqual(error.reason._tag, "InvalidRequestError")
      }))

    it.effect("maps insufficient quota errors to QuotaExhaustedError", () =>
      Effect.gen(function*() {
        const client = yield* OpenAiClient.make({
          apiKey: Redacted.make("sk-test-key")
        }).pipe(
          Effect.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) =>
              Effect.succeed(jsonResponse(request, 429, {
                error: {
                  message: "You exceeded your current quota",
                  type: "insufficient_quota",
                  code: "insufficient_quota"
                }
              }))
            )
          ))
        )

        const error = yield* client.createResponse({
          model: "gpt-4o-mini",
          input: "hello"
        }).pipe(Effect.flip)

        assert.strictEqual(error._tag, "AiError")
        assert.strictEqual(error.method, "createResponse")
        assert.strictEqual(error.reason._tag, "QuotaExhaustedError")
      }))
  })
})

const makeHttpClient = (
  handler: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>
) =>
  HttpClient.makeWith(
    Effect.fnUntraced(function*(requestEffect) {
      const request = yield* requestEffect
      return yield* handler(request)
    }),
    Effect.succeed as HttpClient.HttpClient.Preprocess<HttpClientError.HttpClientError, never>
  )

const makeResponseBody = () => ({
  id: "resp_test_1",
  object: "response",
  model: "gpt-4o-mini",
  status: "completed",
  created_at: 1,
  output: []
})

const jsonResponse = (
  request: HttpClientRequest.HttpClientRequest,
  status: number,
  body: unknown
): HttpClientResponse.HttpClientResponse =>
  HttpClientResponse.fromWeb(
    request,
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json"
      }
    })
  )

const sseResponse = (
  request: HttpClientRequest.HttpClientRequest,
  events: ReadonlyArray<unknown>
): HttpClientResponse.HttpClientResponse =>
  HttpClientResponse.fromWeb(
    request,
    new Response(toSseBody(events), {
      status: 200,
      headers: {
        "content-type": "text/event-stream"
      }
    })
  )

const getRequestBody = (request: HttpClientRequest.HttpClientRequest) =>
  Effect.gen(function*() {
    const body = request.body
    if (body._tag === "Uint8Array") {
      const text = new TextDecoder().decode(body.body)
      return JSON.parse(text)
    }
    return yield* Effect.die(new Error("Expected Uint8Array body"))
  })

const toSseBody = (events: ReadonlyArray<unknown>): string =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")
