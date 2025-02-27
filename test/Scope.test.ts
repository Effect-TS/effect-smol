import { Duration, Effect, Exit, Scope, TestClock } from "effect"
import { describe, expect, it } from "./utils/extend.js"

describe("Scope", () => {
  describe("parallel finalization", () => {
    it.effect("executes finalizers in parallel", () =>
      Effect.gen(function*() {
        const scope = Scope.unsafeMake({ strategy: "parallel" })
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
      class MyScope extends Scope.Named<MyScope>()("MyScope") {
        static scoped = Scope.scoped(this)
      }

      const closes: Array<boolean> = []

      const use = Effect.gen(function*() {
        const scope = yield* MyScope
        yield* Scope.addFinalizer(scope, () =>
          Effect.sync(() => {
            closes.push(true)
          }))
      })

      return Effect.gen(function*() {
        yield* use.pipe(MyScope.scoped)
        expect(closes).toStrictEqual([true])
      })
    })

    it.effect("provide", () => {
      class MyScope extends Scope.Named<MyScope>()("MyScope") {
        static provide = Scope.provide(this)
      }

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
        yield* use.pipe(MyScope.provide(scope))
        yield* Scope.close(scope, Exit.void)
        expect(closes).toStrictEqual([true])
      })
    })

    it.effect("makeScoped", () => {
      class MyScope extends Scope.Named<MyScope>()("MyScope") {
        static provide = Scope.provide(this)
      }

      const closes: Array<boolean> = []

      const use = Effect.gen(function*() {
        const scope = yield* MyScope
        yield* Scope.addFinalizer(scope, () =>
          Effect.sync(() => {
            closes.push(true)
          }))
      })

      return Effect.scoped(Effect.gen(function*() {
        const scope = yield* Scope.makeScoped({ strategy: "parallel" })
        yield* use.pipe(MyScope.provide(scope))
      })).pipe(Effect.map(() => {
        expect(closes).toStrictEqual([true])
      }))
    })

    it.effect("provide from parent", () => {
      class MyScope extends Scope.Named<MyScope>()("MyScope") {
        static provide = Scope.provide(this)
      }

      const closes: Array<boolean> = []

      const use = Effect.gen(function*() {
        const scope = yield* MyScope
        yield* Scope.addFinalizer(scope, () =>
          Effect.sync(() => {
            closes.push(true)
          }))
      })

      return Effect.scoped(Effect.gen(function*() {
        yield* use.pipe(MyScope.provide(Scope.Default))
      })).pipe(Effect.map(() => {
        expect(closes).toStrictEqual([true])
      }))
    })
  })
})
