import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { Fiber } from "effect/runtime"

describe("Effect", () => {
  it("Fiber is a fiber", async () => {
    const result = Effect.runFork(Effect.succeed(1))
    assert.isTrue(Fiber.isFiber(result))
  })
})
