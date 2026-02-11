import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai-compat"
import { assert, describe, it } from "@effect/vitest"
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, Layer, Redacted, Ref, Schema, Stream } from "effect"
import { LanguageModel, Prompt, Tool, Toolkit } from "effect/unstable/ai"
import { HttpClient, type HttpClientError, type HttpClientRequest, HttpClientResponse } from "effect/unstable/http"

describe("OpenAiLanguageModel", () => {
  describe("streamText", () => {
    it.effect("handles chat completion stream chunks", () =>
      Effect.gen(function*() {
        const partsChunk = yield* LanguageModel.streamText({ prompt: "test" }).pipe(
          Stream.runCollect,
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini"))
        )

        const parts = Array.from(partsChunk)

        assert.isTrue(parts.some((part) => part.type === "response-metadata"))

        const finish = parts.find((part) => part.type === "finish")
        assert.isDefined(finish)
        if (finish?.type === "finish") {
          assert.strictEqual(finish.reason, "stop")
        }
      }).pipe(
        Effect.provide(makeTestLayer([
          {
            id: "chatcmpl_test123",
            object: "chat.completion.chunk",
            model: "gpt-4o-mini",
            created: 1,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: "stop"
            }]
          },
          "[DONE]"
        ]))
      ))

    it.effect("maps local shell stream tool calls to local_shell call outputs", () =>
      Effect.gen(function*() {
        const capturedRequests = yield* Ref.make<ReadonlyArray<HttpClientRequest.HttpClientRequest>>([])
        const requestCount = yield* Ref.make(0)

        const httpClient = HttpClient.makeWith(
          Effect.fnUntraced(function*(requestEffect) {
            const request = yield* requestEffect
            yield* Ref.update(capturedRequests, (requests) => [...requests, request])
            const index = yield* Ref.getAndUpdate(requestCount, (value) => value + 1)

            if (index === 0) {
              return HttpClientResponse.fromWeb(
                request,
                new Response(toSseBody([makeLocalShellChunk(), "[DONE]"]), {
                  status: 200,
                  headers: { "content-type": "text/event-stream" }
                })
              )
            }

            return HttpClientResponse.fromWeb(
              request,
              new Response(JSON.stringify(makeChatCompletion()), {
                status: 200,
                headers: { "content-type": "application/json" }
              })
            )
          }),
          Effect.succeed as HttpClient.HttpClient.Preprocess<HttpClientError.HttpClientError, never>
        )

        const layer = OpenAiClient.layer({ apiKey: Redacted.make("sk-test-key") }).pipe(
          Layer.provide(Layer.succeed(HttpClient.HttpClient, httpClient))
        )

        const toolkit = Toolkit.make(CompatLocalShellTool({}))
        const toolkitLayer = toolkit.toLayer({
          CompatLocalShell: () => Effect.succeed("done")
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

        strictEqual(toolCall.name, "CompatLocalShell")
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

        const localShellCall = followUpBody.messages.find((item: any) =>
          item.role === "assistant" && item.tool_calls?.[0]?.function?.name === "local_shell"
        )
        assert.isDefined(localShellCall)
        strictEqual(localShellCall.tool_calls[0].id, toolCall.id)

        const localShellOutput = followUpBody.messages.find((item: any) => item.role === "tool")
        assert.isDefined(localShellOutput)
        strictEqual(localShellOutput.tool_call_id, toolCall.id)
        strictEqual(localShellOutput.content, "done")
      }))

    it.effect("maps apply_patch stream tool calls to custom provider-defined tool", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer([
          {
            id: "chatcmpl_apply_patch_1",
            object: "chat.completion.chunk",
            model: "gpt-4o-mini",
            created: 1,
            choices: [{
              index: 0,
              delta: {
                tool_calls: [{
                  index: 0,
                  id: "patch_call_1",
                  type: "function",
                  function: {
                    name: "apply_patch",
                    arguments: JSON.stringify({
                      call_id: "patch_call_1",
                      operation: {
                        type: "delete_file",
                        path: "src/legacy.ts"
                      }
                    })
                  }
                }]
              },
              finish_reason: "tool_calls"
            }]
          },
          "[DONE]"
        ])

        const toolkit = Toolkit.make(CompatApplyPatchTool({}))
        const toolkitLayer = toolkit.toLayer({
          CompatApplyPatch: () =>
            Effect.succeed({
              status: "completed",
              output: "deleted"
            })
        })

        const partsChunk = yield* LanguageModel.streamText({
          prompt: "Delete src/legacy.ts",
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

        strictEqual(toolCall.name, "CompatApplyPatch")
        deepStrictEqual(toolCall.params, {
          call_id: "patch_call_1",
          operation: {
            type: "delete_file",
            path: "src/legacy.ts"
          }
        })
      }))
  })
})

const localShellAction = {
  type: "exec",
  command: ["pwd"],
  env: {}
}

const CompatLocalShellTool = Tool.providerDefined({
  id: "compat.local_shell",
  customName: "CompatLocalShell",
  providerName: "local_shell",
  requiresHandler: true,
  parameters: Schema.Struct({
    action: Schema.Any
  }),
  success: Schema.String
})

const CompatApplyPatchTool = Tool.providerDefined({
  id: "compat.apply_patch",
  customName: "CompatApplyPatch",
  providerName: "apply_patch",
  requiresHandler: true,
  parameters: Schema.Struct({
    call_id: Schema.String,
    operation: Schema.Any
  }),
  success: Schema.Struct({
    status: Schema.Literals(["completed", "failed"]),
    output: Schema.optionalKey(Schema.NullOr(Schema.String))
  })
})

const makeLocalShellChunk = () => ({
  id: "chatcmpl_local_shell_1",
  object: "chat.completion.chunk",
  model: "gpt-4o-mini",
  created: 1,
  choices: [{
    index: 0,
    delta: {
      tool_calls: [{
        index: 0,
        id: "local_shell_call_1",
        type: "function",
        function: {
          name: "local_shell",
          arguments: JSON.stringify({ action: localShellAction })
        }
      }]
    },
    finish_reason: "tool_calls"
  }]
})

const makeChatCompletion = () => ({
  id: "chatcmpl_followup",
  object: "chat.completion",
  model: "gpt-4o-mini",
  created: 1,
  choices: [{
    index: 0,
    finish_reason: "stop",
    message: {
      role: "assistant",
      content: ""
    }
  }]
})

const makeTestLayer = (events: ReadonlyArray<unknown>) =>
  OpenAiClient.layer({ apiKey: Redacted.make("sk-test-key") }).pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, makeHttpClient(events)))
  )

const makeHttpClient = (events: ReadonlyArray<unknown>) =>
  HttpClient.makeWith(
    Effect.fnUntraced(function*(requestEffect) {
      const request = yield* requestEffect
      return HttpClientResponse.fromWeb(
        request,
        new Response(toSseBody(events), {
          status: 200,
          headers: { "content-type": "text/event-stream" }
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
  events.map((event) => {
    if (typeof event === "string") {
      return `data: ${event}\n\n`
    }
    return `data: ${JSON.stringify(event)}\n\n`
  }).join("")
