import { Schema } from "effect/schema"
import { Rewriter } from "effect/unstable/jsonschema"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../../utils/assert.ts"

function assertJsonSchema(
  rewriter: Rewriter.Rewriter,
  schema: Schema.Top,
  expected: {
    readonly schema: Schema.JsonSchema.Schema
    readonly definitions?: Record<string, Schema.JsonSchema.Schema> | undefined
    readonly traces?: Array<string> | undefined
  },
  options?: Schema.JsonSchemaOptions
) {
  const traces: Array<string> = []
  const tracer: Rewriter.Tracer = {
    push(change) {
      traces.push(change)
    }
  }
  const document = rewriter(
    Schema.makeJsonSchemaDraft2020_12(schema, {
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
    it("Root must be an object", () => {
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
            `return default schema at ["schema"]`
          ]
        }
      )
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Union([Schema.String, Schema.Number]).annotate({
          description: "description",
          title: "title",
          default: "default",
          examples: ["example"]
        }),
        {
          schema: {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": false,
            "description": "description",
            "title": "title",
            "default": "default",
            "examples": ["example"]
          },
          traces: [
            `return default schema at ["schema"]`
          ]
        }
      )
    })

    it("refs are supported", () => {
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

    it("recursive schemas are supported", () => {
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
          additionalProperties: true
        }
      )
    })

    it("all fields must be required", () => {
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Struct({ a: Schema.optionalKey(Schema.String) }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": ["string", "null"]
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
            Schema.String.annotate({
              title: "title",
              description: "description",
              default: "default",
              examples: ["example"]
            })
          )
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": ["string", "null"],
                "title": "title",
                "description": "description",
                "default": "default",
                "examples": ["example"]
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
          a: Schema.optionalKey(Schema.String).annotate({
            title: "title",
            description: "description",
            default: "default",
            examples: ["example"]
          })
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": ["string", "null"],
                "title": "title",
                "description": "description",
                "default": "default",
                "examples": ["example"]
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
        Schema.Struct({ a: Schema.optional(Schema.String) }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": ["string", "null"]
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
          a: Schema.optional(
            Schema.String.annotate({
              title: "title",
              description: "description",
              default: "default",
              examples: ["example"]
            })
          )
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": ["string", "null"],
                "title": "title",
                "description": "description",
                "default": "default",
                "examples": ["example"]
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
          a: Schema.optional(Schema.String).annotate({
            title: "title",
            description: "description",
            default: "default",
            examples: ["example"]
          })
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": ["string", "null"],
                "title": "title",
                "description": "description",
                "default": "default",
                "examples": ["example"]
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
        Schema.Struct({ a: Schema.UndefinedOr(Schema.String) }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": ["string", "null"]
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
          a: Schema.UndefinedOr(
            Schema.String.annotate({
              title: "title",
              description: "description",
              default: "default",
              examples: ["example"]
            })
          )
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": ["string", "null"],
                "title": "title",
                "description": "description",
                "default": "default",
                "examples": ["example"]
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
          a: Schema.UndefinedOr(Schema.String).annotate({
            title: "title",
            description: "description",
            default: "default",
            examples: ["example"]
          })
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": ["string", "null"],
                "title": "title",
                "description": "description",
                "default": "default",
                "examples": ["example"]
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
              title: "title",
              description: "description",
              default: 1,
              examples: [1]
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
                "title": "title",
                "description": "description",
                "default": 1,
                "examples": [1]
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
              title: "title",
              description: "description",
              default: "",
              examples: ["a", 1]
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
                "title": "title",
                "description": "description",
                "default": "",
                "examples": ["a", 1]
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

    it("should rewrite oneOf to anyOf", () => {
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Struct({
          a: Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" })
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "anyOf": [
                  { "type": "string" },
                  { "type": "number" }
                ]
              }
            },
            "required": ["a"],
            "additionalProperties": false
          },
          traces: [
            `rewrote oneOf to anyOf at ["schema"]["properties"]["a"]`
          ]
        }
      )
    })

    it("should strip unsupported string properties", () => {
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
        Schema.Struct({ a: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10)) }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string",
                "description": "a value with a length of at least 1 and a value with a length of at most 10"
              }
            },
            "required": ["a"],
            "additionalProperties": false
          },
          traces: [
            `merged 1 allOf fragment(s) at ["schema"]["properties"]["a"]`
          ]
        }
      )
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Struct({
          a: Schema.String.check(Schema.isMinLength(1, {
            description: "description",
            title: "title",
            default: "default",
            examples: ["example"]
          }))
        }),
        {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string",
                "title": "title",
                "description": "description",
                "default": "default",
                "examples": ["example"]
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

    it("should strip unsupported array properties", () => {
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
