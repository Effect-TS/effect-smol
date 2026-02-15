import * as String from "effect/String"
import { describe, it } from "vitest"
import { strictEqual } from "./utils/assert.ts"

describe("String", () => {
  it("Equivalence", () => {
    strictEqual(String.Equivalence("a", "a"), true)
    strictEqual(String.Equivalence("a", "b"), false)
  })

  it("ReducerConcat", () => {
    strictEqual(String.ReducerConcat.combine("a", "b"), "ab")
    strictEqual(String.ReducerConcat.combine("a", String.ReducerConcat.initialValue), "a")
    strictEqual(String.ReducerConcat.combine(String.ReducerConcat.initialValue, "a"), "a")
  })
})
