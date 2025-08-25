import { UndefinedOr } from "effect/data"
import { Number } from "effect/primitives"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("UndefinedOr", () => {
  it("map", () => {
    const f = (a: number) => a + 1
    deepStrictEqual(UndefinedOr.map(f)(1), 2)
    deepStrictEqual(UndefinedOr.map(1, f), 2)
    deepStrictEqual(UndefinedOr.map(f)(undefined), undefined)
    deepStrictEqual(UndefinedOr.map(undefined, f), undefined)
  })

  it("getReducer", () => {
    const R = UndefinedOr.getReducer(Number.ReducerSum)

    deepStrictEqual(R.combine(1, 2), 3)
    deepStrictEqual(R.combine(1, undefined), 1)
    deepStrictEqual(R.combine(undefined, 2), 2)
    deepStrictEqual(R.combine(undefined, undefined), undefined)
  })

  it("getReducerFailFast", () => {
    const R = UndefinedOr.getReducerFailFast(Number.ReducerSum)

    deepStrictEqual(R.combine(1, 2), 3)
    deepStrictEqual(R.combine(1, undefined), undefined)
    deepStrictEqual(R.combine(undefined, 2), undefined)
    deepStrictEqual(R.combine(undefined, undefined), undefined)

    deepStrictEqual(R.combine(undefined, R.initialValue), undefined)
    deepStrictEqual(R.combine(R.initialValue, undefined), undefined)
    deepStrictEqual(R.combine(1, R.initialValue), 1)
    deepStrictEqual(R.combine(R.initialValue, 1), 1)
  })
})
