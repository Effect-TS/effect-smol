import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { Model } from "effect/unstable/ai"

describe("Model", () => {
  it.effect("provides provider and model names when explicitly set", () =>
    Effect.gen(function*() {
      const providerName = yield* Model.ProviderName
      const modelName = yield* Model.ModelName

      assert.strictEqual(providerName, "openai")
      assert.strictEqual(modelName, "gpt-5")
    }).pipe(
      Effect.provide(Model.make("openai", "gpt-5", Layer.empty))
    ))

  it.effect("defaults model name to provider for legacy make signature", () =>
    Effect.gen(function*() {
      const providerName = yield* Model.ProviderName
      const modelName = yield* Model.ModelName

      assert.strictEqual(providerName, "anthropic")
      assert.strictEqual(modelName, "anthropic")
    }).pipe(
      Effect.provide(Model.make("anthropic", Layer.empty))
    ))
})
