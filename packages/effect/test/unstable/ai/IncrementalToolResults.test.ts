import { assert, describe, it } from "@effect/vitest"
import { Effect, Queue, Schema, Stream } from "effect"
import { TestClock } from "effect/testing"
import type { Toolkit } from "effect/unstable/ai"
import { LanguageModel, type Response, Tool, Toolkit as ToolkitNs } from "effect/unstable/ai"
import * as TestUtils from "./utils.ts"

// Tool that supports incremental results
const IncrementalTool = Tool.make("IncrementalTool", {
  parameters: { input: Schema.String },
  success: Schema.Struct({
    status: Schema.String,
    progress: Schema.optional(Schema.Number)
  })
})

// Tool with failure mode "return" for testing preliminary + failure
const IncrementalToolWithFailure = Tool.make("IncrementalToolWithFailure", {
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

// Helper to offer to the preliminary results queue
// The queue is typed as Enqueue but is actually a Queue underneath
const offerPreliminary = <A, E>(
  context: Toolkit.HandlerContext<Tool.Any>,
  value: A
): Effect.Effect<boolean> => Queue.offer(context.preliminaryResults as Queue.Queue<A, E>, value)

describe("Incremental Tool Results", () => {
  describe("Toolkit.handle", () => {
    it.effect("emits preliminary results from queue with preliminary: true", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalTool)
        const handlers = toolkit.toLayer({
          IncrementalTool: (_params, ctx) =>
            Effect.gen(function*() {
              Queue.offer(ctx.preliminaryResults, { status: "loading" })
              return { status: "complete", progress: 100 }
            })
        })

        const withHandler = yield* toolkit.pipe(Effect.provide(handlers))
        const resultStream = yield* withHandler.handle("IncrementalTool", { input: "test" })
        const results = yield* Stream.runCollect(resultStream)

        assert.strictEqual(results.length, 2)

        // First result is preliminary
        assert.strictEqual(results[0].preliminary, true)
        assert.strictEqual(results[0].isFailure, false)
        assert.deepStrictEqual(results[0].result, { status: "loading" })

        // Second result is final
        assert.strictEqual(results[1].preliminary, false)
        assert.strictEqual(results[1].isFailure, false)
        assert.deepStrictEqual(results[1].result, { status: "complete", progress: 100 })
      }))

    it.effect("emits final result with preliminary: false when no preliminary results", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalTool)
        const handlers = toolkit.toLayer({
          IncrementalTool: () => Effect.succeed({ status: "complete", progress: 100 })
        })

        const withHandler = yield* toolkit.pipe(Effect.provide(handlers))
        const resultStream = yield* withHandler.handle("IncrementalTool", { input: "test" })
        const results = yield* Stream.runCollect(resultStream)

        assert.strictEqual(results.length, 1)
        assert.strictEqual(results[0].preliminary, false)
        assert.strictEqual(results[0].isFailure, false)
        assert.deepStrictEqual(results[0].result, { status: "complete", progress: 100 })
      }))

    it.effect("handles multiple preliminary results in sequence", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalTool)
        const handlers = toolkit.toLayer({
          IncrementalTool: (_params, context) =>
            Effect.gen(function*() {
              yield* offerPreliminary(context, { status: "loading", progress: 0 })
              yield* offerPreliminary(context, { status: "processing", progress: 50 })
              yield* offerPreliminary(context, { status: "finalizing", progress: 90 })
              return { status: "complete", progress: 100 }
            })
        })

        const withHandler = yield* toolkit.pipe(Effect.provide(handlers))
        const resultStream = yield* withHandler.handle("IncrementalTool", { input: "test" })
        const results = yield* Stream.runCollect(resultStream)

        assert.strictEqual(results.length, 4)

        // All preliminary results
        assert.strictEqual(results[0].preliminary, true)
        assert.deepStrictEqual(results[0].result, { status: "loading", progress: 0 })

        assert.strictEqual(results[1].preliminary, true)
        assert.deepStrictEqual(results[1].result, { status: "processing", progress: 50 })

        assert.strictEqual(results[2].preliminary, true)
        assert.deepStrictEqual(results[2].result, { status: "finalizing", progress: 90 })

        // Final result
        assert.strictEqual(results[3].preliminary, false)
        assert.deepStrictEqual(results[3].result, { status: "complete", progress: 100 })
      }))

    it.effect("preliminary results always have isFailure: false", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalToolWithFailure)
        const handlers = toolkit.toLayer({
          IncrementalToolWithFailure: (_params, context) =>
            Effect.gen(function*() {
              yield* offerPreliminary(context, { status: "loading" })
              yield* offerPreliminary(context, { status: "processing" })
              return { status: "complete", progress: 100 }
            })
        })

        const withHandler = yield* toolkit.pipe(Effect.provide(handlers))
        const resultStream = yield* withHandler.handle("IncrementalToolWithFailure", { input: "test" })
        const results = yield* Stream.runCollect(resultStream)

        // All preliminary results have isFailure: false
        for (const result of results.slice(0, -1)) {
          assert.strictEqual(result.preliminary, true)
          assert.strictEqual(result.isFailure, false)
        }

        // Final result also has isFailure: false (success case)
        const final = results[results.length - 1]
        assert.strictEqual(final.preliminary, false)
        assert.strictEqual(final.isFailure, false)
      }))

    it.effect("handles failure after preliminary results emitted", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalToolWithFailure)
        const handlers = toolkit.toLayer({
          IncrementalToolWithFailure: (_params, context) =>
            Effect.gen(function*() {
              yield* offerPreliminary(context, { status: "loading" })
              yield* offerPreliminary(context, { status: "processing" })
              return yield* Effect.fail({ error: "Something went wrong" })
            })
        })

        const withHandler = yield* toolkit.pipe(Effect.provide(handlers))
        const resultStream = yield* withHandler.handle("IncrementalToolWithFailure", { input: "test" })
        const results = yield* Stream.runCollect(resultStream)

        assert.strictEqual(results.length, 3)

        // Preliminary results emitted before failure
        assert.strictEqual(results[0].preliminary, true)
        assert.strictEqual(results[0].isFailure, false)
        assert.deepStrictEqual(results[0].result, { status: "loading" })

        assert.strictEqual(results[1].preliminary, true)
        assert.strictEqual(results[1].isFailure, false)
        assert.deepStrictEqual(results[1].result, { status: "processing" })

        // Final result is the failure
        assert.strictEqual(results[2].preliminary, false)
        assert.strictEqual(results[2].isFailure, true)
        assert.deepStrictEqual(results[2].result, { error: "Something went wrong" })
      }))
  })

  describe("generateText", () => {
    it.effect("filters out preliminary results from final response", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalTool)
        const handlers = toolkit.toLayer({
          IncrementalTool: (_params, context) =>
            Effect.gen(function*() {
              yield* offerPreliminary(context, { status: "loading" })
              yield* offerPreliminary(context, { status: "processing" })
              return { status: "complete", progress: 100 }
            })
        })

        const toolCallId = "tool-123"

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [{
              type: "tool-call",
              id: toolCallId,
              name: "IncrementalTool",
              params: { input: "test" }
            }]
          }),
          Effect.provide(handlers)
        )

        // Only final result should be in toolResults
        assert.strictEqual(response.toolResults.length, 1)
        assert.strictEqual(response.toolResults[0].preliminary, false)
        assert.deepStrictEqual(response.toolResults[0].result, { status: "complete", progress: 100 })
      }))

    it.effect("only final tool results appear in response.toolResults", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalTool)
        const handlers = toolkit.toLayer({
          IncrementalTool: (_params, context) =>
            Effect.gen(function*() {
              // Emit many preliminary results
              for (let i = 0; i < 5; i++) {
                yield* offerPreliminary(context, { status: `step-${i}`, progress: i * 20 })
              }
              return { status: "complete", progress: 100 }
            })
        })

        const response = yield* LanguageModel.generateText({
          prompt: "Test",
          toolkit
        }).pipe(
          TestUtils.withLanguageModel({
            generateText: [{
              type: "tool-call",
              id: "tool-123",
              name: "IncrementalTool",
              params: { input: "test" }
            }]
          }),
          Effect.provide(handlers)
        )

        // Despite 5 preliminary results, only 1 final result in response
        assert.strictEqual(response.toolResults.length, 1)

        const result = response.toolResults[0]
        assert.strictEqual(result.preliminary, false)
        assert.strictEqual(result.isFailure, false)
        assert.deepStrictEqual(result.result, { status: "complete", progress: 100 })
      }))
  })

  describe("streamText", () => {
    it.effect("emits preliminary results with preliminary: true", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalTool)
        const handlers = toolkit.toLayer({
          IncrementalTool: (_params, context) =>
            Effect.gen(function*() {
              yield* offerPreliminary(context, { status: "loading" })
              yield* Effect.sleep("1 second")
              yield* offerPreliminary(context, { status: "processing" })
              yield* Effect.sleep("1 second")
              return { status: "complete", progress: 100 }
            })
        })

        const parts: Array<Response.StreamPart<ToolkitNs.Tools<typeof toolkit>>> = []
        const latch = yield* Effect.makeLatch()

        yield* LanguageModel.streamText({
          prompt: "Test",
          toolkit
        }).pipe(
          Stream.runForEach((part) =>
            Effect.andThen(latch.open, () => {
              parts.push(part)
            })
          ),
          TestUtils.withLanguageModel({
            streamText: [{
              type: "tool-call",
              id: "tool-123",
              name: "IncrementalTool",
              params: { input: "test" }
            }]
          }),
          Effect.provide(handlers),
          Effect.forkScoped
        )

        // Wait for tool-call to be emitted
        yield* latch.await

        // Tool call emitted immediately
        assert.strictEqual(parts.length, 1)
        assert.strictEqual(parts[0].type, "tool-call")

        // First preliminary result after handler starts
        yield* TestClock.adjust("0 seconds")
        const preliminaryParts1 = parts.filter(
          (p) => p.type === "tool-result" && p.preliminary === true
        )
        assert.strictEqual(preliminaryParts1.length, 1)

        // Second preliminary result after 1 second
        yield* TestClock.adjust("1 second")
        const preliminaryParts2 = parts.filter(
          (p) => p.type === "tool-result" && p.preliminary === true
        )
        assert.strictEqual(preliminaryParts2.length, 2)

        // Final result after another second
        yield* TestClock.adjust("1 second")
        const finalParts = parts.filter(
          (p) => p.type === "tool-result" && p.preliminary === false
        )
        assert.strictEqual(finalParts.length, 1)
      }))

    it.effect("emits final result with preliminary: false", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalTool)
        const handlers = toolkit.toLayer({
          IncrementalTool: (_params, context) =>
            Effect.gen(function*() {
              yield* offerPreliminary(context, { status: "loading" })
              return { status: "complete", progress: 100 }
            })
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "Test",
          toolkit
        }).pipe(
          Stream.runCollect,
          TestUtils.withLanguageModel({
            streamText: [{
              type: "tool-call",
              id: "tool-123",
              name: "IncrementalTool",
              params: { input: "test" }
            }]
          }),
          Effect.provide(handlers)
        )

        const toolResults = parts.filter((p) => p.type === "tool-result")
        assert.strictEqual(toolResults.length, 2)

        // Preliminary
        assert.strictEqual(toolResults[0].preliminary, true)

        // Final
        assert.strictEqual(toolResults[1].preliminary, false)
        assert.deepStrictEqual(toolResults[1].result, { status: "complete", progress: 100 })
      }))

    it.effect("preserves ordering within single tool", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalTool)
        const handlers = toolkit.toLayer({
          IncrementalTool: (_params, context) =>
            Effect.gen(function*() {
              yield* offerPreliminary(context, { status: "step-1", progress: 25 })
              yield* offerPreliminary(context, { status: "step-2", progress: 50 })
              yield* offerPreliminary(context, { status: "step-3", progress: 75 })
              return { status: "complete", progress: 100 }
            })
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "Test",
          toolkit
        }).pipe(
          Stream.runCollect,
          TestUtils.withLanguageModel({
            streamText: [{
              type: "tool-call",
              id: "tool-123",
              name: "IncrementalTool",
              params: { input: "test" }
            }]
          }),
          Effect.provide(handlers)
        )

        const toolResults = parts.filter((p) => p.type === "tool-result")

        // Verify ordering: step-1, step-2, step-3, complete
        assert.strictEqual(toolResults.length, 4)
        assert.deepStrictEqual(toolResults[0].result, { status: "step-1", progress: 25 })
        assert.deepStrictEqual(toolResults[1].result, { status: "step-2", progress: 50 })
        assert.deepStrictEqual(toolResults[2].result, { status: "step-3", progress: 75 })
        assert.deepStrictEqual(toolResults[3].result, { status: "complete", progress: 100 })

        // First 3 are preliminary, last is final
        assert.strictEqual(toolResults[0].preliminary, true)
        assert.strictEqual(toolResults[1].preliminary, true)
        assert.strictEqual(toolResults[2].preliminary, true)
        assert.strictEqual(toolResults[3].preliminary, false)
      }))

    it.effect("interleaves results from concurrent tools", () =>
      Effect.gen(function*() {
        const toolkit = ToolkitNs.make(IncrementalTool)
        const handlers = toolkit.toLayer({
          IncrementalTool: ({ input }, context) =>
            Effect.gen(function*() {
              // Different delays based on input to create interleaving
              const delay = input === "fast" ? "100 millis" : "200 millis"
              yield* offerPreliminary(context, { status: `${input}-loading` })
              yield* Effect.sleep(delay)
              return { status: `${input}-complete`, progress: 100 }
            })
        })

        const parts: Array<Response.StreamPart<ToolkitNs.Tools<typeof toolkit>>> = []
        const latch = yield* Effect.makeLatch()

        yield* LanguageModel.streamText({
          prompt: "Test",
          toolkit
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
                id: "tool-fast",
                name: "IncrementalTool",
                params: { input: "fast" }
              },
              {
                type: "tool-call",
                id: "tool-slow",
                name: "IncrementalTool",
                params: { input: "slow" }
              }
            ]
          }),
          Effect.provide(handlers),
          Effect.forkScoped
        )

        yield* latch.await

        // Both tool calls emitted
        const toolCalls = parts.filter((p) => p.type === "tool-call")
        assert.strictEqual(toolCalls.length, 2)

        // Both preliminary results emitted immediately (before any delays)
        yield* TestClock.adjust("0 seconds")
        const preliminaryParts = parts.filter(
          (p) => p.type === "tool-result" && p.preliminary === true
        )
        assert.strictEqual(preliminaryParts.length, 2)

        // Fast tool completes first (100ms)
        yield* TestClock.adjust("100 millis")
        const fastComplete = parts.filter(
          (p) =>
            p.type === "tool-result" &&
            p.preliminary === false &&
            (p.result as { status: string }).status === "fast-complete"
        )
        assert.strictEqual(fastComplete.length, 1)

        // Slow tool completes later (200ms total)
        yield* TestClock.adjust("100 millis")
        const slowComplete = parts.filter(
          (p) =>
            p.type === "tool-result" &&
            p.preliminary === false &&
            (p.result as { status: string }).status === "slow-complete"
        )
        assert.strictEqual(slowComplete.length, 1)
      }))
  })
})
