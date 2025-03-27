import type { Brand } from "effect"
import { Schema } from "effect"
import { describe, expect, it } from "tstyche"

describe("Schema", () => {
  describe("make", () => {
    it("Schema", () => {
      const schema = Schema.String
      expect(schema.make).type.toBe<(a: string) => string>()
    })

    it("brand", () => {
      const schema = Schema.String.pipe(Schema.brand("a"))
      expect(schema.make).type.toBe<(a: string) => string & Brand.Brand<"a">>()
    })

    it("Struct", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.brand("a"))
      })
      expect(schema.make).type.toBe<(a: { readonly a: string }) => { readonly a: string & Brand.Brand<"a"> }>()
    })
  })
})
