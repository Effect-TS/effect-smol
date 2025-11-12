import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Random from "effect/Random"

const withRandom = <A, E>(effect: Effect.Effect<A, E, Random.Random>) =>
  Effect.gen(function*() {
    const service = yield* Random.Random.make
    return yield* Effect.provideService(effect, Random.Random, service)
  })

describe("Random", () => {
  describe("next", () => {
    it.effect("generates a number between 0 and 1", () =>
      withRandom(
        Effect.gen(function*() {
          const random = yield* Random.Random
          const value = yield* random.next()

          assert.isTrue(value >= 0)
          assert.isTrue(value < 1)
          assert.strictEqual(typeof value, "number")
        })
      ))
  })

  describe("nextInt", () => {
    it.effect("generates a safe integer", () =>
      withRandom(
        Effect.gen(function*() {
          const random = yield* Random.Random
          const value = yield* random.nextInt()

          assert.isTrue(Number.isSafeInteger(value))
          assert.isTrue(value >= 0)
          assert.isTrue(value <= Number.MAX_SAFE_INTEGER)
        })
      ))
  })

  describe("nextBetween", () => {
    it.effect("generates number in half-open range by default", () =>
      withRandom(
        Effect.gen(function*() {
          const random = yield* Random.Random

          for (let i = 0; i < 100; i++) {
            const value = yield* random.nextBetween(10, 20)
            assert.isTrue(value >= 10)
            assert.isTrue(value < 20)
          }
        })
      ))

    it.effect("generates number in closed range when halfOpen is false", () =>
      withRandom(
        Effect.gen(function*() {
          const random = yield* Random.Random

          for (let i = 0; i < 100; i++) {
            const value = yield* random.nextBetween(10, 20, { halfOpen: false })
            assert.isTrue(value >= 10)
            assert.isTrue(value <= 20)
          }
        })
      ))

    it.effect("handles negative ranges", () =>
      withRandom(
        Effect.gen(function*() {
          const random = yield* Random.Random
          const value = yield* random.nextBetween(-10, 10)

          assert.isTrue(value >= -10)
          assert.isTrue(value < 10)
        })
      ))
  })

  describe("nextIntBetween", () => {
    it.effect("generates integer in half-open range by default", () =>
      withRandom(
        Effect.gen(function*() {
          const random = yield* Random.Random

          for (let i = 0; i < 100; i++) {
            const value = yield* random.nextIntBetween(1, 6)
            assert.isTrue(Number.isInteger(value))
            assert.isTrue(value >= 1)
            assert.isTrue(value < 6)
          }
        })
      ))

    it.effect("generates integer in closed range when halfOpen is false", () =>
      withRandom(
        Effect.gen(function*() {
          const random = yield* Random.Random

          for (let i = 0; i < 100; i++) {
            const value = yield* random.nextIntBetween(1, 6, { halfOpen: false })
            assert.isTrue(Number.isInteger(value))
            assert.isTrue(value >= 1)
            assert.isTrue(value <= 6)
          }
        })
      ))

    it.effect("handles array index generation", () =>
      withRandom(
        Effect.gen(function*() {
          const random = yield* Random.Random
          const arrayLength = 10

          for (let i = 0; i < 100; i++) {
            const index = yield* random.nextIntBetween(0, arrayLength)
            assert.isTrue(Number.isInteger(index))
            assert.isTrue(index >= 0)
            assert.isTrue(index < arrayLength)
          }
        })
      ))

    it.effect("handles single value range", () =>
      withRandom(
        Effect.gen(function*() {
          const random = yield* Random.Random
          const value = yield* random.nextIntBetween(5, 6)

          assert.strictEqual(value, 5)
        })
      ))
  })
})
