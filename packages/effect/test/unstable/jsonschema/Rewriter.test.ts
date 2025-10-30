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
    readonly traces?: Array<Rewriter.Change> | undefined
  },
  options?: Schema.JsonSchemaOptions
) {
  const traces: Array<Rewriter.Change> = []
  const tracer: Rewriter.Tracer = {
    push(change) {
      traces.push(change)
    }
  }
  const document = rewriter(Schema.makeJsonSchemaDraft2020_12(schema, options), tracer)
  const copy = JSON.parse(JSON.stringify(document.schema))
  deepStrictEqual(document.schema, expected.schema)
  deepStrictEqual(document.definitions, expected.definitions ?? {})
  deepStrictEqual(traces, expected.traces ?? [])
  deepStrictEqual(copy, document.schema)
}

describe("Rewriter", () => {
  describe("openAi", () => {
    it("Root objects must not be anyOf and must be an object", () => {
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
            {
              name: "root-must-be-an-object",
              path: ["schema"],
              summary: "replaced top level non-object with an empty object"
            }
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
                "items": { "$ref": "#/$defs/A" }
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
          },
          traces: [
            {
              name: "replace-top-level-ref-with-definition",
              path: ["schema"],
              summary: `replaced top level ref "A" with its definition`
            }
          ]
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
            {
              name: "additionalProperties-must-be-false",
              path: ["schema"],
              summary: `set additionalProperties to false`
            }
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
            {
              name: "add-required-property",
              path: ["schema"],
              summary: `added required property "a"`
            }
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
            {
              name: "add-required-property",
              path: ["schema"],
              summary: `added required property "a"`
            }
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
            {
              name: "add-required-property",
              path: ["schema"],
              summary: `added required property "a"`
            }
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
            {
              name: "add-required-property",
              path: ["schema"],
              summary: `added required property "a"`
            }
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
            {
              name: "add-required-property",
              path: ["schema"],
              summary: `added required property "a"`
            }
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
            {
              name: "rewrite-oneOf-to-anyOf",
              path: ["schema", "properties", "a"],
              summary: `rewrote oneOf to anyOf`
            }
          ]
        }
      )
    })

    it("should strip unsupported string properties", () => {
      assertJsonSchema(
        Rewriter.openAi,
        Schema.Struct({ a: Schema.NonEmptyString }),
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
              name: "remove-unsupported-property",
              path: ["schema", "properties", "a"],
              summary: `removed unsupported property "minLength"`
            }
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
                }
              }
            },
            "required": ["a"],
            "additionalProperties": false
          },
          traces: [
            {
              name: "remove-unsupported-property",
              path: ["schema", "properties", "a"],
              summary: `removed unsupported property "uniqueItems"`
            }
          ]
        }
      )
    })
  })
})
