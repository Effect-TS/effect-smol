import { assert, describe, it } from "@effect/vitest"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as TxQueue from "effect/TxQueue"

describe("TxQueue", () => {
  describe("constructors", () => {
    it.effect("bounded creates queue with specified capacity", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(5)
        const size = yield* TxQueue.size(queue)
        const isEmpty = yield* TxQueue.isEmpty(queue)

        assert.strictEqual(size, 0)
        assert.strictEqual(isEmpty, true)
      }))

    it.effect("unbounded creates queue with unlimited capacity", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.unbounded<string>()
        const size = yield* TxQueue.size(queue)
        const isEmpty = yield* TxQueue.isEmpty(queue)

        assert.strictEqual(size, 0)
        assert.strictEqual(isEmpty, true)
      }))

    it.effect("dropping creates queue with dropping strategy", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.dropping<number>(2)
        const size = yield* TxQueue.size(queue)
        const isEmpty = yield* TxQueue.isEmpty(queue)

        assert.strictEqual(size, 0)
        assert.strictEqual(isEmpty, true)
      }))

    it.effect("sliding creates queue with sliding strategy", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.sliding<number>(2)
        const size = yield* TxQueue.size(queue)
        const isEmpty = yield* TxQueue.isEmpty(queue)

        assert.strictEqual(size, 0)
        assert.strictEqual(isEmpty, true)
      }))
  })

  describe("basic operations", () => {
    it.effect("offer and take work correctly", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<string>(10)

        const offered = yield* TxQueue.offer(queue, "hello")
        assert.strictEqual(offered, true)

        const item = yield* TxQueue.take(queue)
        assert.strictEqual(item, "hello")
      }))

    it.effect("poll returns Option.none for empty queue", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)

        const maybe = yield* TxQueue.poll(queue)
        assert.deepStrictEqual(maybe, Option.none())
      }))

    it.effect("poll returns Option.some for non-empty queue", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)
        yield* TxQueue.offer(queue, 42)

        const maybe = yield* TxQueue.poll(queue)
        assert.deepStrictEqual(maybe, Option.some(42))
      }))

    it.effect("offerAll works correctly", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)

        const rejected = yield* TxQueue.offerAll(queue, [1, 2, 3, 4, 5])
        assert.deepStrictEqual(Chunk.toReadonlyArray(rejected), [])

        const size = yield* TxQueue.size(queue)
        assert.strictEqual(size, 5)
      }))

    it.effect("takeAll works correctly", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)
        yield* TxQueue.offerAll(queue, [1, 2, 3, 4, 5])

        const items = yield* TxQueue.takeAll(queue)
        assert.deepStrictEqual(Chunk.toReadonlyArray(items), [1, 2, 3, 4, 5])

        const size = yield* TxQueue.size(queue)
        assert.strictEqual(size, 0)
      }))

    it.effect("takeN works correctly", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)
        yield* TxQueue.offerAll(queue, [1, 2, 3, 4, 5])

        const items = yield* TxQueue.takeN(queue, 3)
        assert.deepStrictEqual(Chunk.toReadonlyArray(items), [1, 2, 3])

        const size = yield* TxQueue.size(queue)
        assert.strictEqual(size, 2)
      }))

    it.effect("peek works correctly", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)
        yield* TxQueue.offer(queue, 42)

        const item = yield* TxQueue.peek(queue)
        assert.strictEqual(item, 42)

        // Item should still be in queue
        const size = yield* TxQueue.size(queue)
        assert.strictEqual(size, 1)
      }))
  })

  describe("queue state", () => {
    it.effect("size returns correct count", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)
        yield* TxQueue.offerAll(queue, [1, 2, 3])

        const size = yield* TxQueue.size(queue)
        assert.strictEqual(size, 3)
      }))

    it.effect("isEmpty works correctly", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)

        const empty1 = yield* TxQueue.isEmpty(queue)
        assert.strictEqual(empty1, true)

        yield* TxQueue.offer(queue, 1)
        const empty2 = yield* TxQueue.isEmpty(queue)
        assert.strictEqual(empty2, false)
      }))

    it.effect("isFull works correctly for bounded queue", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(2)

        const full1 = yield* TxQueue.isFull(queue)
        assert.strictEqual(full1, false)

        yield* TxQueue.offerAll(queue, [1, 2])
        const full2 = yield* TxQueue.isFull(queue)
        assert.strictEqual(full2, true)
      }))

    it.effect("isFull returns false for unbounded queue", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.unbounded<number>()
        yield* TxQueue.offerAll(queue, [1, 2, 3, 4, 5])

        const full = yield* TxQueue.isFull(queue)
        assert.strictEqual(full, false)
      }))
  })

  describe("shutdown", () => {
    it.effect("shutdown and isShutdown work correctly", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)

        const isShutdown1 = yield* TxQueue.isShutdown(queue)
        assert.strictEqual(isShutdown1, false)

        yield* TxQueue.shutdown(queue)
        const isShutdown2 = yield* TxQueue.isShutdown(queue)
        assert.strictEqual(isShutdown2, true)
      }))

    it.effect("offer fails after shutdown", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)
        yield* TxQueue.shutdown(queue)

        const offered = yield* TxQueue.offer(queue, 42)
        assert.strictEqual(offered, false)
      }))

    it.effect("poll returns none after shutdown", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.bounded<number>(10)
        yield* TxQueue.offer(queue, 42)
        yield* TxQueue.shutdown(queue)

        const maybe = yield* TxQueue.poll(queue)
        assert.deepStrictEqual(maybe, Option.none())
      }))
  })

  describe("dropping strategy", () => {
    it.effect("dropping queue rejects items when full", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.dropping<number>(2)

        // Fill to capacity
        const accepted1 = yield* TxQueue.offer(queue, 1)
        const accepted2 = yield* TxQueue.offer(queue, 2)
        assert.strictEqual(accepted1, true)
        assert.strictEqual(accepted2, true)

        // This should be dropped
        const accepted3 = yield* TxQueue.offer(queue, 3)
        assert.strictEqual(accepted3, false)

        const size = yield* TxQueue.size(queue)
        assert.strictEqual(size, 2)
      }))
  })

  describe("sliding strategy", () => {
    it.effect("sliding queue evicts old items when full", () =>
      Effect.gen(function*() {
        const queue = yield* TxQueue.sliding<number>(2)

        // Fill to capacity
        yield* TxQueue.offer(queue, 1)
        yield* TxQueue.offer(queue, 2)

        // This should evict item 1
        const accepted = yield* TxQueue.offer(queue, 3)
        assert.strictEqual(accepted, true)

        const size = yield* TxQueue.size(queue)
        assert.strictEqual(size, 2)

        // First item should be 2 (item 1 was evicted)
        const item = yield* TxQueue.take(queue)
        assert.strictEqual(item, 2)
      }))
  })
})
