import { assert, describe, it } from "@effect/vitest"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Queue from "effect/Queue"

describe("Channel", () => {
  describe("constructors", () => {
    it.effect("succeed", () =>
      Effect.gen(function*() {
        const result = yield* Channel.succeed(1).pipe(Channel.runCollect)
        assert.deepStrictEqual(result, [1])
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
              Effect.onInterrupt(Effect.sync(() => {
                interrupted = true
              }))
            ), { concurrency: 2 }),
          Channel.runDrain,
          Effect.fork
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
                Effect.onInterrupt(Effect.sync(() => {
                  interrupts++
                }))
              )
            }
            if (n === 2) {
              return latch2.open.pipe(
                Effect.andThen(Effect.never),
                Effect.onInterrupt(Effect.sync(() => {
                  interrupts++
                }))
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

  describe("merging", () => {
    it.effect("merge - interrupts left side if halt strategy is set to 'right'", () =>
      Effect.gen(function*() {
        const latch = yield* Effect.makeLatch(false)
        const leftQueue = yield* Queue.make<number>()
        const rightQueue = yield* Queue.make<number>()
        const left = Channel.fromQueue(rightQueue)
        const right = Channel.fromQueue(leftQueue).pipe(
          Channel.ensuring(latch.open)
        )
        const fiber = yield* Channel.merge(left, right, {
          haltStrategy: "right"
        }).pipe(Channel.runCollect, Effect.fork)
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
        const leftQueue = yield* Queue.make<number>()
        const rightQueue = yield* Queue.make<number>()
        const left = Channel.fromQueue(leftQueue).pipe(
          Channel.ensuring(latch.open)
        )
        const right = Channel.fromQueue(rightQueue)
        const fiber = yield* Channel.merge(left, right, {
          haltStrategy: "left"
        }).pipe(Channel.runCollect, Effect.fork)
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
        yield* Channel.fromIterable([1, 2, 3]).pipe(
          Channel.switchMap((n) => n === 3 ? Channel.empty : Channel.never),
          Channel.runDrain
        )
      }))
  })
})
