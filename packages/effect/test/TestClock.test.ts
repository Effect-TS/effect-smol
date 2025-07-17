import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as TestClock from "effect/testing/TestClock"
import * as Duration from "effect/time/Duration"

describe("TestClock", () => {
  it.effect("sleep - does not require passage of wall time", () =>
    Effect.gen(function*() {
      let elapsed = false
      yield* Effect.sync(() => {
        elapsed = true
      }).pipe(Effect.delay("10 hours"), Effect.fork)
      yield* TestClock.adjust("11 hours")
      assert.isTrue(elapsed)
    }))

  it.effect("sleep - delays effects until time is adjusted", () =>
    Effect.gen(function*() {
      let elapsed = false
      const fiber = yield* Effect.sync(() => {
        elapsed = true
      }).pipe(Effect.delay("10 hours"), Effect.fork)
      yield* TestClock.adjust("9 hours")
      assert.isUndefined(fiber.unsafePoll())
      yield* TestClock.adjust("11 hours")
      assert.deepStrictEqual(fiber.unsafePoll(), Exit.void)
      assert.isTrue(elapsed)
    }))

  it.effect("sleep - handles multiple sleeps", () =>
    Effect.gen(function*() {
      let message = ""
      yield* Effect.sync(() => {
        message += "World!"
      }).pipe(Effect.delay("3 hours"), Effect.forkScoped)
      yield* Effect.sync(() => {
        message += "Hello, "
      }).pipe(Effect.delay("1 hour"), Effect.forkScoped)
      yield* TestClock.adjust("1 hour")
      assert.strictEqual(message, "Hello, ")
      yield* TestClock.adjust("4 hours")
      assert.strictEqual(message, "Hello, World!")
    }))

  it.effect("setTime - sleep correctly handles new set time", () =>
    Effect.gen(function*() {
      let elapsed = false
      yield* Effect.sync(() => {
        elapsed = true
      }).pipe(Effect.delay("10 hours"), Effect.fork)
      assert.isFalse(elapsed)
      yield* TestClock.setTime(Duration.toMillis("11 hours"))
      assert.isTrue(elapsed)
    }))
})
