import type { Schema } from "effect"
import { SchemaFilter } from "effect"
import { describe, expect, it } from "tstyche"

describe("SchemaFilter", () => {
  it("asCheck should allow to lift filters to schema combinators", () => {
    const check = SchemaFilter.asCheck(SchemaFilter.maxLength(5))
    expect(check).type.toBe<
      <S extends Schema.Schema<{ readonly length: number }>>(self: S) => S["~rebuild.out"]
    >()
  })

  it("asCheckEncoded should allow to lift filters to schema combinators", () => {
    const check = SchemaFilter.asCheckEncoded(SchemaFilter.maxLength(5))
    expect(check).type.toBe<
      <S extends Schema.Top & { readonly Encoded: { readonly length: number } }>(self: S) => S["~rebuild.out"]
    >()
  })
})
