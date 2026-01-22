import { assert, describe, it } from "@effect/vitest"
import { Effect, Schema, Stream } from "effect"
import { TestClock } from "effect/testing"
import { LanguageModel, Response, Tool, Toolkit } from "effect/unstable/ai"
import * as TestUtils from "./utils.ts"

const MyTool = Tool.make("MyTool", {
  parameters: { testParam: Schema.String },
  success: Schema.Struct({ testSuccess: Schema.String })
})

const MyToolkit = Toolkit.make(MyTool)

const MyToolkitLayer = MyToolkit.toLayer({
  MyTool: () => Effect.succeed({ testSuccess: "test-success" }).pipe(Effect.delay("10 seconds"))
})

describe("LanguageModel", () => {
  describe("streamText", () => {
    it("should emit tool calls before executing tool handlers", () =>
      Effect.gen(function* () {
        const parts: Array<Response.StreamPart<Toolkit.Tools<typeof MyToolkit>>> = []
        const latch = yield* Effect.makeLatch()

        const toolCallId = "tool-abc123"
        const toolName = "MyTool"
        const toolParams = { testParam: "test-param" }
        const toolResult = { testSuccess: "test-success" }

        yield* LanguageModel.streamText({
          prompt: [],
          toolkit: MyToolkit
        }).pipe(
          Stream.runForEach((part) =>
            Effect.andThen(latch.open, () => {
              parts.push(part)
            })
          ),
          TestUtils.withLanguageModel({
            streamText: [
              {
                type: "tool-call",
                id: toolCallId,
                name: toolName,
                params: toolParams
              }
            ]
          }),
          Effect.provide(MyToolkitLayer),
          Effect.forkScoped
        )

        yield* latch.await

        const toolCallPart = Response.makePart("tool-call", {
          id: toolCallId,
          name: toolName,
          params: toolParams,
          providerExecuted: false
        })

        const toolResultPart = Response.toolResultPart({
          id: toolCallId,
          name: toolName,
          result: toolResult,
          encodedResult: toolResult,
          isFailure: false,
          providerExecuted: false
        })

        assert.deepStrictEqual(parts, [toolCallPart])

        yield* TestClock.adjust("10 seconds")

        assert.deepStrictEqual(parts, [toolCallPart, toolResultPart])
      }))
  })
})
