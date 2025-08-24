import { Option } from "effect/data"
import { Number } from "effect/primitives"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("Option", () => {
  it("getReducer", () => {
    const R = Option.getReducer(Number.ReducerSum)

    deepStrictEqual(R.combine(Option.some(1), Option.some(2)), Option.some(3))
    deepStrictEqual(R.combine(Option.some(1), Option.none()), Option.some(1))
    deepStrictEqual(R.combine(Option.none(), Option.some(2)), Option.some(2))
    deepStrictEqual(R.combine(Option.none(), Option.none()), Option.none())
  })
})
