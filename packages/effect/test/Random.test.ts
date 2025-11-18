import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Random from "effect/Random"

describe("Random", () => {
  describe("next", () => {
    it.effect("generates a number between 0 and 1", () =>
      Effect.gen(function*() {
        const value = yield* Random.next

        assert.isAtLeast(value, 0)
        assert.isAtMost(value, 1)
      }))
  })

  describe("nextInt", () => {
    it.effect("generates a safe integer", () =>
      Effect.gen(function*() {
        const value = yield* Random.nextInt

        assert.isTrue(Number.isSafeInteger(value))
        assert.isAtLeast(value, Number.MIN_SAFE_INTEGER)
        assert.isAtMost(value, Number.MAX_SAFE_INTEGER)
      }))
  })

  describe("nextBetween", () => {
    it.effect("generates number in closed range", () =>
      Effect.gen(function*() {
        for (let i = 0; i < 100; i++) {
          const value = yield* Random.nextBetween(10, 20)
          assert.isAtLeast(value, 10)
          assert.isAtMost(value, 20)
        }
      }))

    it.effect("handles negative ranges", () =>
      Effect.gen(function*() {
        const value = yield* Random.nextBetween(-10, 10)

        assert.isAtLeast(value, -10)
        assert.isAtMost(value, 10)
      }))
  })

  describe("nextIntBetween", () => {
    it.effect("generates integer in closed range", () =>
      Effect.gen(function*() {
        for (let i = 0; i < 100; i++) {
          const value = yield* Random.nextIntBetween(1, 6)
          assert.isTrue(Number.isInteger(value))
          assert.isAtLeast(value, 1)
          assert.isAtMost(value, 6)
        }
      }))

    it.effect("generates integer in half-open range", () =>
      Effect.gen(function*() {
        for (let i = 0; i < 100; i++) {
          const value = yield* Random.nextIntBetween(1, 6, {
            halfOpen: true
          })
          assert.isTrue(Number.isInteger(value))
          assert.isAtLeast(value, 1)
          assert.isBelow(value, 6)
        }
      }))
  })

  describe("nextUUIDv4", () => {
    it.effect("generates valid UUID v4 format", () =>
      Effect.gen(function*() {
        const uuid = yield* Random.nextUUIDv4

        assert.isString(uuid)
        assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      }))

    it.effect("generates unique UUIDs", () =>
      Effect.gen(function*() {
        const uuid1 = yield* Random.nextUUIDv4
        const uuid2 = yield* Random.nextUUIDv4

        assert.notStrictEqual(uuid1, uuid2)
      }))

    it.effect("generates deterministic UUIDs with same seed", () =>
      Effect.gen(function*() {
        const program = Effect.gen(function*() {
          const uuid1 = yield* Random.nextUUIDv4
          const uuid2 = yield* Random.nextUUIDv4
          return [uuid1, uuid2]
        })

        const result1 = yield* program.pipe(Random.withSeed("uuid-seed"))
        const result2 = yield* program.pipe(Random.withSeed("uuid-seed"))

        assert.deepStrictEqual(result1, result2)

        assert.match(result1[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        assert.match(result1[1], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      }))
  })

  describe("withSeed", () => {
    it.effect("produces deterministic sequence with same seed", () =>
      Effect.gen(function*() {
        const program = Effect.gen(function*() {
          const v1 = yield* Random.next
          const v2 = yield* Random.nextInt
          const v3 = yield* Random.nextUUIDv4
          return [v1, v2, v3]
        })

        const result1 = yield* program.pipe(Random.withSeed("test-seed"))
        const result2 = yield* program.pipe(Random.withSeed("test-seed"))

        assert.deepStrictEqual(result1, result2)
      }))

    it.effect("produces different sequences with different seeds", () =>
      Effect.gen(function*() {
        const program = Effect.gen(function*() {
          const v1 = yield* Random.next
          const v2 = yield* Random.nextInt
          return [v1, v2]
        })

        const result1 = yield* program.pipe(Random.withSeed(12345))
        const result2 = yield* program.pipe(Random.withSeed(67890))

        assert.notDeepEqual(result1, result2)
      }))

    it.effect("works with numeric seeds", () =>
      Effect.gen(function*() {
        const program = Effect.gen(function*() {
          const v1 = yield* Random.next
          const v2 = yield* Random.nextInt
          return [v1, v2]
        })

        const result1 = yield* program.pipe(Random.withSeed(12345))
        const result2 = yield* program.pipe(Random.withSeed(12345))

        assert.deepStrictEqual(result1, result2)
      }))
  })
})
