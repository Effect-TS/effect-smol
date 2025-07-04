import { describe, expect, it } from "@effect/vitest"
import { Duration, Effect, Exit, Scope, TestClock } from "effect"

describe("Scope", () => {
  describe("parallel finalization", () => {
    it.effect("executes finalizers in parallel", () =>
      Effect.gen(function*() {
        const scope = Scope.unsafeMake("parallel")
        yield* Scope.addFinalizer(scope, Effect.sleep(Duration.seconds(1)))
        yield* Scope.addFinalizer(scope, Effect.sleep(Duration.seconds(1)))
        yield* Scope.addFinalizer(scope, Effect.sleep(Duration.seconds(1)))
        const fiber = yield* Effect.fork(Scope.close(scope, Exit.void), { startImmediately: true })
        expect(fiber.unsafePoll()).toBeUndefined()
        yield* TestClock.adjust(Duration.seconds(1))
        expect(fiber.unsafePoll()).toBeDefined()
      }))
  })
})
