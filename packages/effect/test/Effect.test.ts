import { assert, describe, it } from "@effect/vitest"
import { Fiber, Schedule, Scope, ServiceMap } from "effect"
import * as Cause from "effect/Cause"
import { Data, Filter, Option, Result } from "effect/data"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { constFalse, constTrue, pipe } from "effect/Function"
import { TxRef } from "effect/stm"
import { TestClock } from "effect/testing"

class ATag extends ServiceMap.Service<ATag, "A">()("ATag") {}

describe("Effect", () => {
  describe("structural compare", () => {
    it("should pass structural comparison", () => {
      assert.deepEqual(Effect.succeed(0), Effect.succeed(0))
    })
    it("should fail structural comparison", () => {
      assert.notDeepEqual(Effect.succeed(0), Effect.succeed(1))
    })
  })
  describe("tracing", () => {
    it.effect("failCause captures current span", () =>
      Effect.gen(function*() {
        const cause = yield* Effect.failCause(Cause.die(new Error("boom"))).pipe(
          Effect.withSpan("test span"),
          Effect.sandbox,
          Effect.flip
        )
        const annotations = Cause.annotations(cause)
        const span = ServiceMap.getUnsafe(annotations, Cause.CurrentSpan)
        assert.strictEqual(span.name, "test span")
      }))
  })

  it("callback can branch over sync/async", async () => {
    const program = Effect.callback<number>(function(resume) {
      if (this.executionMode === "sync") {
        resume(Effect.succeed(1))
      } else {
        Promise.resolve().then(() => resume(Effect.succeed(2)))
      }
    })

    const isSync = Effect.runSync(program)
    const isAsync = await Effect.runPromise(program)

    assert.strictEqual(isSync, 1)
    assert.strictEqual(isAsync, 2)
  })
  it("runPromise", async () => {
    const result = await Effect.runPromise(Effect.succeed(1))
    assert.strictEqual(result, 1)
  })

  it("acquireUseRelease interrupt", async () => {
    let acquire = false
    let use = false
    let release = false
    const fiber = Effect.acquireUseRelease(
      Effect.sync(() => {
        acquire = true
        return 123
      }).pipe(Effect.delay(100)),
      () =>
        Effect.sync(() => {
          use = true
        }),
      (_) =>
        Effect.sync(() => {
          assert.strictEqual(_, 123)
          release = true
        })
    ).pipe(Effect.runFork)
    fiber.interruptUnsafe()
    const result = await Effect.runPromise(Fiber.await(fiber))
    assert.deepStrictEqual(result, Exit.failCause(Cause.interrupt()))
    assert.isTrue(acquire)
    assert.isFalse(use)
    assert.isTrue(release)
  })

  it("acquireUseRelease uninterruptible", async () => {
    let acquire = false
    let use = false
    let release = false
    const fiber = Effect.acquireUseRelease(
      Effect.sync(() => {
        acquire = true
        return 123
      }).pipe(Effect.delay(100)),
      (_) =>
        Effect.sync(() => {
          use = true
          return _
        }),
      (_) =>
        Effect.sync(() => {
          assert.strictEqual(_, 123)
          release = true
        })
    ).pipe(Effect.uninterruptible, Effect.runFork)
    fiber.interruptUnsafe()
    const result = await Effect.runPromise(Fiber.await(fiber))
    assert.deepStrictEqual(result, Exit.failCause(Cause.interrupt()))
    assert.isTrue(acquire)
    assert.isTrue(use)
    assert.isTrue(release)
  })

  it("ServiceMap.Service", () =>
    ATag.asEffect().pipe(
      Effect.tap((_) => Effect.sync(() => assert.strictEqual(_, "A"))),
      Effect.provideService(ATag, "A"),
      Effect.runPromise
    ))

  describe("fromOption", () => {
    it("from a some", () =>
      Option.some("A").asEffect().pipe(
        Effect.tap((_) => assert.strictEqual(_, "A")),
        Effect.runPromise
      ))

    it("from a none", () =>
      Option.none().asEffect().pipe(
        Effect.flip,
        Effect.tap((error) => assert.ok(error instanceof Cause.NoSuchElementError)),
        Effect.runPromise
      ))

    it.effect("yieldable", () =>
      Effect.gen(function*() {
        const result = yield* Option.some("A")
        assert.strictEqual(result, "A")

        const error = yield* Effect.gen(function*() {
          yield* Option.none()
        }).pipe(Effect.flip)
        assert.deepStrictEqual(error, new Cause.NoSuchElementError())
      }))
  })

  describe("fromResult", () => {
    it("from a success", () =>
      Result.succeed("A").pipe(
        Effect.fromResult,
        Effect.tap((_) => Effect.sync(() => assert.strictEqual(_, "A"))),
        Effect.runPromise
      ))

    it("from a failure", () =>
      Result.fail("error").asEffect().pipe(
        Effect.flip,
        Effect.tap((error) => Effect.sync(() => assert.strictEqual(error, "error"))),
        Effect.runPromise
      ))

    it.effect("yieldable", () =>
      Effect.gen(function*() {
        const result = yield* Result.succeed("A")
        assert.strictEqual(result, "A")

        const error = yield* Effect.gen(function*() {
          yield* Result.fail("error")
        }).pipe(Effect.flip)
        assert.strictEqual(error, "error")
      }))
  })

  describe("gen", () => {
    it("gen", () =>
      Effect.gen(function*() {
        const result = yield* Effect.succeed(1)
        assert.strictEqual(result, 1)
        return result
      }).pipe(Effect.runPromise).then((_) => assert.deepStrictEqual(_, 1)))

    it("gen with context", () =>
      Effect.gen({ a: 1, b: 2 }, function*() {
        const result = yield* Effect.succeed(this.a)
        assert.strictEqual(result, 1)
        return result + this.b
      }).pipe(Effect.runPromise).then((_) => assert.deepStrictEqual(_, 3)))
  })

  describe("forEach", () => {
    it("sequential", () =>
      Effect.gen(function*() {
        const results = yield* Effect.forEach([1, 2, 3], (_) => Effect.succeed(_))
        assert.deepStrictEqual(results, [1, 2, 3])
      }).pipe(Effect.runPromise))

    it("unbounded", () =>
      Effect.gen(function*() {
        const results = yield* Effect.forEach([1, 2, 3], (_) => Effect.succeed(_), { concurrency: "unbounded" })
        assert.deepStrictEqual(results, [1, 2, 3])
      }).pipe(Effect.runPromise))

    it("bounded", () =>
      Effect.gen(function*() {
        const results = yield* Effect.forEach([1, 2, 3, 4, 5], (_) => Effect.succeed(_), { concurrency: 2 })
        assert.deepStrictEqual(results, [1, 2, 3, 4, 5])
      }).pipe(Effect.runPromise))

    it.effect("inherit unbounded", () =>
      Effect.gen(function*() {
        const handle = yield* Effect.forEach([1, 2, 3], (_) => Effect.succeed(_).pipe(Effect.delay(50)), {
          concurrency: "inherit"
        }).pipe(
          Effect.withConcurrency("unbounded"),
          Effect.forkChild
        )
        yield* TestClock.adjust(90)
        assert.deepStrictEqual(handle.pollUnsafe(), Exit.succeed([1, 2, 3]))
      }))

    it.effect("sequential interrupt", () =>
      Effect.gen(function*() {
        const done: Array<number> = []
        const fiber = yield* Effect.forEach([1, 2, 3, 4, 5, 6], (i) =>
          Effect.sync(() => {
            done.push(i)
            return i
          }).pipe(Effect.delay(300))).pipe(Effect.forkChild)
        yield* TestClock.adjust(800)
        yield* Fiber.interrupt(fiber)
        const result = yield* Fiber.await(fiber)
        assert.isTrue(Exit.hasInterrupt(result))
        assert.deepStrictEqual(done, [1, 2])
      }))

    it.effect("unbounded interrupt", () =>
      Effect.gen(function*() {
        const done: Array<number> = []
        const fiber = yield* Effect.forEach([1, 2, 3], (i) =>
          Effect.sync(() => {
            done.push(i)
            return i
          }).pipe(Effect.delay(150)), { concurrency: "unbounded" }).pipe(Effect.forkChild)
        yield* TestClock.adjust(50)
        yield* Fiber.interrupt(fiber)
        const result = yield* Fiber.await(fiber)
        assert.isTrue(Exit.hasInterrupt(result))
        assert.deepStrictEqual(done, [])
      }))

    it.effect("bounded interrupt", () =>
      Effect.gen(function*() {
        const done: Array<number> = []
        const fiber = yield* Effect.forEach([1, 2, 3, 4, 5, 6], (i) =>
          Effect.sync(() => {
            done.push(i)
            return i
          }).pipe(Effect.delay(200)), { concurrency: 2 }).pipe(Effect.forkChild)
        yield* TestClock.adjust(350)
        yield* Fiber.interrupt(fiber)
        const result = yield* Fiber.await(fiber)
        assert.isTrue(Exit.hasInterrupt(result))
        assert.deepStrictEqual(done, [1, 2])
      }))

    it.effect("unbounded fail", () =>
      Effect.gen(function*() {
        const done: Array<number> = []
        const handle = yield* Effect.forEach([1, 2, 3, 4, 5], (i) =>
          Effect.suspend(() => {
            done.push(i)
            return i === 3 ? Effect.fail("error") : Effect.succeed(i)
          }).pipe(Effect.delay(i * 100)), {
          concurrency: "unbounded"
        }).pipe(Effect.forkChild)
        yield* TestClock.adjust(500)
        const result = yield* Fiber.await(handle)
        assert.deepStrictEqual(result, Exit.fail("error"))
        assert.deepStrictEqual(done, [1, 2, 3])
      }))

    it("length = 0", () =>
      Effect.gen(function*() {
        const results = yield* Effect.forEach([], (_) => Effect.succeed(_))
        assert.deepStrictEqual(results, [])
      }).pipe(Effect.runPromise))
    it("string", () =>
      Effect.gen(function*() {
        const results = yield* Effect.forEach("abc", (_) => Effect.succeed(_))
        assert.deepStrictEqual(results, ["a", "b", "c"])
      }).pipe(Effect.runPromise))
  })

  describe("all", () => {
    it("tuple", () =>
      Effect.gen(function*() {
        const results = (yield* Effect.all([
          Effect.succeed(1),
          Effect.succeed(2),
          Effect.succeed(3)
        ])) satisfies [
          number,
          number,
          number
        ]
        assert.deepStrictEqual(results, [1, 2, 3])
      }).pipe(Effect.runPromise))

    it("record", () =>
      Effect.gen(function*() {
        const results = (yield* Effect.all({
          a: Effect.succeed(1),
          b: Effect.succeed("2"),
          c: Effect.succeed(true)
        })) satisfies {
          a: number
          b: string
          c: boolean
        }
        assert.deepStrictEqual(results, {
          a: 1,
          b: "2",
          c: true
        })
      }).pipe(Effect.runPromise))

    it.effect("record discard", () =>
      Effect.gen(function*() {
        const results = (yield* Effect.all({
          a: Effect.succeed(1),
          b: Effect.succeed("2"),
          c: Effect.succeed(true)
        }, { discard: true })) satisfies void
        assert.deepStrictEqual(results, void 0)
      }))

    it.effect("iterable", () =>
      Effect.gen(function*() {
        const results = (yield* Effect.all(
          new Set([
            Effect.succeed(1),
            Effect.succeed(2),
            Effect.succeed(3)
          ])
        )) satisfies Array<number>
        assert.deepStrictEqual(results, [1, 2, 3])
      }))
  })

  describe("filter", () => {
    it.live("odd numbers", () =>
      Effect.gen(function*() {
        const results = yield* Effect.filter([1, 2, 3, 4, 5], (_) => Effect.succeed(_ % 2 === 1 ? _ : Filter.fail(_)))
        assert.deepStrictEqual(results, [1, 3, 5])
      }))

    it.live("iterable", () =>
      Effect.gen(function*() {
        const results = yield* Effect.filter(new Set([1, 2, 3, 4, 5]), (_) =>
          Effect.succeed(_ % 2 === 1 ? _ : Filter.fail(_)))
        assert.deepStrictEqual(results, [1, 3, 5])
      }))
  })

  describe("acquireRelease", () => {
    it("releases on interrupt", () =>
      Effect.gen(function*() {
        let release = false
        const fiber = yield* Effect.acquireRelease(
          Effect.delay(Effect.succeed("foo"), 100),
          () =>
            Effect.sync(() => {
              release = true
            })
        ).pipe(
          Effect.scoped,
          Effect.forkChild({ startImmediately: true })
        )
        fiber.interruptUnsafe()
        yield* Fiber.await(fiber)
        assert.strictEqual(release, true)
      }).pipe(Effect.runPromise))
  })

  it.effect("raceAll", () =>
    Effect.gen(function*() {
      const interrupted: Array<number> = []
      const fiber = yield* Effect.raceAll([500, 300, 200, 0, 100].map((ms) =>
        (ms === 0 ? Effect.fail("boom") : Effect.succeed(ms)).pipe(
          Effect.delay(ms),
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              interrupted.push(ms)
            })
          )
        )
      )).pipe(Effect.forkChild)
      yield* TestClock.adjust("500 millis")
      const result = yield* Fiber.join(fiber)
      assert.strictEqual(result, 100)
      assert.deepStrictEqual(interrupted, [500, 300, 200])
    }))

  it.effect("raceAllFirst", () =>
    Effect.gen(function*() {
      const interrupted: Array<number> = []
      const fiber = yield* Effect.raceAllFirst([500, 300, 200, 0, 100].map((ms) =>
        (ms === 0 ? Effect.fail("boom") : Effect.succeed(ms)).pipe(
          Effect.delay(ms),
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              interrupted.push(ms)
            })
          )
        )
      )).pipe(Effect.exit, Effect.forkChild)
      yield* TestClock.adjust("500 millis")
      const result = yield* Fiber.join(fiber)
      assert.deepStrictEqual(result, Exit.fail("boom"))
      // 100 doesn't start because 0 finishes the race first
      assert.deepStrictEqual(interrupted, [500, 300, 200])
    }))

  describe("repeat", () => {
    it.effect("is interruptible", () =>
      Effect.gen(function*() {
        const fiber = yield* Effect.void.pipe(
          Effect.forever,
          Effect.timeoutOption(50),
          Effect.forkChild
        )
        yield* TestClock.adjust(50)
        const result = yield* Fiber.join(fiber)
        assert.deepStrictEqual(result, Option.none())
      }))

    it.effect("repeat/until - repeats until a condition is true", () =>
      Effect.gen(function*() {
        let input = 10
        let output = 0
        const decrement = Effect.sync(() => --input)
        const increment = Effect.sync(() => output++)
        const result = yield* decrement.pipe(
          Effect.tap(increment),
          Effect.repeat({ until: (n) => n === 0 })
        )
        assert.strictEqual(result, 0)
        assert.strictEqual(output, 10)
      }))

    it.effect("repeat/until - repeats until an effectful condition is true", () =>
      Effect.gen(function*() {
        let input = 10
        let output = 0
        const decrement = Effect.sync(() => --input)
        const increment = Effect.sync(() => output++)
        const result = yield* decrement.pipe(
          Effect.tap(increment),
          Effect.repeat({ until: (n) => Effect.succeed(n === 0) })
        )
        assert.strictEqual(result, 0)
        assert.strictEqual(output, 10)
      }))

    it.effect("repeat/until - always evaluates at least once", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.sync(() => n++)
        yield* Effect.repeat(increment, { until: constTrue })
        assert.strictEqual(n, 1)
      }))

    it.effect("repeat/while - repeats while a condition is true", () =>
      Effect.gen(function*() {
        let input = 10
        let output = 0
        const decrement = Effect.sync(() => --input)
        const increment = Effect.sync(() => output++)
        const result = yield* decrement.pipe(
          Effect.tap(increment),
          Effect.repeat({ while: (n) => n > 0 })
        )
        assert.strictEqual(result, 0)
        assert.strictEqual(output, 10)
      }))

    it.effect("repeat/while - repeats while an effectful condition is true", () =>
      Effect.gen(function*() {
        let input = 10
        let output = 0
        const decrement = Effect.sync(() => --input)
        const increment = Effect.sync(() => output++)
        const result = yield* decrement.pipe(
          Effect.tap(increment),
          Effect.repeat({ while: (n) => Effect.succeed(n > 0) })
        )
        assert.strictEqual(result, 0)
        assert.strictEqual(output, 10)
      }))

    it.effect("repeat/while - always evaluates at least once", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.sync(() => n++)
        yield* Effect.repeat(increment, { while: constFalse })
        assert.strictEqual(n, 1)
      }))

    it.effect("repeat/times", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.sync(() => ++n)
        const result = yield* Effect.repeat(increment, {
          times: 2
        })
        assert.strictEqual(n, 3)
        assert.strictEqual(result, 3)
      }))

    it.effect("repeat/schedule - repeats according to the specified schedule", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.sync(() => ++n)
        const result = yield* Effect.repeat(increment, Schedule.recurs(3))
        assert.strictEqual(result, 3)
      }))

    it.effect("repeat/schedule - with until", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.sync(() => ++n)
        const result = yield* Effect.repeat(increment, {
          schedule: Schedule.recurs(3),
          until: (n) => n === 3
        })
        assert.strictEqual(n, 3)
        assert.strictEqual(result, 2) // schedule result
      }))

    it.effect("repeat/schedule - with while", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.sync(() => ++n)
        const result = yield* Effect.repeat(increment, {
          schedule: Schedule.recurs(3),
          while: (n) => n < 3
        })
        assert.strictEqual(n, 3)
        assert.strictEqual(result, 2) // schedule result
      }))
  })

  describe("retry", () => {
    it.live("nothing on success", () =>
      Effect.gen(function*() {
        let count = 0
        yield* Effect.sync(() => count++).pipe(
          Effect.retry({ times: 10000 })
        )
        assert.strictEqual(count, 1)
      }))

    it.effect("retry/until - retries until a condition is true", () =>
      Effect.gen(function*() {
        let input = 10
        let output = 0
        const decrement = Effect.sync(() => --input)
        const increment = Effect.sync(() => output++)
        const result = yield* decrement.pipe(
          Effect.tap(increment),
          Effect.flip,
          Effect.retry({ until: (n) => n === 0 }),
          Effect.flip
        )
        assert.strictEqual(result, 0)
        assert.strictEqual(output, 10)
      }))

    it.effect("retry/until - retries until an effectful condition is true", () =>
      Effect.gen(function*() {
        let input = 10
        let output = 0
        const decrement = Effect.sync(() => --input)
        const increment = Effect.sync(() => output++)
        const result = yield* decrement.pipe(
          Effect.tap(increment),
          Effect.flip,
          Effect.retry({ until: (n) => Effect.succeed(n === 0) }),
          Effect.flip
        )
        assert.strictEqual(result, 0)
        assert.strictEqual(output, 10)
      }))

    it.effect("retry/until - always evaluates at least once", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.failSync(() => n++)
        yield* increment.pipe(
          Effect.retry({ until: constTrue }),
          Effect.flip
        )
        assert.strictEqual(n, 1)
      }))

    it.effect("retry/while - retries while a condition is true", () =>
      Effect.gen(function*() {
        let input = 10
        let output = 0
        const decrement = Effect.sync(() => --input)
        const increment = Effect.sync(() => output++)
        const result = yield* decrement.pipe(
          Effect.tap(increment),
          Effect.flip,
          Effect.retry({ while: (n) => n > 0 }),
          Effect.flip
        )
        assert.strictEqual(result, 0)
        assert.strictEqual(output, 10)
      }))

    it.effect("retry/while - retries while an effectful condition is true", () =>
      Effect.gen(function*() {
        let input = 10
        let output = 0
        const decrement = Effect.sync(() => --input)
        const increment = Effect.sync(() => output++)
        const result = yield* decrement.pipe(
          Effect.tap(increment),
          Effect.flip,
          Effect.retry({ while: (n) => Effect.succeed(n > 0) }),
          Effect.flip
        )
        assert.strictEqual(result, 0)
        assert.strictEqual(output, 10)
      }))

    it.effect("retry/while - always evaluates at least once", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.failSync(() => n++)
        yield* increment.pipe(
          Effect.retry({ while: constFalse }),
          Effect.flip
        )
        assert.strictEqual(n, 1)
      }))

    it.effect("retry/schedule - retries according to the specified schedule", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.failSync(() => n++)
        yield* increment.pipe(
          Effect.retry(Schedule.recurs(3)),
          Effect.flip
        )
        assert.strictEqual(n, 4)
      }))

    it.effect("retry/schedule - with until", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.failSync(() => ++n)
        yield* increment.pipe(
          Effect.retry({
            schedule: Schedule.recurs(3),
            until: (n) => n === 3
          }),
          Effect.flip
        )
        assert.strictEqual(n, 3)
      }))

    it.effect("retry/schedule - until errors", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.failSync(() => ++n)
        const result = yield* increment.pipe(
          Effect.retry({
            schedule: Schedule.recurs(3),
            until: () => Effect.fail("boom")
          }),
          Effect.flip
        )
        assert.strictEqual(n, 1)
        assert.strictEqual(result, "boom")
      }))

    it.effect("retry/schedule - with while", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.failSync(() => ++n)
        yield* increment.pipe(
          Effect.retry({
            schedule: Schedule.recurs(3),
            while: (n) => n < 3
          }),
          Effect.flip
        )
        assert.strictEqual(n, 3)
      }))

    it.effect("retry/schedule - while errors", () =>
      Effect.gen(function*() {
        let n = 0
        const increment = Effect.failSync(() => ++n)
        const result = yield* increment.pipe(
          Effect.retry({
            schedule: Schedule.recurs(3),
            while: () => Effect.fail("boom")
          }),
          Effect.flip
        )
        assert.strictEqual(n, 1)
        assert.strictEqual(result, "boom")
      }))
  })

  describe("timeoutOption", () => {
    it.live("timeout a long computation", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Effect.sleep(60_000),
          Effect.andThen(Effect.succeed(true)),
          Effect.timeoutOption(10)
        )
        assert.deepStrictEqual(result, Option.none())
      }))
    it.live("timeout a long computation with a failure", () =>
      Effect.gen(function*() {
        const error = new Error("boom")
        const result = yield* pipe(
          Effect.sleep(5000),
          Effect.andThen(Effect.succeed(true)),
          Effect.timeoutOrElse({
            onTimeout: () => Effect.die(error),
            duration: 10
          }),
          Effect.sandbox,
          Effect.flip
        )
        assert.deepStrictEqual(result, Cause.die(error))
      }))
    it.effect("timeout repetition of uninterruptible effect", () =>
      Effect.gen(function*() {
        const fiber = yield* pipe(
          Effect.void,
          Effect.uninterruptible,
          Effect.forever,
          Effect.timeoutOption(10),
          Effect.forkChild
        )
        yield* TestClock.adjust(10)
        const result = yield* Fiber.join(fiber)
        assert.deepStrictEqual(result, Option.none())
      }))
    it.effect("timeout in uninterruptible region", () =>
      Effect.void.pipe(
        Effect.timeoutOption(20_000),
        Effect.uninterruptible
      ), { timeout: 1000 })
  })

  describe("timeout", () => {
    it.live("timeout a long computation", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Effect.sleep(60_000),
          Effect.andThen(Effect.succeed(true)),
          Effect.timeout(10),
          Effect.flip
        )
        assert.deepStrictEqual(result, new Cause.TimeoutError())
      }))
  })

  describe("interruption", () => {
    it.effect("sync forever is interruptible", () =>
      Effect.gen(function*() {
        const fiber = yield* pipe(Effect.succeed(1), Effect.forever, Effect.forkChild)
        yield* Fiber.interrupt(fiber)
        assert(Exit.hasInterrupt(fiber.pollUnsafe()!))
      }))

    it.effect("interrupt of never is interrupted with cause", () =>
      Effect.gen(function*() {
        const fiber = yield* Effect.forkChild(Effect.never)
        yield* Fiber.interrupt(fiber)
        assert(Exit.hasInterrupt(fiber.pollUnsafe()!))
      }))

    it.effect("catch + ensuring + interrupt", () =>
      Effect.gen(function*() {
        let catchFailure = false
        let ensuring = false
        const handle = yield* Effect.never.pipe(
          Effect.catchCause((_) =>
            Effect.sync(() => {
              catchFailure = true
            })
          ),
          Effect.ensuring(Effect.sync(() => {
            ensuring = true
          })),
          Effect.forkChild({ startImmediately: true })
        )
        yield* Fiber.interrupt(handle)
        assert.isFalse(catchFailure)
        assert.isTrue(ensuring)
      }))

    it.effect("run of interruptible", () =>
      Effect.gen(function*() {
        let recovered = false
        const fiber = yield* Effect.never.pipe(
          Effect.interruptible,
          Effect.exit,
          Effect.flatMap((result) =>
            Effect.sync(() => {
              recovered = result._tag === "Failure" && Cause.isInterruptedOnly(result.cause)
            })
          ),
          Effect.uninterruptible,
          Effect.forkChild({ startImmediately: true })
        )
        yield* Fiber.interrupt(fiber)
        assert.isTrue(recovered)
      }))

    it.effect("alternating interruptibility", () =>
      Effect.gen(function*() {
        let counter = 0
        const fiber = yield* Effect.never.pipe(
          Effect.interruptible,
          Effect.exit,
          Effect.andThen(Effect.sync(() => {
            counter++
          })),
          Effect.uninterruptible,
          Effect.interruptible,
          Effect.exit,
          Effect.andThen(Effect.sync(() => {
            counter++
          })),
          Effect.uninterruptible,
          Effect.forkChild({ startImmediately: true })
        )
        yield* Fiber.interrupt(fiber)
        assert.strictEqual(counter, 2)
      }))

    it.live("acquireUseRelease use inherits interrupt status", () =>
      Effect.gen(function*() {
        let ref = false
        const fiber = yield* Effect.acquireUseRelease(
          Effect.succeed(123),
          (_) =>
            Effect.sync(() => {
              ref = true
            }).pipe(
              Effect.delay(10)
            ),
          () => Effect.void
        ).pipe(
          Effect.uninterruptible,
          Effect.forkChild({ startImmediately: true })
        )
        yield* Fiber.interrupt(fiber)
        assert.isTrue(ref)
      }))

    it.live("async can be uninterruptible", () =>
      Effect.gen(function*() {
        let ref = false
        const fiber = yield* Effect.sleep(10).pipe(
          Effect.andThen(() => {
            ref = true
          }),
          Effect.uninterruptible,
          Effect.forkChild({ startImmediately: true })
        )
        yield* Fiber.interrupt(fiber)
        assert.isTrue(ref)
      }))

    it.live("callback cannot resume on interrupt", () =>
      Effect.gen(function*() {
        const fiber = yield* Effect.callback<string>((resume) => {
          setTimeout(() => {
            resume(Effect.succeed("foo"))
          }, 10)
        }).pipe(
          Effect.onInterrupt(() => Effect.sleep(30)),
          Effect.forkChild({ startImmediately: true })
        )
        yield* Fiber.interrupt(fiber)
        assert.isTrue(Exit.hasInterrupt(fiber.pollUnsafe()!))
      }))

    it.live("closing scope is uninterruptible", () =>
      Effect.gen(function*() {
        let ref = false
        const child = pipe(
          Effect.sleep(10),
          Effect.andThen(() => {
            ref = true
          })
        )
        const fiber = yield* child.pipe(Effect.uninterruptible, Effect.forkChild({ startImmediately: true }))
        yield* Fiber.interrupt(fiber)
        assert.isTrue(ref)
      }))

    it.effect("AbortSignal is aborted", () =>
      Effect.gen(function*() {
        let signal: AbortSignal
        const fiber = yield* Effect.callback<void>((_cb, signal_) => {
          signal = signal_
        }).pipe(Effect.forkChild({ startImmediately: true }))
        yield* Fiber.interrupt(fiber)
        assert.strictEqual(signal!.aborted, true)
      }))
  })

  describe("fork", () => {
    it.effect("is interrupted with parent", () =>
      Effect.gen(function*() {
        let child = false
        let parent = false
        const fiber = yield* Effect.never.pipe(
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              child = true
            })
          ),
          Effect.forkChild({ startImmediately: true }),
          Effect.andThen(Effect.never),
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              parent = true
            })
          ),
          Effect.forkChild({ startImmediately: true })
        )
        yield* Fiber.interrupt(fiber)
        assert.isTrue(child)
        assert.isTrue(parent)
      }))
  })

  describe("forkDaemon", () => {
    it.effect("is not interrupted with parent", () =>
      Effect.gen(function*() {
        let child = false
        let parent = false
        const handle = yield* Effect.never.pipe(
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              child = true
            })
          ),
          Effect.forkDetach,
          Effect.andThen(Effect.never),
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              parent = true
            })
          ),
          Effect.forkChild({ startImmediately: true })
        )
        yield* Fiber.interrupt(handle)
        assert.isFalse(child)
        assert.isTrue(parent)
      }))
  })

  describe("forkIn", () => {
    it.effect("is interrupted when scope is closed", () =>
      Effect.gen(function*() {
        let interrupted = false
        const scope = yield* Scope.make()
        yield* Effect.never.pipe(
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              interrupted = true
            })
          ),
          Effect.forkIn(scope, { startImmediately: true })
        )
        yield* Scope.close(scope, Exit.void)
        assert.isTrue(interrupted)
      }))
  })

  describe("forkScoped", () => {
    it.effect("is interrupted when scope is closed", () =>
      Effect.gen(function*() {
        let interrupted = false
        const scope = yield* Scope.make()
        yield* Effect.never.pipe(
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              interrupted = true
            })
          ),
          Effect.fork({ startImmediately: true }),
          Scope.provide(scope)
        )
        yield* Scope.close(scope, Exit.void)
        assert.isTrue(interrupted)
      }))
  })

  // describe("do notation", () => {
  //   it.effect("works", () =>
  //     Effect.succeed(1).pipe(
  //       Effect.bindTo("a"),
  //       Effect.let("b", ({ a }) => a + 1),
  //       Effect.bind("b", ({ b }) => Effect.succeed(b.toString())),
  //       Effect.tap((_) => {
  //         assert.deepStrictEqual(_, {
  //           a: 1,
  //           b: "2"
  //         })
  //       })
  //     ))
  // })

  describe("stack safety", () => {
    it.live("recursion", () => {
      const loop: Effect.Effect<void> = Effect.void.pipe(
        Effect.flatMap((_) => loop)
      )
      return loop.pipe(
        Effect.timeoutOption(50)
      )
    })
  })

  describe("finalization", () => {
    const ExampleError = new Error("Oh noes!")

    it.effect("fail ensuring", () =>
      Effect.gen(function*() {
        let finalized = false
        const result = yield* Effect.fail(ExampleError).pipe(
          Effect.ensuring(Effect.sync(() => {
            finalized = true
          })),
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.fail(ExampleError))
        assert.isTrue(finalized)
      }))

    it.effect("fail on error", () =>
      Effect.gen(function*() {
        let finalized = false
        const result = yield* Effect.fail(ExampleError).pipe(
          Effect.onError(() =>
            Effect.sync(() => {
              finalized = true
            })
          ),
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.fail(ExampleError))
        assert.isTrue(finalized)
      }))

    it.effect("finalizer errors not caught", () =>
      Effect.gen(function*() {
        const e2 = new Error("e2")
        const e3 = new Error("e3")
        const result = yield* pipe(
          Effect.fail(ExampleError),
          Effect.ensuring(Effect.die(e2)),
          Effect.ensuring(Effect.die(e3)),
          Effect.sandbox,
          Effect.flip,
          Effect.map((cause) => cause)
        )
        assert.deepStrictEqual(result, Cause.die(e3))
      }))

    it.effect("finalizer errors reported", () =>
      Effect.gen(function*() {
        let reported: Exit.Exit<number> | undefined
        const result = yield* pipe(
          Effect.succeed(42),
          Effect.ensuring(Effect.die(ExampleError)),
          Effect.forkChild,
          Effect.flatMap((fiber) =>
            pipe(
              Fiber.await(fiber),
              Effect.flatMap((e) =>
                Effect.sync(() => {
                  reported = e
                })
              )
            )
          )
        )
        assert.isUndefined(result)
        assert.isFalse(reported !== undefined && Exit.isSuccess(reported))
      }))

    it.effect("acquireUseRelease usage result", () =>
      Effect.gen(function*() {
        const result = yield* Effect.acquireUseRelease(
          Effect.void,
          () => Effect.succeed(42),
          () => Effect.void
        )
        assert.strictEqual(result, 42)
      }))

    it.effect("error in just acquisition", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Effect.acquireUseRelease(
            Effect.fail(ExampleError),
            () => Effect.void,
            () => Effect.void
          ),
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.fail(ExampleError))
      }))

    it.effect("error in just release", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Effect.acquireUseRelease(
            Effect.void,
            () => Effect.void,
            () => Effect.die(ExampleError)
          ),
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.die(ExampleError))
      }))

    it.effect("error in just usage", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Effect.acquireUseRelease(
            Effect.void,
            () => Effect.fail(ExampleError),
            () => Effect.void
          ),
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.fail(ExampleError))
      }))

    it.effect("rethrown caught error in acquisition", () =>
      Effect.gen(function*() {
        const result = yield* Effect.acquireUseRelease(
          Effect.fail(ExampleError),
          () => Effect.void,
          () => Effect.void
        ).pipe(Effect.flip)
        assert.deepEqual(result, ExampleError)
      }))

    it.effect("rethrown caught error in release", () =>
      Effect.gen(function*() {
        const result = yield* pipe(
          Effect.acquireUseRelease(
            Effect.void,
            () => Effect.void,
            () => Effect.die(ExampleError)
          ),
          Effect.exit
        )
        assert.deepStrictEqual(result, Exit.die(ExampleError))
      }))

    it.effect("rethrown caught error in usage", () =>
      Effect.gen(function*() {
        const result = yield* Effect.acquireUseRelease(
          Effect.void,
          () => Effect.fail(ExampleError),
          () => Effect.void
        ).pipe(Effect.exit)
        assert.deepEqual(result, Exit.fail(ExampleError))
      }))

    it.effect("onResult - ensures that a cleanup function runs when an effect fails", () =>
      Effect.gen(function*() {
        let ref = false
        yield* Effect.die("boom").pipe(
          Effect.onExit((result) =>
            Exit.hasDie(result) ?
              Effect.sync(() => {
                ref = true
              }) :
              Effect.void
          ),
          Effect.sandbox,
          Effect.ignore
        )
        assert.isTrue(ref)
      }))
  })

  describe("error handling", () => {
    class ErrorA extends Data.TaggedError("A") {}
    class ErrorB extends Data.TaggedError("B") {}
    class ErrorC extends Data.Error {}

    it.effect("catchTag", () =>
      Effect.gen(function*() {
        let error: ErrorA | ErrorB | ErrorC = new ErrorA()
        const effect = Effect.failSync(() => error).pipe(
          Effect.catchTag("A", (_) => Effect.succeed(1)),
          Effect.catchTag("B", (_) => Effect.succeed(2)),
          Effect.orElseSucceed(() => 3)
        )
        assert.strictEqual(yield* effect, 1)
        error = new ErrorB()
        assert.strictEqual(yield* effect, 2)
        error = new ErrorC()
        assert.strictEqual(yield* effect, 3)
      }))
  })

  describe("zip", () => {
    it.effect("concurrent: false", () => {
      const executionOrder: Array<string> = []
      const task1 = Effect.succeed("a").pipe(Effect.delay(50), Effect.tap(() => executionOrder.push("task1")))
      const task2 = Effect.succeed(1).pipe(Effect.delay(1), Effect.tap(() => executionOrder.push("task2")))
      return Effect.gen(function*() {
        const fiber = yield* Effect.forkChild(Effect.zip(task1, task2))
        yield* TestClock.adjust(51)
        const result = yield* Fiber.join(fiber)
        assert.deepStrictEqual(result, ["a", 1])
        assert.deepStrictEqual(executionOrder, ["task1", "task2"])
      })
    })
    it.effect("concurrent: true", () => {
      const executionOrder: Array<string> = []
      const task1 = Effect.succeed("a").pipe(Effect.delay(50), Effect.tap(() => executionOrder.push("task1")))
      const task2 = Effect.succeed(1).pipe(Effect.delay(1), Effect.tap(() => executionOrder.push("task2")))
      return Effect.gen(function*() {
        const fiber = yield* Effect.forkChild(Effect.zip(task1, task2, { concurrent: true }))
        yield* TestClock.adjust(50)
        const result = yield* Fiber.join(fiber)
        assert.deepStrictEqual(result, ["a", 1])
        assert.deepStrictEqual(executionOrder, ["task2", "task1"])
      })
    })
  })

  describe("zipWith", () => {
    it.effect("concurrent: false", () => {
      const executionOrder: Array<string> = []
      const task1 = Effect.succeed("a").pipe(Effect.delay(50), Effect.tap(() => executionOrder.push("task1")))
      const task2 = Effect.succeed(1).pipe(Effect.delay(1), Effect.tap(() => executionOrder.push("task2")))
      return Effect.gen(function*() {
        const fiber = yield* Effect.forkChild(Effect.zipWith(task1, task2, (a, b) => a + b))
        yield* TestClock.adjust(51)
        const result = yield* Fiber.join(fiber)
        assert.deepStrictEqual(result, "a1")
        assert.deepStrictEqual(executionOrder, ["task1", "task2"])
      })
    })
    it.effect("concurrent: true", () => {
      const executionOrder: Array<string> = []
      const task1 = Effect.succeed("a").pipe(Effect.delay(50), Effect.tap(() => executionOrder.push("task1")))
      const task2 = Effect.succeed(1).pipe(Effect.delay(1), Effect.tap(() => executionOrder.push("task2")))
      return Effect.gen(function*() {
        const fiber = yield* Effect.forkChild(Effect.zipWith(task1, task2, (a, b) => a + b, { concurrent: true }))
        yield* TestClock.adjust(50)
        const result = yield* Fiber.join(fiber)
        assert.deepStrictEqual(result, "a1")
        assert.deepStrictEqual(executionOrder, ["task2", "task1"])
      })
    })
  })

  describe("catchCauseFilter", () => {
    it.effect("first argument as success", () =>
      Effect.gen(function*() {
        const result = yield* Effect.catchCauseFilter(Effect.succeed(1), (_) => Filter.fail(_), () => Effect.fail("e2"))
        assert.deepStrictEqual(result, 1)
      }))
    it.effect("first argument as failure and predicate return false", () =>
      Effect.gen(function*() {
        const result = yield* Effect.flip(
          Effect.catchCauseFilter(Effect.fail("e1" as const), (_) => Filter.fail(_), () => Effect.fail("e2" as const))
        )
        assert.deepStrictEqual(result, "e1")
      }))
    it.effect("first argument as failure and predicate return true", () =>
      Effect.gen(function*() {
        const result = yield* Effect.flip(
          Effect.catchCauseFilter(Effect.fail("e1" as const), (e) => e, () => Effect.fail("e2" as const))
        )
        assert.deepStrictEqual(result, "e2")
      }))
  })

  describe("catch", () => {
    it.effect("first argument as success", () =>
      Effect.gen(function*() {
        const result = yield* Effect.catch(Effect.succeed(1), () => Effect.fail("e2" as const))
        assert.deepStrictEqual(result, 1)
      }))
    it.effect("first argument as failure", () =>
      Effect.gen(function*() {
        const result = yield* Effect.flip(Effect.catch(Effect.fail("e1" as const), () => Effect.fail("e2" as const)))
        assert.deepStrictEqual(result, "e2")
      }))
  })

  describe("catchCause", () => {
    it.effect("first argument as success", () =>
      Effect.gen(function*() {
        const result = yield* Effect.catchCause(Effect.succeed(1), () => Effect.fail("e2" as const))
        assert.deepStrictEqual(result, 1)
      }))
    it.effect("first argument as failure", () =>
      Effect.gen(function*() {
        const result = yield* Effect.flip(
          Effect.catchCause(Effect.fail("e1" as const), () => Effect.fail("e2" as const))
        )
        assert.deepStrictEqual(result, "e2")
      }))
  })

  describe("transaction (isolated transactions)", () => {
    describe("basic isolation", () => {
      it.effect("should create isolated transaction boundaries", () =>
        Effect.gen(function*() {
          const ref1 = yield* TxRef.make(0)
          const ref2 = yield* TxRef.make(100)

          // Nested atomic transaction - should compose
          yield* Effect.atomic(Effect.gen(function*() {
            yield* TxRef.set(ref1, 10)

            // This atomic operation composes with the parent
            yield* Effect.atomic(
              // Part of same transaction
              TxRef.set(ref1, 20)
            )
          }))

          // Isolated transaction - should be independent
          yield* Effect.transaction(TxRef.set(ref2, 200))

          const val1 = yield* TxRef.get(ref1)
          const val2 = yield* TxRef.get(ref2)

          assert.strictEqual(val1, 20)
          assert.strictEqual(val2, 200)
        }))

      it.effect("should isolate failures between parent and child transactions", () =>
        Effect.gen(function*() {
          const ref1 = yield* TxRef.make(0)
          const ref2 = yield* TxRef.make(100)

          // Parent atomic transaction that will fail
          const parentError = yield* Effect.atomic(Effect.gen(function*() {
            yield* TxRef.set(ref1, 10)

            // Child isolated transaction should commit independently
            yield* Effect.transaction(TxRef.set(ref2, 200))

            // This will cause parent transaction to fail
            return yield* Effect.fail("parent failed")
          })).pipe(Effect.flip)

          const val1 = yield* TxRef.get(ref1)
          const val2 = yield* TxRef.get(ref2)

          assert.strictEqual(parentError, "parent failed")
          assert.strictEqual(val1, 0) // Parent transaction rolled back
          assert.strictEqual(val2, 200) // Child transaction committed independently
        }))

      it.effect("should isolate failures from child to parent transactions", () =>
        Effect.gen(function*() {
          const ref1 = yield* TxRef.make(0)
          const ref2 = yield* TxRef.make(100)

          // Parent atomic transaction should succeed
          yield* Effect.atomic(Effect.gen(function*() {
            yield* TxRef.set(ref1, 10)

            // Child isolated transaction that fails
            const childResult = yield* Effect.transaction(Effect.gen(function*() {
              yield* TxRef.set(ref2, 200)
              return yield* Effect.fail("child failed")
            })).pipe(Effect.result)

            // Parent continues despite child failure
            yield* TxRef.set(ref1, 20)

            // Verify child failed
            assert.strictEqual(Result.isFailure(childResult), true)
          }))

          const val1 = yield* TxRef.get(ref1)
          const val2 = yield* TxRef.get(ref2)

          assert.strictEqual(val1, 20) // Parent transaction committed
          assert.strictEqual(val2, 100) // Child transaction rolled back
        }))
    })

    describe("transaction nesting", () => {
      it.effect("should handle multiple levels of nested isolated transactions", () =>
        Effect.gen(function*() {
          const ref1 = yield* TxRef.make(0)
          const ref2 = yield* TxRef.make(0)
          const ref3 = yield* TxRef.make(0)

          yield* Effect.atomic(Effect.gen(function*() {
            yield* TxRef.set(ref1, 1)

            yield* Effect.transaction(Effect.gen(function*() {
              yield* TxRef.set(ref2, 2)

              yield* Effect.transaction(TxRef.set(ref3, 3))
            }))
          }))

          const val1 = yield* TxRef.get(ref1)
          const val2 = yield* TxRef.get(ref2)
          const val3 = yield* TxRef.get(ref3)

          assert.strictEqual(val1, 1)
          assert.strictEqual(val2, 2)
          assert.strictEqual(val3, 3)
        }))
    })

    describe("transactionWith function", () => {
      it.effect("should provide isolated transaction state", () =>
        Effect.gen(function*() {
          const ref = yield* TxRef.make(0)

          const result = yield* Effect.transactionWith((txState) =>
            Effect.gen(function*() {
              // Transaction state should be isolated
              const initialJournalSize = txState.journal.size

              yield* TxRef.set(ref, 42)

              // Journal should now have one entry
              const finalJournalSize = txState.journal.size
              const value = yield* TxRef.get(ref)

              return {
                value,
                initialJournalSize,
                finalJournalSize,
                retry: txState.retry
              }
            })
          )

          assert.strictEqual(result.value, 42)
          assert.strictEqual(result.initialJournalSize, 0)
          assert.strictEqual(result.finalJournalSize, 1)
          assert.strictEqual(result.retry, false)
        }))

      it.effect("should maintain isolation when nested in atomic blocks", () =>
        Effect.gen(function*() {
          const ref1 = yield* TxRef.make(0)
          const ref2 = yield* TxRef.make(0)

          yield* Effect.atomic(Effect.gen(function*() {
            yield* TxRef.set(ref1, 10)

            // This should run in its own isolated transaction
            const isolatedResult = yield* Effect.transactionWith((txState) =>
              Effect.gen(function*() {
                // Should start with empty journal despite parent transaction
                const journalSize = txState.journal.size
                yield* TxRef.set(ref2, 20)
                return { journalSize }
              })
            )

            // Verify journal was isolated
            assert.strictEqual(isolatedResult.journalSize, 0)
          }))

          const val1 = yield* TxRef.get(ref1)
          const val2 = yield* TxRef.get(ref2)

          assert.strictEqual(val1, 10)
          assert.strictEqual(val2, 20)
        }))
    })

    describe("comparison with atomic behavior", () => {
      it.effect("should demonstrate difference between atomic composition and transaction isolation", () =>
        Effect.gen(function*() {
          const ref = yield* TxRef.make(0)

          // Test atomic composition - nested failure rolls back entire atomic block
          const atomicError = yield* Effect.atomic(Effect.gen(function*() {
            yield* TxRef.set(ref, 10)

            // This nested atomic composes with parent and will roll back everything
            return yield* Effect.atomic(Effect.gen(function*() {
              yield* TxRef.set(ref, 20)
              return yield* Effect.fail("atomic nested failure")
            }))
          })).pipe(Effect.flip)

          const atomicValue = yield* TxRef.get(ref)

          // Reset ref
          yield* TxRef.set(ref, 0)

          // Test transaction isolation - nested failure doesn't affect parent
          yield* Effect.atomic(Effect.gen(function*() {
            yield* TxRef.set(ref, 10)

            // This isolated transaction fails but doesn't affect parent
            const childError = yield* Effect.transaction(Effect.gen(function*() {
              yield* TxRef.set(ref, 20)
              return yield* Effect.fail("transaction nested failure")
            })).pipe(Effect.flip)

            // Verify child failed
            assert.strictEqual(childError, "transaction nested failure")
          }))

          const transactionValue = yield* TxRef.get(ref)

          // Atomic: entire block rolled back due to nested failure
          assert.strictEqual(atomicError, "atomic nested failure")
          assert.strictEqual(atomicValue, 0)

          // Transaction: parent committed despite nested failure
          assert.strictEqual(transactionValue, 10)
        }))
    })
  })

  describe("error channel vs defect channel", () => {
    it.effect("Effect.try (to be renamed Effect.sync) callback form puts errors in defect channel", () =>
      Effect.gen(function*() {
        const program = Effect.try(() => {
          throw new Error("sync error")
        })

        const exit = yield* Effect.exit(program)

        assert.isTrue(Exit.isFailure(exit))
        if (exit._tag === "Failure") {
          assert.isTrue(Cause.hasDie(exit.cause))
          const defect = Cause.filterDefect(exit.cause)
          assert.strictEqual((defect as Error).message, "sync error")
        }
      }))

    it.effect("Effect.try (to be renamed Effect.sync) object form without catch puts errors in error channel with UnknownError", () =>
      Effect.gen(function*() {
        const program = Effect.try({
          try: () => {
            throw new Error("sync error")
          }
        })

        const exit = yield* Effect.exit(program)

        assert.isTrue(Exit.isFailure(exit))
        if (exit._tag === "Failure") {
          assert.isTrue(Cause.hasFail(exit.cause))
          const fail = Cause.filterError(exit.cause)
          assert.strictEqual((fail as Error).message, "An error occurred in Effect.sync")
        }
      }))

    it.effect("Effect.promise callback form puts rejections in defect channel", () =>
      Effect.gen(function*() {
        const program = Effect.promise(() => Promise.reject(new Error("async error")))

        const exit = yield* Effect.exit(program)

        assert.isTrue(Exit.isFailure(exit))
        if (exit._tag === "Failure") {
          assert.isTrue(Cause.hasDie(exit.cause))
          const defect = Cause.filterDefect(exit.cause)
          assert.strictEqual((defect as Error).message, "async error")
        }
      }))

    it.effect("Effect.promise object form without catch puts rejections in error channel with UnknownError", () =>
      Effect.gen(function*() {
        const program = Effect.promise({ try: () => Promise.reject(new Error("async error")) })

        const exit = yield* Effect.exit(program)

        assert.isTrue(Exit.isFailure(exit))
        if (exit._tag === "Failure") {
          assert.isTrue(Cause.hasFail(exit.cause))
          const fail = Cause.filterError(exit.cause)
          assert.strictEqual((fail as Error).message, "An error occurred in Effect.promise")
        }
      }))
  })
})
