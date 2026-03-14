import { assert, describe, it } from "@effect/vitest"
import {
  Array,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Latch,
  Number,
  Pull,
  Random,
  Scope,
  Stream,
  SubscriptionRef
} from "effect"

describe("SubscriptionRef", () => {
  it.effect("multiple subscribers can receive changes", () =>
    Effect.gen(function*() {
      const ref = yield* SubscriptionRef.make(0)
      const latch1 = yield* Latch.make()
      const latch2 = yield* Latch.make()
      const fiber1 = yield* SubscriptionRef.changes(ref).pipe(
        Stream.tap(() => latch1.open),
        Stream.take(3),
        Stream.runCollect,
        Effect.forkScoped
      )
      yield* latch1.await
      yield* SubscriptionRef.update(ref, Number.increment)
      const fiber2 = yield* SubscriptionRef.changes(ref).pipe(
        Stream.tap(() => latch2.open),
        Stream.take(2),
        Stream.runCollect,
        Effect.forkScoped
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
      const ref = yield* SubscriptionRef.make(0)
      const latch1 = yield* Latch.make()
      const latch2 = yield* Latch.make()
      const fiber1 = yield* SubscriptionRef.changes(ref).pipe(
        Stream.tap(() => latch1.open),
        Stream.take(5),
        Stream.runCollect,
        Effect.forkScoped
      )
      yield* latch1.await
      yield* SubscriptionRef.update(ref, Number.increment)
      const fiber2 = yield* SubscriptionRef.changes(ref).pipe(
        Stream.tap(() => latch2.open),
        Stream.take(2),
        Stream.runCollect,
        Effect.forkScoped
      )
      yield* latch2.await
      yield* SubscriptionRef.update(ref, Number.increment)
      yield* Fiber.interrupt(fiber1)
      const result1 = yield* Fiber.await(fiber1)
      const result2 = yield* Fiber.join(fiber2)
      assert.isTrue(Exit.isFailure(result1) && Pull.isDoneCause(result1.cause))
      assert.deepStrictEqual(result2, [1, 2])
    }))

  it.effect("concurrent subscribes and unsubscribes are handled correctly", () =>
    Effect.gen(function*() {
      const ref = yield* SubscriptionRef.make(0)
      const producer = yield* SubscriptionRef.update(ref, Number.increment).pipe(
        Effect.forever,
        Effect.forkScoped
      )
      const [result1, result2] = yield* Effect.all([
        makeConsumer(ref),
        makeConsumer(ref)
      ], { concurrency: 2 })
      yield* Fiber.interrupt(producer)
      assert.deepStrictEqual(result1, Array.sort(Number.Order)(result1))
      assert.deepStrictEqual(result2, Array.sort(Number.Order)(result2))
    }))

  it.effect("effectful mutations are synchronized", () =>
    Effect.gen(function*() {
      const ref = yield* SubscriptionRef.make(0)
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const secondDone = yield* Deferred.make<void>()

      const first = yield* SubscriptionRef.updateEffect(ref, (n) =>
        Effect.gen(function*() {
          assert.strictEqual(n, 0)
          yield* Deferred.succeed(started, undefined)
          yield* Deferred.await(release)
          return n + 1
        })).pipe(Effect.forkScoped)

      yield* Deferred.await(started)

      const second = yield* SubscriptionRef.updateEffect(ref, (n) => Effect.succeed(n + 1)).pipe(
        Effect.tap(() => Deferred.succeed(secondDone, undefined)),
        Effect.forkScoped
      )

      assert.isFalse(yield* Deferred.isDone(secondDone))

      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(first)
      yield* Fiber.join(second)

      assert.strictEqual(yield* SubscriptionRef.get(ref), 2)
    }))

  it.effect("mutating a closed ref interrupts", () =>
    Effect.gen(function*() {
      const scope = yield* Scope.make()
      const ref = yield* SubscriptionRef.make(0).pipe(Scope.provide(scope))
      yield* Scope.close(scope, Exit.void)
      const getExit = yield* SubscriptionRef.get(ref)
      const setExit = yield* Effect.exit(SubscriptionRef.set(ref, 1))
      const changesExit = yield* SubscriptionRef.changes(ref).pipe(Stream.take(1), Stream.runCollect)
      assert.strictEqual(getExit, 0)
      assert.isTrue(Exit.hasInterrupts(setExit))
      assert.deepStrictEqual(changesExit, [0])
    }))
})

const makeConsumer = Effect.fnUntraced(
  function*(ref: SubscriptionRef.SubscriptionRef<number>) {
    const n = yield* Random.nextIntBetween(0, 200)
    const changes = SubscriptionRef.changes(ref)
    return yield* changes.pipe(Stream.take(n), Stream.runCollect)
  }
)
