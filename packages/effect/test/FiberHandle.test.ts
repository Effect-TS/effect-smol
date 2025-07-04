import { assert, describe, it } from "@effect/vitest"
import { assertFalse, assertTrue, strictEqual } from "@effect/vitest/utils"
import { Deferred, Effect, Exit, Fiber, FiberHandle, pipe, Ref, TestClock } from "effect"

describe("FiberHandle", () => {
  it.effect("interrupts fibers", () =>
    Effect.gen(function*() {
      const ref = yield* (Ref.make(0))
      yield* pipe(
        Effect.gen(function*() {
          const handle = yield* FiberHandle.make()
          yield* FiberHandle.run(handle, Effect.onInterrupt(Effect.never, Ref.update(ref, (n) => n + 1)))
          yield* Effect.yieldNow
        }),
        Effect.scoped
      )

      strictEqual(yield* (Ref.get(ref)), 1)
    }))

  it.effect("runtime", () =>
    Effect.gen(function*() {
      const ref = yield* Ref.make(0)
      yield* pipe(
        Effect.gen(function*() {
          const handle = yield* FiberHandle.make()
          const run = yield* FiberHandle.runtime(handle)<never>()
          run(Effect.onInterrupt(Effect.never, Ref.update(ref, (n) => n + 1)))
          yield* Effect.yieldNow
          run(Effect.onInterrupt(Effect.never, Ref.update(ref, (n) => n + 1)))
          yield* Effect.yieldNow
          run(Effect.onInterrupt(Effect.never, Ref.update(ref, (n) => n + 1)), {
            onlyIfMissing: true
          })
          yield* Effect.yieldNow
          strictEqual(yield* Ref.get(ref), 1)
        }),
        Effect.scoped
      )

      strictEqual(yield* Ref.get(ref), 2)
    }))

  it.effect("join", () =>
    Effect.gen(function*() {
      const handle = yield* FiberHandle.make()
      FiberHandle.unsafeSet(handle, Effect.runFork(Effect.void))
      FiberHandle.unsafeSet(handle, Effect.runFork(Effect.fail("fail")))
      const result = yield* Effect.flip(FiberHandle.join(handle))
      strictEqual(result, "fail")
    }))

  it.effect("onlyIfMissing", () =>
    Effect.gen(function*() {
      const handle = yield* FiberHandle.make()
      const fiberA = yield* FiberHandle.run(handle, Effect.never)
      const fiberB = yield* FiberHandle.run(handle, Effect.never, { onlyIfMissing: true })
      const fiberC = yield* FiberHandle.run(handle, Effect.never, { onlyIfMissing: true })
      yield* Effect.yieldNow
      assertTrue(Exit.hasInterrupt(yield* Fiber.await(fiberB)))
      assertTrue(Exit.hasInterrupt(yield* Fiber.await(fiberC)))
      strictEqual(fiberA.unsafePoll(), undefined)
    }))

  it.effect("runtime onlyIfMissing", () =>
    Effect.gen(function*() {
      const run = yield* FiberHandle.makeRuntime<never>()
      const fiberA = run(Effect.never)
      const fiberB = run(Effect.never, { onlyIfMissing: true })
      const fiberC = run(Effect.never, { onlyIfMissing: true })
      yield* Effect.yieldNow
      assertTrue(Exit.hasInterrupt(yield* Fiber.await(fiberB)))
      assertTrue(Exit.hasInterrupt(yield* Fiber.await(fiberC)))
      strictEqual(fiberA.unsafePoll(), undefined)
    }))

  it.effect("propagateInterruption: false", () =>
    Effect.gen(function*() {
      const handle = yield* FiberHandle.make()
      const fiber = yield* FiberHandle.run(handle, Effect.never, {
        propagateInterruption: false
      })
      yield* Effect.yieldNow
      yield* Fiber.interrupt(fiber)
      assertFalse(yield* Deferred.isDone(handle.deferred))
    }))

  it.effect("propagateInterruption: true", () =>
    Effect.gen(function*() {
      const handle = yield* FiberHandle.make()
      const fiber = yield* FiberHandle.run(handle, Effect.never, {
        propagateInterruption: true
      })
      yield* Effect.yieldNow
      yield* Fiber.interrupt(fiber)
      assertTrue(Exit.hasInterrupt(
        yield* FiberHandle.join(handle).pipe(
          Effect.exit
        )
      ))
    }))

  it.effect("awaitEmpty", () =>
    Effect.gen(function*() {
      const handle = yield* FiberHandle.make()
      yield* FiberHandle.run(handle, Effect.sleep(1000))

      const fiber = yield* Effect.fork(FiberHandle.awaitEmpty(handle))
      yield* TestClock.adjust(500)
      assert.isUndefined(fiber.unsafePoll())
      yield* TestClock.adjust(500)
      assert.isDefined(fiber.unsafePoll())
    }))

  it.effect("makeRuntimePromise", () =>
    Effect.gen(function*() {
      const run = yield* FiberHandle.makeRuntimePromise()
      const result = yield* Effect.promise(() => run(Effect.succeed("done")))
      strictEqual(result, "done")
    }))
})
