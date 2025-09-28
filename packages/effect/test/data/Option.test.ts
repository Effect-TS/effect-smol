import { Number } from "effect"
import { Option } from "effect/data"
import { deepStrictEqual } from "node:assert"
import { describe, it } from "vitest"

describe("Option", () => {
  it("getReducer", () => {
    const R = Option.getReducer(Number.ReducerSum)

    deepStrictEqual(R.combine(Option.some(1), Option.some(2)), Option.some(3))
    deepStrictEqual(R.combine(Option.some(1), Option.none()), Option.some(1))
    deepStrictEqual(R.combine(Option.none(), Option.some(2)), Option.some(2))
    deepStrictEqual(R.combine(Option.none(), Option.none()), Option.none())
  })

  it("getReducerFailFast", () => {
    const R = Option.getReducerFailFast(Number.ReducerSum)

    deepStrictEqual(R.combine(Option.some(1), Option.some(2)), Option.some(3))
    deepStrictEqual(R.combine(Option.some(1), Option.none()), Option.none())
    deepStrictEqual(R.combine(Option.none(), Option.some(2)), Option.none())
    deepStrictEqual(R.combine(Option.none(), Option.none()), Option.none())

    deepStrictEqual(R.combine(Option.none(), R.initialValue), Option.none())
    deepStrictEqual(R.combine(R.initialValue, Option.none()), Option.none())
    deepStrictEqual(R.combine(Option.some(1), R.initialValue), Option.some(1))
    deepStrictEqual(R.combine(R.initialValue, Option.some(1)), Option.some(1))
  })
})
