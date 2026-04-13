import { AmazonBedrockClient, AmazonBedrockLanguageModel } from "@effect/ai-amazon-bedrock"
import { assert, describe, it } from "@effect/vitest"
import { Config, Effect, Layer, Stream } from "effect"
import { LanguageModel } from "effect/unstable/ai"
import { FetchHttpClient } from "effect/unstable/http"

// Smoke tests against real Bedrock API.
// Silently skipped when AWS credentials are not available.

const hasCredentials = !!process.env.AWS_ACCESS_KEY_ID

const TestLayer = AmazonBedrockClient.layerConfig({
  accessKeyId: Config.string("AWS_ACCESS_KEY_ID"),
  secretAccessKey: Config.redacted("AWS_SECRET_ACCESS_KEY"),
  ...(process.env.AWS_SESSION_TOKEN
    ? { sessionToken: Config.redacted("AWS_SESSION_TOKEN") }
    : {}),
  region: Config.string("AWS_REGION").pipe(Config.withDefault("us-east-1"))
}).pipe(Layer.provide(FetchHttpClient.layer))

describe("AmazonBedrock Smoke Tests", () => {
  it.effect.runIf(hasCredentials)("Converse: minimal text generation", () =>
    Effect.gen(function*() {
      const result = yield* LanguageModel.generateText({
        prompt: "Say hi"
      }).pipe(
        Effect.provide(AmazonBedrockLanguageModel.model("amazon.nova-micro-v1:0", {
          inferenceConfig: { maxTokens: 10 }
        })),
        Effect.provide(TestLayer)
      )

      const textPart = result.content.find((part) => part.type === "text")
      assert.isDefined(textPart)
      if (textPart?.type !== "text") return
      assert.isTrue(textPart.text.length > 0)

      const finishPart = result.content.find((part) => part.type === "finish")
      assert.isDefined(finishPart)
      if (finishPart?.type !== "finish") return
      assert.isDefined(finishPart.usage)
      assert.isTrue((finishPart.usage.inputTokens.total ?? 0) > 0)
    }), 30_000)

  it.effect.runIf(hasCredentials)("ConverseStream: minimal streaming", () =>
    Effect.gen(function*() {
      const parts = yield* LanguageModel.streamText({
        prompt: "Say hi"
      }).pipe(
        Stream.runCollect,
        Effect.provide(AmazonBedrockLanguageModel.model("amazon.nova-micro-v1:0", {
          inferenceConfig: { maxTokens: 10 }
        })),
        Effect.provide(TestLayer)
      )

      const partsArray = globalThis.Array.from(parts)

      const textDeltas = partsArray.filter((p) => p.type === "text-delta")
      assert.isTrue(textDeltas.length >= 1)

      const finishPart = partsArray.find((p) => p.type === "finish")
      assert.isDefined(finishPart)
      if (finishPart?.type !== "finish") return
      assert.isDefined(finishPart.usage)
      assert.isTrue((finishPart.usage.inputTokens.total ?? 0) > 0)
    }), 30_000)
})
