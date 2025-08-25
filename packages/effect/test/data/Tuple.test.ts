import { Tuple } from "effect/data"
import { Number, String } from "effect/primitives"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("Tuple", () => {
  it("getCombiner", () => {
    const C = Tuple.getCombiner([
      Number.ReducerSum,
      String.ReducerConcat
    ])

    deepStrictEqual(C.combine([1, "a"], [2, "b"]), [3, "ab"])
  })

  it("getReducer", () => {
    const R = Tuple.getReducer([
      Number.ReducerSum,
      String.ReducerConcat
    ])

    deepStrictEqual(R.combine([1, "a"], [2, "b"]), [3, "ab"])
    deepStrictEqual(R.initialValue, [0, ""])
  })
})
