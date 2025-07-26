import { assert, describe, it } from "@effect/vitest"
import { Fiber } from "effect"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as TxSemaphore from "effect/transactions/TxSemaphore"

describe("TxSemaphore", () => {
  describe("constructors", () => {
    it.effect("make creates semaphore with specified permits", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)
        const available = yield* TxSemaphore.available(semaphore)
        const capacity = yield* TxSemaphore.capacity(semaphore)

        assert.strictEqual(available, 5)
        assert.strictEqual(capacity, 5)
      }))

    it.effect("make with zero permits creates empty semaphore", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(0)
        const available = yield* TxSemaphore.available(semaphore)
        const capacity = yield* TxSemaphore.capacity(semaphore)

        assert.strictEqual(available, 0)
        assert.strictEqual(capacity, 0)
      }))

    it.effect("make with negative permits causes defect", () =>
      Effect.gen(function*() {
        const result = yield* Effect.exit(TxSemaphore.make(-1))
        assert.isTrue(Exit.hasDie(result))
      }))
  })

  describe("basic operations", () => {
    it.effect("acquire and release work correctly", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(3)

        yield* TxSemaphore.acquire(semaphore)
        const available = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(available, 2)

        yield* TxSemaphore.release(semaphore)
        const availableAfter = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(availableAfter, 3)
      }))

    it.effect("acquireN and releaseN work correctly", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)

        yield* TxSemaphore.acquireN(semaphore, 3)
        const available = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(available, 2)

        yield* TxSemaphore.releaseN(semaphore, 2)
        const availableAfter = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(availableAfter, 4)
      }))

    it.effect("tryAcquire succeeds when permits available", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(2)

        const first = yield* TxSemaphore.tryAcquire(semaphore)
        assert.strictEqual(first, true)

        const available = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(available, 1)
      }))

    it.effect("tryAcquire fails when no permits available", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(1)

        // Acquire the only permit
        yield* TxSemaphore.acquire(semaphore)

        // Try to acquire when none available
        const result = yield* TxSemaphore.tryAcquire(semaphore)
        assert.strictEqual(result, false)

        const available = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(available, 0)
      }))

    it.effect("tryAcquireN succeeds when enough permits available", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)

        const result = yield* TxSemaphore.tryAcquireN(semaphore, 3)
        assert.strictEqual(result, true)

        const available = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(available, 2)
      }))

    it.effect("tryAcquireN fails when not enough permits available", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(2)

        const result = yield* TxSemaphore.tryAcquireN(semaphore, 3)
        assert.strictEqual(result, false)

        const available = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(available, 2)
      }))
  })

  describe("scoped operations", () => {
    it.effect("withPermit automatically manages permit lifecycle", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(2)

        const result = yield* TxSemaphore.withPermit(
          semaphore,
          Effect.gen(function*() {
            const available = yield* TxSemaphore.available(semaphore)
            assert.strictEqual(available, 1) // One permit acquired
            return "success"
          })
        )

        assert.strictEqual(result, "success")

        // Permit should be released
        const finalAvailable = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(finalAvailable, 2)
      }))

    it.effect("withPermits automatically manages multiple permits", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)

        const result = yield* TxSemaphore.withPermits(
          semaphore,
          3,
          Effect.gen(function*() {
            const available = yield* TxSemaphore.available(semaphore)
            assert.strictEqual(available, 2) // Three permits acquired
            return ["result1", "result2", "result3"]
          })
        )

        assert.deepStrictEqual(result, ["result1", "result2", "result3"])

        // All permits should be released
        const finalAvailable = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(finalAvailable, 5)
      }))

    it.effect("withPermitScoped works within scoped context", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(3)

        yield* Effect.scoped(
          Effect.gen(function*() {
            yield* TxSemaphore.withPermitScoped(semaphore)

            const available = yield* TxSemaphore.available(semaphore)
            assert.strictEqual(available, 2) // One permit acquired for scope
          })
        )

        // Permit should be released when scope closes
        const finalAvailable = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(finalAvailable, 3)
      }))
  })

  describe("edge cases", () => {
    it.effect("acquireN with zero permits causes defect", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)
        const result = yield* Effect.exit(TxSemaphore.acquireN(semaphore, 0))
        assert.isTrue(Exit.hasDie(result))
      }))

    it.effect("acquireN with negative permits causes defect", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)
        const result = yield* Effect.exit(TxSemaphore.acquireN(semaphore, -1))
        assert.isTrue(Exit.hasDie(result))
      }))

    it.effect("releaseN with zero permits causes defect", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)
        const result = yield* Effect.exit(TxSemaphore.releaseN(semaphore, 0))
        assert.isTrue(Exit.hasDie(result))
      }))

    it.effect("releaseN with negative permits causes defect", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)
        const result = yield* Effect.exit(TxSemaphore.releaseN(semaphore, -1))
        assert.isTrue(Exit.hasDie(result))
      }))

    it.effect("release does not exceed capacity", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(3)

        // Release more permits than capacity
        yield* TxSemaphore.release(semaphore)
        yield* TxSemaphore.release(semaphore)

        const available = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(available, 3) // Should not exceed capacity
      }))

    it.effect("releaseN does not exceed capacity", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)

        // Release more permits than capacity
        yield* TxSemaphore.releaseN(semaphore, 10)

        const available = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(available, 5) // Should not exceed capacity
      }))
  })

  describe("type guards", () => {
    it.effect("isTxSemaphore correctly identifies TxSemaphore instances", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)
        const notSemaphore = { some: "object" }

        assert.isTrue(TxSemaphore.isTxSemaphore(semaphore))
        assert.isFalse(TxSemaphore.isTxSemaphore(notSemaphore))
        assert.isFalse(TxSemaphore.isTxSemaphore(null))
        assert.isFalse(TxSemaphore.isTxSemaphore(undefined))
      }))
  })

  describe("concurrency", () => {
    it.effect("multiple fibers can acquire permits concurrently", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(3)

        const fiber1 = yield* Effect.fork(
          TxSemaphore.withPermit(semaphore, Effect.succeed(1))
        )

        const fiber2 = yield* Effect.fork(
          TxSemaphore.withPermit(semaphore, Effect.succeed(2))
        )

        const fiber3 = yield* Effect.fork(
          TxSemaphore.withPermit(semaphore, Effect.succeed(3))
        )

        const [result1, result2, result3] = yield* Effect.all([
          Fiber.join(fiber1),
          Fiber.join(fiber2),
          Fiber.join(fiber3)
        ])

        assert.strictEqual(result1, 1)
        assert.strictEqual(result2, 2)
        assert.strictEqual(result3, 3)

        // All permits should be released
        const finalAvailable = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(finalAvailable, 3)
      }))
  })

  describe("transactional behavior", () => {
    it.effect("operations are atomic within transactions", () =>
      Effect.gen(function*() {
        const semaphore = yield* TxSemaphore.make(5)

        yield* TxSemaphore.acquire(semaphore)
        yield* TxSemaphore.acquire(semaphore)
        yield* TxSemaphore.release(semaphore)

        const available = yield* TxSemaphore.available(semaphore)
        assert.strictEqual(available, 4) // Net effect: -1 permit
      }))
  })
})
