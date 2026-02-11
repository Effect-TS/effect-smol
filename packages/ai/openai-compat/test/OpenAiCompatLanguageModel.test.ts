import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai-compat"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Redacted, Schema, Stream } from "effect"
import { LanguageModel, Tool, Toolkit } from "effect/unstable/ai"
import { HttpClient, type HttpClientError, type HttpClientRequest, HttpClientResponse } from "effect/unstable/http"

describe("OpenAi compat LanguageModel", () => {
  describe("generateText", () => {
    it.effect("sends model in request and decodes text output", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

        const layer = OpenAiClient.layer({ apiKey: Redacted.make("sk-test-key") }).pipe(
          Layer.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) => {
              capturedRequest = request
              return Effect.succeed(jsonResponse(
                request,
                makeResponseBody({
                  output: [makeTextOutput("Hello, compat!")]
                })
              ))
            })
          ))
        )

        const result = yield* LanguageModel.generateText({ prompt: "hello" }).pipe(
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(layer)
        )

        assert.strictEqual(result.text, "Hello, compat!")
        assert.isDefined(capturedRequest)
        if (capturedRequest === undefined) {
          return
        }

        const requestBody = yield* getRequestBody(capturedRequest)
        assert.strictEqual(requestBody.model, "gpt-4o-mini")
        assert.strictEqual(requestBody.text.format.type, "text")
      }))

    it.effect("maps function_call output to tool-call part and sends function tool schema", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

        const layer = OpenAiClient.layer({ apiKey: Redacted.make("sk-test-key") }).pipe(
          Layer.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) => {
              capturedRequest = request
              return Effect.succeed(jsonResponse(
                request,
                makeResponseBody({
                  output: [{
                    type: "function_call",
                    id: "fc_1",
                    call_id: "call_1",
                    name: "TestTool",
                    arguments: JSON.stringify({ input: "hello" }),
                    status: "completed",
                    future_provider_field: true
                  }]
                })
              ))
            })
          ))
        )

        const result = yield* LanguageModel.generateText({
          prompt: "use the tool",
          toolkit: TestToolkit,
          disableToolCallResolution: true
        }).pipe(
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(TestToolkitLayer),
          Effect.provide(layer)
        )

        const toolCall = result.content.find((part) => part.type === "tool-call")
        assert.isDefined(toolCall)
        if (toolCall?.type !== "tool-call") {
          return
        }

        assert.strictEqual(toolCall.name, "TestTool")
        assert.deepStrictEqual(toolCall.params, { input: "hello" })

        assert.isDefined(capturedRequest)
        if (capturedRequest === undefined) {
          return
        }

        const requestBody = yield* getRequestBody(capturedRequest)
        const functionTool = requestBody.tools.find((tool: any) => tool.type === "function")
        assert.isDefined(functionTool)
        assert.strictEqual(functionTool.name, "TestTool")
        assert.strictEqual(functionTool.strict, true)
      }))

    it.effect("decodes usage when token detail fields are absent", () =>
      Effect.gen(function*() {
        const layer = OpenAiClient.layer({ apiKey: Redacted.make("sk-test-key") }).pipe(
          Layer.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) =>
              Effect.succeed(jsonResponse(
                request,
                makeResponseBody({
                  output: [makeTextOutput("Hello")],
                  usage: {
                    input_tokens: 4,
                    output_tokens: 5,
                    total_tokens: 9,
                    provider_future_field: true
                  }
                })
              ))
            )
          ))
        )

        const result = yield* LanguageModel.generateText({ prompt: "hello" }).pipe(
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(layer)
        )

        const finish = result.content.find((part) => part.type === "finish")
        assert.isDefined(finish)
        if (finish?.type !== "finish") {
          return
        }

        assert.deepStrictEqual(finish.usage.inputTokens, {
          uncached: 4,
          total: 4,
          cacheRead: 0,
          cacheWrite: undefined
        })
        assert.deepStrictEqual(finish.usage.outputTokens, {
          total: 5,
          text: 5,
          reasoning: 0
        })
      }))
  })

  describe("generateObject", () => {
    it.effect("uses json_schema format for structured output", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

        const layer = OpenAiClient.layer({ apiKey: Redacted.make("sk-test-key") }).pipe(
          Layer.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) => {
              capturedRequest = request
              return Effect.succeed(jsonResponse(
                request,
                makeResponseBody({
                  output: [makeTextOutput(JSON.stringify({ name: "Ada", age: 37 }))]
                })
              ))
            })
          ))
        )

        const person = yield* LanguageModel.generateObject({
          prompt: "Return a person",
          schema: Schema.Struct({
            name: Schema.String,
            age: Schema.Number
          })
        }).pipe(
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(layer)
        )

        assert.strictEqual(person.value.name, "Ada")
        assert.strictEqual(person.value.age, 37)

        assert.isDefined(capturedRequest)
        if (capturedRequest === undefined) {
          return
        }

        const requestBody = yield* getRequestBody(capturedRequest)
        assert.strictEqual(requestBody.text.format.type, "json_schema")
        assert.strictEqual(requestBody.text.format.strict, true)
      }))
  })

  describe("streamText", () => {
    it.effect("streams known events and ignores unknown ones", () =>
      Effect.gen(function*() {
        let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

        const events = [
          {
            type: "response.created",
            sequence_number: 1,
            response: makeResponseBody({
              id: "resp_stream",
              output: []
            })
          },
          {
            type: "response.output_item.added",
            output_index: 0,
            sequence_number: 2,
            item: makeMessage("msg_stream")
          },
          {
            type: "response.output_text.delta",
            item_id: "msg_stream",
            output_index: 0,
            content_index: 0,
            delta: "Hello",
            sequence_number: 3
          },
          {
            type: "response.provider_future_event",
            payload: { accepted: true }
          },
          {
            type: "response.output_item.done",
            output_index: 0,
            sequence_number: 4,
            item: makeMessage("msg_stream", "Hello")
          },
          {
            type: "response.completed",
            sequence_number: 5,
            response: makeResponseBody({
              id: "resp_stream",
              output: [makeMessage("msg_stream", "Hello")],
              usage: {
                input_tokens: 10,
                output_tokens: 7,
                total_tokens: 17,
                input_tokens_details: {
                  cached_tokens: 3
                },
                output_tokens_details: {
                  reasoning_tokens: 2
                }
              }
            })
          }
        ]

        const layer = OpenAiClient.layer({ apiKey: Redacted.make("sk-test-key") }).pipe(
          Layer.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) => {
              capturedRequest = request
              return Effect.succeed(sseResponse(request, events))
            })
          ))
        )

        const partsChunk = yield* LanguageModel.streamText({ prompt: "hello" }).pipe(
          Stream.runCollect,
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(layer)
        )

        const parts = globalThis.Array.from(partsChunk)
        const metadata = parts.find((part) => part.type === "response-metadata")
        const finish = parts.find((part) => part.type === "finish")
        const deltas = parts.filter((part) => part.type === "text-delta")

        assert.isDefined(metadata)
        assert.isDefined(finish)
        assert.strictEqual(deltas.length, 1)
        assert.strictEqual(deltas[0]?.delta, "Hello")
        if (finish?.type === "finish") {
          assert.strictEqual(finish.reason, "stop")
          assert.deepStrictEqual(finish.usage.inputTokens, {
            uncached: 7,
            total: 10,
            cacheRead: 3,
            cacheWrite: undefined
          })
          assert.deepStrictEqual(finish.usage.outputTokens, {
            total: 7,
            text: 5,
            reasoning: 2
          })
        }

        assert.isDefined(capturedRequest)
        if (capturedRequest === undefined) {
          return
        }

        const requestBody = yield* getRequestBody(capturedRequest)
        assert.strictEqual(requestBody.stream, true)
        assert.isTrue(capturedRequest.url.endsWith("/responses"))
      }))
  })
})

const TestTool = Tool.make("TestTool", {
  description: "A test tool",
  parameters: Schema.Struct({ input: Schema.String }),
  success: Schema.Struct({ output: Schema.String })
})

const TestToolkit = Toolkit.make(TestTool)

const TestToolkitLayer = TestToolkit.toLayer({
  TestTool: ({ input }) => Effect.succeed({ output: input })
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

const makeResponseBody = (overrides: Record<string, unknown> = {}) => ({
  id: "resp_test_1",
  object: "response",
  model: "gpt-4o-mini",
  status: "completed",
  created_at: 1,
  output: [],
  ...overrides
})

const makeMessage = (id: string, text?: string) => ({
  type: "message",
  id,
  role: "assistant",
  status: "completed",
  content: text === undefined ? [] : [{
    type: "output_text",
    text,
    annotations: [],
    logprobs: []
  }]
})

const makeTextOutput = (text: string) => ({
  type: "message",
  id: "msg_1",
  role: "assistant",
  status: "completed",
  content: [{
    type: "output_text",
    text,
    annotations: [],
    logprobs: []
  }]
})

const jsonResponse = (
  request: HttpClientRequest.HttpClientRequest,
  body: unknown
): HttpClientResponse.HttpClientResponse =>
  HttpClientResponse.fromWeb(
    request,
    new Response(JSON.stringify(body), {
      status: 200,
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
