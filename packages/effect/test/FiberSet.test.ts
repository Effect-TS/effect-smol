import { assert, describe, it } from "@effect/vitest"
import { assertFalse, assertTrue, strictEqual } from "@effect/vitest/utils"
import { Deferred, Effect, Exit, Fiber, FiberSet, pipe, Ref, Scope } from "effect"
import { Array } from "effect/collections"
import { TestClock } from "effect/testing"

describe("FiberSet", () => {
  it.effect("interrupts fibers", () =>
    Effect.gen(function*() {
      const ref = yield* Ref.make(0)
      yield* Effect.scoped(
        Effect.gen(function*() {
          const set = yield* FiberSet.make()
          yield* Effect.onInterrupt(
            Effect.never,
            () => Ref.update(ref, (n) => n + 1)
          ).pipe(
            FiberSet.run(set),
            Effect.repeat({ times: 9 })
          )

          yield* Effect.yieldNow
        })
      )

      strictEqual(yield* Ref.get(ref), 10)
    }))

  it.effect("runtime", () =>
    Effect.gen(function*() {
      const ref = yield* Ref.make(0)
      yield* pipe(
        Effect.gen(function*() {
          const set = yield* FiberSet.make()
          const run = yield* FiberSet.runtime(set)<never>()
          Array.range(1, 10).forEach(() =>
            run(
              Effect.onInterrupt(
                Effect.never,
                () => Ref.update(ref, (n) => n + 1)
              )
            )
          )
          yield* Effect.yieldNow
        }),
        Effect.scoped
      )

      strictEqual(yield* Ref.get(ref), 10)
    }))

  it.effect("join", () =>
    Effect.gen(function*() {
      const set = yield* FiberSet.make()
      FiberSet.addUnsafe(set, Effect.runFork(Effect.void))
      FiberSet.addUnsafe(set, Effect.runFork(Effect.void))
      FiberSet.addUnsafe(set, Effect.runFork(Effect.fail("fail")))
      const result = yield* pipe(FiberSet.join(set), Effect.flip)
      strictEqual(result, "fail")
    }))

  it.effect("size", () =>
    Effect.gen(function*() {
      const scope = yield* Scope.make()
      const set = yield* pipe(FiberSet.make(), Scope.provide(scope))
      FiberSet.addUnsafe(set, Effect.runFork(Effect.never))
      FiberSet.addUnsafe(set, Effect.runFork(Effect.never))
      strictEqual(yield* FiberSet.size(set), 2)
      yield* Scope.close(scope, Exit.void)
      strictEqual(yield* FiberSet.size(set), 0)
    }))

  it.effect("propagateInterruption false", () =>
    Effect.gen(function*() {
      const set = yield* FiberSet.make()
      const fiber = yield* FiberSet.run(set, Effect.never, {
        propagateInterruption: false
      })
      yield* Effect.yieldNow
      yield* Fiber.interrupt(fiber)
      assertFalse(yield* Deferred.isDone(set.deferred))
    }))

  it.effect("propagateInterruption true", () =>
    Effect.gen(function*() {
      const set = yield* FiberSet.make()
      const fiber = yield* FiberSet.run(set, Effect.never, {
        propagateInterruption: true
      })
      yield* Effect.yieldNow
      yield* Fiber.interrupt(fiber)
      assertTrue(Exit.hasInterrupt(
        yield* FiberSet.join(set).pipe(
          Effect.exit
        )
      ))
    }))

  it.effect("awaitEmpty", () =>
    Effect.gen(function*() {
      const set = yield* FiberSet.make()
      yield* FiberSet.run(set, Effect.sleep(1000))
      yield* FiberSet.run(set, Effect.sleep(1000))
      yield* FiberSet.run(set, Effect.sleep(1000))
      yield* FiberSet.run(set, Effect.sleep(1000))

      const fiber = yield* Effect.fork(FiberSet.awaitEmpty(set))
      yield* TestClock.adjust(500)
      assert.isUndefined(fiber.pollUnsafe())
      yield* TestClock.adjust(500)
      assert.isDefined(fiber.pollUnsafe())
    }))

  it.effect("makeRuntimePromise", () =>
    Effect.gen(function*() {
      const run = yield* FiberSet.makeRuntimePromise()
      const result = yield* Effect.promise(() => run(Effect.succeed("done")))
      strictEqual(result, "done")
    }))
})
