import * as Cause from "effect/Cause"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { assert, describe, it } from "vitest"

describe("Deferred", () => {
  describe("success", () => {
    it("succeed - should propagate the value", () =>
      Effect.gen(function*() {
        const deferred = yield* Deferred.make<number>()
        assert.isTrue(yield* Deferred.succeed(deferred, 1))
        assert.isFalse(yield* Deferred.succeed(deferred, 1))
        assert.strictEqual(yield* Deferred.await(deferred), 1)
      }).pipe(Effect.runPromise))

    it("complete - should memoize the result of the provided effect", () =>
      Effect.gen(function*() {
        let value = 0
        const complete = Effect.sync(() => {
          value += 1
          return value
        })
        const deferred = yield* Deferred.make<number>()
        assert.isTrue(yield* Deferred.complete(deferred, complete))
        assert.isFalse(yield* Deferred.complete(deferred, complete))
        assert.strictEqual(value, 1)
        assert.strictEqual(yield* Deferred.await(deferred), 1)
        assert.strictEqual(yield* Deferred.await(deferred), 1)
        assert.strictEqual(value, 1)
      }).pipe(Effect.runPromise))

    it("completeWith - should memoize the provided effect", () =>
      Effect.gen(function*() {
        let value = 0
        const complete = Effect.sync(() => {
          value += 1
          return value
        })
        const complete2 = Effect.sync(() => {
          value += 10
          return value
        })
        const deferred = yield* Deferred.make<number>()
        assert.isTrue(yield* Deferred.completeWith(deferred, complete))
        assert.isFalse(yield* Deferred.completeWith(deferred, complete2))
        assert.strictEqual(value, 0)
        assert.strictEqual(yield* Deferred.await(deferred), 1)
        assert.strictEqual(yield* Deferred.await(deferred), 2)
        assert.strictEqual(value, 2)
      }).pipe(Effect.runPromise))
  })

  describe("failure", () => {
    it("fail - should propagate the failure", () =>
      Effect.gen(function*() {
        const deferred = yield* Deferred.make<number, string>()
        assert.isTrue(yield* Deferred.fail(deferred, "boom"))
        assert.isFalse(yield* Deferred.succeed(deferred, 1))
        const result = yield* Effect.exit(Deferred.await(deferred))
        assert.deepStrictEqual(result, Exit.fail("boom"))
      }).pipe(Effect.runPromise))

    it("complete - should memoize the failure of the provided effect", () =>
      Effect.gen(function*() {
        const deferred = yield* Deferred.make<number, string>()
        assert.isTrue(yield* Deferred.complete(deferred, Effect.fail("boom")))
        assert.isFalse(yield* Deferred.complete(deferred, Effect.fail("boom2")))
        const result1 = yield* Effect.exit(Deferred.await(deferred))
        const result2 = yield* Effect.exit(Deferred.await(deferred))
        assert.deepStrictEqual(result1, Exit.fail("boom"))
        assert.deepStrictEqual(result2, Exit.fail("boom"))
      }).pipe(Effect.runPromise))

    it("completeWith - should memoize the provided effect", () =>
      Effect.gen(function*() {
        let i = 0
        const failures = ["boom", "boom2"]
        const complete = Effect.failSync(() => failures[i++])
        const complete2 = Effect.failSync(() => "boom3")
        const deferred = yield* Deferred.make<number, string>()
        assert.isTrue(yield* Deferred.completeWith(deferred, complete))
        assert.isFalse(yield* Deferred.completeWith(deferred, complete2))
        const result = yield* Effect.exit(Deferred.await(deferred))
        const result2 = yield* Effect.exit(Deferred.await(deferred))
        assert.deepStrictEqual(result, Exit.fail("boom"))
        assert.deepStrictEqual(result2, Exit.fail("boom2"))
      }).pipe(Effect.runPromise))
  })

  describe("interruption", () => {
    it("interrupt - should propagate the interruption", () =>
      Effect.gen(function*() {
        const deferred = yield* Deferred.make<number>()
        assert.isTrue(yield* Deferred.interrupt(deferred))
        assert.isFalse(yield* Deferred.interrupt(deferred))
        const result = yield* Effect.exit(Deferred.await(deferred))
        assert.deepStrictEqual(result, Exit.failCause(Cause.interrupt()))
      }).pipe(Effect.runPromise))
  })

  describe("done", () => {
    it("isDone - should return true when suceeded", () =>
      Effect.gen(function*() {
        const deferred = yield* Deferred.make<number>()
        yield* Deferred.succeed(deferred, 1)
        assert.isTrue(yield* Deferred.isDone(deferred))
      }).pipe(Effect.runPromise))

    it("isDone - should return true when failed", () =>
      Effect.gen(function*() {
        const deferred = yield* Deferred.make<number, string>()
        yield* Deferred.fail(deferred, "boom")
        assert.isTrue(yield* Deferred.isDone(deferred))
      }).pipe(Effect.runPromise))
  })
})
