import { describe, it } from "@effect/vitest"
import { assertDefined, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, Schema, Stream } from "effect"
import { TestClock } from "effect/testing"
import { LanguageModel, Prompt, Response, Tool, Toolkit } from "effect/unstable/ai"
import * as TestUtils from "./utils.ts"

const MyTool = Tool.make("MyTool", {
  parameters: { testParam: Schema.String },
  success: Schema.Struct({ testSuccess: Schema.String })
})

const MyToolkit = Toolkit.make(MyTool)

const MyToolkitLayer = MyToolkit.toLayer({
  MyTool: () =>
    Effect.succeed({ testSuccess: "test-success" }).pipe(
      Effect.delay("10 seconds")
    )
})

const ApprovalTool = Tool.make("ApprovalTool", {
  parameters: { action: Schema.String },
  success: Schema.Struct({ result: Schema.String }),
  needsApproval: true
})

const DynamicApprovalTool = Tool.make("DynamicApprovalTool", {
  parameters: { dangerous: Schema.Boolean },
  success: Schema.Struct({ result: Schema.String }),
  needsApproval: (params) => params.dangerous
})

const ApprovalToolkit = Toolkit.make(ApprovalTool, DynamicApprovalTool)

const ApprovalToolkitLayer = ApprovalToolkit.toLayer({
  ApprovalTool: () => Effect.succeed({ result: "approved-result" }),
  DynamicApprovalTool: () => Effect.succeed({ result: "dynamic-result" })
})

describe("LanguageModel", () => {
  describe("streamText", () => {
    it("should emit tool calls before executing tool handlers", () =>
      Effect.gen(function*() {
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
          providerExecuted: false,
          preliminary: false
        })

        deepStrictEqual(parts, [toolCallPart])

        yield* TestClock.adjust("10 seconds")

        deepStrictEqual(parts, [toolCallPart, toolResultPart])
      }))
  })

  describe("tool approval", () => {
    it("emits tool-approval-request when tool has needsApproval: true", () =>
      Effect.gen(function*() {
        const parts: Array<Response.StreamPart<Toolkit.Tools<typeof ApprovalToolkit>>> = []

        const toolCallId = "call-123"
        const toolName = "ApprovalTool"
        const toolParams = { action: "delete" }

        yield* LanguageModel.streamText({
          prompt: [],
          toolkit: ApprovalToolkit
        }).pipe(
          Stream.runForEach((part) =>
            Effect.sync(() => {
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
          Effect.provide(ApprovalToolkitLayer)
        )

        strictEqual(parts.length, 2)
        deepStrictEqual(
          parts[0],
          Response.makePart("tool-call", {
            id: toolCallId,
            name: toolName,
            params: toolParams,
            providerExecuted: false
          })
        )

        const approvalPart = parts[1]
        strictEqual(approvalPart.type, "tool-approval-request")
        if (approvalPart.type === "tool-approval-request") {
          strictEqual(approvalPart.toolCallId, toolCallId)
          assertDefined(approvalPart.approvalId)
        }
      }))

    it("pre-resolves approved tool calls before calling LLM", () =>
      Effect.gen(function*() {
        const toolCallId = "call-456"
        const approvalId = "approval-456"
        let capturedPrompt: LanguageModel.ProviderOptions["prompt"] | undefined

        const prompt: Array<Prompt.Message> = [
          Prompt.assistantMessage({
            content: [
              Prompt.makePart("tool-call", {
                id: toolCallId,
                name: "ApprovalTool",
                params: { action: "delete" },
                providerExecuted: false
              }),
              Prompt.makePart("tool-approval-request", {
                approvalId,
                toolCallId
              })
            ]
          }),
          Prompt.toolMessage({
            content: [
              Prompt.toolApprovalResponsePart({
                approvalId,
                approved: true
              })
            ]
          })
        ]

        yield* LanguageModel.streamText({
          prompt,
          toolkit: ApprovalToolkit
        }).pipe(
          Stream.runDrain,
          TestUtils.withLanguageModel({
            streamText: (opts) => {
              capturedPrompt = opts.prompt
              return [{
                type: "finish",
                reason: "stop",
                usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 }
              }]
            }
          }),
          Effect.provide(ApprovalToolkitLayer)
        )

        // Verify the prompt sent to LLM contains pre-resolved tool result
        assertDefined(capturedPrompt)
        const messages = capturedPrompt.content
        const lastMessage = messages[messages.length - 1]
        strictEqual(lastMessage.role, "tool")
        assertTrue(Array.isArray(lastMessage.content))
        const toolResults = (lastMessage.content as Array<Prompt.ToolMessagePart>).filter(
          (p): p is Prompt.ToolResultPart => p.type === "tool-result"
        )
        strictEqual(toolResults.length, 1)
        strictEqual(toolResults[0].id, toolCallId)
        deepStrictEqual(toolResults[0].result, { result: "approved-result" })
        strictEqual(toolResults[0].isFailure, false)
      }))

    it("pre-resolves denied tool calls with execution-denied before calling LLM", () =>
      Effect.gen(function*() {
        const toolCallId = "call-789"
        const approvalId = "approval-789"
        let capturedPrompt: LanguageModel.ProviderOptions["prompt"] | undefined

        const prompt: Array<Prompt.Message> = [
          Prompt.assistantMessage({
            content: [
              Prompt.makePart("tool-call", {
                id: toolCallId,
                name: "ApprovalTool",
                params: { action: "delete" },
                providerExecuted: false
              }),
              Prompt.makePart("tool-approval-request", {
                approvalId,
                toolCallId
              })
            ]
          }),
          Prompt.toolMessage({
            content: [
              Prompt.toolApprovalResponsePart({
                approvalId,
                approved: false,
                reason: "User declined"
              })
            ]
          })
        ]

        yield* LanguageModel.streamText({
          prompt,
          toolkit: ApprovalToolkit
        }).pipe(
          Stream.runDrain,
          TestUtils.withLanguageModel({
            streamText: (opts) => {
              capturedPrompt = opts.prompt
              return [{
                type: "finish",
                reason: "stop",
                usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 }
              }]
            }
          }),
          Effect.provide(ApprovalToolkitLayer)
        )

        // Verify the prompt sent to LLM contains pre-resolved denial result
        assertDefined(capturedPrompt)
        const messages = capturedPrompt.content
        const lastMessage = messages[messages.length - 1]
        strictEqual(lastMessage.role, "tool")
        assertTrue(Array.isArray(lastMessage.content))
        const toolResults = (lastMessage.content as Array<Prompt.ToolMessagePart>).filter(
          (p): p is Prompt.ToolResultPart => p.type === "tool-result"
        )
        strictEqual(toolResults.length, 1)
        strictEqual(toolResults[0].id, toolCallId)
        const result = toolResults[0].result as { type: string; reason: string }
        strictEqual(result.type, "execution-denied")
        strictEqual(result.reason, "User declined")
        strictEqual(toolResults[0].isFailure, true)
      }))

    it("dynamic needsApproval returns true when condition met", () =>
      Effect.gen(function*() {
        const parts: Array<Response.StreamPart<Toolkit.Tools<typeof ApprovalToolkit>>> = []

        const toolCallId = "call-dyn-1"

        yield* LanguageModel.streamText({
          prompt: [],
          toolkit: ApprovalToolkit
        }).pipe(
          Stream.runForEach((part) =>
            Effect.sync(() => {
              parts.push(part)
            })
          ),
          TestUtils.withLanguageModel({
            streamText: [
              {
                type: "tool-call",
                id: toolCallId,
                name: "DynamicApprovalTool",
                params: { dangerous: true }
              }
            ]
          }),
          Effect.provide(ApprovalToolkitLayer)
        )

        strictEqual(parts.length, 2)
        strictEqual(parts[0].type, "tool-call")
        strictEqual(parts[1].type, "tool-approval-request")
        if (parts[1].type === "tool-approval-request") {
          strictEqual(parts[1].toolCallId, toolCallId)
        }
      }))

    it("dynamic needsApproval returns false when condition not met", () =>
      Effect.gen(function*() {
        const parts: Array<Response.StreamPart<Toolkit.Tools<typeof ApprovalToolkit>>> = []

        const toolCallId = "call-dyn-2"

        yield* LanguageModel.streamText({
          prompt: [],
          toolkit: ApprovalToolkit
        }).pipe(
          Stream.runForEach((part) =>
            Effect.sync(() => {
              parts.push(part)
            })
          ),
          TestUtils.withLanguageModel({
            streamText: [
              {
                type: "tool-call",
                id: toolCallId,
                name: "DynamicApprovalTool",
                params: { dangerous: false }
              }
            ]
          }),
          Effect.provide(ApprovalToolkitLayer)
        )

        strictEqual(parts.length, 2)
        strictEqual(parts[0].type, "tool-call")
        strictEqual(parts[1].type, "tool-result")
        if (parts[1].type === "tool-result") {
          deepStrictEqual(parts[1].result, { result: "dynamic-result" })
        }
      }))

    it("tool without needsApproval executes normally", () =>
      Effect.gen(function*() {
        const parts: Array<Response.StreamPart<Toolkit.Tools<typeof MyToolkit>>> = []

        const toolCallId = "call-normal"
        const latch = yield* Effect.makeLatch()

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
                name: "MyTool",
                params: { testParam: "test" }
              }
            ]
          }),
          Effect.provide(MyToolkitLayer),
          Effect.forkScoped
        )

        yield* latch.await
        yield* TestClock.adjust("10 seconds")

        strictEqual(parts.length, 2)
        strictEqual(parts[0].type, "tool-call")
        strictEqual(parts[1].type, "tool-result")
        if (parts[1].type === "tool-result") {
          deepStrictEqual(parts[1].result, { testSuccess: "test-success" })
        }
      }))
  })
})
