import { deepStrictEqual } from "@effect/vitest/utils"
import { Schema } from "effect/schema"
import type { StandardJSONSchemaV1 } from "effect/schema/StandardSchema"
import { describe, it } from "vitest"

function standardConvertToJSONSchema(
  schema: StandardJSONSchemaV1
): Record<string, unknown> {
  return schema["~standard"].jsonSchema.input({
    target: "draft-07"
  })
}

describe("asStandardJSONSchemaV1", () => {
  it("a schema without identifiers", () => {
    const schema = Schema.String
    const standardJSONSchema = Schema.asStandardJSONSchemaV1(schema)
    deepStrictEqual(standardConvertToJSONSchema(standardJSONSchema), {
      "type": "string"
    })
  })

  it("a schema with identifier", () => {
    const schema = Schema.String.annotate({ identifier: "ID" })
    const standardJSONSchema = Schema.asStandardJSONSchemaV1(schema)
    deepStrictEqual(standardConvertToJSONSchema(standardJSONSchema), {
      "$ref": "#/definitions/ID",
      "definitions": {
        "ID": {
          "type": "string"
        }
      }
    })
  })

  it("a recursive schema", () => {
    type A = {
      readonly a: string
      readonly as: ReadonlyArray<A>
    }
    const schema = Schema.Struct({
      a: Schema.String,
      as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
    }).annotate({ identifier: "A" })
    const standardJSONSchema = Schema.asStandardJSONSchemaV1(schema)
    deepStrictEqual(standardConvertToJSONSchema(standardJSONSchema), {
      "$ref": "#/definitions/A",
      "definitions": {
        "A": {
          "type": "object",
          "properties": {
            "a": { "type": "string" },
            "as": { "type": "array", "items": { "$ref": "#/definitions/A" } }
          },
          "required": ["a", "as"],
          "additionalProperties": false
        }
      }
    })
  })
})
