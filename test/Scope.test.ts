import { Duration, Effect, Exit, Scope, TestClock } from "effect"
import { describe, expect, it } from "./utils/extend.js"

describe("Scope", () => {
  describe("parallel finalization", () => {
    it.effect("executes finalizers in parallel", () =>
      Effect.gen(function*() {
        const scope = Scope.unsafeMake("parallel")
        yield* scope.addFinalizer(() => Effect.sleep(Duration.seconds(1)))
        yield* scope.addFinalizer(() => Effect.sleep(Duration.seconds(1)))
        yield* scope.addFinalizer(() => Effect.sleep(Duration.seconds(1)))
        const fiber = yield* Effect.fork(scope.close(Exit.void), { startImmediately: true })
        expect(fiber.unsafePoll()).toBeUndefined()
        yield* TestClock.adjust(Duration.seconds(1))
        expect(fiber.unsafePoll()).toBeDefined()
      }))
  })
})
