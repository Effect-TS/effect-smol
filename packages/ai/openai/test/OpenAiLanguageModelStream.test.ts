import { type Generated, OpenAiClient, OpenAiLanguageModel, OpenAiTool } from "@effect/ai-openai"
import { assert, describe, it } from "@effect/vitest"
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, Layer, Redacted, Ref, Stream } from "effect"
import { LanguageModel, Prompt, Toolkit } from "effect/unstable/ai"
import { HttpClient, type HttpClientError, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"

describe("OpenAiLanguageModel", () => {
  describe("streamText", () => {
    it.effect("maps local shell stream tool calls to local_shell call outputs", () =>
      Effect.gen(function*() {
        const capturedRequests = yield* Ref.make<ReadonlyArray<HttpClientRequest.HttpClientRequest>>([])
        const requestCount = yield* Ref.make(0)

        const layer = OpenAiClient.layer({ apiKey: Redacted.make("sk-test-key") }).pipe(
          Layer.provide(Layer.succeed(HttpClient.HttpClient, makeHttpClient({ capturedRequests, requestCount })))
        )

        const toolkit = Toolkit.make(OpenAiTool.LocalShell({}))
        const toolkitLayer = toolkit.toLayer({
          OpenAiLocalShell: () => Effect.succeed({ output: "done" })
        })

        const partsChunk = yield* LanguageModel.streamText({
          prompt: "Run pwd",
          toolkit,
          disableToolCallResolution: true
        }).pipe(
          Stream.runCollect,
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(toolkitLayer),
          Effect.provide(layer)
        )

        const toolCall = globalThis.Array.from(partsChunk).find((part) => part.type === "tool-call")
        assert.isDefined(toolCall)
        if (toolCall?.type !== "tool-call") {
          return
        }

        strictEqual(toolCall.name, "OpenAiLocalShell")
        deepStrictEqual(toolCall.params, { action: localShellAction })

        yield* LanguageModel.generateText({
          prompt: Prompt.make([
            { role: "user", content: "Run pwd" },
            {
              role: "assistant",
              content: [Prompt.toolCallPart({
                id: toolCall.id,
                name: toolCall.name,
                params: { action: localShellAction },
                providerExecuted: false,
                options: {
                  openai: {
                    itemId: "ls_call_1"
                  }
                }
              })]
            },
            {
              role: "tool",
              content: [Prompt.toolResultPart({
                id: toolCall.id,
                name: toolCall.name,
                isFailure: false,
                result: "done"
              })]
            }
          ]),
          toolkit
        }).pipe(
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(toolkitLayer),
          Effect.provide(layer)
        )

        const requests = yield* Ref.get(capturedRequests)
        const followUpRequest = requests[1]
        assert.isDefined(followUpRequest)
        if (followUpRequest === undefined) {
          return
        }

        const followUpBody = yield* getRequestBody(followUpRequest)

        const localShellCall = followUpBody.input.find((item: any) => item.type === "local_shell_call")
        assert.isDefined(localShellCall)
        strictEqual(localShellCall.call_id, toolCall.id)

        const localShellOutput = followUpBody.input.find((item: any) => item.type === "local_shell_call_output")
        assert.isDefined(localShellOutput)
        strictEqual(localShellOutput.call_id, toolCall.id)
        strictEqual(localShellOutput.output, "done")
      }))

    it.effect("maps cached and reasoning usage tokens from response.completed", () =>
      Effect.gen(function*() {
        const partsChunk = yield* LanguageModel.streamText({ prompt: "test" }).pipe(
          Stream.runCollect,
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(makeStreamLayer([
            makeResponseCompletedEvent({
              input_tokens: 10,
              output_tokens: 7,
              total_tokens: 17,
              input_tokens_details: {
                cached_tokens: 3
              },
              output_tokens_details: {
                reasoning_tokens: 2
              }
            })
          ]))
        )

        const finish = globalThis.Array.from(partsChunk).find((part) => part.type === "finish")
        assert.isDefined(finish)
        if (finish?.type !== "finish") {
          return
        }

        deepStrictEqual(finish.usage.inputTokens, {
          uncached: 7,
          total: 10,
          cacheRead: 3,
          cacheWrite: undefined
        })
        deepStrictEqual(finish.usage.outputTokens, {
          total: 7,
          text: 5,
          reasoning: 2
        })
      }))

    it.effect("defaults usage detail fields when response usage detail objects are missing", () =>
      Effect.gen(function*() {
        const partsChunk = yield* LanguageModel.streamText({ prompt: "test" }).pipe(
          Stream.runCollect,
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(makeStreamLayer([
            makeResponseCompletedEvent({
              input_tokens: 4,
              output_tokens: 5,
              total_tokens: 9
            })
          ]))
        )

        const finish = globalThis.Array.from(partsChunk).find((part) => part.type === "finish")
        assert.isDefined(finish)
        if (finish?.type !== "finish") {
          return
        }

        deepStrictEqual(finish.usage.inputTokens, {
          uncached: 4,
          total: 4,
          cacheRead: 0,
          cacheWrite: undefined
        })
        deepStrictEqual(finish.usage.outputTokens, {
          total: 5,
          text: 5,
          reasoning: 0
        })
      }))
  })

  describe("generateText", () => {
    it.effect("maps cached and reasoning usage tokens from createResponse", () =>
      Effect.gen(function*() {
        const result = yield* LanguageModel.generateText({ prompt: "test" }).pipe(
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(makeGenerateLayer(makeResponseWithUsage({
            input_tokens: 10,
            output_tokens: 7,
            total_tokens: 17,
            input_tokens_details: {
              cached_tokens: 3
            },
            output_tokens_details: {
              reasoning_tokens: 2
            }
          })))
        )

        const finish = result.content.find((part) => part.type === "finish")
        assert.isDefined(finish)
        if (finish?.type !== "finish") {
          return
        }

        deepStrictEqual(finish.usage.inputTokens, {
          uncached: 7,
          total: 10,
          cacheRead: 3,
          cacheWrite: undefined
        })
        deepStrictEqual(finish.usage.outputTokens, {
          total: 7,
          text: 5,
          reasoning: 2
        })
      }))

    it.effect("defaults usage detail fields when createResponse usage detail objects are missing", () =>
      Effect.gen(function*() {
        const result = yield* LanguageModel.generateText({ prompt: "test" }).pipe(
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini")),
          Effect.provide(makeGenerateLayer(makeResponseWithUsage({
            input_tokens: 4,
            output_tokens: 5,
            total_tokens: 9
          })))
        )

        const finish = result.content.find((part) => part.type === "finish")
        assert.isDefined(finish)
        if (finish?.type !== "finish") {
          return
        }

        deepStrictEqual(finish.usage.inputTokens, {
          uncached: 4,
          total: 4,
          cacheRead: 0,
          cacheWrite: undefined
        })
        deepStrictEqual(finish.usage.outputTokens, {
          total: 5,
          text: 5,
          reasoning: 0
        })
      }))
  })
})

const localShellAction: Generated.LocalShellExecAction = {
  type: "exec",
  command: ["pwd"],
  env: {}
}

const localShellDoneEvent: Generated.ResponseOutputItemDoneEvent = {
  type: "response.output_item.done",
  output_index: 0,
  sequence_number: 1,
  item: {
    type: "local_shell_call",
    id: "ls_call_1",
    call_id: "local_shell_call_1",
    action: localShellAction,
    status: "completed"
  }
}

const followUpResponse: Generated.Response = {
  id: "resp_followup",
  object: "response",
  created_at: 1,
  model: "gpt-4o-mini",
  status: "completed",
  output: [],
  metadata: null,
  temperature: null,
  top_p: null,
  tools: [],
  tool_choice: "auto",
  error: null,
  incomplete_details: null,
  instructions: null,
  parallel_tool_calls: false
}

const makeHttpClient = ({
  capturedRequests,
  requestCount
}: {
  readonly capturedRequests: Ref.Ref<ReadonlyArray<HttpClientRequest.HttpClientRequest>>
  readonly requestCount: Ref.Ref<number>
}) =>
  HttpClient.makeWith(
    Effect.fnUntraced(function*(requestEffect) {
      const request = yield* requestEffect
      yield* Ref.update(capturedRequests, (requests) => [...requests, request])
      const index = yield* Ref.getAndUpdate(requestCount, (value) => value + 1)

      if (index === 0) {
        return HttpClientResponse.fromWeb(
          request,
          new Response(toSseBody([localShellDoneEvent]), {
            status: 200,
            headers: { "content-type": "text/event-stream" }
          })
        )
      }

      return HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify(followUpResponse), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    }),
    Effect.succeed as HttpClient.HttpClient.Preprocess<HttpClientError.HttpClientError, never>
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

const makeStreamLayer = (events: ReadonlyArray<Generated.ResponseStreamEvent>) =>
  Layer.succeed(OpenAiClient.OpenAiClient, makeStreamOnlyClient(events))

const makeGenerateLayer = (responseBody: Generated.Response): Layer.Layer<OpenAiClient.OpenAiClient> =>
  Layer.succeed(OpenAiClient.OpenAiClient, makeGenerateOnlyClient(responseBody))

const makeGenerateOnlyClient = (responseBody: Generated.Response): OpenAiClient.Service => ({
  client: undefined as unknown as Generated.OpenAiClient,
  createResponse: () =>
    Effect.succeed(
      [
        responseBody,
        HttpClientResponse.fromWeb(
          HttpClientRequest.post("https://api.openai.com/v1/responses"),
          new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        )
      ] as const
    ),
  createResponseStream: () => Effect.die(new Error("createResponseStream should not be called")),
  createEmbedding: () => Effect.die(new Error("createEmbedding should not be called"))
})

const makeStreamOnlyClient = (
  events: ReadonlyArray<Generated.ResponseStreamEvent>
): OpenAiClient.Service => ({
  client: undefined as unknown as Generated.OpenAiClient,
  createResponse: () => Effect.die(new Error("createResponse should not be called")),
  createResponseStream: () =>
    Effect.succeed(
      [
        HttpClientResponse.fromWeb(
          HttpClientRequest.post("https://api.openai.com/v1/responses"),
          new Response(null, {
            status: 200,
            headers: { "content-type": "text/event-stream" }
          })
        ),
        Stream.fromIterable(events)
      ] as const
    ),
  createEmbedding: () => Effect.die(new Error("createEmbedding should not be called"))
})

const makeResponseCompletedEvent = (usage: unknown): Generated.ResponseCompletedEvent => ({
  type: "response.completed",
  sequence_number: 1,
  response: {
    ...followUpResponse,
    usage
  } as Generated.Response
})

const makeResponseWithUsage = (usage: unknown): Generated.Response => ({
  ...followUpResponse,
  usage
} as Generated.Response)
