import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Random from "effect/Random"

describe("Random", () => {
  describe("next", () => {
    it.effect("generates a number between 0 and 1", () =>
      Effect.gen(function*() {
        const random = yield* Random.Random
        const value = yield* random.next()

        assert.isAtLeast(value, 0)
        assert.isAtMost(value, 1)
      }))
  })

  describe("nextInt", () => {
    it.effect("generates a safe integer", () =>
      Effect.gen(function*() {
        const random = yield* Random.Random
        const value = yield* random.nextInt()

        assert.isTrue(Number.isSafeInteger(value))
        assert.isAtLeast(value, Number.MIN_SAFE_INTEGER)
        assert.isAtMost(value, Number.MAX_SAFE_INTEGER)
      }))
  })

  describe("nextBetween", () => {
    it.effect("generates number in closed range", () =>
      Effect.gen(function*() {
        const random = yield* Random.Random

        for (let i = 0; i < 100; i++) {
          const value = yield* random.nextBetween(10, 20)
          assert.isAtLeast(value, 10)
          assert.isAtMost(value, 20)
        }
      }))

    it.effect("handles negative ranges", () =>
      Effect.gen(function*() {
        const random = yield* Random.Random
        const value = yield* random.nextBetween(-10, 10)

        assert.isAtLeast(value, -10)
        assert.isAtMost(value, 10)
      }))
  })

  describe("nextIntBetween", () => {
    it.effect("generates integer in closed range", () =>
      Effect.gen(function*() {
        const random = yield* Random.Random

        for (let i = 0; i < 100; i++) {
          const value = yield* random.nextIntBetween(1, 6)
          assert.isTrue(Number.isInteger(value))
          assert.isAtLeast(value, 1)
          assert.isAtMost(value, 6)
        }
      }))

    it.effect("generates integer in half-open range", () =>
      Effect.gen(function*() {
        const random = yield* Random.Random

        for (let i = 0; i < 100; i++) {
          const value = yield* random.nextIntBetween(1, 6, {
            halfOpen: true
          })
          assert.isTrue(Number.isInteger(value))
          assert.isAtLeast(value, 1)
          assert.isBelow(value, 6)
        }
      }))
  })
})
