import type { Schema } from "effect"
import { SchemaCheck } from "effect"
import { describe, expect, it } from "tstyche"

describe("SchemaCheck", () => {
  it("asCheck should allow to lift filters to schema combinators", () => {
    const check = SchemaCheck.asCheck(SchemaCheck.maxLength(5))
    expect(check).type.toBe<
      <S extends Schema.Schema<{ readonly length: number }>>(self: S) => S["~rebuild.out"]
    >()
  })
})
