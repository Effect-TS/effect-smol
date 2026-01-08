import type { JsonSchema } from "effect"
import { Schema, SchemaRepresentation } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../../utils/assert.ts"

describe("toJson", () => {
  function assertToJson(
    schema: Schema.Top,
    expected: {
      readonly schema: JsonSchema.JsonSchema
      readonly references?: Record<string, JsonSchema.JsonSchema>
    }
  ) {
    const document = SchemaRepresentation.fromAST(schema.ast)
    const jd = SchemaRepresentation.toJson(document)
    deepStrictEqual(jd, { references: {}, ...expected })
    deepStrictEqual(SchemaRepresentation.toJson(SchemaRepresentation.fromJson(jd)), jd)
  }

  it("String", () => {
    assertToJson(Schema.String, {
      schema: { _tag: "String", checks: [] }
    })
  })
})
