import { Combiner } from "effect/data"
import { Number, String } from "effect/primitives"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "../utils/assert.ts"

describe("Combiner", () => {
  it("UndefinedOr", () => {
    const C = Combiner.UndefinedOr(Number.ReducerSum)

    // if one side is undefined, return the other
    strictEqual(C.combine(undefined, 2), 2)
    strictEqual(C.combine(2, undefined), 2)

    // when both defined, combine
    strictEqual(C.combine(1, 2), 3)
  })

  it("NullOr", () => {
    const C = Combiner.NullOr(Number.ReducerSum)

    // if one side is null, return the other
    strictEqual(C.combine(null, 2), 2)
    strictEqual(C.combine(2, null), 2)

    // when both non-null, combine
    strictEqual(C.combine(1, 2), 3)
  })

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
          n: Combiner.UndefinedOr(Number.ReducerSum),
          s: Combiner.UndefinedOr(String.ReducerConcat)
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
