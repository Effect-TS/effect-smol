import { AmazonBedrockClient, AmazonBedrockLanguageModel } from "@effect/ai-amazon-bedrock"
import { assert, describe, it } from "@effect/vitest"
import { Config, Effect, Layer, Schema, Stream } from "effect"
import { LanguageModel, Tool, Toolkit } from "effect/unstable/ai"
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

const NovaModel = AmazonBedrockLanguageModel.model("amazon.nova-micro-v1:0", {
  inferenceConfig: { maxTokens: 100 }
})

// ---------------------------------------------------------------------------
// Tools used across tests
// ---------------------------------------------------------------------------

const GetWeather = Tool.make("GetWeather", {
  description: "Get the current weather for a city",
  parameters: Schema.Struct({ city: Schema.String }),
  success: Schema.String
})

const weatherToolkit = Toolkit.make(GetWeather)

// ---------------------------------------------------------------------------
// Text generation
// ---------------------------------------------------------------------------

describe("AmazonBedrock Smoke Tests", () => {
  it.effect.runIf(hasCredentials)("Converse: minimal text generation", () =>
    Effect.gen(function*() {
      const result = yield* LanguageModel.generateText({
        prompt: "Say hi"
      }).pipe(
        Effect.provide(NovaModel),
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
        Effect.provide(NovaModel),
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

  // ---------------------------------------------------------------------------
  // Tool calling
  // ---------------------------------------------------------------------------

  it.effect.runIf(hasCredentials)("Converse: tool call", () =>
    Effect.gen(function*() {
      const result = yield* LanguageModel.generateText({
        prompt: "What is the weather in London?",
        toolkit: weatherToolkit,
        disableToolCallResolution: true
      }).pipe(
        Effect.provide(NovaModel),
        Effect.provide(TestLayer)
      )

      const toolCall = result.content.find((part) => part.type === "tool-call")
      assert.isDefined(toolCall)
      if (toolCall?.type !== "tool-call") return
      assert.strictEqual(toolCall.name, "GetWeather")
      assert.isObject(toolCall.params)
      assert.isString((toolCall.params as any).city)
    }), 30_000)

  it.effect.runIf(hasCredentials)("ConverseStream: tool call", () =>
    Effect.gen(function*() {
      const parts = yield* LanguageModel.streamText({
        prompt: "What is the weather in London?",
        toolkit: weatherToolkit,
        disableToolCallResolution: true
      }).pipe(
        Stream.runCollect,
        Effect.provide(NovaModel),
        Effect.provide(TestLayer)
      )

      const partsArray = globalThis.Array.from(parts)

      const toolParamsStart = partsArray.find((p) => p.type === "tool-params-start")
      assert.isDefined(toolParamsStart)

      const toolParamsDeltas = partsArray.filter((p) => p.type === "tool-params-delta")
      assert.isTrue(toolParamsDeltas.length >= 1)

      const toolParamsEnd = partsArray.find((p) => p.type === "tool-params-end")
      assert.isDefined(toolParamsEnd)

      const toolCall = partsArray.find((p) => p.type === "tool-call")
      assert.isDefined(toolCall)
      if (toolCall?.type !== "tool-call") return
      assert.strictEqual(toolCall.name, "GetWeather")
      assert.isObject(toolCall.params)
      assert.isString((toolCall.params as any).city)
    }), 30_000)

  // ---------------------------------------------------------------------------
  // JSON response format
  // ---------------------------------------------------------------------------

  it.effect.runIf(hasCredentials)("Converse: JSON response format", () =>
    Effect.gen(function*() {
      const result = yield* LanguageModel.generateObject({
        prompt: "Describe a person named Alice who is 30 years old",
        schema: Schema.Struct({
          name: Schema.String,
          age: Schema.Number
        }),
        objectName: "Person"
      }).pipe(
        Effect.provide(NovaModel),
        Effect.provide(TestLayer)
      )

      assert.isString(result.value.name)
      assert.isNumber(result.value.age)
    }), 30_000)

  // ---------------------------------------------------------------------------
  // Not included in this port — placeholder tests
  // ---------------------------------------------------------------------------

  it.effect.skip("Reasoning / extended thinking (requires Anthropic model on Bedrock)", () => Effect.void)

  it.effect.skip("Document input (PDF, CSV, etc.)", () => Effect.void)

  it.effect.skip("Image input", () => Effect.void)

  it.effect.skip("Cache points (CachePointBlock)", () => Effect.void)

  it.effect.skip("Provider-defined Anthropic tools (computer use, web search, etc.)", () => Effect.void)

  it.effect.skip("Config override via withConfigOverride", () => Effect.void)
})
