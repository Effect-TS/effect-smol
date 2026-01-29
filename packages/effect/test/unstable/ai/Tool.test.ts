import { describe, it } from "@effect/vitest"
import { assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, Fiber, identity, Schema, Stream } from "effect"
import { TestClock } from "effect/testing"
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
            providerExecuted: false,
            preliminary: false
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
            providerExecuted: false,
            preliminary: false
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
            preliminary: false,
            result: AiError.make({
              module: "Toolkit",
              method: "FailureModeReturn.handle",
              reason
            }),
            encodedResult: {
              _tag: "AiError",
              module: "Toolkit",
              method: "FailureModeReturn.handle",
              reason: { _tag: "RateLimitError", metadata: {} }
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

    describe("Preliminary Results", () => {
      it.effect("should not have preliminary results when generateText is used", () =>
        Effect.gen(function*() {
          const toolkit = Toolkit.make(IncrementalTool)

          const toolCallId = "tool-123"
          const toolName = "IncrementalTool"
          const preliminaryResult = { status: "loading", progress: 50 } as const
          const terminalResult = { status: "complete" } as const

          const handlers = toolkit.toLayer({
            IncrementalTool: Effect.fnUntraced(function*(_, ctx) {
              yield* ctx.preliminary(preliminaryResult)
              return terminalResult
            })
          })

          const response = yield* LanguageModel.generateText({
            prompt: "Test",
            toolkit
          }).pipe(
            TestUtils.withLanguageModel({
              generateText: [{
                type: "tool-call",
                id: toolCallId,
                name: toolName,
                params: { input: "test" }
              }]
            }),
            Effect.provide(handlers)
          )

          const hasPreliminaryResults = response.content.some((part) => {
            return part.type === "tool-result" && part.preliminary === true
          })

          assertFalse(hasPreliminaryResults)
          deepStrictEqual(
            response.content[1],
            Response.toolResultPart({
              id: toolCallId,
              name: toolName,
              isFailure: false,
              result: terminalResult,
              encodedResult: terminalResult,
              providerExecuted: false,
              preliminary: false
            })
          )
        }))

      it.effect("should have preliminary results when streamText is used", () =>
        Effect.gen(function*() {
          const toolkit = Toolkit.make(IncrementalTool)

          const toolCallId = "tool-123"
          const toolName = "IncrementalTool"
          const preliminaryResult = { status: "loading", progress: 50 } as const
          const terminalResult = { status: "complete" } as const

          const handlers = toolkit.toLayer({
            IncrementalTool: Effect.fnUntraced(function*(_, ctx) {
              yield* ctx.preliminary(preliminaryResult)
              return terminalResult
            })
          })

          const response = yield* LanguageModel.streamText({
            prompt: "Test",
            toolkit
          }).pipe(
            Stream.runCollect,
            TestUtils.withLanguageModel({
              streamText: [{
                type: "tool-call",
                id: toolCallId,
                name: toolName,
                params: { input: "test" }
              }]
            }),
            Effect.provide(handlers)
          )

          deepStrictEqual(
            response[1],
            Response.toolResultPart({
              id: toolCallId,
              name: toolName,
              isFailure: false,
              result: preliminaryResult,
              encodedResult: preliminaryResult,
              providerExecuted: false,
              preliminary: true
            })
          )

          deepStrictEqual(
            response[2],
            Response.toolResultPart({
              id: toolCallId,
              name: toolName,
              isFailure: false,
              result: terminalResult,
              encodedResult: terminalResult,
              providerExecuted: false,
              preliminary: false
            })
          )
        }))

      it.effect("should handle multiple preliminary results in sequence", () =>
        Effect.gen(function*() {
          const toolkit = Toolkit.make(IncrementalTool)

          const toolCallId = "tool-123"
          const toolName = "IncrementalTool"

          const handlers = toolkit.toLayer({
            IncrementalTool: Effect.fnUntraced(function*(_, ctx) {
              yield* ctx.preliminary({ status: "loading", progress: 0 })
              yield* ctx.preliminary({ status: "processing", progress: 50 })
              yield* ctx.preliminary({ status: "finalizing", progress: 90 })
              return { status: "complete" }
            })
          })

          const response = yield* LanguageModel.streamText({
            prompt: "Test",
            toolkit
          }).pipe(
            Stream.runCollect,
            TestUtils.withLanguageModel({
              streamText: [{
                type: "tool-call",
                id: toolCallId,
                name: toolName,
                params: { input: "test" }
              }]
            }),
            Effect.provide(handlers)
          )

          const toolResults = response.filter((part) => part.type === "tool-result")

          // Should have 3 preliminary + 1 final = 4 results
          strictEqual(toolResults.length, 4)

          // Verify ordering and preliminary flags
          strictEqual(toolResults[0].preliminary, true)
          deepStrictEqual(toolResults[0].result, { status: "loading", progress: 0 })

          strictEqual(toolResults[1].preliminary, true)
          deepStrictEqual(toolResults[1].result, { status: "processing", progress: 50 })

          strictEqual(toolResults[2].preliminary, true)
          deepStrictEqual(toolResults[2].result, { status: "finalizing", progress: 90 })

          strictEqual(toolResults[3].preliminary, false)
          deepStrictEqual(toolResults[3].result, { status: "complete" })
        }))

      it.effect("should handle preliminary results for long-running tools", () =>
        Effect.gen(function*() {
          const toolkit = Toolkit.make(IncrementalTool)

          const toolCallId = "tool-123"
          const toolName = "IncrementalTool"

          const handlers = toolkit.toLayer({
            IncrementalTool: Effect.fnUntraced(function*(_, ctx) {
              yield* ctx.preliminary({ status: "loading", progress: 0 })
              yield* Effect.sleep("5 seconds")
              return { status: "complete" }
            })
          })

          const terminalLatch = yield* Effect.makeLatch()
          const assertions = { preliminary: false, terminal: false }

          const fiber = yield* LanguageModel.streamText({
            prompt: "Test",
            toolkit
          }).pipe(
            Stream.tap(Effect.fnUntraced(function*(part) {
              if (part.type === "tool-result") {
                if (!assertions.preliminary) {
                  yield* terminalLatch.open
                  strictEqual(part.preliminary, true)
                  deepStrictEqual(part.result, { status: "loading", progress: 0 })
                  assertions.preliminary = true
                } else {
                  strictEqual(part.preliminary, false)
                  deepStrictEqual(part.result, { status: "complete" })
                  assertions.terminal = true
                }
              }
            })),
            Stream.runCollect,
            TestUtils.withLanguageModel({
              streamText: [{
                type: "tool-call",
                id: toolCallId,
                name: toolName,
                params: { input: "test" }
              }]
            }),
            Effect.provide(handlers),
            Effect.forkScoped
          )

          yield* terminalLatch.await
          yield* TestClock.adjust("5 seconds")
          const response = yield* Fiber.join(fiber)

          assertTrue(Object.values(assertions).every(identity))

          // Should have 1 preliminary + 1 final = 2 results
          const toolResults = response.filter((part) => part.type === "tool-result")
          strictEqual(toolResults.length, 2)
        }))

      it.effect("should emit preliminary results before failure when handler fails", () =>
        Effect.gen(function*() {
          const toolkit = Toolkit.make(IncrementalToolWithFailure)

          const toolCallId = "tool-123"
          const toolName = "IncrementalToolWithFailure"

          const handlers = toolkit.toLayer({
            IncrementalToolWithFailure: Effect.fnUntraced(function*(_, ctx) {
              yield* ctx.preliminary({ status: "loading" })
              yield* ctx.preliminary({ status: "processing" })
              return yield* Effect.fail({ error: "Something went wrong" })
            })
          })

          const response = yield* LanguageModel.streamText({
            prompt: "Test",
            toolkit
          }).pipe(
            Stream.runCollect,
            TestUtils.withLanguageModel({
              streamText: [{
                type: "tool-call",
                id: toolCallId,
                name: toolName,
                params: { input: "test" }
              }]
            }),
            Effect.provide(handlers)
          )

          const toolResults = response.filter((part) => part.type === "tool-result")

          // Should have 2 preliminary + 1 final (failure) = 3 results
          strictEqual(toolResults.length, 3)

          // Preliminary results emitted before failure
          strictEqual(toolResults[0].preliminary, true)
          strictEqual(toolResults[0].isFailure, false)
          deepStrictEqual(toolResults[0].result, { status: "loading" })

          strictEqual(toolResults[1].preliminary, true)
          strictEqual(toolResults[1].isFailure, false)
          deepStrictEqual(toolResults[1].result, { status: "processing" })

          // Final result is the failure
          strictEqual(toolResults[2].preliminary, false)
          strictEqual(toolResults[2].isFailure, true)
          deepStrictEqual(toolResults[2].result, { error: "Something went wrong" })
        }))

      it.effect("should interleave results from concurrent tools with preliminary results", () =>
        Effect.gen(function*() {
          const toolkit = Toolkit.make(ConcurrentIncrementalTool)

          const handlers = toolkit.toLayer({
            ConcurrentIncrementalTool: Effect.fnUntraced(function*({ name, delay }, ctx) {
              yield* ctx.preliminary({ status: `loading`, job: name, progress: 50 })
              yield* Effect.sleep(delay)
              return { status: `complete`, job: name }
            })
          })

          const latch = yield* Effect.makeLatch()
          const toolResults: Array<Response.ToolResultParts<Toolkit.Tools<typeof toolkit>>> = []

          const fiber = yield* LanguageModel.streamText({
            prompt: "Test",
            toolkit
          }).pipe(
            Stream.tap(() => latch.open),
            Stream.tap((part) => {
              if (part.type === "tool-result") {
                return Effect.sync(() => toolResults.push(part))
              }
              return Effect.void
            }),
            Stream.runCollect,
            TestUtils.withLanguageModel({
              streamText: [
                {
                  type: "tool-call",
                  id: "tool-fast",
                  name: "ConcurrentIncrementalTool",
                  params: { name: "fast", delay: 1000 }
                },
                {
                  type: "tool-call",
                  id: "tool-slow",
                  name: "ConcurrentIncrementalTool",
                  params: { name: "slow", delay: 2000 }
                }
              ]
            }),
            Effect.provide(handlers),
            Effect.forkScoped
          )

          // Wait for stream to start (first item emitted)
          yield* latch.await

          // Give forked tool handlers time to emit preliminary results
          yield* Effect.yieldNow
          yield* Effect.yieldNow
          yield* Effect.yieldNow

          // Initially both preliminary results should be emitted immediately
          strictEqual(toolResults.length, 2)
          strictEqual(toolResults[0].preliminary, true)
          deepStrictEqual(toolResults[0].result, { status: "loading", job: "fast", progress: 50 })
          strictEqual(toolResults[1].preliminary, true)
          deepStrictEqual(toolResults[1].result, { status: "loading", job: "slow", progress: 50 })

          // After 1 second, fast tool completes
          yield* TestClock.adjust("1 second")
          yield* Effect.yieldNow
          strictEqual(toolResults.length, 3)
          strictEqual(toolResults[2].preliminary, false)
          deepStrictEqual(toolResults[2].result, { status: "complete", job: "fast" })

          // After 2 more seconds (3 total), slow tool completes
          yield* TestClock.adjust("2 seconds")
          yield* Effect.yieldNow
          yield* Fiber.join(fiber)

          strictEqual(toolResults.length, 4)
          strictEqual(toolResults[3].preliminary, false)
          deepStrictEqual(toolResults[3].result, { status: "complete", job: "slow" })
        }))
    })
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
            providerExecuted: true,
            preliminary: false
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
            providerExecuted: true,
            preliminary: false
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
            providerExecuted: false,
            preliminary: false
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
            providerExecuted: false,
            preliminary: false
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

const IncrementalTool = Tool.make("IncrementalTool", {
  description: "A test tool",
  parameters: { input: Schema.String },
  success: Schema.Union([
    Schema.Struct({ status: Schema.Literal("loading"), progress: Schema.Number }),
    Schema.Struct({ status: Schema.Literal("processing"), progress: Schema.Number }),
    Schema.Struct({ status: Schema.Literal("finalizing"), progress: Schema.Number }),
    Schema.Struct({ status: Schema.Literal("complete") })
  ])
})

const ConcurrentIncrementalTool = Tool.make("ConcurrentIncrementalTool", {
  description: "A test tool",
  parameters: { name: Schema.String, delay: Schema.DurationFromMillis },
  success: Schema.Union([
    Schema.Struct({ status: Schema.Literal("loading"), job: Schema.String, progress: Schema.Number }),
    Schema.Struct({ status: Schema.Literal("complete"), job: Schema.String })
  ])
})

const IncrementalToolWithFailure = Tool.make("IncrementalToolWithFailure", {
  description: "A test tool",
  failureMode: "return",
  parameters: { input: Schema.String },
  success: Schema.Struct({
    status: Schema.String,
    progress: Schema.optional(Schema.Number)
  }),
  failure: Schema.Struct({
    error: Schema.String
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
