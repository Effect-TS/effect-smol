import { assertTrue, deepStrictEqual } from "@effect/vitest/utils"
import type { StandardJSONSchemaV1 } from "@standard-schema/spec"
import { Schema } from "effect"
import { describe, it } from "vitest"

function standardConvertToJSONSchemaInput(
  schema: StandardJSONSchemaV1
): Record<string, unknown> {
  return schema["~standard"].jsonSchema.input({
    target: "draft-2020-12"
  })
}

function standardConvertToJSONSchemaOutput(
  schema: StandardJSONSchemaV1
): Record<string, unknown> {
  return schema["~standard"].jsonSchema.output({
    target: "draft-2020-12"
  })
}

describe("toStandardJSONSchemaV1", () => {
  it("should return a schema", () => {
    const schema = Schema.FiniteFromString
    const standardSchema = Schema.toStandardJSONSchemaV1(schema)
    assertTrue(Schema.isSchema(standardSchema))
  })

  it("should support both standards", () => {
    const schema = Schema.String
    const both = Schema.toStandardSchemaV1(Schema.toStandardJSONSchemaV1(schema))
    deepStrictEqual(standardConvertToJSONSchemaInput(both), {
      "type": "string"
    })
  })

  it("should return the input JSON Schema", () => {
    const schema = Schema.FiniteFromString
    const standardJSONSchema = Schema.toStandardJSONSchemaV1(schema)
    deepStrictEqual(standardConvertToJSONSchemaInput(standardJSONSchema), {
      "type": "string"
    })
  })

  it("should return the output JSON Schema", () => {
    const schema = Schema.FiniteFromString
    const standardJSONSchema = Schema.toStandardJSONSchemaV1(schema)
    deepStrictEqual(standardConvertToJSONSchemaOutput(standardJSONSchema), {
      "type": "number"
    })
  })

  it("a schema with identifier", () => {
    const schema = Schema.String.annotate({ identifier: "ID" })
    const standardJSONSchema = Schema.toStandardJSONSchemaV1(schema)
    deepStrictEqual(standardConvertToJSONSchemaInput(standardJSONSchema), {
      "$ref": "#/$defs/ID",
      "$defs": {
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
    const standardJSONSchema = Schema.toStandardJSONSchemaV1(schema)
    deepStrictEqual(standardConvertToJSONSchemaInput(standardJSONSchema), {
      "$ref": "#/$defs/A",
      "$defs": {
        "A": {
          "type": "object",
          "properties": {
            "a": { "type": "string" },
            "as": { "type": "array", "items": { "$ref": "#/$defs/A" } }
          },
          "required": ["a", "as"],
          "additionalProperties": false
        }
      }
    })
  })
})
