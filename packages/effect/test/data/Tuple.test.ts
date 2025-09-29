import { Number, pipe, String } from "effect"
import { Tuple } from "effect/data"
import { Schema } from "effect/schema"
import { TestSchema } from "effect/testing"
import { deepStrictEqual, strictEqual } from "node:assert"
import { describe, it } from "vitest"

const tuple = ["a", 2, true] as [string, number, boolean]

describe("Tuple", () => {
  it("make", () => {
    deepStrictEqual(Tuple.make("a", 2, true), ["a", 2, true])
  })

  it("get", () => {
    strictEqual(pipe(tuple, Tuple.get(0)), "a")
    strictEqual(pipe(tuple, Tuple.get(1)), 2)

    strictEqual(Tuple.get(tuple, 0), "a")
    strictEqual(Tuple.get(tuple, 1), 2)
  })

  it("pick", () => {
    deepStrictEqual(pipe(tuple, Tuple.pick([0, 2])), ["a", true])
    deepStrictEqual(Tuple.pick(tuple, [0, 2]), ["a", true])
  })

  it("omit", () => {
    deepStrictEqual(pipe(tuple, Tuple.omit([1])), ["a", true])
    deepStrictEqual(Tuple.omit(tuple, [1]), ["a", true])
  })

  it("evolve", () => {
    deepStrictEqual(
      pipe(
        tuple,
        Tuple.evolve([
          (s) => s.length,
          undefined,
          (b) => `b: ${b}`
        ])
      ),
      [1, 2, "b: true"]
    )
    deepStrictEqual(
      Tuple.evolve(
        tuple,
        [
          (s) => s.length,
          undefined,
          (b) => `b: ${b}`
        ] as const
      ),
      [1, 2, "b: true"]
    )
  })

  describe("renameIndices", () => {
    it("partial index mapping", () => {
      deepStrictEqual(pipe(tuple, Tuple.renameIndices(["1", "0"])), [2, "a", true])
      deepStrictEqual(Tuple.renameIndices(tuple, ["1", "0"]), [2, "a", true])
    })

    it("full index mapping", () => {
      deepStrictEqual(pipe(tuple, Tuple.renameIndices(["2", "1", "0"])), [true, 2, "a"])
      deepStrictEqual(Tuple.renameIndices(tuple, ["2", "1", "0"]), [true, 2, "a"])
    })
  })

  it("map", () => {
    const tuple = [Schema.String, Schema.Number, Schema.Boolean] as const
    TestSchema.Asserts.ast.elements.equals(pipe(tuple, Tuple.map(Schema.NullOr)), [
      Schema.NullOr(Schema.String),
      Schema.NullOr(Schema.Number),
      Schema.NullOr(Schema.Boolean)
    ])
    TestSchema.Asserts.ast.elements.equals(Tuple.map(tuple, Schema.NullOr), [
      Schema.NullOr(Schema.String),
      Schema.NullOr(Schema.Number),
      Schema.NullOr(Schema.Boolean)
    ])
  })

  it("mapPick", () => {
    const tuple = [Schema.String, Schema.Number, Schema.Boolean] as const
    TestSchema.Asserts.ast.elements.equals(pipe(tuple, Tuple.mapPick([0, 2], Schema.NullOr)), [
      Schema.NullOr(Schema.String),
      Schema.Number,
      Schema.NullOr(Schema.Boolean)
    ])
    TestSchema.Asserts.ast.elements.equals(Tuple.mapPick(tuple, [0, 2], Schema.NullOr), [
      Schema.NullOr(Schema.String),
      Schema.Number,
      Schema.NullOr(Schema.Boolean)
    ])
  })

  it("mapOmit", () => {
    const tuple = [Schema.String, Schema.Number, Schema.Boolean] as const
    TestSchema.Asserts.ast.elements.equals(pipe(tuple, Tuple.mapOmit([1], Schema.NullOr)), [
      Schema.NullOr(Schema.String),
      Schema.Number,
      Schema.NullOr(Schema.Boolean)
    ])
    TestSchema.Asserts.ast.elements.equals(Tuple.mapOmit(tuple, [1], Schema.NullOr), [
      Schema.NullOr(Schema.String),
      Schema.Number,
      Schema.NullOr(Schema.Boolean)
    ])
  })

  it("getCombiner", () => {
    const C = Tuple.getCombiner([
      Number.ReducerSum,
      String.ReducerConcat
    ])

    deepStrictEqual(C.combine([1, "a"], [2, "b"]), [3, "ab"])
  })

  it("getReducer", () => {
    const R = Tuple.getReducer([
      Number.ReducerSum,
      String.ReducerConcat
    ])

    deepStrictEqual(R.initialValue, [0, ""])
  })
})
