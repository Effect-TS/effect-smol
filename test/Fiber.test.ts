import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import { assert, describe, it } from "./utils/extend.js"

describe("Effect", () => {
  it("Fiber is a fiber", async () => {
    const result = Effect.runFork(Effect.succeed(1))
    assert.isTrue(Fiber.isFiber(result))
  })
})
