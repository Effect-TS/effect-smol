import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Effect, Schema } from "effect"
import { AiError, LanguageModel, Response, Tool, Toolkit } from "effect/unstable/ai"
import * as TestUtils from "./utils.ts"

describe("Tool", () => {
  describe("User Defined", () => {
    it.effect("should return tool call handler successes", () =>
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

        deepStrictEqual(response.toolResults, [
          Response.makePart("tool-result", {
            id: toolCallId,
            isFailure: false,
            name: toolName,
            result: toolResult,
            encodedResult: toolResult,
            providerExecuted: false
          })
        ])
      }))

    it.effect("should return tool call handler failures when failure mode is return", () =>
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

        deepStrictEqual(response.toolResults, [
          Response.makePart("tool-result", {
            id: toolCallId,
            name: toolName,
            isFailure: true,
            result: toolResult,
            encodedResult: toolResult,
            providerExecuted: false
          })
        ])
      }))

    it.effect("should raise an error on tool call handler failures when failure mode is error", () =>
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

        deepStrictEqual(response, toolResult)
      }))

    it.effect("should raise an error when tool call parameters are invalid", () =>
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

        deepStrictEqual(
          response,
          AiError.make({
            module: "Toolkit",
            method: "FailureModeReturn.handle",
            reason: new AiError.ToolParameterValidationError({
              toolName: "FailureModeReturn",
              toolParams: {},
              description: `Missing key\n  at ["testParam"]`
            })
          })
        )
      }))

    it.effect("should return AiError when user returns an AiErrorReason when failure mode is return", () =>
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

        deepStrictEqual(response.toolResults, [
          Response.toolResultPart({
            id: toolCallId,
            name: toolName,
            isFailure: true,
            providerExecuted: false,
            result: AiError.make({
              module: "Toolkit",
              method: "FailureModeReturn.handle",
              reason
            }),
            encodedResult: {
              _tag: "AiError",
              module: "Toolkit",
              method: "FailureModeReturn.handle",
              reason: { _tag: "RateLimitError" }
            }
          })
        ])
      }))

    it.effect("should raise an AiError when user returns an AiErrorReason when failure mode is error", () =>
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

        deepStrictEqual(
          response,
          AiError.make({
            module: "Toolkit",
            method: "FailureModeError.handle",
            reason
          })
        )
      }))
  })

  describe("Provider Defined", () => {
    it.effect("should return tool call successes from the model", () =>
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

        deepStrictEqual(response.toolResults, [
          Response.makePart("tool-result", {
            id: toolCallId,
            name: tool.name,
            isFailure: false,
            result: toolResult,
            encodedResult: toolResult,
            providerExecuted: true
          })
        ])
      }))

    it.effect("should return tool call failures from the model", () =>
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

        deepStrictEqual(response.toolResults, [
          Response.makePart("tool-result", {
            id: toolCallId,
            name: tool.name,
            isFailure: true,
            result: toolResult,
            encodedResult: toolResult,
            providerExecuted: true
          })
        ])
      }))

    it.effect("should return tool call handler successes", () =>
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

        deepStrictEqual(response.toolResults, [
          Response.makePart("tool-result", {
            id: toolCallId,
            name: tool.name,
            isFailure: false,
            result: toolResult,
            encodedResult: toolResult,
            providerExecuted: false
          })
        ])
      }))

    it.effect("should return tool call handler failures when failure mode is return", () =>
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

        deepStrictEqual(response.toolResults, [
          Response.makePart("tool-result", {
            id: toolCallId,
            name: tool.name,
            isFailure: true,
            result: toolResult,
            encodedResult: toolResult,
            providerExecuted: false
          })
        ])
      }))

    it.effect("should raise an error on tool call handler failures when failure mode is error", () =>
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

        deepStrictEqual(response, toolResult)
      }))

    it.effect("should raise an error when tool call parameters are invalid", () =>
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

        deepStrictEqual(
          response,
          AiError.make({
            module: "Toolkit",
            method: "HandlerRequired.handle",
            reason: new AiError.ToolParameterValidationError({
              toolName: "HandlerRequired",
              toolParams: {},
              description: `Missing key\n  at ["testParam"]`
            })
          })
        )
      }))
  })
})

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
