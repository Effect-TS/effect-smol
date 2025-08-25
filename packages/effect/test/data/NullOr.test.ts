import { NullOr } from "effect/data"
import { Number } from "effect/primitives"
import { describe, it } from "vitest"
import { strictEqual } from "../utils/assert.ts"

describe("NullOr", () => {
  it("map", () => {
    const f = (a: number) => a + 1
    strictEqual(NullOr.map(f)(1), 2)
    strictEqual(NullOr.map(1, f), 2)
    strictEqual(NullOr.map(f)(null), null)
    strictEqual(NullOr.map(null, f), null)
  })

  it("getReducer", () => {
    const R = NullOr.getReducer(Number.ReducerSum)

    strictEqual(R.combine(1, 2), 3)
    strictEqual(R.combine(1, null), 1)
    strictEqual(R.combine(null, 2), 2)
    strictEqual(R.combine(null, null), null)
  })

  it("getReducerFailFast", () => {
    const R = NullOr.getReducerFailFast(Number.ReducerSum)

    strictEqual(R.combine(1, 2), 3)
    strictEqual(R.combine(1, null), null)
    strictEqual(R.combine(null, 2), null)
    strictEqual(R.combine(null, null), null)

    strictEqual(R.combine(null, R.initialValue), null)
    strictEqual(R.combine(R.initialValue, null), null)
    strictEqual(R.combine(1, R.initialValue), 1)
    strictEqual(R.combine(R.initialValue, 1), 1)
  })
})
