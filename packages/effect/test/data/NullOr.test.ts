import { NullOr } from "effect/data"
import { Number } from "effect/primitives"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("NullOr", () => {
  it("map", () => {
    const f = (a: number) => a + 1
    deepStrictEqual(NullOr.map(f)(1), 2)
    deepStrictEqual(NullOr.map(1, f), 2)
    deepStrictEqual(NullOr.map(f)(null), null)
    deepStrictEqual(NullOr.map(null, f), null)
  })

  it("getReducer", () => {
    const R = NullOr.getReducer(Number.ReducerSum)

    deepStrictEqual(R.combine(1, 2), 3)
    deepStrictEqual(R.combine(1, null), 1)
    deepStrictEqual(R.combine(null, 2), 2)
    deepStrictEqual(R.combine(null, null), null)
  })

  it("getReducerFailFast", () => {
    const R = NullOr.getReducerFailFast(Number.ReducerSum)

    deepStrictEqual(R.combine(1, 2), 3)
    deepStrictEqual(R.combine(1, null), null)
    deepStrictEqual(R.combine(null, 2), null)
    deepStrictEqual(R.combine(null, null), null)

    deepStrictEqual(R.combine(null, R.initialValue), null)
    deepStrictEqual(R.combine(R.initialValue, null), null)
    deepStrictEqual(R.combine(1, R.initialValue), 1)
    deepStrictEqual(R.combine(R.initialValue, 1), 1)
  })
})
