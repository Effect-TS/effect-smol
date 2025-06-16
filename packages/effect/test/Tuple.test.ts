import { pipe, Schema, Tuple } from "effect"
import { describe, it } from "vitest"
import * as Util from "./SchemaTest.js"
import { deepStrictEqual, fail, strictEqual, throws } from "./utils/assert.js"

const assertions = Util.assertions({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

const tuple = ["a", 2, true] as [string, number, boolean]

describe("Tuple", () => {
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
    assertions.schema.elements.equals(pipe(tuple, Tuple.map(Schema.NullOr)), [
      Schema.NullOr(Schema.String),
      Schema.NullOr(Schema.Number),
      Schema.NullOr(Schema.Boolean)
    ])
    assertions.schema.elements.equals(Tuple.map(tuple, Schema.NullOr), [
      Schema.NullOr(Schema.String),
      Schema.NullOr(Schema.Number),
      Schema.NullOr(Schema.Boolean)
    ])
  })

  it("mapPick", () => {
    const tuple = [Schema.String, Schema.Number, Schema.Boolean] as const
    assertions.schema.elements.equals(pipe(tuple, Tuple.mapPick([0, 2], Schema.NullOr)), [
      Schema.NullOr(Schema.String),
      Schema.Number,
      Schema.NullOr(Schema.Boolean)
    ])
    assertions.schema.elements.equals(Tuple.mapPick(tuple, [0, 2], Schema.NullOr), [
      Schema.NullOr(Schema.String),
      Schema.Number,
      Schema.NullOr(Schema.Boolean)
    ])
  })

  it("mapOmit", () => {
    const tuple = [Schema.String, Schema.Number, Schema.Boolean] as const
    assertions.schema.elements.equals(pipe(tuple, Tuple.mapOmit([1], Schema.NullOr)), [
      Schema.NullOr(Schema.String),
      Schema.Number,
      Schema.NullOr(Schema.Boolean)
    ])
    assertions.schema.elements.equals(Tuple.mapOmit(tuple, [1], Schema.NullOr), [
      Schema.NullOr(Schema.String),
      Schema.Number,
      Schema.NullOr(Schema.Boolean)
    ])
  })
})
