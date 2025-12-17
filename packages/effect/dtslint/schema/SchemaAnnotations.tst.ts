import type { Option } from "effect"
import { Schema, SchemaAnnotations } from "effect"
import { describe, expect, it } from "tstyche"

describe("Annotations", () => {
  describe("resolveInto", () => {
    it("String", () => {
      const schema = Schema.String
      const annotations = SchemaAnnotations.resolveInto(schema)
      expect(annotations).type.toBe<SchemaAnnotations.Bottom<string, readonly []> | undefined>()
      expect(annotations?.examples).type.toBe<ReadonlyArray<string> | undefined>()
    })

    it("URL", () => {
      const schema = Schema.URL
      const annotations = SchemaAnnotations.resolveInto(schema)
      expect(annotations).type.toBe<SchemaAnnotations.Bottom<URL, readonly []> | undefined>()
    })

    it("Option(string)", () => {
      const schema = Schema.Option(Schema.String)
      const annotations = SchemaAnnotations.resolveInto(schema)
      expect(annotations).type.toBe<
        SchemaAnnotations.Bottom<Option.Option<string>, readonly [Schema.String]> | undefined
      >()
    })
  })
})
