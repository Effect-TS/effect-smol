import * as Boolean from "effect/Boolean"
import { describe, it } from "vitest"
import { strictEqual } from "./utils/assert.ts"

describe("Boolean", () => {
  it("ReducerAnd", () => {
    strictEqual(Boolean.ReducerAnd.combine(true, true), true)
    strictEqual(Boolean.ReducerAnd.combine(true, false), false)
    strictEqual(Boolean.ReducerAnd.combine(false, true), false)
    strictEqual(Boolean.ReducerAnd.combine(false, false), false)
    strictEqual(Boolean.ReducerAnd.combine(Boolean.ReducerAnd.initialValue, false), false)
    strictEqual(Boolean.ReducerAnd.combine(Boolean.ReducerAnd.initialValue, true), true)
    strictEqual(Boolean.ReducerAnd.combine(false, Boolean.ReducerAnd.initialValue), false)
    strictEqual(Boolean.ReducerAnd.combine(true, Boolean.ReducerAnd.initialValue), true)
  })

  it("ReducerOr", () => {
    strictEqual(Boolean.ReducerOr.combine(true, true), true)
    strictEqual(Boolean.ReducerOr.combine(true, false), true)
    strictEqual(Boolean.ReducerOr.combine(false, true), true)
    strictEqual(Boolean.ReducerOr.combine(false, false), false)
    strictEqual(Boolean.ReducerOr.combine(Boolean.ReducerOr.initialValue, false), false)
    strictEqual(Boolean.ReducerOr.combine(Boolean.ReducerOr.initialValue, true), true)
    strictEqual(Boolean.ReducerOr.combine(false, Boolean.ReducerOr.initialValue), false)
    strictEqual(Boolean.ReducerOr.combine(true, Boolean.ReducerOr.initialValue), true)
  })
})
