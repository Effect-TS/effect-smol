import { Combiner, UndefinedOr } from "effect/data"
import { Number, String } from "effect/primitives"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("Combiner", () => {
  describe("Struct", () => {
    it("default omitKeyWhen (never omit)", () => {
      const C = Combiner.Struct({
        n: Number.ReducerSum,
        s: String.ReducerConcat
      })

      deepStrictEqual(C.combine({ n: 1, s: "a" }, { n: 2, s: "b" }), { n: 3, s: "ab" })
    })

    it("custom omitKeyWhen", () => {
      const C = Combiner.Struct<{ n?: number | undefined; s?: string | undefined }>(
        {
          n: UndefinedOr.getReducer(Number.ReducerSum),
          s: UndefinedOr.getReducer(String.ReducerConcat)
        },
        { omitKeyWhen: (v) => v === undefined }
      )

      // merged values equal to undefined should be omitted
      deepStrictEqual(C.combine({ n: undefined, s: "a" }, { n: undefined, s: "b" }), { s: "ab" })
      deepStrictEqual(C.combine({ s: undefined }, { s: "b" }), { s: "b" })
      deepStrictEqual(C.combine({ s: "a" }, { s: undefined }), { s: "a" })
      deepStrictEqual(C.combine({ s: "a" }, { s: "b" }), { s: "ab" })
    })
  })
})
