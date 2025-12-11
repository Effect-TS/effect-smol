import { Schema } from "effect/schema"
import { Rewriter } from "effect/unstable/jsonschema"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../../utils/assert.ts"

function assertJsonSchema(
  rewriter: Rewriter.Rewriter,
  schema: Schema.Top,
  expected: {
    readonly schema: Schema.JsonSchema
    readonly definitions?: Record<string, Schema.JsonSchema> | undefined
    readonly traces?: Array<string> | undefined
  },
  options?: Schema.MakeJsonSchemaOptions
) {
  const traces: Array<string> = []
  const tracer: Rewriter.Tracer = {
    push(change) {
      traces.push(change)
    }
  }
  const document = rewriter(
    Schema.makeJsonSchema(schema, {
      target: "draft-2020-12",
      generateDescriptions: true,
      referenceStrategy: "skip-top-level",
      ...options
    }),
    tracer
  )
  const copy = JSON.parse(JSON.stringify(document.schema))
  deepStrictEqual(document.schema, expected.schema)
  deepStrictEqual(document.definitions, expected.definitions ?? {})
  deepStrictEqual(traces, expected.traces ?? [])
  deepStrictEqual(copy, document.schema)
}

describe("Rewriter", () => {
  describe("openAi", () => {
    it("root must be an object", () => {
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Union([Schema.String, Schema.Number]),
        {
          schema: {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": false
          },
          traces: [
            `root must be an object, returning default schema at ["schema"]`
          ]
        }
      )
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Union([Schema.String, Schema.Number]).annotate({
          description: "description"
        }),
        {
          schema: {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": false,
            "description": "description"
          },
          traces: [
            `root must be an object, returning default schema at ["schema"]`
          ]
        }
      )
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Union([Schema.String, Schema.Number]).annotate({
          identifier: "ID",
          description: "description"
        }),
        {
          schema: {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": false,
            "description": "description"
          },
          traces: [
            `root must be an object, returning default schema at ["schema"]`
          ]
        }
      )
    })

    it("nested $ref", () => {
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Struct({ a: Schema.String.annotate({ identifier: "ID" }) }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "$ref": "#/$defs/ID"
              }
            },
            "required": ["a"],
            "additionalProperties": false
          },
          definitions: {
            "ID": {
              "type": "string"
            }
          }
        }
      )
    })

    describe("Suspend", () => {
      it("inner annotation", () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema.annotate({ identifier: "A" })))
        })
        assertJsonSchema(
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

      it("outer annotation", () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema).annotate({ identifier: "A" }))
        })
        assertJsonSchema(
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

      it("top annotation", () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
        }).annotate({ identifier: "A" })
        assertJsonSchema(
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
    })

    describe("Struct", () => {
      it("additionalProperties: false must always be set in objects", () => {
        assertJsonSchema(
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
            },
            traces: [
              `set additionalProperties to false at ["schema"]`
            ]
          },
          {
            target: "draft-07",
            additionalProperties: true
          }
        )
      })

      it("required field", () => {
        assertJsonSchema(
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
            },
            traces: [
              `removed property "minLength" at ["schema"]["properties"]["a"]`
            ]
          }
        )
      })

      it("optional field", () => {
        assertJsonSchema(
          Rewriter.openAi,
          Schema.Struct({
            a: Schema.optionalKey(Schema.String),
            b: Schema.optionalKey(Schema.String.annotate({ description: "description" })),
            c: Schema.optionalKey(Schema.String).annotate({ description: "description" }),
            d: Schema.optional(Schema.String),
            e: Schema.optional(Schema.String.annotate({ description: "description" })),
            f: Schema.optional(Schema.String).annotate({ description: "description" }),
            g: Schema.UndefinedOr(Schema.String),
            h: Schema.UndefinedOr(Schema.String.annotate({ description: "description" })),
            i: Schema.UndefinedOr(Schema.String).annotate({ description: "description" }),
            l: Schema.optional(Schema.NonEmptyString).annotate({ description: "description" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": ["string", "null"]
                },
                "b": {
                  "type": ["string", "null"],
                  "description": "description"
                },
                "c": {
                  "type": ["string", "null"],
                  "description": "description"
                },
                "d": {
                  "type": ["string", "null"]
                },
                "e": {
                  "type": ["string", "null"],
                  "description": "description"
                },
                "f": {
                  "type": ["string", "null"],
                  "description": "description"
                },
                "g": {
                  "type": ["string", "null"]
                },
                "h": {
                  "type": ["string", "null"],
                  "description": "description"
                },
                "i": {
                  "type": ["string", "null"],
                  "description": "description"
                },
                "l": {
                  "type": ["string", "null"],
                  "description": "a value with a length of at least 1, description"
                }
              },
              "required": ["a", "b", "c", "d", "e", "f", "g", "h", "i", "l"],
              "additionalProperties": false
            },
            traces: [
              `merged 1 fragment(s) at ["schema"]["properties"]["l"]`,
              `added required property "a" at ["schema"]`,
              `added required property "b" at ["schema"]`,
              `added required property "c" at ["schema"]`,
              `added required property "d" at ["schema"]`,
              `added required property "e" at ["schema"]`,
              `added required property "f" at ["schema"]`,
              `added required property "g" at ["schema"]`,
              `added required property "h" at ["schema"]`,
              `added required property "i" at ["schema"]`,
              `added required property "l" at ["schema"]`
            ]
          }
        )
        assertJsonSchema(
          Rewriter.openAi,
          Schema.Struct({ a: Schema.optionalKey(Schema.Literal(1)) }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": ["number", "null"],
                  "enum": [1]
                }
              },
              "required": ["a"],
              "additionalProperties": false
            },
            traces: [
              `added required property "a" at ["schema"]`
            ]
          }
        )
        assertJsonSchema(
          Rewriter.openAi,
          Schema.Struct({
            a: Schema.optionalKey(
              Schema.Literal(1).annotate({
                description: "description"
              })
            )
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": ["number", "null"],
                  "enum": [1],
                  "description": "description"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            },
            traces: [
              `added required property "a" at ["schema"]`
            ]
          }
        )
        assertJsonSchema(
          Rewriter.openAi,
          Schema.Struct({ a: Schema.optionalKey(Schema.Union([Schema.String, Schema.Number])) }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "anyOf": [
                    { "type": "string" },
                    { "type": "number" },
                    { "type": "null" }
                  ]
                }
              },
              "required": ["a"],
              "additionalProperties": false
            },
            traces: [
              `added required property "a" at ["schema"]`
            ]
          }
        )
        assertJsonSchema(
          Rewriter.openAi,
          Schema.Struct({
            a: Schema.optionalKey(
              Schema.Union([Schema.String, Schema.Number]).annotate({
                description: "description"
              })
            )
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "anyOf": [
                    { "type": "string" },
                    { "type": "number" },
                    { "type": "null" }
                  ],
                  "description": "description"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            },
            traces: [
              `added required property "a" at ["schema"]`
            ]
          }
        )
      })
    })

    describe("Union", () => {
      it("anyOf", () => {
        assertJsonSchema(
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
            },
            traces: [
              `removed property "minLength" at ["schema"]["properties"]["a"]["anyOf"][0]`,
              `merged 1 fragment(s) at ["schema"]["properties"]["a"]["anyOf"][1]["anyOf"][0]`
            ]
          }
        )
      })

      it("anyOf", () => {
        assertJsonSchema(
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
            },
            traces: [
              `removed property "minLength" at ["schema"]["properties"]["a"]["oneOf"][0]`,
              `merged 1 fragment(s) at ["schema"]["properties"]["a"]["oneOf"][1]["oneOf"][0]`,
              `rewrote oneOf to anyOf at ["schema"]["properties"]["a"]["oneOf"][1]`,
              `rewrote oneOf to anyOf at ["schema"]["properties"]["a"]`
            ]
          }
        )
      })
    })

    it("String", () => {
      assertJsonSchema(
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
          },
          traces: [
            `removed property "minLength" at ["schema"]["properties"]["a"]`
          ]
        }
      )
      assertJsonSchema(
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
          },
          traces: [
            `removed property "minLength" at ["schema"]["properties"]["a"]`
          ]
        }
      )
      assertJsonSchema(
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
          },
          traces: [
            `merged 1 fragment(s) at ["schema"]["properties"]["a"]`
          ]
        }
      )
    })

    it("Tuple", () => {
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Struct({ a: Schema.Tuple([Schema.NonEmptyString, Schema.Number]) }),
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
                    "type": "number"
                  }
                ],
                "items": false
              }
            },
            "required": ["a"],
            "additionalProperties": false
          },
          traces: [
            `removed property "minItems" at ["schema"]["properties"]["a"]`,
            `removed property "minLength" at ["schema"]["properties"]["a"]["prefixItems"][0]`
          ]
        }
      )
    })

    it("Array", () => {
      assertJsonSchema(
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
          },
          traces: [
            `removed property "minLength" at ["schema"]["properties"]["a"]["items"]`
          ]
        }
      )
    })

    it("const", () => {
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Struct({
          a: Schema.String.annotate({
            description: "description",
            jsonSchema: () => ({
              const: "a"
            })
          })
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "enum": ["a"],
                "description": "description"
              }
            },
            "required": ["a"],
            "additionalProperties": false
          },
          traces: [
            `rewrote const to enum at ["schema"]["properties"]["a"]`
          ]
        }
      )
    })

    it("UniqueArray", () => {
      assertJsonSchema(
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
          },
          traces: [
            `removed property "uniqueItems" at ["schema"]["properties"]["a"]`
          ]
        }
      )
    })
  })
})
