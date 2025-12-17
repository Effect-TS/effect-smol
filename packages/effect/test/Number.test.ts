import { Number } from "effect"
import { describe, it } from "vitest"
import { strictEqual } from "./utils/assert.ts"

describe("Number", () => {
  it("ReducerSum", () => {
    strictEqual(Number.ReducerSum.combine(1, 2), 3)
    strictEqual(Number.ReducerSum.combine(Number.ReducerSum.initialValue, 2), 2)
    strictEqual(Number.ReducerSum.combine(2, Number.ReducerSum.initialValue), 2)
  })

  it("ReducerMultiply", () => {
    strictEqual(Number.ReducerMultiply.combine(2, 3), 6)
    strictEqual(Number.ReducerMultiply.combine(Number.ReducerMultiply.initialValue, 2), 2)
    strictEqual(Number.ReducerMultiply.combine(2, Number.ReducerMultiply.initialValue), 2)
  })

  it("ReducerMax", () => {
    strictEqual(Number.ReducerMax.combine(1, 2), 2)
    strictEqual(Number.ReducerMax.combine(Number.ReducerMax.initialValue, 2), 2)
    strictEqual(Number.ReducerMax.combine(2, Number.ReducerMax.initialValue), 2)
  })

  it("ReducerMin", () => {
    strictEqual(Number.ReducerMin.combine(1, 2), 1)
    strictEqual(Number.ReducerMin.combine(Number.ReducerMin.initialValue, 2), 2)
    strictEqual(Number.ReducerMin.combine(2, Number.ReducerMin.initialValue), 2)
  })
})
