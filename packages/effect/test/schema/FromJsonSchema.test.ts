import type { Annotations } from "effect/schema"
import { FromJsonSchema, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

function assertRoundtrip(schema: Schema.Top) {
  const document = Schema.makeJsonSchemaDraft2020_12(schema)
  const code = FromJsonSchema.make(document.schema)
  const fn = new Function("Schema", `return ${code}`)
  const generated = fn(Schema)
  const codedocument = Schema.makeJsonSchemaDraft2020_12(generated)
  deepStrictEqual(codedocument, document)
  deepStrictEqual(FromJsonSchema.make(codedocument.schema), code)
}

function assertOutput(
  input: {
    readonly schema: Record<string, unknown> | boolean
    readonly definitions?: Schema.JsonSchema.Definitions | undefined
    readonly target?: Annotations.JsonSchema.Target | undefined
  },
  expected: string
) {
  const code = FromJsonSchema.make(input.schema, {
    target: input.target ?? "2020-12",
    definitions: input.definitions ?? {}
  })
  deepStrictEqual(code, expected)
}

describe("FromJsonSchema", () => {
  it("should handle `true` as `Schema.Unknown`", () => {
    assertOutput({ schema: true }, "Schema.Unknown")
  })

  it("should handle `false` as `Schema.Never`", () => {
    assertOutput({ schema: false }, "Schema.Never")
  })

  describe("type as array", () => {
    it("string | number", () => {
      assertOutput({
        schema: {
          "type": ["string", "number"]
        }
      }, "Schema.Union([Schema.String, Schema.Number])")
    })

    it("string | number & annotations", () => {
      assertOutput({
        schema: {
          "type": ["string", "number"],
          "description": "description"
        }
      }, `Schema.Union([Schema.String, Schema.Number]).annotate({ description: "description" })`)
    })
  })

  it("should handle annotations", () => {
    assertOutput(
      {
        schema: {
          "type": "string",
          "title": "title",
          "description": "description",
          "default": "a",
          "examples": ["a", "b"]
        }
      },
      `Schema.String.annotate({ title: "title", description: "description", default: "a", examples: ["a", "b"] })`
    )
  })

  it("should handle checks", () => {
    assertOutput(
      {
        schema: {
          "type": "string",
          "minLength": 1
        }
      },
      `Schema.String.check(Schema.isMinLength(1))`
    )
    assertOutput(
      {
        schema: {
          "type": "string",
          "description": "description",
          "minLength": 1
        }
      },
      `Schema.String.annotate({ description: "description" }).check(Schema.isMinLength(1))`
    )
  })

  describe("$ref", () => {
    it("simple identifier", () => {
      assertOutput(
        {
          schema: {
            "$ref": "#/definitions/ID"
          },
          definitions: {
            "ID": {
              "type": "string"
            }
          }
        },
        `Schema.String.annotate({ identifier: "ID" })`
      )
    })

    it("escaped identifier", () => {
      assertOutput(
        {
          schema: {
            "$ref": "#/definitions/ID~1a~0b"
          },
          definitions: {
            "ID/a~b": {
              "type": "string"
            }
          }
        },
        `Schema.String.annotate({ identifier: "ID/a~b" })`
      )
    })

    describe("recursive", () => {
      it.todo("top annotation", () => {
        assertOutput(
          {
            schema: {
              "$ref": "#/definitions/A"
            },
            definitions: {
              "A": {
                "type": "object",
                "properties": {
                  "a": {
                    "type": "string"
                  },
                  "as": {
                    "type": "array",
                    "items": { "$ref": "#/definitions/A" }
                  }
                },
                "required": ["a", "as"],
                "additionalProperties": false
              }
            }
          },
          `Schema.Struct({
            a: Schema.String,
            as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
          }).annotate({ identifier: "A" })`
        )
      })
    })
  })

  describe("object", () => {
    it("no properties", () => {
      assertOutput({
        schema: {
          "type": "object"
        }
      }, "Schema.Record(Schema.String, Schema.Unknown)")
    })

    it("empty struct", () => {
      assertOutput({
        schema: {
          "anyOf": [
            { "type": "object" },
            { "type": "array" }
          ]
        }
      }, "Schema.Union([Schema.Record(Schema.String, Schema.Unknown), Schema.Array(Schema.Unknown)])")
    })

    it("properties", () => {
      assertOutput(
        {
          schema: {
            "type": "object",
            "properties": {
              "a": { "type": "string" },
              "b": { "type": "number" }
            },
            "required": ["a"]
          }
        },
        "Schema.Struct({ a: Schema.String, b: Schema.optionalKey(Schema.Number) })"
      )
    })
  })

  describe("roundtrips", () => {
    it("Never", () => {
      assertRoundtrip(Schema.Never)
    })

    it("Unknown", () => {
      assertRoundtrip(Schema.Unknown)
    })

    it("Null", () => {
      assertRoundtrip(Schema.Null)
    })

    describe("String", () => {
      it("basic", () => {
        assertRoundtrip(Schema.String)
      })

      it("with annotations", () => {
        assertRoundtrip(Schema.String.annotate({ title: "title", description: "description" }))
      })

      it("with check", () => {
        assertRoundtrip(Schema.String.check(Schema.isMinLength(1)))
      })

      it("with check and annotations", () => {
        assertRoundtrip(Schema.String.annotate({ description: "description" }).check(Schema.isMinLength(1)))
        assertRoundtrip(Schema.String.check(Schema.isMinLength(1)).annotate({ description: "description" }))
        assertRoundtrip(Schema.String.check(Schema.isMinLength(1, { description: "description" })))
      })

      it("with checks", () => {
        assertRoundtrip(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10)))
      })

      it("with checks and annotations", () => {
        assertRoundtrip(
          Schema.String.annotate({ description: "description" }).check(Schema.isMinLength(1), Schema.isMaxLength(10))
        )
        assertRoundtrip(
          Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10)).annotate({ description: "description" })
        )
        assertRoundtrip(
          Schema.String.check(Schema.isMinLength(1, { description: "description" }), Schema.isMaxLength(10))
        )
        assertRoundtrip(
          Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10, { description: "description" }))
        )
        assertRoundtrip(
          Schema.String.annotate({ description: "description1" }).check(
            Schema.isMinLength(1),
            Schema.isMaxLength(10, { description: "description2" })
          )
        )
        assertRoundtrip(
          Schema.String.check(
            Schema.isMinLength(1, { description: "description1" }),
            Schema.isMaxLength(10, { description: "description2" })
          )
        )
      })
    })

    it("Number", () => {
      assertRoundtrip(Schema.Number)
    })

    it("Boolean", () => {
      assertRoundtrip(Schema.Boolean)
    })

    it("Int", () => {
      assertRoundtrip(Schema.Int)
    })

    describe("Struct", () => {
      it.todo("empty", () => {
        assertRoundtrip(Schema.Struct({}))
      })

      it("required field", () => {
        assertRoundtrip(Schema.Struct({
          a: Schema.String
        }))
      })

      it("optionalKey field", () => {
        assertRoundtrip(Schema.Struct({
          a: Schema.optionalKey(Schema.String)
        }))
      })

      it("optional field", () => {
        assertRoundtrip(Schema.Struct({
          a: Schema.optional(Schema.String)
        }))
      })
    })

    describe("Tuple", () => {
      it("empty", () => {
        assertRoundtrip(Schema.Tuple([]))
      })

      it.todo("required element", () => {
        assertRoundtrip(Schema.Tuple([Schema.String]))
      })

      it.todo("optionalKey element", () => {
        assertRoundtrip(Schema.Tuple([Schema.optionalKey(Schema.String)]))
      })
    })

    describe("Union", () => {
      it("empty", () => {
        assertRoundtrip(Schema.Union([]))
      })

      it("String | Number", () => {
        assertRoundtrip(Schema.Union([Schema.String, Schema.Number]))
      })
    })
  })
})
