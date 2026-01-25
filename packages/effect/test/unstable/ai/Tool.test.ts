import { assert, describe, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { AiError, LanguageModel, Response, Tool, Toolkit } from "effect/unstable/ai"
import * as TestUtils from "./utils.ts"

const FailureModeError = Tool.make("FailureModeError", {
  description: "A test tool",
  parameters: {
    testParam: Schema.String
  },
  success: Schema.Struct({
    testSuccess: Schema.String
  }),
  failure: Schema.Struct({
    testFailure: Schema.String
  })
})

const FailureModeReturn = Tool.make("FailureModeReturn", {
  description: "A test tool",
  failureMode: "return",
  parameters: {
    testParam: Schema.String
  },
  success: Schema.Struct({
    testSuccess: Schema.String
  }),
  failure: Schema.Struct({
    testFailure: Schema.String
  })
})

const NoHandlerRequired = Tool.providerDefined({
  customName: "NoHandlerRequired",
  providerName: "no_handler_required",
  args: {
    testArg: Schema.String
  },
  parameters: {
    testParam: Schema.String
  },
  success: Schema.Struct({
    testSuccess: Schema.String
  }),
  failure: Schema.Struct({
    testFailure: Schema.String
  })
})

const HandlerRequired = Tool.providerDefined({
  customName: "HandlerRequired",
  providerName: "handler_required",
  requiresHandler: true,
  args: {
    testArg: Schema.String
  },
  parameters: {
    testParam: Schema.String
  },
  success: Schema.Struct({
    testSuccess: Schema.String
  }),
  failure: Schema.Struct({
    testFailure: Schema.String
  })
})

describe("Tool", () => {
  describe("User Defined", () => {
    it.effect("should return tool call handler success as a Right", () =>
      Effect.gen(function*() {
        const toolkit = Toolkit.make(FailureModeReturn)

        const toolResult = { testSuccess: "failure-mode-return-tool" }
        const handlers = toolkit.toLayer({
          FailureModeReturn: () => Effect.succeed(toolResult)
        })

        const toolCallId = "tool-123"
        const toolName = "FailureModeReturn"

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [{
              type: "tool-call",
              id: toolCallId,
              name: toolName,
              params: { testParam: "test-param" }
            }]
          }),
          Effect.provide(handlers)
        )

        const expected = Response.makePart("tool-result", {
          id: toolCallId,
          isFailure: false,
          name: toolName,
          result: toolResult,
          encodedResult: toolResult,
          providerExecuted: false
        })

        assert.deepInclude(response.toolResults, expected)
      }))

    it.effect("should return tool call handler failure as a Left", () =>
      Effect.gen(function*() {
        const toolkit = Toolkit.make(FailureModeReturn)

        const toolResult = { testFailure: "failure-mode-return-tool" }
        const handlers = toolkit.toLayer({
          FailureModeReturn: () => Effect.fail(toolResult)
        })

        const toolCallId = "tool-123"
        const toolName = "FailureModeReturn"

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [{
              type: "tool-call",
              id: toolCallId,
              name: toolName,
              params: { testParam: "test-param" }
            }]
          }),
          Effect.provide(handlers)
        )

        const expected = Response.makePart("tool-result", {
          id: toolCallId,
          name: toolName,
          isFailure: true,
          result: toolResult,
          encodedResult: toolResult,
          providerExecuted: false
        })

        assert.deepInclude(response.toolResults, expected)
      }))

    it.effect("should raise an error on tool call handler failure", () =>
      Effect.gen(function*() {
        const toolkit = Toolkit.make(FailureModeError)

        const toolResult = { testFailure: "failure-mode-error-tool" }
        const handlers = toolkit.toLayer({
          FailureModeError: () => Effect.fail(toolResult)
        })

        const toolCallId = "tool-123"
        const toolName = "FailureModeError"

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [{
              type: "tool-call",
              id: toolCallId,
              name: toolName,
              params: { testParam: "test-param" }
            }]
          }),
          Effect.provide(handlers),
          Effect.flip
        )

        assert.deepStrictEqual(response, toolResult)
      }))

    it.effect("should raise an error on invalid tool call parameters", () =>
      Effect.gen(function*() {
        const toolkit = Toolkit.make(FailureModeReturn)

        const toolResult = { testSuccess: "failure-mode-return-tool" }
        const handlers = toolkit.toLayer({
          FailureModeReturn: () => Effect.succeed(toolResult)
        })

        const toolCallId = "tool-123"
        const toolName = "FailureModeReturn"

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [{
              type: "tool-call",
              id: toolCallId,
              name: toolName,
              params: {}
            }]
          }),
          Effect.provide(handlers),
          Effect.flip
        )

        assert.strictEqual(response._tag, "AiError")
        if (response._tag === "AiError") {
          assert.strictEqual(response.reason._tag, "ToolParameterValidationError")
          if (response.reason._tag === "ToolParameterValidationError") {
            assert.strictEqual(response.reason.toolName, "FailureModeReturn")
          }
        }
      }))

    it.effect("should return AiError as tool result when failureMode is 'return'", () =>
      Effect.gen(function*() {
        const toolkit = Toolkit.make(FailureModeReturn)

        const aiError = AiError.make({
          module: "Test",
          method: "testHandler",
          reason: new AiError.RateLimitError({})
        })
        const handlers = toolkit.toLayer({
          FailureModeReturn: () => Effect.fail(aiError)
        })

        const toolCallId = "tool-123"
        const toolName = "FailureModeReturn"

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [{
              type: "tool-call",
              id: toolCallId,
              name: toolName,
              params: { testParam: "test-param" }
            }]
          }),
          Effect.provide(handlers)
        )

        const toolResult = response.toolResults[0]
        assert.strictEqual(toolResult?.isFailure, true)
        assert.strictEqual(AiError.isAiError(toolResult?.result), true)
      }))

    it.effect("should return wrapped AiErrorReason as tool result when failureMode is 'return'", () =>
      Effect.gen(function*() {
        const toolkit = Toolkit.make(FailureModeReturn)

        const reason = new AiError.RateLimitError({})
        const handlers = toolkit.toLayer({
          FailureModeReturn: () => Effect.fail(reason)
        })

        const toolCallId = "tool-123"
        const toolName = "FailureModeReturn"

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [{
              type: "tool-call",
              id: toolCallId,
              name: toolName,
              params: { testParam: "test-param" }
            }]
          }),
          Effect.provide(handlers)
        )

        const toolResult = response.toolResults[0]
        assert.strictEqual(toolResult?.isFailure, true)
        assert.strictEqual(AiError.isAiError(toolResult?.result), true)
        if (AiError.isAiError(toolResult?.result)) {
          assert.strictEqual(toolResult.result.reason._tag, "RateLimitError")
        }
      }))

    it.effect("should raise AiError when failureMode is 'error'", () =>
      Effect.gen(function*() {
        const toolkit = Toolkit.make(FailureModeError)

        const aiError = AiError.make({
          module: "Test",
          method: "testHandler",
          reason: new AiError.RateLimitError({})
        })
        const handlers = toolkit.toLayer({
          FailureModeError: () => Effect.fail(aiError)
        })

        const toolCallId = "tool-123"
        const toolName = "FailureModeError"

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [{
              type: "tool-call",
              id: toolCallId,
              name: toolName,
              params: { testParam: "test-param" }
            }]
          }),
          Effect.provide(handlers),
          Effect.flip
        )

        assert.strictEqual(AiError.isAiError(response), true)
        if (AiError.isAiError(response)) {
          assert.strictEqual(response.reason._tag, "RateLimitError")
        }
      }))

    it.effect("should wrap and raise AiErrorReason when failureMode is 'error'", () =>
      Effect.gen(function*() {
        const toolkit = Toolkit.make(FailureModeError)

        const reason = new AiError.RateLimitError({})
        const handlers = toolkit.toLayer({
          FailureModeError: () => Effect.fail(reason)
        })

        const toolCallId = "tool-123"
        const toolName = "FailureModeError"

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [{
              type: "tool-call",
              id: toolCallId,
              name: toolName,
              params: { testParam: "test-param" }
            }]
          }),
          Effect.provide(handlers),
          Effect.flip
        )

        assert.strictEqual(AiError.isAiError(response), true)
        if (AiError.isAiError(response)) {
          assert.strictEqual(response.reason._tag, "RateLimitError")
        }
      }))
  })

  describe("Provider Defined", () => {
    it.effect("should return tool call successes from the model as a Right", () =>
      Effect.gen(function*() {
        const tool = NoHandlerRequired({
          testArg: "test-arg"
        })
        const toolkit = Toolkit.make(tool)

        const toolCallId = "tool-123"
        const toolResult = { testSuccess: "provider-defined-tool" }

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [
              {
                type: "tool-call",
                id: toolCallId,
                name: tool.name,
                providerExecuted: true,
                params: { testParam: "test-param" }
              },
              {
                type: "tool-result",
                id: toolCallId,
                name: tool.name,
                isFailure: false,
                result: toolResult,
                providerExecuted: true
              }
            ]
          })
        )

        const expected = Response.makePart("tool-result", {
          id: toolCallId,
          name: tool.name,
          isFailure: false,
          result: toolResult,
          encodedResult: toolResult,
          providerExecuted: true
        })

        assert.deepInclude(response.toolResults, expected)
      }))

    it.effect("should return tool call errors from the model as a Left", () =>
      Effect.gen(function*() {
        const tool = NoHandlerRequired({
          testArg: "test-arg"
        })
        const toolkit = Toolkit.make(tool)

        const toolCallId = "tool-123"
        const toolResult = { testFailure: "provider-defined-tool" }

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [
              {
                type: "tool-call",
                id: toolCallId,
                name: tool.name,
                providerExecuted: true,
                params: { testParam: "test-param" }
              },
              {
                type: "tool-result",
                id: toolCallId,
                isFailure: true,
                name: tool.name,
                result: toolResult,
                providerExecuted: true
              }
            ]
          })
        )

        const expected = Response.makePart("tool-result", {
          id: toolCallId,
          name: tool.name,
          isFailure: true,
          result: toolResult,
          encodedResult: toolResult,
          providerExecuted: true
        })

        assert.deepInclude(response.toolResults, expected)
      }))

    it.effect("should return tool call handler success as a Right", () =>
      Effect.gen(function*() {
        const tool = HandlerRequired({
          testArg: "test-arg"
        })

        const toolCallId = "tool-123"
        const toolResult = { testSuccess: "provider-defined-tool" }

        const toolkit = Toolkit.make(tool)
        const handlers = toolkit.toLayer({
          HandlerRequired: () => Effect.succeed(toolResult)
        })

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [
              {
                type: "tool-call",
                id: toolCallId,
                name: tool.name,
                // Given this provider-defined tool requires a user-space
                // handler, it is not considered `providerExecuted`
                providerExecuted: false,
                params: { testParam: "test-param" }
              }
            ]
          }),
          Effect.provide(handlers)
        )

        const expected = Response.makePart("tool-result", {
          id: toolCallId,
          name: tool.name,
          isFailure: false,
          result: toolResult,
          encodedResult: toolResult,
          providerExecuted: false
        })

        assert.deepInclude(response.toolResults, expected)
      }))

    it.effect("should return tool call handler failure as a Left", () =>
      Effect.gen(function*() {
        const tool = HandlerRequired({
          failureMode: "return",
          testArg: "test-arg"
        })

        const toolCallId = "tool-123"
        const toolResult = { testFailure: "provider-defined-tool" }

        const toolkit = Toolkit.make(tool)
        const handlers = toolkit.toLayer({
          HandlerRequired: () => Effect.fail(toolResult)
        })

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [
              {
                type: "tool-call",
                id: toolCallId,
                name: tool.name,
                // Given this provider-defined tool requires a user-space
                // handler, it is not considered `providerExecuted`
                providerExecuted: false,
                params: { testParam: "test-param" }
              }
            ]
          }),
          Effect.provide(handlers)
        )

        const expected = Response.makePart("tool-result", {
          id: toolCallId,
          name: tool.name,
          isFailure: true,
          result: toolResult,
          encodedResult: toolResult,
          providerExecuted: false
        })

        assert.deepInclude(response.toolResults, expected)
      }))

    it.effect("should raise an error on tool call handler failure", () =>
      Effect.gen(function*() {
        const tool = HandlerRequired({
          testArg: "test-arg"
        })

        const toolCallId = "tool-123"
        const toolResult = { testFailure: "provider-defined-tool" }

        const toolkit = Toolkit.make(tool)
        const handlers = toolkit.toLayer({
          HandlerRequired: () => Effect.fail(toolResult)
        })

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [
              {
                type: "tool-call",
                id: toolCallId,
                name: tool.name,
                // Given this provider-defined tool requires a user-space
                // handler, it is not considered `providerExecuted`
                providerExecuted: false,
                params: { testParam: "test-param" }
              }
            ]
          }),
          Effect.provide(handlers),
          Effect.flip
        )

        assert.deepStrictEqual(response, toolResult)
      }))

    it.effect("should raise an error on invalid tool call parameters", () =>
      Effect.gen(function*() {
        const tool = HandlerRequired({
          failureMode: "return",
          testArg: "test-arg"
        })

        const toolCallId = "tool-123"
        const toolResult = { testSuccess: "provider-defined-tool" }

        const toolkit = Toolkit.make(tool)
        const handlers = toolkit.toLayer({
          HandlerRequired: () => Effect.succeed(toolResult)
        })

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [
              {
                type: "tool-call",
                id: toolCallId,
                name: tool.name,
                // Given this provider-defined tool requires a user-space
                // handler, it is not considered `providerExecuted`
                providerExecuted: false,
                params: {}
              }
            ]
          }),
          Effect.provide(handlers),
          Effect.flip
        )

        assert.strictEqual(response._tag, "AiError")
        if (response._tag === "AiError") {
          assert.strictEqual(response.reason._tag, "ToolParameterValidationError")
          if (response.reason._tag === "ToolParameterValidationError") {
            assert.strictEqual(response.reason.toolName, "HandlerRequired")
          }
        }
      }))
  })
})
