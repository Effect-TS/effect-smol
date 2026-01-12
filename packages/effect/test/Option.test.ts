import { Number, Option } from "effect"
import { deepStrictEqual } from "node:assert"
import { describe, it } from "vitest"

describe("Option", () => {
  it("makeReducer", () => {
    const R = Option.makeReducer(Number.ReducerSum)

    deepStrictEqual(R.combine(Option.some(1), Option.some(2)), Option.some(3))
    deepStrictEqual(R.combine(Option.some(1), Option.none()), Option.some(1))
    deepStrictEqual(R.combine(Option.none(), Option.some(2)), Option.some(2))
    deepStrictEqual(R.combine(Option.none(), Option.none()), Option.none())
  })

  it("makeReducerFailFast", () => {
    const R = Option.makeReducerFailFast(Number.ReducerSum)

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
