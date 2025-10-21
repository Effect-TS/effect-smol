import { assert, describe, it } from "@effect/vitest"
import { Effect, Exit, Fiber, Number } from "effect"
import { Array } from "effect/collections"
import { Pull, Stream, SubscriptionRef } from "effect/stream"

describe("SubscriptionRef", () => {
  it.effect("multiple subscribers can receive changes", () =>
    Effect.gen(function*() {
      const ref = yield* SubscriptionRef.make(0)
      const latch1 = yield* Effect.makeLatch()
      const latch2 = yield* Effect.makeLatch()
      const fiber1 = yield* SubscriptionRef.changes(ref).pipe(
        Stream.tap(() => latch1.open),
        Stream.take(3),
        Stream.runCollect,
        Effect.fork
      )
      yield* latch1.await
      yield* SubscriptionRef.update(ref, Number.increment)
      const fiber2 = yield* SubscriptionRef.changes(ref).pipe(
        Stream.tap(() => latch2.open),
        Stream.take(2),
        Stream.runCollect,
        Effect.fork
      )
      yield* latch2.await
      yield* SubscriptionRef.update(ref, Number.increment)
      const result1 = yield* Fiber.join(fiber1)
      const result2 = yield* Fiber.join(fiber2)
      assert.deepStrictEqual(result1, [0, 1, 2])
      assert.deepStrictEqual(result2, [1, 2])
    }))

  it.effect("subscriptions are interruptible", () =>
    Effect.gen(function*() {
      const ref = yield* (SubscriptionRef.make(0))
      const latch1 = yield* Effect.makeLatch()
      const latch2 = yield* Effect.makeLatch()
      const fiber1 = yield* SubscriptionRef.changes(ref).pipe(
        Stream.tap(() => latch1.open),
        Stream.take(5),
        Stream.runCollect,
        Effect.fork
      )
      yield* latch1.await
      yield* SubscriptionRef.update(ref, Number.increment)
      const fiber2 = yield* SubscriptionRef.changes(ref).pipe(
        Stream.tap(() => latch2.open),
        Stream.take(2),
        Stream.runCollect,
        Effect.fork
      )
      yield* latch2.await
      yield* SubscriptionRef.update(ref, Number.increment)
      yield* Fiber.interrupt(fiber1)
      const result1 = yield* Fiber.await(fiber1)
      const result2 = yield* Fiber.join(fiber2)
      assert.isTrue(Exit.isFailure(result1) && Pull.isHaltCause(result1.cause))
      assert.deepStrictEqual(result2, [1, 2])
    }))

  it.effect("concurrent subscribes and unsubscribes are handled correctly", () =>
    Effect.gen(function*() {
      const ref = yield* SubscriptionRef.make(0)
      const producer = yield* SubscriptionRef.update(ref, Number.increment).pipe(
        Effect.forever,
        Effect.fork
      )
      const [result1, result2] = yield* Effect.all([
        makeConsumer(ref),
        makeConsumer(ref)
      ], { concurrency: 2 })
      yield* Fiber.interrupt(producer)
      assert.deepStrictEqual(result1, Array.sort(Number.Order)(result1))
      assert.deepStrictEqual(result2, Array.sort(Number.Order)(result2))
    }))
})

const makeConsumer = Effect.fnUntraced(
  function*(ref: SubscriptionRef.SubscriptionRef<number>) {
    const n = randomInteger(0, 200)
    const changes = SubscriptionRef.changes(ref)
    return yield* changes.pipe(Stream.take(n), Stream.runCollect)
  }
)

const randomInteger = (start: number, end: number) => Math.floor(Math.random() * (end - start)) + start
