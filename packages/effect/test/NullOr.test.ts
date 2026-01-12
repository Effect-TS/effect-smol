import { NullOr, Number } from "effect"
import { describe, it } from "vitest"
import { strictEqual, throws } from "./utils/assert.ts"

describe("NullOr", () => {
  it("map", () => {
    const f = (a: number) => a + 1
    strictEqual(NullOr.map(f)(1), 2)
    strictEqual(NullOr.map(1, f), 2)
    strictEqual(NullOr.map(f)(null), null)
    strictEqual(NullOr.map(null, f), null)
  })

  it("match", () => {
    strictEqual(NullOr.match(1, { onNotNull: (a) => a, onNull: () => 0 }), 1)
    strictEqual(NullOr.match(null, { onNotNull: (a) => a, onNull: () => 0 }), 0)
  })

  it("getOrThrowWith", () => {
    strictEqual(NullOr.getOrThrowWith(1, () => new Error("test")), 1)
    throws(() => NullOr.getOrThrowWith(null, () => new Error("test")), new Error("test"))
  })

  it("getOrThrow", () => {
    strictEqual(NullOr.getOrThrow(1), 1)
    throws(() => NullOr.getOrThrow(null), new Error("getOrThrow called on a null"))
  })

  it("liftThrowable", () => {
    const f = (a: number) => {
      if (a === 0) {
        throw new Error("test")
      }
      return a + 1
    }
    strictEqual(NullOr.liftThrowable(f)(1), 2)
    strictEqual(NullOr.liftThrowable(f)(0), null)
  })

  it("makeReducer", () => {
    const R = NullOr.makeReducer(Number.ReducerSum)

    strictEqual(R.combine(1, 2), 3)
    strictEqual(R.combine(1, null), 1)
    strictEqual(R.combine(null, 2), 2)
    strictEqual(R.combine(null, null), null)
  })

  it("makeReducerFailFast", () => {
    const R = NullOr.makeReducerFailFast(Number.ReducerSum)

    strictEqual(R.combine(1, 2), 3)
    strictEqual(R.combine(1, null), null)
    strictEqual(R.combine(null, 2), null)
    strictEqual(R.combine(null, null), null)

    strictEqual(R.combine(null, R.initialValue), null)
    strictEqual(R.combine(R.initialValue, null), null)
    strictEqual(R.combine(1, R.initialValue), 1)
    strictEqual(R.combine(R.initialValue, 1), 1)

    strictEqual(R.combineAll([1, null, 2]), null)
    strictEqual(R.combineAll([1, 2]), 3)
  })
})
