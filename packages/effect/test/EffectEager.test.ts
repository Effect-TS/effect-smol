import { assert, describe, it } from "@effect/vitest"
import * as Effect from "../src/Effect.js"
import * as Exit from "../src/Exit.js"
import * as Fiber from "../src/Fiber.js"
import * as TestClock from "../src/TestClock.js"

describe("Effect Eager Operations", () => {
  describe("fnUntracedEager", () => {
    describe("eager computation", () => {
      it("computes sync effects immediately", () => {
        let execCount = 0
        const fn = Effect.fnUntracedEager(function*() {
          execCount++
          yield* Effect.succeed(1)
          yield* Effect.succeed(2)
          return execCount
        })

        const effect = fn()

        assert.strictEqual(execCount, 1)
        assert.strictEqual((effect as any)._tag, "Success")
        assert.strictEqual((effect as any).value, 1)
      })

      it("computes failures immediately", () => {
        const fn = Effect.fnUntracedEager(function*() {
          yield* Effect.succeed(1)
          yield* Effect.fail("error")
          return "unreachable"
        })

        const effect = fn()
        assert.strictEqual((effect as any)._tag, "Failure")
      })

      it("stops at first async effect", () => {
        let syncSteps = 0
        let asyncReached = false

        const fn = Effect.fnUntracedEager(function*() {
          syncSteps++
          yield* Effect.succeed(1)
          syncSteps++
          yield* Effect.promise(() => {
            asyncReached = true
            return Promise.resolve(2)
          })
          syncSteps++
          return "done"
        })

        const effect = fn()

        assert.strictEqual(syncSteps, 2)
        assert.strictEqual(asyncReached, false)
        assert.notStrictEqual((effect as any)._tag, "Success")
      })

      it("handles exceptions", () => {
        const fn = Effect.fnUntracedEager(function*() {
          yield* Effect.succeed(1)
          throw new Error("sync error")
        })

        const effect = fn()
        assert.strictEqual((effect as any)._tag, "Failure")
      })
    })

    it.effect("executes sync generators", () =>
      Effect.gen(function*() {
        const fn = Effect.fnUntracedEager(function*() {
          yield* Effect.succeed(1)
          yield* Effect.succeed(2)
          return "done"
        })

        const result = yield* fn()
        assert.strictEqual(result, "done")
      }))

    it.effect("handles mixed sync/async effects", () =>
      Effect.gen(function*() {
        const fn = Effect.fnUntracedEager(function*() {
          const a = yield* Effect.succeed(1)
          const b = yield* Effect.promise(() => Promise.resolve(2))
          return a + b
        })

        const result = yield* fn()
        assert.strictEqual(result, 3)
      }))

    it.effect("handles failures", () =>
      Effect.gen(function*() {
        const fn = Effect.fnUntracedEager(function*() {
          yield* Effect.fail("error")
          return "unreachable"
        })

        const exit = yield* Effect.exit(fn())
        assert.isTrue(Exit.isFailure(exit))
      }))

    it.effect("works with arguments and this context", () =>
      Effect.gen(function*() {
        const obj = {
          value: 10,
          fn: Effect.fnUntracedEager(function*(this: { value: number }, x: number) {
            const a = yield* Effect.succeed(x)
            return a + this.value
          })
        }

        const result = yield* obj.fn(5)
        assert.strictEqual(result, 15)
      }))

    it.effect("works with pipeable operators", () =>
      Effect.gen(function*() {
        const fn = Effect.fnUntracedEager(
          function*() {
            yield* Effect.succeed(1)
            return 10
          },
          Effect.map((x: number) => x * 2)
        )

        const result = yield* fn()
        assert.strictEqual(result, 20)
      }))

    it.effect("re-execution creates fresh iterators", () =>
      Effect.gen(function*() {
        let execCount = 0
        const fn = Effect.fnUntracedEager(function*() {
          execCount++
          yield* Effect.succeed(1)
          yield* Effect.promise(() => Promise.resolve(2))
          return execCount
        })

        const effect = fn()

        const result1 = yield* effect
        assert.strictEqual(result1, 1)

        const result2 = yield* effect
        assert.strictEqual(result2, 2)
        assert.strictEqual(execCount, 2)
      }))

    it.effect("handles long sync chains efficiently", () =>
      Effect.gen(function*() {
        const fn = Effect.fnUntracedEager(function*() {
          let sum = 0
          for (let i = 0; i < 100; i++) {
            const val = yield* Effect.succeed(i)
            sum += val
          }
          return sum
        })

        const result = yield* fn()
        assert.strictEqual(result, 4950) // sum of 0 to 99
      }))
  })

  describe("mapEager", () => {
    it.effect("successful effect", () =>
      Effect.gen(function*() {
        const result = yield* Effect.mapEager(Effect.succeed(5), (n) => n * 2)
        assert.strictEqual(result, 10)
      }))

    it.effect("failed effect preserves failure", () =>
      Effect.gen(function*() {
        const effect = Effect.fail("error")
        const mapped = Effect.mapEager(effect, (n) => n * 2)
        const exit = yield* Effect.exit(mapped)

        assert.strictEqual(exit._tag, "Failure", "Expected effect to fail")
        assert.ok(exit._tag === "Failure", "Type guard for exit failure")

        const failure = exit.cause.failures.find((failure: any) => failure._tag === "Fail")
        assert.ok(failure, "Expected to find a Fail cause")
        assert.strictEqual(failure._tag, "Fail", "Expected failure to be a Fail type")
        assert.strictEqual((failure as any).error, "error", "Expected error to be preserved")
      }))

    it.effect("complex effect falls back to regular map", () =>
      Effect.gen(function*() {
        const effect = Effect.mapEager(Effect.delay(Effect.succeed(10), 1), (n) => n + 5)
        const fiber = yield* Effect.fork(effect)
        yield* TestClock.adjust(1)
        const result = yield* Fiber.join(fiber)
        assert.strictEqual(result, 15)
      }))
  })

  describe("flatMapEager", () => {
    it.effect("applies transformation eagerly for success effects", () =>
      Effect.gen(function*() {
        let executions = 0
        const effect = Effect.succeed(5)
        const flatMapped = Effect.flatMapEager(effect, (n) => {
          executions++
          return Effect.succeed(n * 2)
        })
        assert.strictEqual(yield* flatMapped, 10)
        assert.strictEqual(yield* flatMapped, 10)
        assert.strictEqual(yield* flatMapped, 10)
        assert.strictEqual(executions, 1)
      }))

    it.effect("preserves failure for failed effects", () =>
      Effect.gen(function*() {
        const error = new Error("test error")
        const effect = Effect.fail(error)
        const flatMapped = Effect.flatMapEager(effect, (n) => Effect.succeed(n * 2))
        const exit = yield* Effect.exit(flatMapped)

        assert.strictEqual(exit._tag, "Failure", "Expected effect to fail")
        assert.ok(exit._tag === "Failure", "Type guard for exit failure")

        const failure = exit.cause.failures.find((failure: any) => failure._tag === "Fail")
        assert.ok(failure, "Expected to find a Fail cause")
        assert.strictEqual(failure._tag, "Fail", "Expected failure to be a Fail type")
        assert.strictEqual((failure as any).error, error, "Expected error to be preserved")
      }))

    it.effect("fallback to regular flatMap for complex effects", () =>
      Effect.gen(function*() {
        const effect = Effect.delay(Effect.succeed(10), "1 millis")
        const flatMapped = Effect.flatMapEager(effect, (n) => Effect.succeed(n * 2))

        const fiber = yield* Effect.fork(flatMapped)
        yield* TestClock.adjust("1 millis")
        const result = yield* Fiber.join(fiber)

        assert.strictEqual(result, 20)
      }))
  })

  describe("mapErrorEager", () => {
    it.effect("preserves success for successful effects", () =>
      Effect.gen(function*() {
        const effect = Effect.succeed(5)
        const mapped = Effect.mapErrorEager(effect, (err) => `mapped: ${err}`)
        const result = yield* mapped
        assert.strictEqual(result, 5)
      }))

    it.effect("applies transformation eagerly for failure effects", () =>
      Effect.gen(function*() {
        const effect = Effect.fail("original error")
        const mapped = Effect.mapErrorEager(effect, (err) => `mapped: ${err}`)
        const exit = yield* Effect.exit(mapped)

        assert.strictEqual(exit._tag, "Failure", "Expected effect to fail")
        assert.ok(exit._tag === "Failure", "Type guard for exit failure")

        const failure = exit.cause.failures.find((failure: any) => failure._tag === "Fail")
        assert.ok(failure, "Expected to find a Fail cause")
        assert.strictEqual(failure._tag, "Fail", "Expected failure to be a Fail type")
        assert.strictEqual((failure as any).error, "mapped: original error", "Expected error to be transformed")
      }))

    it.effect("fallback to regular mapError for complex effects", () =>
      Effect.gen(function*() {
        const effect = Effect.delay(Effect.fail("error"), "1 millis")
        const mapped = Effect.mapErrorEager(effect, (err) => `mapped: ${err}`)

        const fiber = yield* Effect.fork(mapped)
        yield* TestClock.adjust("1 millis")
        const exit = yield* Fiber.await(fiber)

        assert.strictEqual(exit._tag, "Failure", "Expected effect to fail")
        assert.ok(exit._tag === "Failure", "Type guard for exit failure")

        const failure = exit.cause.failures.find((failure: any) => failure._tag === "Fail")
        assert.ok(failure, "Expected to find a Fail cause")
        assert.strictEqual(failure._tag, "Fail", "Expected failure to be a Fail type")
        assert.strictEqual((failure as any).error, "mapped: error", "Expected error to be transformed")
      }))
  })

  describe("mapBothEager", () => {
    it.effect("applies onSuccess eagerly for success effects", () =>
      Effect.gen(function*() {
        const effect = Effect.succeed(5)
        const mapped = Effect.mapBothEager(effect, {
          onFailure: (err) => `Failed: ${err}`,
          onSuccess: (n) => n * 2
        })
        const result = yield* mapped
        assert.strictEqual(result, 10)
      }))

    it.effect("applies onFailure eagerly for failure effects", () =>
      Effect.gen(function*() {
        const effect = Effect.fail("original error")
        const mapped = Effect.mapBothEager(effect, {
          onFailure: (err) => `Failed: ${err}`,
          onSuccess: (n) => n * 2
        })
        const exit = yield* Effect.exit(mapped)

        assert.strictEqual(exit._tag, "Failure", "Expected effect to fail")
        assert.ok(exit._tag === "Failure", "Type guard for exit failure")

        const failure = exit.cause.failures.find((failure: any) => failure._tag === "Fail")
        assert.ok(failure, "Expected to find a Fail cause")
        assert.strictEqual(failure._tag, "Fail", "Expected failure to be a Fail type")
        assert.strictEqual((failure as any).error, "Failed: original error", "Expected error to be transformed")
      }))

    it.effect("fallback to regular mapBoth for complex effects", () =>
      Effect.gen(function*() {
        const effect = Effect.delay(Effect.succeed(10), "1 millis")
        const mapped = Effect.mapBothEager(effect, {
          onFailure: (err) => `Failed: ${err}`,
          onSuccess: (n) => n * 2
        })

        const fiber = yield* Effect.fork(mapped)
        yield* TestClock.adjust("1 millis")
        const result = yield* Fiber.join(fiber)

        assert.strictEqual(result, 20)
      }))
  })

  describe("catchEager", () => {
    it.effect("preserves success effects without applying catch", () =>
      Effect.gen(function*() {
        const effect = Effect.succeed(42)
        const caught = Effect.catchEager(effect, (err) => Effect.succeed(`recovered: ${err}`))
        const result = yield* caught
        assert.strictEqual(result, 42)
      }))

    it.effect("applies catch function eagerly for failure effects", () =>
      Effect.gen(function*() {
        const effect = Effect.fail("original error")
        const caught = Effect.catchEager(effect, (err) => Effect.succeed(`recovered: ${err}`))
        const result = yield* caught
        assert.strictEqual(result, "recovered: original error")
      }))

    it.effect("fallback to regular catch for complex effects", () =>
      Effect.gen(function*() {
        const effect = Effect.delay(Effect.fail("error"), "1 millis")
        const caught = Effect.catchEager(effect, (err) => Effect.succeed(`recovered: ${err}`))

        const fiber = yield* Effect.fork(caught)
        yield* TestClock.adjust("1 millis")
        const result = yield* Fiber.join(fiber)

        assert.strictEqual(result, "recovered: error")
      }))
  })
})
