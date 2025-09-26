import { String } from "effect"
import { Reducer } from "effect/data"
import { describe, it } from "vitest"
import { strictEqual } from "../utils/assert.ts"

describe("Combiner", () => {
  it("flip", () => {
    const R = Reducer.flip(String.ReducerConcat)
    strictEqual(R.combine("a", "b"), "ba")
    strictEqual(R.initialValue, "")
    strictEqual(R.combineAll(["a", "b", "c"]), "cba")
  })
})
