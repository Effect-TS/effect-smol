import { Record } from "effect/data"
import { Number } from "effect/primitives"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("Record", () => {
  it("singleton", () => {
    deepStrictEqual(Record.singleton("a", 1), { a: 1 })
    deepStrictEqual(Record.singleton("__proto__", 1), { ["__proto__"]: 1 })
  })

  it("getReducerUnion", () => {
    const R = Record.getReducerUnion(Number.ReducerSum)

    deepStrictEqual(R.combine({ a: 1, b: 2 }, { a: 3, b: 4, c: 5 }), { a: 4, b: 6, c: 5 })
  })

  it("getReducerIntersection", () => {
    const R = Record.getReducerIntersection(Number.ReducerSum)

    deepStrictEqual(R.combine({ a: 1, b: 2 }, { a: 3, b: 4, c: 5 }), { a: 4, b: 6 })
  })
})
