import { assert, describe, it } from "@effect/vitest"
import { assertFailure, assertTrue } from "@effect/vitest/utils"
import { type Cause, Deferred, pipe, Ref } from "effect"
import * as Channel from "effect/Channel"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Filter from "effect/Filter"
import * as Queue from "effect/Queue"

describe("Channel", () => {
  describe("constructors", () => {
    it.effect("empty", () =>
      Effect.gen(function*() {
        const result = yield* Channel.empty.pipe(
          Channel.runCollect
        )
        assert.deepStrictEqual(result, [])
      }))

    it.effect("succeed", () =>
      Effect.gen(function*() {
        const result = yield* Channel.succeed(1).pipe(
          Channel.runCollect
        )
        assert.deepStrictEqual(result, [1])
      }))

    it.effect("sync", () =>
      Effect.gen(function*() {
        const result = yield* Channel.sync(() => 1).pipe(
          Channel.runCollect
        )
        assert.deepStrictEqual(result, [1])
      }))

    it.effect("end", () =>
      Effect.gen(function*() {
        let result = 0
        yield* Channel.end(42).pipe(
          Channel.mapDone((n) => {
            result = n
          }),
          Channel.runDrain
        )
        assert.strictEqual(result, 42)
      }))

    it.effect("endSync", () =>
      Effect.gen(function*() {
        let result = 0
        yield* Channel.endSync(() => 42).pipe(
          Channel.mapDone((n) => {
            result = n
          }),
          Channel.runDrain
        )
        assert.strictEqual(result, 42)
      }))

    it.effect("fromArray", () =>
      Effect.gen(function*() {
        const array = [0, 1, 2, 3, 4]
        const result = yield* Channel.runCollect(Channel.fromArray(array))
        assert.deepStrictEqual(result, array)
      }))

    it.effect("fromChunk", () =>
      Effect.gen(function*() {
        const chunk = Chunk.fromArrayUnsafe([0, 1, 2, 3, 4])
        const result = yield* Channel.runCollect(Channel.fromChunk(chunk))
        assert.deepStrictEqual(result, Chunk.toArray(chunk))
      }))

    it.effect("fromIterator", () =>
      Effect.gen(function*() {
        const result = yield* Channel.fromIterator(() => ({
          n: 0,
          next(this: { n: number }) {
            return this.n === 5
              ? { done: true, value: this.n }
              : { done: false, value: this.n++ }
          }
        })).pipe(Channel.runCollect)
        assert.deepStrictEqual(result, [0, 1, 2, 3, 4])
      }))

    it.effect("fromIteratorArray", () =>
      Effect.gen(function*() {
        function* fibonacci(): Generator<number, void, unknown> {
          let a = 0, b = 1
          for (let i = 0; i < 5; i++) {
            yield a
            ;[a, b] = [b, a + b]
          }
        }
        const result = yield* Channel.runCollect(
          Channel.fromIteratorArray(() => fibonacci(), 3)
        )
        assert.deepStrictEqual(result, [[0, 1, 1], [2, 3]])
      }))

    it.effect("fromIterable", () =>
      Effect.gen(function*() {
        const set = new Set([1, 1, 2, 3])
        const result = yield* Channel.runCollect(Channel.fromIterable(set))
        assert.deepStrictEqual(result, [1, 2, 3])
      }))

    it.effect("fromIterableArray", () =>
      Effect.gen(function*() {
        const numbers = [1, 2, 3, 4, 5]
        const result = yield* Channel.runCollect(Channel.fromIterableArray(numbers))
        const resultChunked = yield* Channel.runCollect(Channel.fromIterableArray(numbers, 4))
        assert.deepStrictEqual(result, [[1, 2, 3, 4, 5]])
        assert.deepStrictEqual(resultChunked, [[1, 2, 3, 4], [5]])
      }))

    it.effect("acquireRelease", () =>
      Effect.gen(function*() {
        const acquired = yield* Ref.make(false)
        const released = yield* Ref.make(false)
        yield* Channel.acquireRelease(
          Ref.set(acquired, true),
          () => Ref.set(released, true)
        ).pipe(Channel.runDrain)
        assert.isTrue(yield* Ref.get(acquired))
        assert.isTrue(yield* Ref.get(released))
      }))
  })

  describe("mapping", () => {
    it.effect("map", () =>
      Effect.gen(function*() {
        const result = yield* Channel.fromArray([1, 2, 3]).pipe(
          Channel.map((n) => n + 1),
          Channel.runCollect
        )
        assert.deepStrictEqual(result, [2, 3, 4])
      }))

    it.effect("mapEffect - propagates interruption", () =>
      Effect.gen(function*() {
        let interrupted = false
        const latch = yield* Effect.makeLatch(false)
        const fiber = yield* Channel.succeed(1).pipe(
          Channel.mapEffect(() =>
            latch.open.pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() =>
                Effect.sync(() => {
                  interrupted = true
                })
              )
            ), { concurrency: 2 }),
          Channel.runDrain,
          Effect.forkChild
        )
        yield* Fiber.interrupt(fiber).pipe(latch.whenOpen)
        assert.isTrue(interrupted)
      }))

    it.effect("mapEffect - interrupts pending tasks on failure", () =>
      Effect.gen(function*() {
        let interrupts = 0
        const latch1 = yield* Effect.makeLatch(false)
        const latch2 = yield* Effect.makeLatch(false)
        const result = yield* Channel.fromArray([1, 2, 3]).pipe(
          Channel.mapEffect((n) => {
            if (n === 1) {
              return latch1.open.pipe(
                Effect.andThen(Effect.never),
                Effect.onInterrupt(() =>
                  Effect.sync(() => {
                    interrupts++
                  })
                )
              )
            }
            if (n === 2) {
              return latch2.open.pipe(
                Effect.andThen(Effect.never),
                Effect.onInterrupt(() =>
                  Effect.sync(() => {
                    interrupts++
                  })
                )
              )
            }
            return Effect.fail("boom").pipe(
              latch1.whenOpen,
              latch2.whenOpen
            )
          }, { concurrency: 3 }),
          Channel.runDrain,
          Effect.exit
        )
        assert.strictEqual(interrupts, 2)
        assert.deepStrictEqual(result, Exit.fail("boom"))
      }))
  })

  describe("filtering", () => {
    it.effect("filterMap", () =>
      Effect.gen(function*() {
        const filter = Filter.make((n: number) => n % 2 === 0 ? n * 2 : Filter.fail(n))
        const result = yield* Channel.fromArray([1, 2, 3, 4]).pipe(
          Channel.filterMap(filter),
          Channel.runCollect
        )
        assert.deepStrictEqual(result, [4, 8])
      }))

    it.effect("filterMapEffect", () =>
      Effect.gen(function*() {
        const filter = Filter.makeEffect((n: number) => Effect.succeed(n > 2 ? n + 1 : Filter.fail(n)))
        const result = yield* Channel.fromArray([1, 2, 3, 4]).pipe(
          Channel.filterMapEffect(filter),
          Channel.runCollect
        )
        assert.deepStrictEqual(result, [4, 5])
      }))
  })

  describe("merging", () => {
    it.effect("merge - interrupts left side if halt strategy is set to 'right'", () =>
      Effect.gen(function*() {
        const latch = yield* Effect.makeLatch(false)
        const leftQueue = yield* Queue.make<number, Cause.Done>()
        const rightQueue = yield* Queue.make<number>()
        const left = Channel.fromQueue(rightQueue)
        const right = Channel.fromQueue(leftQueue).pipe(
          Channel.ensuring(latch.open)
        )
        const fiber = yield* Channel.merge(left, right, {
          haltStrategy: "right"
        }).pipe(Channel.runCollect, Effect.forkChild)
        yield* Queue.offerAll(leftQueue, [1, 2])
        yield* Queue.end(leftQueue)
        yield* latch.await
        yield* Queue.offerAll(rightQueue, [3, 4])
        const result = yield* Fiber.join(fiber)
        assert.deepStrictEqual(result, [1, 2])
      }))

    it.effect("merge - interrupts right side if halt strategy is set to 'left'", () =>
      Effect.gen(function*() {
        const latch = yield* Effect.makeLatch(false)
        const leftQueue = yield* Queue.make<number, Cause.Done>()
        const rightQueue = yield* Queue.make<number>()
        const left = Channel.fromQueue(leftQueue).pipe(
          Channel.ensuring(latch.open)
        )
        const right = Channel.fromQueue(rightQueue)
        const fiber = yield* Channel.merge(left, right, {
          haltStrategy: "left"
        }).pipe(Channel.runCollect, Effect.forkChild)
        yield* Queue.offerAll(leftQueue, [1, 2])
        yield* Queue.end(leftQueue)
        yield* latch.await
        yield* Queue.offerAll(rightQueue, [3, 4])
        const result = yield* Fiber.join(fiber)
        assert.deepStrictEqual(result, [1, 2])
      }))

    it.effect("merge - interrupts losing side if halt strategy is set to 'either'", () =>
      Effect.gen(function*() {
        const left = Channel.fromEffect(Effect.never)
        const right = Channel.succeed(1)
        const result = yield* Channel.merge(left, right, {
          haltStrategy: "either"
        }).pipe(Channel.runCollect)
        assert.deepStrictEqual(result, [1])
      }))

    it.effect("merge - waits for both sides if halt strategy is set to 'both'", () =>
      Effect.gen(function*() {
        const left = Channel.succeed(1)
        const right = Channel.succeed(2)
        const result = yield* Channel.merge(left, right, {
          haltStrategy: "both"
        }).pipe(Channel.runCollect)
        assert.deepStrictEqual(result, [1, 2])
      }))

    it.effect("merge - prioritizes failure", () =>
      Effect.gen(function*() {
        const left = Channel.fromEffect(Effect.fail("boom"))
        const right = Channel.fromEffect(Effect.never)
        const result = yield* Channel.merge(left, right).pipe(
          Channel.runCollect,
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.fail("boom"))
      }))
  })

  describe("switchMap", () => {
    it.effect("interrupts the previous channel", () =>
      Effect.gen(function*() {
        const result = yield* Channel.fromIterable([1, 2, 3]).pipe(
          Channel.switchMap((n) => n === 3 ? Channel.empty : Channel.never),
          Channel.runDrain
        )
        assert.isUndefined(result)
      }))
  })

  describe("interruptWhen", () => {
    it.effect("interrupts the current element", () =>
      Effect.gen(function*() {
        const interrupted = yield* Ref.make(false)
        const latch = yield* Deferred.make<void>()
        const halt = yield* Deferred.make<void>()
        const started = yield* Deferred.make<void>()
        const channel = Deferred.succeed(started, void 0).pipe(
          Effect.andThen(Deferred.await(latch)),
          Effect.onInterrupt(() => Ref.set(interrupted, true)),
          Channel.fromEffect,
          Channel.interruptWhen(Deferred.await(halt))
        )
        const fiber = yield* Effect.forkChild(Channel.runDrain(channel))
        yield* pipe(
          Deferred.await(started),
          Effect.andThen(Deferred.succeed(halt, void 0))
        )
        yield* Fiber.await(fiber)
        const result = yield* Ref.get(interrupted)
        assertTrue(result)
      }))

    it.effect("interruptWhen - propagates errors", () =>
      Effect.gen(function*() {
        const deferred = yield* Deferred.make<never, string>()
        const channel = Channel.fromEffect(Effect.never).pipe(
          Channel.interruptWhen(Deferred.await(deferred))
        )
        yield* Deferred.fail(deferred, "fail")
        const result = yield* Effect.result(Channel.runDrain(channel))
        assertFailure(result, "fail")
      }))
  })
})
