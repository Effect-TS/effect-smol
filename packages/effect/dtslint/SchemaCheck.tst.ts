import { Schema, SchemaCheck } from "effect"
import { describe, expect, it } from "tstyche"

describe("SchemaCheck", () => {
  it("asCheck", () => {
    const check = Schema.asCheck(SchemaCheck.maxLength(5))
    expect(check).type.toBe<
      <S extends Schema.Schema<{ readonly length: number }>>(self: S) => S["~rebuild.out"]
    >()
  })
})
