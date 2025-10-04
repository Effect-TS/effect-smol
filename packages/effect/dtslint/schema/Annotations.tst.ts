import type { Option } from "effect/data"
import { Annotations, Schema } from "effect/schema"
import { describe, expect, it } from "tstyche"

describe("Annotations", () => {
  describe("getUnsafe", () => {
    it("String", () => {
      const schema = Schema.String
      const annotations = Annotations.getUnsafe(schema)
      expect(annotations).type.toBe<Annotations.Bottom<string, readonly []> | undefined>()
      expect(annotations?.examples).type.toBe<ReadonlyArray<string> | undefined>()
    })

    it("URL", () => {
      const schema = Schema.URL
      const annotations = Annotations.getUnsafe(schema)
      expect(annotations).type.toBe<Annotations.Bottom<URL, readonly []> | undefined>()
    })

    it("Option(string)", () => {
      const schema = Schema.Option(Schema.String)
      const annotations = Annotations.getUnsafe(schema)
      expect(annotations).type.toBe<Annotations.Bottom<Option.Option<string>, readonly [Schema.String]> | undefined>()
    })
  })
})
