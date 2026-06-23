import { type Duration, type Effect, type Layer } from "effect"
import { RateLimiter, type Redis } from "effect/unstable/persistence"
import { describe, expect, it } from "tstyche"

describe("RateLimiterStore", () => {
  it("exposes adaptive store operations", () => {
    expect<RateLimiter.AdaptivePhase>().type.toBe<"inactive" | "cooldown" | "learning" | "learned">()
    expect<RateLimiter.AdaptiveConsumeOptions>().type.toBe<{
      readonly key: string
      readonly tokens: number
      readonly fallbackLimit: number
      readonly fallbackWindow: Duration.Duration
    }>()
    expect<RateLimiter.AdaptiveFeedbackOptions>().type.toBe<{
      readonly key: string
      readonly epoch: number
      readonly tokens: number
      readonly status: number
      readonly retryAfter: Duration.Duration | undefined
    }>()
    expect<(typeof RateLimiter.RateLimiterStore)["Service"]["adaptiveConsume"]>().type.toBe<
      (
        options: RateLimiter.AdaptiveConsumeOptions
      ) => Effect.Effect<RateLimiter.AdaptiveConsumeResult, RateLimiter.RateLimiterError>
    >()
    expect<(typeof RateLimiter.RateLimiterStore)["Service"]["adaptiveFeedback"]>().type.toBe<
      (
        options: RateLimiter.AdaptiveFeedbackOptions
      ) => Effect.Effect<void, RateLimiter.RateLimiterError>
    >()
  })

  it("provides store layers that satisfy the extended interface", () => {
    expect(RateLimiter.layerStoreMemory).type.toBe<Layer.Layer<RateLimiter.RateLimiterStore>>()
    expect(RateLimiter.layerStoreRedis()).type.toBe<Layer.Layer<RateLimiter.RateLimiterStore, never, Redis.Redis>>()
  })
})
