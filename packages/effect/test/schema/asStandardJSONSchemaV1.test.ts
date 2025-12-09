import { assertTrue, deepStrictEqual } from "@effect/vitest/utils"
import { Schema } from "effect/schema"
import type { StandardJSONSchemaV1 } from "effect/schema/StandardSchema"
import { describe, it } from "vitest"

function standardConvertToJSONSchemaInput(
  schema: StandardJSONSchemaV1
): Record<string, unknown> {
  return schema["~standard"].jsonSchema.input({
    target: "draft-07"
  })
}

function standardConvertToJSONSchemaOutput(
  schema: StandardJSONSchemaV1
): Record<string, unknown> {
  return schema["~standard"].jsonSchema.output({
    target: "draft-07"
  })
}

describe("asStandardJSONSchemaV1", () => {
  it("should return a schema", () => {
    const schema = Schema.FiniteFromString
    const standardSchema = Schema.asStandardJSONSchemaV1(schema)
    assertTrue(Schema.isSchema(standardSchema))
  })

  it("should support both standards", () => {
    const schema = Schema.String
    const both = Schema.asStandardSchemaV1(Schema.asStandardJSONSchemaV1(schema))
    deepStrictEqual(standardConvertToJSONSchemaInput(both), {
      "type": "string"
    })
  })

  it("should return the input JSON Schema", () => {
    const schema = Schema.FiniteFromString
    const standardJSONSchema = Schema.asStandardJSONSchemaV1(schema)
    deepStrictEqual(standardConvertToJSONSchemaInput(standardJSONSchema), {
      "type": "string"
    })
  })

  it("should return the output JSON Schema", () => {
    const schema = Schema.FiniteFromString
    const standardJSONSchema = Schema.asStandardJSONSchemaV1(schema)
    deepStrictEqual(standardConvertToJSONSchemaOutput(standardJSONSchema), {
      "type": "number"
    })
  })

  it("a schema with identifier", () => {
    const schema = Schema.String.annotate({ identifier: "ID" })
    const standardJSONSchema = Schema.asStandardJSONSchemaV1(schema)
    deepStrictEqual(standardConvertToJSONSchemaInput(standardJSONSchema), {
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
    deepStrictEqual(standardConvertToJSONSchemaInput(standardJSONSchema), {
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
