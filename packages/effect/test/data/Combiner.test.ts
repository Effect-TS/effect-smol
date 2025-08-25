import { Combiner } from "effect/data"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("Combiner", () => {
  it("first", () => {
    const C = Combiner.first<number>()
    deepStrictEqual(C.combine(1, 2), 1)
  })

  it("last", () => {
    const C = Combiner.last<number>()
    deepStrictEqual(C.combine(1, 2), 2)
  })
})
