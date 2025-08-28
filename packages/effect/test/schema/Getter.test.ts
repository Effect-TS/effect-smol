import { Effect } from "effect"
import { Option } from "effect/data"
import { Getter } from "effect/schema"
import { describe, it } from "vitest"
import { assertSome } from "../utils/assert.ts"

describe("Getter", () => {
  it("map", () => {
    const getter = Getter.succeed(1).map((t) => t + 1)
    const result = Effect.runSync(getter.run(Option.some(1), {}))
    assertSome(result, 2)
  })
})
