import { AmazonBedrockClient, AmazonBedrockLanguageModel } from "@effect/ai-amazon-bedrock"
import { assert, describe, it } from "@effect/vitest"
import { EventStreamCodec } from "@smithy/eventstream-codec"
import { fromUtf8, toUtf8 } from "@smithy/util-utf8"
import { Effect, Layer, Redacted, Schema, Stream } from "effect"
import { LanguageModel, Tool, Toolkit } from "effect/unstable/ai"
import { HttpClient, type HttpClientError, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"

describe("AmazonBedrockLanguageModel", () => {
  describe("generateText", () => {
    it.effect("parses a simple text response", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) =>
          Effect.succeed(jsonResponse(request, {
            output: {
              message: {
                role: "assistant",
                content: [{ text: "Hello!" }]
              }
            },
            metrics: { latencyMs: 100 },
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            stopReason: "end_turn"
          }))
        )

        const result = yield* LanguageModel.generateText({
          prompt: "Say hello"
        }).pipe(
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const textPart = result.content.find((part) => part.type === "text")
        assert.isDefined(textPart)
        if (textPart?.type !== "text") return
        assert.strictEqual(textPart.text, "Hello!")

        const finishPart = result.content.find((part) => part.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.reason, "stop")
      }))

    it.effect("parses a tool call response", () =>
      Effect.gen(function*() {
        const toolParams = { pattern: "*.ts" }

        const layer = makeTestLayer((request) =>
          Effect.succeed(jsonResponse(request, {
            output: {
              message: {
                role: "assistant",
                content: [{
                  toolUse: {
                    toolUseId: "tool_1",
                    name: "GlobTool",
                    input: toolParams
                  }
                }]
              }
            },
            metrics: { latencyMs: 100 },
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            stopReason: "tool_use"
          }))
        )

        const GlobTool = Tool.make("GlobTool", {
          description: "Search for files",
          parameters: Schema.Struct({ pattern: Schema.String }),
          success: Schema.String
        })

        const toolkit = Toolkit.make(GlobTool)
        const toolkitLayer = toolkit.toLayer({
          GlobTool: () => Effect.succeed("found.ts")
        })

        const result = yield* LanguageModel.generateText({
          prompt: "find ts files",
          toolkit,
          disableToolCallResolution: true
        }).pipe(
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(toolkitLayer),
          Effect.provide(layer)
        )

        const toolCall = result.content.find((part) => part.type === "tool-call")
        assert.isDefined(toolCall)
        if (toolCall?.type !== "tool-call") return
        assert.strictEqual(toolCall.name, "GlobTool")
        assert.deepStrictEqual(toolCall.params, toolParams)
      }))

    it.effect("maps max_tokens stop reason to length", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) =>
          Effect.succeed(jsonResponse(request, {
            output: {
              message: {
                role: "assistant",
                content: [{ text: "Truncated..." }]
              }
            },
            metrics: { latencyMs: 100 },
            usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
            stopReason: "max_tokens"
          }))
        )

        const result = yield* LanguageModel.generateText({
          prompt: "Write a long essay"
        }).pipe(
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const finishPart = result.content.find((part) => part.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.reason, "length")
      }))

    it.effect("includes cached token counts in finish", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) =>
          Effect.succeed(jsonResponse(request, {
            output: {
              message: {
                role: "assistant",
                content: [{ text: "Hello!" }]
              }
            },
            metrics: { latencyMs: 100 },
            usage: {
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 115,
              cacheReadInputTokens: 50,
              cacheWriteInputTokens: 50
            },
            stopReason: "end_turn"
          }))
        )

        const result = yield* LanguageModel.generateText({
          prompt: "Hello"
        }).pipe(
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const finishPart = result.content.find((part) => part.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.usage.inputTokens.cacheRead, 50)
        assert.strictEqual(finishPart.usage.inputTokens.cacheWrite, 50)
        assert.strictEqual(finishPart.usage.inputTokens.uncached, 10)
        assert.strictEqual(finishPart.usage.inputTokens.total, 110)
      }))

    it.effect("cached tokens default to 0 when not in response", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) =>
          Effect.succeed(jsonResponse(request, {
            output: {
              message: {
                role: "assistant",
                content: [{ text: "Hello!" }]
              }
            },
            metrics: { latencyMs: 100 },
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            stopReason: "end_turn"
          }))
        )

        const result = yield* LanguageModel.generateText({
          prompt: "Hello"
        }).pipe(
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const finishPart = result.content.find((part) => part.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.usage.inputTokens.cacheRead, 0)
        assert.strictEqual(finishPart.usage.inputTokens.cacheWrite, 0)
        assert.strictEqual(finishPart.usage.inputTokens.total, 10)
      }))

    it.effect("cacheReadInputTokens: 0 is preserved as 0, not undefined", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) =>
          Effect.succeed(jsonResponse(request, {
            output: {
              message: {
                role: "assistant",
                content: [{ text: "Hello!" }]
              }
            },
            metrics: { latencyMs: 100 },
            usage: {
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
              cacheReadInputTokens: 0
            },
            stopReason: "end_turn"
          }))
        )

        const result = yield* LanguageModel.generateText({
          prompt: "Hello"
        }).pipe(
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const finishPart = result.content.find((part) => part.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.usage.inputTokens.cacheRead, 0)
      }))
  })

  describe("streamText", () => {
    it.effect("streams text and emits finish after messageStop + metadata", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", { contentBlockIndex: 0, start: {} }],
              ["contentBlockDelta", { contentBlockIndex: 0, delta: { text: "Hello" } }],
              ["contentBlockDelta", { contentBlockIndex: 0, delta: { text: " World" } }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              ["messageStop", { stopReason: "end_turn" }],
              ["metadata", {
                metrics: { latencyMs: 150 },
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
              }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "Say hello world"
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)

        // Should have text deltas
        const textDeltas = partsArray.filter((p) => p.type === "text-delta")
        assert.isTrue(textDeltas.length >= 1)

        // Should have a finish part
        const finishPart = partsArray.find((p) => p.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.reason, "stop")

        // Finish part should have usage
        assert.isDefined(finishPart.usage)
        assert.strictEqual(finishPart.usage.inputTokens.total, 10)
        assert.strictEqual(finishPart.usage.outputTokens.total, 5)
      }))

    it.effect("streams tool call with params in deltas", () =>
      Effect.gen(function*() {
        const toolParams = { query: "test" }

        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", {
                contentBlockIndex: 0,
                start: {
                  toolUse: {
                    name: "SearchTool",
                    toolUseId: "tool_1"
                  }
                }
              }],
              ["contentBlockDelta", {
                contentBlockIndex: 0,
                delta: { toolUse: { input: JSON.stringify(toolParams) } }
              }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              ["messageStop", { stopReason: "tool_use" }],
              ["metadata", {
                metrics: { latencyMs: 100 },
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
              }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const SearchTool = Tool.make("SearchTool", {
          description: "Search",
          parameters: Schema.Struct({ query: Schema.String }),
          success: Schema.String
        })

        const toolkit = Toolkit.make(SearchTool)
        const toolkitLayer = toolkit.toLayer({
          SearchTool: () => Effect.succeed("result")
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "search for test",
          toolkit,
          disableToolCallResolution: true
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(toolkitLayer),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)

        const toolCall = partsArray.find((p) => p.type === "tool-call")
        assert.isDefined(toolCall)
        if (toolCall?.type !== "tool-call") return
        assert.strictEqual(toolCall.name, "SearchTool")
        assert.deepStrictEqual(toolCall.params, toolParams)
      }))

    it.effect("tryEmitFinish defers until both messageStop and metadata arrive", () =>
      Effect.gen(function*() {
        // Test that finish is only emitted after BOTH messageStop and metadata
        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", { contentBlockIndex: 0, start: {} }],
              ["contentBlockDelta", { contentBlockIndex: 0, delta: { text: "Hi" } }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              // messageStop arrives first — finish should NOT be emitted yet
              ["messageStop", { stopReason: "end_turn" }],
              // metadata arrives second — NOW finish should be emitted
              ["metadata", {
                metrics: { latencyMs: 50 },
                usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 }
              }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "hi"
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)

        // There should be exactly one finish part
        const finishParts = partsArray.filter((p) => p.type === "finish")
        assert.strictEqual(finishParts.length, 1)

        // It should be the last meaningful part
        const lastPart = partsArray[partsArray.length - 1]
        assert.strictEqual(lastPart.type, "finish")
      }))

    it.effect("streams cached token counts (cacheRead/cacheWrite) in finish", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", { contentBlockIndex: 0, start: {} }],
              ["contentBlockDelta", { contentBlockIndex: 0, delta: { text: "Hi" } }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              ["messageStop", { stopReason: "end_turn" }],
              ["metadata", {
                metrics: { latencyMs: 100 },
                usage: {
                  inputTokens: 10,
                  outputTokens: 5,
                  totalTokens: 115,
                  cacheReadInputTokens: 50,
                  cacheWriteInputTokens: 50
                }
              }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "Hi"
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)
        const finishPart = partsArray.find((p) => p.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.usage.inputTokens.cacheRead, 50)
        assert.strictEqual(finishPart.usage.inputTokens.cacheWrite, 50)
        assert.strictEqual(finishPart.usage.inputTokens.uncached, 10)
        assert.strictEqual(finishPart.usage.inputTokens.total, 110)
      }))

    it.effect("cached tokens default to 0 when not in metadata", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", { contentBlockIndex: 0, start: {} }],
              ["contentBlockDelta", { contentBlockIndex: 0, delta: { text: "Hi" } }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              ["messageStop", { stopReason: "end_turn" }],
              ["metadata", {
                metrics: { latencyMs: 100 },
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
              }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "Hi"
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)
        const finishPart = partsArray.find((p) => p.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.usage.inputTokens.cacheRead, 0)
        assert.strictEqual(finishPart.usage.inputTokens.cacheWrite, 0)
        assert.strictEqual(finishPart.usage.inputTokens.total, 10)
      }))

    it.effect("cacheReadInputTokens: 0 is preserved as 0, not undefined", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", { contentBlockIndex: 0, start: {} }],
              ["contentBlockDelta", { contentBlockIndex: 0, delta: { text: "Hi" } }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              ["messageStop", { stopReason: "end_turn" }],
              ["metadata", {
                metrics: { latencyMs: 100 },
                usage: {
                  inputTokens: 10,
                  outputTokens: 5,
                  totalTokens: 15,
                  cacheReadInputTokens: 0
                }
              }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "Hi"
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)
        const finishPart = partsArray.find((p) => p.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.usage.inputTokens.cacheRead, 0)
      }))

    it.effect("includes trace metadata in finish part", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", { contentBlockIndex: 0, start: {} }],
              ["contentBlockDelta", { contentBlockIndex: 0, delta: { text: "Hi" } }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              ["messageStop", { stopReason: "end_turn" }],
              ["metadata", {
                metrics: { latencyMs: 100 },
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                trace: {
                  guardrail: { modelOutput: ["safe content"] }
                }
              }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "Hi"
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)
        const finishPart = partsArray.find((p) => p.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        const metadata = finishPart.metadata as any
        assert.isDefined(metadata?.bedrock?.trace)
      }))

    it.effect("does not emit finish if error arrives after messageStop", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", { contentBlockIndex: 0, start: {} }],
              ["contentBlockDelta", { contentBlockIndex: 0, delta: { text: "Hi" } }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              ["messageStop", { stopReason: "end_turn" }],
              // Error instead of metadata — finish should NOT be emitted
              ["internalServerException", { message: "Something went wrong" }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "Hi"
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)
        const finishParts = partsArray.filter((p) => p.type === "finish")
        assert.strictEqual(finishParts.length, 0)
        const errorParts = partsArray.filter((p) => p.type === "error")
        assert.strictEqual(errorParts.length, 1)
      }))

    it.effect("does not emit finish if only metadata arrives without messageStop", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", { contentBlockIndex: 0, start: {} }],
              ["contentBlockDelta", { contentBlockIndex: 0, delta: { text: "Hi" } }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              // No messageStop — only metadata
              ["metadata", {
                metrics: { latencyMs: 100 },
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
              }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "Hi"
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)
        const finishParts = partsArray.filter((p) => p.type === "finish")
        assert.strictEqual(finishParts.length, 0)
      }))

    it.effect("maps max_tokens stop reason to length in streaming", () =>
      Effect.gen(function*() {
        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", { contentBlockIndex: 0, start: {} }],
              ["contentBlockDelta", { contentBlockIndex: 0, delta: { text: "Truncated" } }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              ["messageStop", { stopReason: "max_tokens" }],
              ["metadata", {
                metrics: { latencyMs: 100 },
                usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 }
              }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "Write a long essay"
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)
        const finishPart = partsArray.find((p) => p.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.reason, "length")
      }))

    it.effect("streams cached tokens alongside tool call content blocks", () =>
      Effect.gen(function*() {
        const toolParams = { query: "test" }

        const layer = makeTestLayer((request) => {
          if (request.url.includes("converse-stream")) {
            return Effect.succeed(eventStreamResponse(request, [
              ["messageStart", { role: "assistant" }],
              ["contentBlockStart", {
                contentBlockIndex: 0,
                start: {
                  toolUse: {
                    name: "SearchTool",
                    toolUseId: "tool_1"
                  }
                }
              }],
              ["contentBlockDelta", {
                contentBlockIndex: 0,
                delta: { toolUse: { input: JSON.stringify(toolParams) } }
              }],
              ["contentBlockStop", { contentBlockIndex: 0 }],
              ["messageStop", { stopReason: "tool_use" }],
              ["metadata", {
                metrics: { latencyMs: 100 },
                usage: {
                  inputTokens: 20,
                  outputTokens: 10,
                  totalTokens: 130,
                  cacheReadInputTokens: 80,
                  cacheWriteInputTokens: 20
                }
              }]
            ]))
          }
          return Effect.succeed(jsonResponse(request, {}))
        })

        const SearchTool = Tool.make("SearchTool", {
          description: "Search",
          parameters: Schema.Struct({ query: Schema.String }),
          success: Schema.String
        })

        const toolkit = Toolkit.make(SearchTool)
        const toolkitLayer = toolkit.toLayer({
          SearchTool: () => Effect.succeed("result")
        })

        const parts = yield* LanguageModel.streamText({
          prompt: "search",
          toolkit,
          disableToolCallResolution: true
        }).pipe(
          Stream.runCollect,
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(toolkitLayer),
          Effect.provide(layer)
        )

        const partsArray = globalThis.Array.from(parts)

        const toolCall = partsArray.find((p) => p.type === "tool-call")
        assert.isDefined(toolCall)

        const finishPart = partsArray.find((p) => p.type === "finish")
        assert.isDefined(finishPart)
        if (finishPart?.type !== "finish") return
        assert.strictEqual(finishPart.usage.inputTokens.cacheRead, 80)
        assert.strictEqual(finishPart.usage.inputTokens.cacheWrite, 20)
        assert.strictEqual(finishPart.usage.inputTokens.total, 120)
        assert.strictEqual(finishPart.reason, "tool-calls")
      }))
  })

  describe("transformClient", () => {
    it.effect("bearer token auth is mutually exclusive with SigV4 signature", () =>
      Effect.gen(function*() {
        let capturedAuthHeader: string | undefined

        // Works because mapRequest appends after SigV4, overwriting the same lowercase "authorization" key
        const layer = AmazonBedrockClient.layer({
          accessKeyId: "dummy-key",
          secretAccessKey: Redacted.make("dummy-secret"),
          region: "us-east-1",
          transformClient: (client) =>
            HttpClient.mapRequest(client, (request) =>
              HttpClientRequest.setHeader(request, "authorization", "Bearer my-bearer-token")
            )
        }).pipe(
          Layer.provide(Layer.succeed(
            HttpClient.HttpClient,
            makeHttpClient((request) => {
              capturedAuthHeader = request.headers["authorization"]
              return Effect.succeed(jsonResponse(request, {
                output: {
                  message: {
                    role: "assistant",
                    content: [{ text: "Hello!" }]
                  }
                },
                metrics: { latencyMs: 100 },
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                stopReason: "end_turn"
              }))
            })
          ))
        )

        yield* LanguageModel.generateText({
          prompt: "Hello"
        }).pipe(
          Effect.provide(AmazonBedrockLanguageModel.model("anthropic.claude-3-5-sonnet-20241022-v2:0")),
          Effect.provide(layer)
        )

        assert.isDefined(capturedAuthHeader)
        assert.strictEqual(capturedAuthHeader, "Bearer my-bearer-token")
        assert.isFalse(capturedAuthHeader!.startsWith("AWS4-HMAC-SHA256"))
      }))
  })
})

// =============================================================================
// Test helpers
// =============================================================================

const makeTestLayer = (
  handler: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>
) =>
  AmazonBedrockClient.layer({
    accessKeyId: "test-key",
    secretAccessKey: Redacted.make("test-secret"),
    region: "us-east-1"
  }).pipe(
    Layer.provide(Layer.succeed(
      HttpClient.HttpClient,
      makeHttpClient(handler)
    ))
  )

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

const jsonResponse = (
  request: HttpClientRequest.HttpClientRequest,
  body: unknown
): HttpClientResponse.HttpClientResponse =>
  HttpClientResponse.fromWeb(
    request,
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  )

const eventStreamResponse = (
  request: HttpClientRequest.HttpClientRequest,
  events: ReadonlyArray<readonly [eventType: string, payload: unknown]>
): HttpClientResponse.HttpClientResponse => {
  const codec = new EventStreamCodec(toUtf8, fromUtf8)
  const chunks: Array<Uint8Array> = []

  for (const [eventType, payload] of events) {
    const body = fromUtf8(JSON.stringify(payload))
    const message = codec.encode({
      headers: {
        ":event-type": { type: "string", value: eventType },
        ":content-type": { type: "string", value: "application/json" },
        ":message-type": { type: "string", value: "event" }
      },
      body
    })
    chunks.push(message)
  }

  // Concatenate all encoded event chunks into a single Uint8Array
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const combined = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.length
  }

  return HttpClientResponse.fromWeb(
    request,
    new Response(combined, {
      status: 200,
      headers: { "content-type": "application/vnd.amazon.eventstream" }
    })
  )
}
