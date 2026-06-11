import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect } from "effect"
import { TestClock } from "effect/testing"
import { RateLimiter } from "effect/unstable/persistence"

describe(`RateLimiter`, () => {
  describe("retry-after", () => {
    it.effect("stores, extends, and expires retry-after delays", () =>
      Effect.gen(function*() {
        const store = yield* RateLimiter.RateLimiterStore

        assert.deepStrictEqual(yield* store.getRetryAfter({ key: "a" }), Duration.zero)

        yield* store.setRetryAfter({ key: "a", duration: Duration.minutes(1) })
        assert.deepStrictEqual(yield* store.getRetryAfter({ key: "a" }), Duration.minutes(1))

        yield* TestClock.adjust(Duration.seconds(10))
        assert.deepStrictEqual(yield* store.getRetryAfter({ key: "a" }), Duration.seconds(50))

        yield* store.setRetryAfter({ key: "a", duration: Duration.seconds(5) })
        assert.deepStrictEqual(yield* store.getRetryAfter({ key: "a" }), Duration.seconds(50))

        yield* store.setRetryAfter({ key: "a", duration: Duration.minutes(2) })
        assert.deepStrictEqual(yield* store.getRetryAfter({ key: "a" }), Duration.minutes(2))

        yield* TestClock.adjust(Duration.minutes(2))
        assert.deepStrictEqual(yield* store.getRetryAfter({ key: "a" }), Duration.zero)
      }).pipe(
        Effect.provide(RateLimiter.layerStoreMemory)
      ))

    it.effect("makes consume fail or delay while retry-after is active", () =>
      Effect.gen(function*() {
        const limiter = yield* RateLimiter.make
        const store = yield* RateLimiter.RateLimiterStore
        const consumeFail = limiter.consume({
          algorithm: "fixed-window",
          onExceeded: "fail",
          window: "1 minute",
          limit: 1,
          key: "a"
        })
        const consumeDelay = limiter.consume({
          algorithm: "fixed-window",
          onExceeded: "delay",
          window: "1 minute",
          limit: 1,
          key: "a"
        })

        yield* store.setRetryAfter({ key: "a", duration: Duration.millis(100) })

        const error = yield* Effect.flip(consumeFail)
        if (error.reason._tag !== "RateLimitExceeded") {
          throw new Error("Expected RateLimitExceeded")
        }
        assert.deepStrictEqual(error.reason.retryAfter, Duration.millis(100))

        const delayed = yield* consumeDelay
        assert.deepStrictEqual(delayed.delay, Duration.millis(100))

        yield* TestClock.adjust(Duration.millis(100))
        const result = yield* consumeFail
        assert.deepStrictEqual(result.delay, Duration.zero)
        assert.strictEqual(result.remaining, 0)
      }).pipe(
        Effect.provide(RateLimiter.layerStoreMemory)
      ))

    it.effect("shares retry-after state across limiters backed by the same store", () =>
      Effect.gen(function*() {
        const limiterA = yield* RateLimiter.make
        const limiterB = yield* RateLimiter.make
        const store = yield* RateLimiter.RateLimiterStore

        yield* store.setRetryAfter({ key: "a", duration: Duration.millis(100) })

        const errorA = yield* Effect.flip(limiterA.consume({
          algorithm: "fixed-window",
          onExceeded: "fail",
          window: "1 minute",
          limit: 1,
          key: "a"
        }))
        if (errorA.reason._tag !== "RateLimitExceeded") {
          throw new Error("Expected RateLimitExceeded")
        }
        assert.deepStrictEqual(errorA.reason.retryAfter, Duration.millis(100))

        const error = yield* Effect.flip(limiterB.consume({
          algorithm: "fixed-window",
          onExceeded: "fail",
          window: "1 minute",
          limit: 1,
          key: "a"
        }))
        if (error.reason._tag !== "RateLimitExceeded") {
          throw new Error("Expected RateLimitExceeded")
        }
        assert.deepStrictEqual(error.reason.retryAfter, Duration.millis(100))
      }).pipe(
        Effect.provide(RateLimiter.layerStoreMemory)
      ))
  })

  describe("fixed-window", () => {
    it.effect("returns accumulated delays after the fixed window is exceeded", () =>
      Effect.gen(function*() {
        const limiter = yield* RateLimiter.make
        const consume = limiter.consume({
          algorithm: "fixed-window",
          onExceeded: "delay",
          window: "1 minute",
          limit: 5,
          tokens: 1,
          key: "a"
        })
        yield* Effect.repeat(consume, { times: 3 }) // 1 + 3
        let result = yield* consume // 5
        assert.deepStrictEqual(result.delay, Duration.zero)
        result = yield* consume // 6
        assert.deepStrictEqual(result.delay, Duration.minutes(1))

        yield* Effect.repeat(consume, { times: 2 }) // 7,8,9
        result = yield* consume // 10
        assert.deepStrictEqual(result.delay, Duration.minutes(1))
        result = yield* consume // 11
        assert.deepStrictEqual(result.delay, Duration.minutes(2))

        yield* TestClock.adjust(Duration.seconds(30))

        result = yield* consume // 12
        assert.deepStrictEqual(result.delay, Duration.seconds(90))

        yield* TestClock.adjust(Duration.seconds(45))

        result = yield* consume // 13
        assert.deepStrictEqual(result.delay, Duration.seconds(45))
      }).pipe(
        Effect.provide(RateLimiter.layerStoreMemory)
      ))

    it.effect("fails with retryAfter until the fixed window resets", () =>
      Effect.gen(function*() {
        const limiter = yield* RateLimiter.make
        const consume = limiter.consume({
          algorithm: "fixed-window",
          onExceeded: "fail",
          window: "1 minute",
          limit: 5,
          tokens: 1,
          key: "a"
        })
        yield* Effect.repeat(consume, { times: 3 })
        let result = yield* consume
        assert.deepStrictEqual(result.delay, Duration.zero)
        let error = yield* Effect.flip(consume)
        if (error.reason._tag !== "RateLimitExceeded") {
          throw new Error("Expected RateLimitExceeded")
        }
        assert.deepStrictEqual(error.reason.retryAfter, Duration.minutes(1))
        assert.strictEqual(error.reason.remaining, 0)

        yield* TestClock.adjust(Duration.seconds(30))

        error = yield* Effect.flip(consume)
        if (error.reason._tag !== "RateLimitExceeded") {
          throw new Error("Expected RateLimitExceeded")
        }
        assert.deepStrictEqual(error.reason.retryAfter, Duration.seconds(30))
        assert.strictEqual(error.reason.remaining, 0)

        yield* TestClock.adjust(Duration.seconds(30))

        result = yield* consume
        assert.deepStrictEqual(result.delay, Duration.zero)
        assert.strictEqual(result.remaining, 4)
      }).pipe(
        Effect.provide(RateLimiter.layerStoreMemory)
      ))
  })

  describe("token-bucket", () => {
    it.effect("returns delay based on the token refill rate", () =>
      Effect.gen(function*() {
        const limiter = yield* RateLimiter.make
        const consume = limiter.consume({
          algorithm: "token-bucket",
          onExceeded: "delay",
          window: "1 minute",
          limit: 5,
          tokens: 1,
          key: "a"
        })
        const refillRate = Duration.divideUnsafe(Duration.minutes(1), 5)
        yield* Effect.repeat(consume, { times: 3 }) // 1 + 3
        let result = yield* consume // 5
        assert.deepStrictEqual(result.delay, Duration.zero)
        result = yield* consume // 6
        assert.deepStrictEqual(result.delay, refillRate)
        result = yield* consume // 7
        assert.deepStrictEqual(result.delay, Duration.times(refillRate, 2))

        yield* TestClock.adjust(Duration.minutes(1)) // 2

        result = yield* consume // 3
        assert.deepStrictEqual(result.delay, Duration.zero)
        assert.strictEqual(result.remaining, 2)
      }).pipe(
        Effect.provide(RateLimiter.layerStoreMemory)
      ))

    it.effect("fails until enough tokens are refilled", () =>
      Effect.gen(function*() {
        const limiter = yield* RateLimiter.make
        const consume = limiter.consume({
          algorithm: "token-bucket",
          onExceeded: "fail",
          window: "1 minute",
          limit: 5,
          tokens: 1,
          key: "a"
        })
        const refillRate = Duration.divideUnsafe(Duration.minutes(1), 5)
        yield* Effect.repeat(consume, { times: 3 }) // 1 + 3
        let result = yield* consume
        assert.deepStrictEqual(result.delay, Duration.zero)
        const error = yield* Effect.flip(consume)
        if (error.reason._tag !== "RateLimitExceeded") {
          throw new Error("Expected RateLimitExceeded")
        }
        assert.deepStrictEqual(error.reason.retryAfter, Duration.seconds(12))
        assert.strictEqual(error.reason.remaining, 0)

        yield* TestClock.adjust(Duration.times(refillRate, 3))

        result = yield* consume
        assert.deepStrictEqual(result.delay, Duration.zero)
        assert.strictEqual(result.remaining, 2)
      }).pipe(
        Effect.provide(RateLimiter.layerStoreMemory)
      ))
  })
})
