import { Schema } from "effect"
import type * as JsonSchema from "effect/JsonSchema"
import { Rewriter } from "effect/unstable/jsonschema"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../../utils/assert.ts"

function assertRewrite(
  rewriter: Rewriter.Rewriter,
  schema: Schema.Top,
  expected: {
    readonly schema: JsonSchema.JsonSchema
    readonly definitions?: Record<string, JsonSchema.JsonSchema> | undefined
  },
  options?: Schema.ToJsonSchemaOptions
) {
  const document = rewriter(
    Schema.toJsonSchemaDocument(schema, {
      generateDescriptions: true,
      ...options
    })
  )
  deepStrictEqual(document.schema, expected.schema)
  deepStrictEqual(document.definitions, expected.definitions ?? {})
}

describe("Rewriter", () => {
  describe("openAi", () => {
    it("Root must be an object and not a union", () => {
      assertRewrite(
        Rewriter.openAi,
        Schema.String,
        {
          schema: {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": false
          }
        }
      )
      assertRewrite(
        Rewriter.openAi,
        Schema.Union([Schema.String, Schema.Number]),
        {
          schema: {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": false
          }
        }
      )
    })

    describe("Suspend", () => {
      it("outer annotation", () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
        }).annotate({ identifier: "A" })

        assertRewrite(
          Rewriter.openAi,
          schema,
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                },
                "as": {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/A"
                  }
                }
              },
              "required": ["a", "as"],
              "additionalProperties": false
            },
            definitions: {
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
          }
        )
      })

      it("inner annotation", () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema.annotate({ identifier: "A" })))
        })
        assertRewrite(
          Rewriter.openAi,
          schema,
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "$ref": "#/$defs/String_"
                },
                "as": {
                  "$ref": "#/$defs/Arrays_"
                }
              },
              "required": ["a", "as"],
              "additionalProperties": false
            },
            definitions: {
              String_: {
                "type": "string"
              },
              Arrays_: {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "a": {
                      "$ref": "#/$defs/String_"
                    },
                    "as": {
                      "$ref": "#/$defs/Arrays_"
                    }
                  },
                  "required": ["a", "as"],
                  "additionalProperties": false
                }
              }
            }
          }
        )
      })
    })

    describe("Struct", () => {
      it("additionalProperties: false must always be set in objects", () => {
        assertRewrite(
          Rewriter.openAi,
          Schema.Struct({ a: Schema.String }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          },
          {
            additionalProperties: true
          }
        )
      })

      it("required field", () => {
        assertRewrite(
          Rewriter.openAi,
          Schema.Struct({ a: Schema.NonEmptyString }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string",
                  "description": "a value with a length of at least 1"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })

      describe("optional field", () => {
        it("optionalKey", () => {
          assertRewrite(
            Rewriter.openAi,
            Schema.Struct({ a: Schema.optionalKey(Schema.String) }),
            {
              schema: {
                "type": "object",
                "properties": {
                  "a": { "type": ["string", "null"] }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          )
        })

        it("optional", () => {
          assertRewrite(
            Rewriter.openAi,
            Schema.Struct({ a: Schema.optional(Schema.String) }),
            {
              schema: {
                "type": "object",
                "properties": {
                  "a": {
                    "anyOf": [
                      { "type": "string" },
                      { "type": "null" }
                    ]
                  }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          )
        })

        it("UndefinedOr", () => {
          assertRewrite(
            Rewriter.openAi,
            Schema.Struct({ a: Schema.UndefinedOr(Schema.String) }),
            {
              schema: {
                "type": "object",
                "properties": {
                  "a": {
                    "anyOf": [
                      { "type": "string" },
                      { "type": "null" }
                    ]
                  }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          )
        })
      })
    })

    describe("Union", () => {
      it("anyOf", () => {
        assertRewrite(
          Rewriter.openAi,
          Schema.Struct({
            a: Schema.Union([
              Schema.NonEmptyString.annotate({ description: "string description" }),
              Schema.Union([
                Schema.Int.check(Schema.isGreaterThan(0)),
                Schema.Boolean.annotate({ description: "boolean description" })
              ]).annotate({ description: "number or boolean description" })
            ]).annotate({ description: "top level description" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "anyOf": [
                    {
                      "type": "string",
                      "description": "string description"
                    },
                    {
                      "anyOf": [
                        {
                          "type": "integer",
                          "exclusiveMinimum": 0,
                          "description": "an integer, a value greater than 0"
                        },
                        {
                          "type": "boolean",
                          "description": "boolean description"
                        }
                      ],
                      "description": "number or boolean description"
                    }
                  ],
                  "description": "top level description"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })

      it("anyOf", () => {
        assertRewrite(
          Rewriter.openAi,
          Schema.Struct({
            a: Schema.Union([
              Schema.NonEmptyString.annotate({ description: "string description" }),
              Schema.Union([
                Schema.Int.check(Schema.isGreaterThan(0)),
                Schema.Boolean.annotate({ description: "boolean description" })
              ], { mode: "oneOf" }).annotate({ description: "number or boolean description" })
            ], { mode: "oneOf" }).annotate({ description: "top level description" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "anyOf": [
                    {
                      "type": "string",
                      "description": "string description"
                    },
                    {
                      "anyOf": [
                        {
                          "type": "integer",
                          "exclusiveMinimum": 0,
                          "description": "an integer, a value greater than 0"
                        },
                        {
                          "type": "boolean",
                          "description": "boolean description"
                        }
                      ],
                      "description": "number or boolean description"
                    }
                  ],
                  "description": "top level description"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })
    })

    it("String", () => {
      assertRewrite(
        Rewriter.openAi,
        Schema.Struct({ a: Schema.String.check(Schema.isMinLength(1)) }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string",
                "description": "a value with a length of at least 1"
              }
            },
            "required": ["a"],
            "additionalProperties": false
          }
        }
      )
      assertRewrite(
        Rewriter.openAi,
        Schema.Struct({
          a: Schema.String.check(Schema.isMinLength(1, {
            description: "description isMinLength(1)"
          }))
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string",
                "description": "description isMinLength(1)"
              }
            },
            "required": ["a"],
            "additionalProperties": false
          }
        }
      )
      assertRewrite(
        Rewriter.openAi,
        Schema.Struct({
          a: Schema.String.check(
            Schema.isMinLength(1, {
              description: "description isMinLength(1)"
            }),
            Schema.isMaxLength(4)
          )
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string",
                "description": "description isMinLength(1), a value with a length of at most 4"
              }
            },
            "required": ["a"],
            "additionalProperties": false
          }
        }
      )
    })

    it("Tuple", () => {
      assertRewrite(
        Rewriter.openAi,
        Schema.Struct({ a: Schema.Tuple([Schema.NonEmptyString, Schema.Finite]) }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "array",
                "prefixItems": [
                  {
                    "type": "string",
                    "description": "a value with a length of at least 1"
                  },
                  {
                    "type": "number",
                    "description": "a finite number"
                  }
                ],
                "minItems": 2,
                "maxItems": 2
              }
            },
            "required": ["a"],
            "additionalProperties": false
          }
        }
      )
    })

    it("Array", () => {
      assertRewrite(
        Rewriter.openAi,
        Schema.Struct({ a: Schema.Array(Schema.NonEmptyString) }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "array",
                "items": {
                  "type": "string",
                  "description": "a value with a length of at least 1"
                }
              }
            },
            "required": ["a"],
            "additionalProperties": false
          }
        }
      )
    })

    it("const", () => {
      const document = Rewriter.openAi({
        dialect: "draft-2020-12",
        schema: {
          "type": "object",
          "properties": {
            "a": {
              "const": "a"
            }
          },
          "required": ["a"],
          "additionalProperties": false
        },
        definitions: {}
      })

      deepStrictEqual(document.schema, {
        "type": "object",
        "properties": {
          "a": {
            "enum": ["a"]
          }
        },
        "required": ["a"],
        "additionalProperties": false
      })
    })

    it("UniqueArray", () => {
      assertRewrite(
        Rewriter.openAi,
        Schema.Struct({ a: Schema.UniqueArray(Schema.String) }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "an array with unique items"
              }
            },
            "required": ["a"],
            "additionalProperties": false
          }
        }
      )
    })
  })
})
