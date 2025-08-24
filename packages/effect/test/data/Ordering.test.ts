import { Ordering } from "effect/data"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("Ordering", () => {
  it("Reducer", () => {
    const R = Ordering.Reducer

    deepStrictEqual(R.combine(-1, 1), -1)
    deepStrictEqual(R.combine(1, -1), 1)
    deepStrictEqual(R.combine(1, 1), 1)
    deepStrictEqual(R.combine(0, 0), 0)
    deepStrictEqual(R.combine(0, 1), 1)
    deepStrictEqual(R.combine(1, 0), 1)
    deepStrictEqual(R.combine(0, -1), -1)
    deepStrictEqual(R.combine(-1, 0), -1)
  })
})
