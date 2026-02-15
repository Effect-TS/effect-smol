import * as BigInt from "effect/BigInt"
import { describe, it } from "vitest"
import { strictEqual } from "./utils/assert.ts"

describe("BigInt", () => {
  it("Equivalence", () => {
    strictEqual(BigInt.Equivalence(1n, 1n), true)
    strictEqual(BigInt.Equivalence(1n, 2n), false)
  })

  it("ReducerSum", () => {
    strictEqual(BigInt.ReducerSum.combine(1n, 2n), 3n)
    strictEqual(BigInt.ReducerSum.combine(BigInt.ReducerSum.initialValue, 2n), 2n)
    strictEqual(BigInt.ReducerSum.combine(2n, BigInt.ReducerSum.initialValue), 2n)
  })

  it("ReducerMultiply", () => {
    strictEqual(BigInt.ReducerMultiply.combine(2n, 3n), 6n)
    strictEqual(BigInt.ReducerMultiply.combine(BigInt.ReducerMultiply.initialValue, 2n), 2n)
    strictEqual(BigInt.ReducerMultiply.combine(2n, BigInt.ReducerMultiply.initialValue), 2n)
  })

  it("CombinerMax", () => {
    strictEqual(BigInt.CombinerMax.combine(1n, 2n), 2n)
  })

  it("CombinerMin", () => {
    strictEqual(BigInt.CombinerMin.combine(1n, 2n), 1n)
  })
})
