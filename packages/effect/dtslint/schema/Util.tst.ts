import { Schema, Util } from "effect/schema"
import { describe, expect, it } from "tstyche"

describe("Util", () => {
  describe("asTaggedUnion", () => {
    it("should throw if the tag field is invalid", () => {
      const original = Schema.Union([
        Schema.Struct({ _tag: Schema.tag("A"), a: Schema.String }),
        Schema.Struct({ _tag: Schema.tag("B"), b: Schema.Finite })
      ])

      expect(original.pipe).type.toBeCallableWith(Util.asTaggedUnion("_tag"))
      expect(original.pipe).type.not.toBeCallableWith(Util.asTaggedUnion("a"))
    })
  })
})
