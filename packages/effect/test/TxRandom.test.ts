import { assert, describe, it } from "@effect/vitest"
import { Effect, TxRandom } from "effect"

describe("TxRandom", () => {
  describe("constructors", () => {
    it.effect("make creates a random generator", () =>
      Effect.gen(function*() {
        const rng = yield* TxRandom.make(42)
        assert.isTrue(TxRandom.isTxRandom(rng))
      }))

    it.effect("make without seed creates a random generator", () =>
      Effect.gen(function*() {
        const rng = yield* TxRandom.make()
        assert.isTrue(TxRandom.isTxRandom(rng))
      }))
  })

  describe("determinism", () => {
    it.effect("same seed produces same sequence", () =>
      Effect.gen(function*() {
        const rng1 = yield* TxRandom.make(42)
        const rng2 = yield* TxRandom.make(42)
        const a1 = yield* TxRandom.next(rng1)
        const a2 = yield* TxRandom.next(rng2)
        assert.strictEqual(a1, a2)
        const b1 = yield* TxRandom.next(rng1)
        const b2 = yield* TxRandom.next(rng2)
        assert.strictEqual(b1, b2)
      }))

    it.effect("different seeds produce different sequences", () =>
      Effect.gen(function*() {
        const rng1 = yield* TxRandom.make(42)
        const rng2 = yield* TxRandom.make(99)
        const a1 = yield* TxRandom.next(rng1)
        const a2 = yield* TxRandom.next(rng2)
        assert.notStrictEqual(a1, a2)
      }))
  })

  describe("combinators", () => {
    it.effect("next returns value in [0, 1)", () =>
      Effect.gen(function*() {
        const rng = yield* TxRandom.make(42)
        for (let i = 0; i < 100; i++) {
          const value = yield* TxRandom.next(rng)
          assert.isTrue(value >= 0 && value < 1, `value ${value} not in [0, 1)`)
        }
      }))

    it.effect("nextBoolean returns boolean", () =>
      Effect.gen(function*() {
        const rng = yield* TxRandom.make(42)
        const value = yield* TxRandom.nextBoolean(rng)
        assert.isTrue(typeof value === "boolean")
      }))

    it.effect("nextInt returns integer", () =>
      Effect.gen(function*() {
        const rng = yield* TxRandom.make(42)
        const value = yield* TxRandom.nextInt(rng)
        assert.isTrue(Number.isInteger(value))
      }))

    it.effect("nextRange returns value in [min, max)", () =>
      Effect.gen(function*() {
        const rng = yield* TxRandom.make(42)
        for (let i = 0; i < 100; i++) {
          const value = yield* TxRandom.nextRange(rng, 10, 20)
          assert.isTrue(value >= 10 && value < 20, `value ${value} not in [10, 20)`)
        }
      }))

    it.effect("nextIntBetween returns integer in [min, max)", () =>
      Effect.gen(function*() {
        const rng = yield* TxRandom.make(42)
        for (let i = 0; i < 100; i++) {
          const value = yield* TxRandom.nextIntBetween(rng, 0, 10)
          assert.isTrue(Number.isInteger(value), `value ${value} is not integer`)
          assert.isTrue(value >= 0 && value < 10, `value ${value} not in [0, 10)`)
        }
      }))

    it.effect("shuffle returns all elements", () =>
      Effect.gen(function*() {
        const rng = yield* TxRandom.make(42)
        const input = [1, 2, 3, 4, 5]
        const shuffled = yield* TxRandom.shuffle(rng, input)
        assert.strictEqual(shuffled.length, 5)
        assert.deepStrictEqual(shuffled.sort((a, b) => a - b), [1, 2, 3, 4, 5])
      }))

    it.effect("shuffle is deterministic with same seed", () =>
      Effect.gen(function*() {
        const rng1 = yield* TxRandom.make(42)
        const rng2 = yield* TxRandom.make(42)
        const s1 = yield* TxRandom.shuffle(rng1, [1, 2, 3, 4, 5])
        const s2 = yield* TxRandom.shuffle(rng2, [1, 2, 3, 4, 5])
        assert.deepStrictEqual(s1, s2)
      }))
  })

  describe("guards", () => {
    it.effect("isTxRandom", () =>
      Effect.gen(function*() {
        const rng = yield* TxRandom.make(42)
        assert.isTrue(TxRandom.isTxRandom(rng))
        assert.isFalse(TxRandom.isTxRandom(null))
        assert.isFalse(TxRandom.isTxRandom({ some: "object" }))
      }))
  })
})
