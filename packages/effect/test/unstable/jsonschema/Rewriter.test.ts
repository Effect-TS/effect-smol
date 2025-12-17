import { Schema } from "effect"
import type { JsonPatchOperation } from "effect/JsonPatch"
import { Rewriter } from "effect/unstable/jsonschema"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../../utils/assert.ts"

function assertJsonSchema(
  rewriter: Rewriter.Rewriter,
  schema: Schema.Top,
  expected: {
    readonly schema: Schema.JsonSchema
    readonly definitions?: Record<string, Schema.JsonSchema> | undefined
    readonly traces?: Array<JsonPatchOperation> | undefined
  },
  options?: Schema.ToJsonSchemaOptions
) {
  const traces: Array<JsonPatchOperation> = []
  const tracer: Rewriter.RewriterTracer = {
    push(change) {
      traces.push(change)
    }
  }
  const document = rewriter(
    Schema.toJsonSchema(schema, {
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
        Rewriter.openAiRewriter,
        Schema.Union([Schema.String, Schema.Number]),
        {
          schema: {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": false
          },
          traces: [
            {
              description: "[ROOT_OBJECT_REQUIRED]",
              op: "replace",
              path: "/schema",
              value: {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": false
              }
            }
          ]
        }
      )
      assertJsonSchema(
        Rewriter.openAiRewriter,
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
            {
              description: "[ROOT_OBJECT_REQUIRED]",
              op: "replace",
              path: "/schema",
              value: {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": false,
                "description": "description"
              }
            }
          ]
        }
      )
      assertJsonSchema(
        Rewriter.openAiRewriter,
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
            {
              description: "[ROOT_OBJECT_REQUIRED]",
              op: "replace",
              path: "/schema",
              value: {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": false,
                "description": "description"
              }
            }
          ]
        }
      )
    })

    it("nested $ref", () => {
      assertJsonSchema(
        Rewriter.openAiRewriter,
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
          Rewriter.openAiRewriter,
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
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
        }).annotate({ identifier: "A" })
        assertJsonSchema(
          Rewriter.openAiRewriter,
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
          Rewriter.openAiRewriter,
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
              {
                description: `[SET_ADDITIONAL_PROPERTIES_TO_FALSE]`,
                op: "replace",
                path: "/schema/additionalProperties",
                value: false
              }
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
          Rewriter.openAiRewriter,
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
              {
                description: `[UNSUPPORTED_PROPERTY_KEY]: "minLength"`,
                op: "remove",
                path: "/schema/properties/a/minLength"
              }
            ]
          }
        )
      })

      it("optional field", () => {
        assertJsonSchema(
          Rewriter.openAiRewriter,
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
              {
                description: `[MERGE_ALL_OF]: 1 fragment(s)`,
                op: "replace",
                path: "/schema/properties/l",
                value: {
                  description: "a value with a length of at least 1, description",
                  type: "string"
                }
              },
              {
                description: `[ADD_REQUIRED_PROPERTY]: "a"`,
                op: "add",
                path: "/schema/required/-",
                value: "a"
              },
              {
                description: `[ADD_REQUIRED_PROPERTY]: "b"`,
                op: "add",
                path: "/schema/required/-",
                value: "b"
              },
              {
                description: `[ADD_REQUIRED_PROPERTY]: "c"`,
                op: "add",
                path: "/schema/required/-",
                value: "c"
              },
              {
                description: `[ADD_REQUIRED_PROPERTY]: "d"`,
                op: "add",
                path: "/schema/required/-",
                value: "d"
              },
              {
                description: `[ADD_REQUIRED_PROPERTY]: "e"`,
                op: "add",
                path: "/schema/required/-",
                value: "e"
              },
              {
                description: `[ADD_REQUIRED_PROPERTY]: "f"`,
                op: "add",
                path: "/schema/required/-",
                value: "f"
              },
              {
                description: `[ADD_REQUIRED_PROPERTY]: "g"`,
                op: "add",
                path: "/schema/required/-",
                value: "g"
              },
              {
                description: `[ADD_REQUIRED_PROPERTY]: "h"`,
                op: "add",
                path: "/schema/required/-",
                value: "h"
              },
              {
                description: `[ADD_REQUIRED_PROPERTY]: "i"`,
                op: "add",
                path: "/schema/required/-",
                value: "i"
              },
              {
                description: `[ADD_REQUIRED_PROPERTY]: "l"`,
                op: "add",
                path: "/schema/required/-",
                value: "l"
              }
            ]
          }
        )
        assertJsonSchema(
          Rewriter.openAiRewriter,
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
              {
                description: `[ADD_REQUIRED_PROPERTY]: "a"`,
                op: "add",
                path: "/schema/required/-",
                value: "a"
              }
            ]
          }
        )
        assertJsonSchema(
          Rewriter.openAiRewriter,
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
              {
                description: `[ADD_REQUIRED_PROPERTY]: "a"`,
                op: "add",
                path: "/schema/required/-",
                value: "a"
              }
            ]
          }
        )
        assertJsonSchema(
          Rewriter.openAiRewriter,
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
              {
                description: `[ADD_REQUIRED_PROPERTY]: "a"`,
                op: "add",
                path: "/schema/required/-",
                value: "a"
              }
            ]
          }
        )
        assertJsonSchema(
          Rewriter.openAiRewriter,
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
              {
                description: `[ADD_REQUIRED_PROPERTY]: "a"`,
                op: "add",
                path: "/schema/required/-",
                value: "a"
              }
            ]
          }
        )
      })
    })

    describe("Union", () => {
      it("anyOf", () => {
        assertJsonSchema(
          Rewriter.openAiRewriter,
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
              {
                description: `[UNSUPPORTED_PROPERTY_KEY]: "minLength"`,
                op: "remove",
                path: "/schema/properties/a/anyOf/0/minLength"
              },
              {
                description: `[MERGE_ALL_OF]: 1 fragment(s)`,
                op: "replace",
                path: "/schema/properties/a/anyOf/1/anyOf/0",
                value: {
                  "type": "integer",
                  "description": "an integer, a value greater than 0"
                }
              }
            ]
          }
        )
      })

      it("anyOf", () => {
        assertJsonSchema(
          Rewriter.openAiRewriter,
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
              {
                description: `[UNSUPPORTED_PROPERTY_KEY]: "minLength"`,
                op: "remove",
                path: "/schema/properties/a/oneOf/0/minLength"
              },
              {
                description: `[MERGE_ALL_OF]: 1 fragment(s)`,
                op: "replace",
                path: "/schema/properties/a/oneOf/1/oneOf/0",
                value: {
                  "type": "integer",
                  "description": "an integer, a value greater than 0"
                }
              },
              {
                description: `[ONE_OF -> ANY_OF]`,
                op: "replace",
                path: "/schema/properties/a/oneOf/1",
                value: {
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
              },
              {
                description: `[ONE_OF -> ANY_OF]`,
                op: "replace",
                path: "/schema/properties/a",
                value: {
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
              }
            ]
          }
        )
      })
    })

    it("String", () => {
      assertJsonSchema(
        Rewriter.openAiRewriter,
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
            {
              description: `[UNSUPPORTED_PROPERTY_KEY]: "minLength"`,
              op: "remove",
              path: "/schema/properties/a/minLength"
            }
          ]
        }
      )
      assertJsonSchema(
        Rewriter.openAiRewriter,
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
            {
              description: `[UNSUPPORTED_PROPERTY_KEY]: "minLength"`,
              op: "remove",
              path: "/schema/properties/a/minLength"
            }
          ]
        }
      )
      assertJsonSchema(
        Rewriter.openAiRewriter,
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
            {
              description: `[MERGE_ALL_OF]: 1 fragment(s)`,
              op: "replace",
              path: "/schema/properties/a",
              value: {
                "type": "string",
                "description": "description isMinLength(1), a value with a length of at most 4"
              }
            }
          ]
        }
      )
    })

    it("Tuple", () => {
      assertJsonSchema(
        Rewriter.openAiRewriter,
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
            {
              description: `[UNSUPPORTED_PROPERTY_KEY]: "minItems"`,
              op: "remove",
              path: "/schema/properties/a/minItems"
            },
            {
              description: `[UNSUPPORTED_PROPERTY_KEY]: "minLength"`,
              op: "remove",
              path: "/schema/properties/a/prefixItems/0/minLength"
            }
          ]
        }
      )
    })

    it("Array", () => {
      assertJsonSchema(
        Rewriter.openAiRewriter,
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
            {
              description: `[UNSUPPORTED_PROPERTY_KEY]: "minLength"`,
              op: "remove",
              path: "/schema/properties/a/items/minLength"
            }
          ]
        }
      )
    })

    it("const", () => {
      assertJsonSchema(
        Rewriter.openAiRewriter,
        Schema.Struct({
          a: Schema.String.annotate({
            description: "description",
            toJsonSchema: () => ({
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
            {
              description: `[CONST -> ENUM]`,
              op: "replace",
              path: "/schema/properties/a",
              value: {
                "enum": ["a"],
                "description": "description"
              }
            }
          ]
        }
      )
    })

    it("UniqueArray", () => {
      assertJsonSchema(
        Rewriter.openAiRewriter,
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
            {
              description: `[UNSUPPORTED_PROPERTY_KEY]: "uniqueItems"`,
              op: "remove",
              path: "/schema/properties/a/uniqueItems"
            }
          ]
        }
      )
    })
  })
})
