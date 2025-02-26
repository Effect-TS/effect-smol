import { Duration, Effect, Exit, Scope, TestClock } from "effect"
import { describe, expect, it } from "./utils/extend.js"

describe("Scope", () => {
  describe("parallel finalization", () => {
    it.effect("executes finalizers in parallel", () =>
      Effect.gen(function*() {
        const scope = Scope.unsafeMake("parallel")
        yield* Scope.addFinalizer(scope, () => Effect.sleep(Duration.seconds(1)))
        yield* Scope.addFinalizer(scope, () => Effect.sleep(Duration.seconds(1)))
        yield* Scope.addFinalizer(scope, () => Effect.sleep(Duration.seconds(1)))
        const fiber = yield* Effect.fork(Scope.close(scope, Exit.void), { startImmediately: true })
        expect(fiber.unsafePoll()).toBeUndefined()
        yield* TestClock.adjust(Duration.seconds(1))
        expect(fiber.unsafePoll()).toBeDefined()
      }))
  })
  describe("uses a named scope", () => {
    it.effect("scoped", () => {
      class MyScope extends Scope.Named<MyScope>()("MyScope") {}

      const closes: Array<boolean> = []

      const use = Effect.gen(function*() {
        const scope = yield* MyScope
        yield* Scope.addFinalizer(scope, () =>
          Effect.sync(() => {
            closes.push(true)
          }))
      })

      return Effect.gen(function*() {
        yield* use.pipe(Scope.scoped(MyScope))
        expect(closes).toStrictEqual([true])
      })
    })

    it.effect("provide", () => {
      class MyScope extends Scope.Named<MyScope>()("MyScope") {}

      const closes: Array<boolean> = []

      const use = Effect.gen(function*() {
        const scope = yield* MyScope
        yield* Scope.addFinalizer(scope, () =>
          Effect.sync(() => {
            closes.push(true)
          }))
      })

      return Effect.gen(function*() {
        const scope = yield* Scope.make()
        yield* use.pipe(Scope.provide(MyScope)(scope))
        yield* Scope.close(scope, Exit.void)
        expect(closes).toStrictEqual([true])
      })
    })
  })
})
