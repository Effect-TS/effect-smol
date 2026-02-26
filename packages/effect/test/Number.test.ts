import { Number } from "effect"
import { describe, it } from "vitest"
import { assertNone, assertSome, strictEqual } from "./utils/assert.ts"

describe("Number", () => {
  it("Equivalence", () => {
    strictEqual(Number.Equivalence(1, 1), true)
    strictEqual(Number.Equivalence(1, 2), false)
    strictEqual(Number.Equivalence(NaN, NaN), true)
  })

  it("divide", () => {
    assertSome(Number.divide(6, 3), 2)
    assertNone(Number.divide(6, 0))
    strictEqual(Number.divideUnsafe(6, 3), 2)
    strictEqual(Number.divideUnsafe(6, 0), Infinity)
  })

  it("parse", () => {
    assertSome(Number.parse("42"), 42)
    assertSome(Number.parse("3.14"), 3.14)
    assertSome(Number.parse("NaN"), NaN)
    assertSome(Number.parse("Infinity"), Infinity)
    assertSome(Number.parse("-Infinity"), -Infinity)
    assertNone(Number.parse(""))
    assertNone(Number.parse("not a number"))
  })

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
