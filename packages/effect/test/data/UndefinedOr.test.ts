import { Number } from "effect"
import { UndefinedOr } from "effect/data"
import { describe, it } from "vitest"
import { strictEqual } from "../utils/assert.ts"

describe("UndefinedOr", () => {
  it("map", () => {
    const f = (a: number) => a + 1
    strictEqual(UndefinedOr.map(f)(1), 2)
    strictEqual(UndefinedOr.map(1, f), 2)
    strictEqual(UndefinedOr.map(f)(undefined), undefined)
    strictEqual(UndefinedOr.map(undefined, f), undefined)
  })

  it("match", () => {
    strictEqual(UndefinedOr.match(1, { onDefined: (a) => a, onUndefined: () => 0 }), 1)
    strictEqual(UndefinedOr.match(undefined, { onDefined: (a) => a, onUndefined: () => 0 }), 0)
  })

  it("getReducer", () => {
    const R = UndefinedOr.getReducer(Number.ReducerSum)

    strictEqual(R.combine(1, 2), 3)
    strictEqual(R.combine(1, undefined), 1)
    strictEqual(R.combine(undefined, 2), 2)
    strictEqual(R.combine(undefined, undefined), undefined)
  })

  it("getReducerFailFast", () => {
    const R = UndefinedOr.getReducerFailFast(Number.ReducerSum)

    strictEqual(R.combine(1, 2), 3)
    strictEqual(R.combine(1, undefined), undefined)
    strictEqual(R.combine(undefined, 2), undefined)
    strictEqual(R.combine(undefined, undefined), undefined)

    strictEqual(R.combine(undefined, R.initialValue), undefined)
    strictEqual(R.combine(R.initialValue, undefined), undefined)
    strictEqual(R.combine(1, R.initialValue), 1)
    strictEqual(R.combine(R.initialValue, 1), 1)

    strictEqual(R.combineAll([1, undefined, 2]), undefined)
    strictEqual(R.combineAll([1, 2]), 3)
  })
})
