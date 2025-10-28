import type { Options as AjvOptions } from "ajv"
// eslint-disable-next-line import-x/no-named-as-default
import Ajv from "ajv"
import type { Annotations } from "effect/schema"
import { Getter, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { assertTrue, deepStrictEqual, strictEqual, throws } from "../utils/assert.ts"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Ajv2020 = require("ajv/dist/2020")

const baseAjvOptions: AjvOptions = {
  allErrors: true,
  strict: false, // warns/throws on unknown keywords depending on Ajv version
  validateSchema: true,
  code: { esm: true } // optional
}

const ajvDraft07 = new Ajv.default(baseAjvOptions)
const ajvDraft2020_12 = new Ajv2020.default(baseAjvOptions)

function assertUnsupportedSchema(schema: Schema.Top, message: string, options?: Schema.JsonSchemaOptions) {
  throws(() => Schema.makeJsonSchemaDraft07(schema, options), message)
}

function assertDraft07<S extends Schema.Top>(
  schema: S,
  expected: { schema: object; definitions?: Record<string, object> },
  options?: Schema.JsonSchemaOptions
) {
  const { definitions, jsonSchema, uri } = Schema.makeJsonSchemaDraft07(schema, options)
  strictEqual(uri, "http://json-schema.org/draft-07/schema")
  deepStrictEqual(jsonSchema, expected.schema)
  deepStrictEqual(definitions, expected.definitions ?? {})
  const valid = ajvDraft07.validateSchema({ $schema: uri, ...jsonSchema })
  assertTrue(valid)
}

export function assertDraft2020_12<S extends Schema.Top>(
  schema: S,
  expected: { schema: object; definitions?: Record<string, object> },
  options?: Schema.JsonSchemaOptions
) {
  const { definitions, jsonSchema, uri } = Schema.makeJsonSchemaDraft2020_12(schema, options)
  strictEqual(uri, "https://json-schema.org/draft/2020-12/schema")
  deepStrictEqual(jsonSchema, expected.schema)
  deepStrictEqual(definitions, expected.definitions ?? {})
  const valid = ajvDraft2020_12.validateSchema({ $schema: uri, ...jsonSchema })
  assertTrue(valid)
}

export function assertOpenApi3_1<S extends Schema.Top>(
  schema: S,
  expected: { schema: object; definitions?: Record<string, object> },
  options?: Schema.JsonSchemaOptions
) {
  const { definitions, jsonSchema, uri } = Schema.makeJsonSchemaOpenApi3_1(schema, options)
  strictEqual(uri, "https://json-schema.org/draft/2020-12/schema")
  deepStrictEqual(jsonSchema, expected.schema)
  deepStrictEqual(definitions, expected.definitions ?? {})
  const valid = ajvDraft2020_12.validateSchema({ $schema: uri, ...jsonSchema })
  assertTrue(valid)
}

describe("ToJsonSchema", () => {
  describe("Thrown errors", () => {
    it("Declaration", () => {
      assertUnsupportedSchema(
        Schema.instanceOf(globalThis.URL),
        `Unsupported schema Declaration`
      )
    })

    it("Undefined", () => {
      assertUnsupportedSchema(
        Schema.Undefined,
        `Unsupported schema Undefined`
      )
    })

    it("BigInt", () => {
      assertUnsupportedSchema(
        Schema.BigInt,
        `Unsupported schema BigInt`
      )
    })

    it("UniqueSymbol", () => {
      assertUnsupportedSchema(
        Schema.UniqueSymbol(Symbol.for("effect/Schema/test/a")),
        `Unsupported schema UniqueSymbol`
      )
    })

    it("Symbol", () => {
      assertUnsupportedSchema(
        Schema.Symbol,
        `Unsupported schema Symbol`
      )
    })

    it("Literal(bigint)", () => {
      assertUnsupportedSchema(
        Schema.Literal(1n),
        `Unsupported literal 1n`
      )
    })

    it("Suspend without identifier annotation", () => {
      interface A {
        readonly a: string
        readonly as: ReadonlyArray<A>
      }
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Schema.suspend((): Schema.Schema<A> => schema))
      })
      assertUnsupportedSchema(
        schema,
        `Missing identifier for Suspend
  at ["as"][0]`
      )
    })

    describe("Tuple", () => {
      it("Unsupported element", () => {
        assertUnsupportedSchema(
          Schema.Tuple([Schema.Symbol]),
          `Unsupported schema Symbol
  at [0]`
        )
      })

      it("Unsupported post-rest elements", () => {
        assertUnsupportedSchema(
          Schema.TupleWithRest(Schema.Tuple([]), [Schema.Number, Schema.String]),
          "Generating a JSON Schema for post-rest elements is not currently supported. You're welcome to contribute by submitting a Pull Request"
        )
      })
    })

    describe("Struct", () => {
      it("Unsupported field", () => {
        assertUnsupportedSchema(
          Schema.Struct({ a: Schema.Symbol }),
          `Unsupported schema Symbol
  at ["a"]`
        )
      })

      it("Unsupported property signature name", () => {
        const a = Symbol.for("effect/Schema/test/a")
        assertUnsupportedSchema(
          Schema.Struct({ [a]: Schema.String }),
          `Unsupported property signature name Symbol(effect/Schema/test/a)
  at [Symbol(effect/Schema/test/a)]`
        )
      })

      it("Unsupported index signature parameter", () => {
        assertUnsupportedSchema(
          Schema.Record(Schema.Symbol, Schema.Number),
          `Unsupported index signature parameter Symbol`
        )
      })
    })

    describe("onMissingJsonSchemaAnnotation", () => {
      it("when returns a JSON Schema", () => {
        assertDraft07(
          Schema.Date,
          {
            schema: {}
          },
          {
            onMissingJsonSchemaAnnotation: () => ({})
          }
        )
      })

      it("when returns undefined", () => {
        assertUnsupportedSchema(
          Schema.Date,
          `Unsupported schema Declaration`,
          {
            onMissingJsonSchemaAnnotation: () => undefined
          }
        )
      })
    })
  })

  describe("Override annotation", () => {
    it("typeParameters", () => {
      function getOptionJsonSchema(value: Annotations.JsonSchema.JsonSchema): Annotations.JsonSchema.JsonSchema {
        return {
          "title": "Option",
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "_tag": {
                  "type": "string",
                  "enum": ["Some"]
                },
                value
              },
              "required": ["_tag"],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "_tag": {
                  "type": "string",
                  "enum": ["None"]
                }
              },
              "required": ["_tag"],
              "additionalProperties": false
            }
          ]
        }
      }
      const schema = Schema.Option(Schema.String).annotate({
        jsonSchema: {
          _tag: "Override",
          override: (ctx) => {
            return getOptionJsonSchema(ctx.typeParameters[0])
          }
        }
      })
      assertDraft07(schema, {
        schema: getOptionJsonSchema({
          "type": "string"
        })
      })
    })

    it("instanceOf", () => {
      const schema = Schema.instanceOf(URL, {
        jsonSchema: {
          _tag: "Override",
          override: () => ({ "type": "string" })
        }
      })
      assertDraft07(schema, {
        schema: {
          "type": "string"
        }
      })
    })

    it("should ignore errors when generating the default JSON Schema passed in the override context", () => {
      assertDraft07(
        Schema.Symbol.annotate({
          jsonSchema: {
            _tag: "Override",
            override: (ctx) => ({ ...ctx.jsonSchema, "type": "string" })
          }
        }),
        {
          schema: {
            "type": "string"
          }
        }
      )
      assertDraft07(
        Schema.Symbol.annotate({
          jsonSchema: {
            _tag: "Override",
            override: (ctx) => ({ ...ctx.jsonSchema, "type": "string" })
          }
        }),
        {
          schema: {
            "$comment": "comment",
            "type": "string"
          }
        },
        {
          onMissingJsonSchemaAnnotation: () => ({ "$comment": "comment" })
        }
      )
      assertDraft07(
        Schema.Symbol.check(Schema.makeFilter(() => true)).annotate({
          jsonSchema: {
            _tag: "Override",
            override: (ctx) => ({ ...ctx.jsonSchema, "type": "string" })
          }
        }),
        {
          schema: {
            "type": "string"
          }
        }
      )
      assertDraft07(
        Schema.Symbol.check(Schema.makeFilter(() => true)).annotate({
          jsonSchema: {
            _tag: "Override",
            override: (ctx) => ({ ...ctx.jsonSchema, "type": "string" })
          }
        }),
        {
          schema: {
            "$comment": "comment",
            "type": "string"
          }
        },
        {
          onMissingJsonSchemaAnnotation: () => ({ "$comment": "comment" })
        }
      )
    })

    describe("String", () => {
      it("String & override", () => {
        const schema = Schema.String.annotate({
          jsonSchema: {
            _tag: "Override",
            override: () => ({
              "type": "string",
              "minLength": 1
            })
          }
        })
        assertDraft07(
          schema,
          {
            schema: {
              "type": "string",
              "minLength": 1
            }
          }
        )
        assertDraft07(
          schema.annotate({ description: "description" }),
          {
            schema: {
              "type": "string",
              "description": "description",
              "minLength": 1
            }
          }
        )
      })

      it("String & identifier & override", () => {
        assertDraft07(
          Schema.String.annotate({
            identifier: "ID",
            jsonSchema: {
              _tag: "Override",
              override: () => ({
                "type": "string",
                "minLength": 1
              })
            }
          }),
          {
            schema: {
              "$ref": "#/definitions/ID"
            },
            definitions: {
              "ID": {
                "type": "string",
                "minLength": 1
              }
            }
          }
        )
      })

      it("String & check & override", () => {
        assertDraft07(
          Schema.String.check(Schema.isMinLength(2)).annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({
                "type": "string",
                "minLength": 1
              })
            }
          }),
          {
            schema: {
              "type": "string",
              "minLength": 1
            }
          }
        )
      })
    })
  })

  describe("draft-07", () => {
    const jsonAnnotations = {
      "title": "title",
      "description": "description",
      "default": "",
      "examples": ["", "a", "aa"]
    }

    describe("refs", () => {
      it(`refs should be created using the pattern: "#/definitions/IDENTIFIER"`, () => {
        assertDraft07(
          Schema.String.annotate({ identifier: "ID" }),
          {
            schema: {
              "$ref": "#/definitions/ID"
            },
            definitions: {
              "ID": {
                "type": "string"
              }
            }
          }
        )
      })

      it(`refs should escape "~" and "/"`, () => {
        assertDraft07(
          Schema.String.annotate({ identifier: "ID~a/b" }),
          {
            schema: {
              "$ref": "#/definitions/ID~0a~1b"
            },
            definitions: {
              "ID~a/b": {
                "type": "string"
              }
            }
          }
        )
      })

      it("String & identifier", () => {
        assertDraft07(
          Schema.String.annotate({ identifier: "ID" }),
          {
            schema: {
              "$ref": "#/definitions/ID"
            },
            definitions: {
              "ID": {
                "type": "string"
              }
            }
          }
        )
        assertDraft07(
          Schema.String.annotate({
            identifier: "ID",
            ...jsonAnnotations
          }),
          {
            schema: {
              "$ref": "#/definitions/ID"
            },
            definitions: {
              "ID": {
                "type": "string",
                ...jsonAnnotations
              }
            }
          }
        )
      })

      it("String & check & identifier", () => {
        assertDraft07(
          Schema.String.check(Schema.isMinLength(2, { identifier: "ID" })),
          {
            schema: {
              "$ref": "#/definitions/ID"
            },
            definitions: {
              "ID": {
                "type": "string",
                "minLength": 2
              }
            }
          }
        )
      })

      it("String & check & annotations + identifier", () => {
        assertDraft07(
          Schema.String.check(Schema.isMinLength(2)).annotate({
            identifier: "ID",
            ...jsonAnnotations
          }),
          {
            schema: {
              "$ref": "#/definitions/ID"
            },
            definitions: {
              ID: {
                "type": "string",
                "minLength": 2,
                ...jsonAnnotations
              }
            }
          }
        )
      })

      it("using a schema with two different encodings", () => {
        const To = Schema.String.annotate({ identifier: "ID" })
        const schema1 = To.pipe(Schema.encodeTo(Schema.Literal(1), {
          decode: Getter.succeed("a"),
          encode: Getter.succeed(1)
        }))
        const schema2 = To.pipe(Schema.encodeTo(Schema.Literal(2), {
          decode: Getter.succeed("b"),
          encode: Getter.succeed(2)
        }))
        const schema = Schema.Union([schema1, schema2])
        assertDraft07(schema, {
          schema: {
            "anyOf": [
              {
                "$ref": "#/definitions/ID"
              },
              {
                "type": "number",
                "enum": [2]
              }
            ]
          },
          definitions: {
            "ID": {
              "type": "number",
              "enum": [1]
            }
          }
        })
      })

      it("using the same identifier annotated schema twice", () => {
        const schema1 = Schema.String.annotate({ identifier: "ID" })
        assertDraft07(
          Schema.Union([schema1, schema1]),
          {
            schema: {
              "anyOf": [
                { "$ref": "#/definitions/ID" },
                { "$ref": "#/definitions/ID" }
              ]
            },
            definitions: {
              "ID": { "type": "string" }
            }
          }
        )
        assertDraft07(
          Schema.Union([schema1, schema1.annotate({ description: "description" })]),
          {
            schema: {
              "anyOf": [
                { "$ref": "#/definitions/ID" },
                {
                  "type": "string",
                  "description": "description"
                }
              ]
            },
            definitions: {
              "ID": { "type": "string" }
            }
          }
        )
      })
    })

    describe("String", () => {
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": "",
        "examples": ["", "a", "aa"]
      }

      it("String", () => {
        assertDraft07(
          Schema.String,
          {
            schema: {
              "type": "string"
            }
          }
        )
        assertDraft07(
          Schema.String.annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "type": "string",
              ...jsonAnnotations
            }
          }
        )
        // should support getters
        assertDraft07(
          Schema.String.annotate({
            get description() {
              return "description"
            }
          }),
          {
            schema: {
              "type": "string",
              "description": "description"
            }
          }
        )
      })

      it("should ignore the key json annotations if the schema is not contextual", () => {
        assertDraft07(
          Schema.String.annotateKey({
            ...jsonAnnotations
          }),
          {
            schema: {
              "type": "string"
            }
          }
        )
      })

      it("String & check", () => {
        assertDraft07(
          Schema.String.check(Schema.isMinLength(2)),
          {
            schema: {
              "type": "string",
              "minLength": 2
            }
          }
        )
      })

      it("String & empty check", () => {
        assertDraft07(
          Schema.String.check(Schema.makeFilter(() => true)),
          {
            schema: {
              "type": "string"
            }
          }
        )
      })

      it("String & override & check", () => {
        assertDraft07(
          Schema.String.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({
                "type": "string",
                "minLength": 1
              })
            }
          }).check(Schema.isMinLength(2)),
          {
            schema: {
              "type": "string",
              "minLength": 1,
              "allOf": [
                {
                  "minLength": 2
                }
              ]
            }
          }
        )
      })

      it("String & annotations & check", () => {
        assertDraft07(
          Schema.String.annotate({
            ...jsonAnnotations
          }).check(Schema.isMinLength(2)),
          {
            schema: {
              "type": "string",
              "minLength": 2,
              ...jsonAnnotations
            }
          }
        )
      })

      it("String & annotations & check & identifier", () => {
        assertDraft07(
          Schema.String.annotate({
            ...jsonAnnotations
          }).check(Schema.isMinLength(2, { identifier: "ID" })),
          {
            schema: {
              "$ref": "#/definitions/ID"
            },
            definitions: {
              ID: {
                "type": "string",
                "minLength": 2,
                ...jsonAnnotations
              }
            }
          }
        )
      })

      it("String & check & annotations", () => {
        assertDraft07(
          Schema.String.check(Schema.isMinLength(2)).annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "type": "string",
              "minLength": 2,
              ...jsonAnnotations
            }
          }
        )
      })

      it("String & check & check", () => {
        assertDraft07(
          Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(3)),
          {
            schema: {
              "type": "string",
              "minLength": 2,
              "maxLength": 3
            }
          }
        )
      })

      it("String & check & check & annotations", () => {
        assertDraft07(
          Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(3)).annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "type": "string",
              "minLength": 2,
              "maxLength": 3,
              ...jsonAnnotations
            }
          }
        )
      })
    })

    it("Void", () => {
      const schema = Schema.Void
      assertDraft07(
        schema,
        {
          schema: {}
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description"
      }
      assertDraft07(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            ...jsonAnnotations
          }
        }
      )
    })

    it("Unknown", () => {
      const schema = Schema.Unknown
      assertDraft07(
        schema,
        {
          schema: {}
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": null,
        "examples": [null, "a", 1]
      }
      assertDraft07(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            ...jsonAnnotations
          }
        }
      )
    })

    it("Any", () => {
      const schema = Schema.Any
      assertDraft07(
        schema,
        {
          schema: {}
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": null,
        "examples": [null, "a", 1]
      }
      assertDraft07(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            ...jsonAnnotations
          }
        }
      )
    })

    it("Never", () => {
      const schema = Schema.Never
      assertDraft07(
        schema,
        {
          schema: {
            "not": {}
          }
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description"
      }
      assertDraft07(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            "not": {},
            ...jsonAnnotations
          }
        }
      )
    })

    it("Null", () => {
      const schema = Schema.Null
      assertDraft07(
        schema,
        {
          schema: {
            "type": "null"
          }
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": null,
        "examples": [null]
      }
      assertDraft07(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            "type": "null",
            ...jsonAnnotations
          }
        }
      )
    })

    it("Number", () => {
      const schema = Schema.Number
      assertDraft07(
        schema,
        {
          schema: {
            "type": "number"
          }
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": 0,
        "examples": [0, 1, 2]
      }
      assertDraft07(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            "type": "number",
            ...jsonAnnotations
          }
        }
      )
    })

    it("Boolean", () => {
      const schema = Schema.Boolean
      assertDraft07(
        schema,
        {
          schema: {
            "type": "boolean"
          }
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": false,
        "examples": [false, true]
      }
      assertDraft07(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            "type": "boolean",
            ...jsonAnnotations
          }
        }
      )
    })

    it("ObjectKeyword", () => {
      const schema = Schema.ObjectKeyword
      assertDraft07(
        schema,
        {
          schema: {
            "anyOf": [
              { "type": "object" },
              { "type": "array" }
            ]
          }
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": {},
        "examples": [{}, []]
      }
      assertDraft07(
        schema.annotate({
          ...jsonAnnotations
        }),
        {
          schema: {
            "anyOf": [
              { "type": "object" },
              { "type": "array" }
            ],
            ...jsonAnnotations
          }
        }
      )
    })

    describe("Literal", () => {
      it("string", () => {
        const schema = Schema.Literal("a")
        assertDraft07(
          schema,
          {
            schema: {
              "type": "string",
              "enum": ["a"]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": "a" as const,
          "examples": ["a"] as const
        }
        assertDraft07(
          schema.annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "type": "string",
              "enum": ["a"],
              ...jsonAnnotations
            }
          }
        )
      })

      it("number", () => {
        const schema = Schema.Literal(1)
        assertDraft07(
          schema,
          {
            schema: {
              "type": "number",
              "enum": [1]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": 1 as const,
          "examples": [1] as const
        }
        assertDraft07(
          schema.annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "type": "number",
              "enum": [1],
              ...jsonAnnotations
            }
          }
        )
      })

      it("boolean", () => {
        const schema = Schema.Literal(true)
        assertDraft07(
          schema,
          {
            schema: {
              "type": "boolean",
              "enum": [true]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": true as const,
          "examples": [true] as const
        }
        assertDraft07(
          schema.annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "type": "boolean",
              "enum": [true],
              ...jsonAnnotations
            }
          }
        )
      })
    })

    describe("Literals", () => {
      it("empty literals", () => {
        const schema = Schema.Literals([])
        assertDraft07(
          schema,
          {
            schema: {
              "not": {}
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description"
        }
        assertDraft07(
          schema.annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "not": {},
              ...jsonAnnotations
            }
          }
        )
      })

      it("strings", () => {
        const schema = Schema.Literals(["a", "b"])
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "enum": ["a"]
                },
                {
                  "type": "string",
                  "enum": ["b"]
                }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": "a" as const,
          "examples": ["a", "b"] as const
        }
        assertDraft07(
          schema.annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "enum": ["a"]
                },
                {
                  "type": "string",
                  "enum": ["b"]
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })

      it("numbers", () => {
        const schema = Schema.Literals([1, 2])
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "number",
                  "enum": [1]
                },
                {
                  "type": "number",
                  "enum": [2]
                }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": 1 as const,
          "examples": [1, 2] as const
        }
        assertDraft07(
          schema.annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "number",
                  "enum": [1]
                },
                {
                  "type": "number",
                  "enum": [2]
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })

      it("booleans", () => {
        const schema = Schema.Literals([true, false])
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "boolean",
                  "enum": [true]
                },
                {
                  "type": "boolean",
                  "enum": [false]
                }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": true as const,
          "examples": [true, false] as const
        }
        assertDraft07(
          schema.annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "boolean",
                  "enum": [true]
                },
                {
                  "type": "boolean",
                  "enum": [false]
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })

      it("strings & numbers", () => {
        const schema = Schema.Literals(["a", 1])
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "enum": ["a"]
                },
                {
                  "type": "number",
                  "enum": [1]
                }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": "a" as const,
          "examples": ["a", 1] as const
        }
        assertDraft07(
          schema.annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "enum": ["a"]
                },
                {
                  "type": "number",
                  "enum": [1]
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })
    })

    describe("Union of literals", () => {
      it("strings", () => {
        const schema = Schema.Union([
          Schema.Literal("a"),
          Schema.Literal("b")
        ])
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "enum": ["a"]
                },
                {
                  "type": "string",
                  "enum": ["b"]
                }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": "a" as const,
          "examples": ["a", "b"] as const
        }
        assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "enum": ["a"]
                },
                {
                  "type": "string",
                  "enum": ["b"]
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })

      it("strings & inner annotate", () => {
        const schema = Schema.Union([
          Schema.Literal("a"),
          Schema.Literal("b").annotate({ description: "b-description" })
        ])
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "enum": ["a"]
                },
                {
                  "type": "string",
                  "enum": ["b"],
                  "description": "b-description"
                }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": "a" as const,
          "examples": ["a", "b"] as const
        }
        assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "enum": ["a"]
                },
                {
                  "type": "string",
                  "enum": ["b"],
                  "description": "b-description"
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })

      it("numbers", () => {
        const schema = Schema.Union([
          Schema.Literal(1),
          Schema.Literal(2)
        ])
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "number",
                  "enum": [1]
                },
                {
                  "type": "number",
                  "enum": [2]
                }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": 1 as const,
          "examples": [1, 2] as const
        }
        assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "number",
                  "enum": [1]
                },
                {
                  "type": "number",
                  "enum": [2]
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })

      it("booleans", () => {
        const schema = Schema.Union([
          Schema.Literal(true),
          Schema.Literal(false)
        ])
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "boolean",
                  "enum": [true]
                },
                {
                  "type": "boolean",
                  "enum": [false]
                }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": true as const,
          "examples": [true, false] as const
        }
        assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "boolean",
                  "enum": [true]
                },
                {
                  "type": "boolean",
                  "enum": [false]
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })

      it("strings & numbers", () => {
        const schema = Schema.Union([
          Schema.Literal("a"),
          Schema.Literal(1)
        ])
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "enum": ["a"]
                },
                {
                  "type": "number",
                  "enum": [1]
                }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": "a" as const,
          "examples": ["a", 1] as const
        }
        assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "enum": ["a"]
                },
                {
                  "type": "number",
                  "enum": [1]
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })
    })

    describe("Enum", () => {
      it("empty enum", () => {
        enum Empty {}
        const schema = Schema.Enum(Empty)
        assertDraft07(
          schema,
          {
            schema: {
              "not": {}
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description"
        }
        assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "not": {},
              ...jsonAnnotations
            }
          }
        )
      })

      it("single enum", () => {
        enum Fruits {
          Apple
        }
        const schema = Schema.Enum(Fruits)
        assertDraft07(
          schema,
          {
            schema: {
              "type": "number",
              "enum": [0],
              "title": "Apple"
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": Fruits.Apple,
          "examples": [Fruits.Apple] as const
        }
        assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "type": "number",
              "enum": [0],
              ...jsonAnnotations
            }
          }
        )
        assertDraft07(
          schema.annotate({
            identifier: "ID",
            description: "description"
          }),
          {
            schema: {
              "$ref": "#/definitions/ID"
            },
            definitions: {
              "ID": {
                "type": "number",
                "enum": [0],
                "title": "Apple",
                "description": "description"
              }
            }
          }
        )
      })

      it("mixed enums (number & string)", () => {
        enum Fruits {
          Apple,
          Banana,
          Orange = "orange"
        }
        const schema = Schema.Enum(Fruits)
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "number",
                  "enum": [0],
                  "title": "Apple"
                },
                {
                  "type": "number",
                  "enum": [1],
                  "title": "Banana"
                },
                {
                  "type": "string",
                  "enum": ["orange"],
                  "title": "Orange"
                }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": Fruits.Apple,
          "examples": [Fruits.Banana, Fruits.Orange] as const
        }
        assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "number",
                  "enum": [0],
                  "title": "Apple"
                },
                {
                  "type": "number",
                  "enum": [1],
                  "title": "Banana"
                },
                {
                  "type": "string",
                  "enum": ["orange"],
                  "title": "Orange"
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })

      it("const enum", () => {
        const Fruits = {
          Apple: "apple",
          Banana: "banana",
          Cantaloupe: 3
        } as const
        const schema = Schema.Enum(Fruits)
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "title": "Apple",
                  "enum": ["apple"]
                },
                {
                  "type": "string",
                  "title": "Banana",
                  "enum": ["banana"]
                },
                {
                  "type": "number",
                  "title": "Cantaloupe",
                  "enum": [3]
                }
              ]
            }
          }
        )
      })
    })

    it("TemplateLiteral", () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String])
      assertDraft07(schema, {
        schema: {
          "type": "string",
          "pattern": "^(a)([\\s\\S]*?)$"
        }
      })
      const jsonAnnotations = {
        "title": "title",
        "description": "description",
        "default": "a" as const,
        "examples": ["a", "aa", "ab"] as const
      }
      assertDraft07(schema.annotate({ ...jsonAnnotations }), {
        schema: {
          "type": "string",
          "pattern": "^(a)([\\s\\S]*?)$",
          ...jsonAnnotations
        }
      })
    })

    describe("Struct", () => {
      it("empty struct", () => {
        const schema = Schema.Struct({})
        assertDraft07(
          schema,
          {
            schema: {
              "anyOf": [
                { "type": "object" },
                { "type": "array" }
              ]
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": {},
          "examples": [{}, []]
        }
        assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "object"
                },
                {
                  "type": "array"
                }
              ],
              ...jsonAnnotations
            }
          }
        )
      })

      it("required property", () => {
        const Id3 = Schema.String.annotate({ identifier: "id3" })
        assertDraft07(
          Schema.Struct({
            a: Schema.String,
            b: Schema.String.annotate({ description: "b" }),
            c: Schema.String.annotateKey({ description: "c-key" }),
            d: Schema.String.annotate({ description: "d" }).annotateKey({ description: "d-key" }),
            id1: Schema.String.annotate({ identifier: "id1" }),
            id2: Schema.String.annotate({ identifier: "id2" }).annotateKey({ description: "id2-key" }),
            id3_1: Id3.annotateKey({ description: "id3_1-key" }),
            id3_2: Id3.annotateKey({ description: "id3_2-key" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                },
                "b": {
                  "type": "string",
                  "description": "b"
                },
                "c": {
                  "type": "string",
                  "description": "c-key"
                },
                "d": {
                  "type": "string",
                  "description": "d",
                  "allOf": [{
                    "description": "d-key"
                  }]
                },
                "id1": { "$ref": "#/definitions/id1" },
                "id2": {
                  "allOf": [
                    { "$ref": "#/definitions/id2" },
                    {
                      "description": "id2-key"
                    }
                  ]
                },
                "id3_1": {
                  "allOf": [
                    { "$ref": "#/definitions/id3" },
                    {
                      "description": "id3_1-key"
                    }
                  ]
                },
                "id3_2": {
                  "allOf": [
                    { "$ref": "#/definitions/id3" },
                    {
                      "description": "id3_2-key"
                    }
                  ]
                }
              },
              "required": ["a", "b", "c", "d", "id1", "id2", "id3_1", "id3_2"],
              "additionalProperties": false
            },
            definitions: {
              "id1": { "type": "string" },
              "id2": { "type": "string" },
              "id3": { "type": "string" }
            }
          }
        )
      })

      it("optionalKey properties", () => {
        assertDraft07(
          Schema.Struct({
            a: Schema.optionalKey(Schema.String)
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": { "type": "string" }
              },
              "required": [],
              "additionalProperties": false
            }
          }
        )
      })

      it("optionalKey to required key", () => {
        assertDraft07(
          Schema.Struct({
            a: Schema.optionalKey(Schema.String).pipe(Schema.encodeTo(Schema.String))
          }),
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
          }
        )
      })

      it("optional properties", () => {
        assertDraft07(
          Schema.Struct({
            a: Schema.optional(Schema.String),
            b: Schema.optional(Schema.String.annotate({ description: "b" })),
            c: Schema.optional(Schema.String).annotate({ description: "c" }),
            d: Schema.optional(Schema.String).annotateKey({ description: "d-key" }),
            e: Schema.optional(Schema.String.annotate({ description: "e" })).annotateKey({ description: "e-key" })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                },
                "b": {
                  "type": "string",
                  "description": "b"
                },
                "c": {
                  "type": "string",
                  "description": "c"
                },
                "d": {
                  "type": "string",
                  "description": "d-key"
                },
                "e": {
                  "type": "string",
                  "description": "e",
                  "allOf": [{
                    "description": "e-key"
                  }]
                }
              },
              "required": [],
              "additionalProperties": false
            }
          }
        )
      })

      it("UndefinedOr fields", () => {
        const schema = Schema.Struct({
          a: Schema.UndefinedOr(Schema.String),
          b: Schema.UndefinedOr(Schema.String.annotate({ description: "b-inner-description" })),
          c: Schema.UndefinedOr(Schema.String.annotate({ description: "c-inner-description" })).annotate({
            description: "c-outer-description"
          }),
          d: Schema.UndefinedOr(Schema.String.annotate({ description: "d-inner-description" })).annotateKey({
            description: "d-key-description"
          })
        })
        assertDraft07(schema, {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string"
              },
              "b": {
                "type": "string",
                "description": "b-inner-description"
              },
              "c": {
                "anyOf": [
                  {
                    "description": "c-inner-description",
                    "type": "string"
                  }
                ],
                "description": "c-outer-description"
              },
              "d": {
                "type": "string",
                "description": "d-inner-description",
                "allOf": [{
                  "description": "d-key-description"
                }]
              }
            },
            "required": [],
            "additionalProperties": false
          }
        })
      })
    })

    describe("Record", () => {
      it("Record(String, Number)", () => {
        assertDraft07(
          Schema.Record(Schema.String, Schema.Number),
          {
            schema: {
              "type": "object",
              "properties": {},
              "required": [],
              "additionalProperties": {
                "type": "number"
              }
            }
          }
        )
        assertDraft07(
          Schema.Record(Schema.String, Schema.Number).annotate({ description: "description" }),
          {
            schema: {
              "type": "object",
              "properties": {},
              "required": [],
              "additionalProperties": {
                "type": "number"
              },
              "description": "description"
            }
          }
        )
      })

      it("Record(`a${string}`, Number) & annotate", () => {
        assertDraft07(
          Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Number),
          {
            schema: {
              "type": "object",
              "properties": {},
              "required": [],
              "patternProperties": {
                "^(a)([\\s\\S]*?)$": {
                  "type": "number"
                }
              }
            }
          }
        )
      })
    })

    describe("Tuple", () => {
      it("empty tuple", () => {
        const schema = Schema.Tuple([])
        assertDraft07(
          schema,
          {
            schema: {
              "type": "array",
              "items": false
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": [] as const,
          "examples": [[] as const]
        }
        assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "type": "array",
              "items": false,
              ...jsonAnnotations
            }
          }
        )
      })

      it("required element", () => {
        const Id3 = Schema.String.annotate({ identifier: "id3" })
        assertDraft07(
          Schema.Tuple([
            Schema.String,
            Schema.String.annotate({ description: "b" }),
            Schema.String.annotateKey({ description: "c-key" }),
            Schema.String.annotate({ description: "d" }).annotateKey({ description: "d-key" }),
            Schema.String.annotate({ identifier: "id1" }),
            Schema.String.annotate({ identifier: "id2" }).annotateKey({ description: "id2-key" }),
            Id3.annotateKey({ description: "id3_1-key" }),
            Id3.annotateKey({ description: "id3_2-key" })
          ]),
          {
            schema: {
              "type": "array",
              "items": [
                {
                  "type": "string"
                },
                {
                  "type": "string",
                  "description": "b"
                },
                {
                  "type": "string",
                  "description": "c-key"
                },
                {
                  "type": "string",
                  "description": "d",
                  "allOf": [{
                    "description": "d-key"
                  }]
                },
                { "$ref": "#/definitions/id1" },
                {
                  "allOf": [
                    { "$ref": "#/definitions/id2" },
                    {
                      "description": "id2-key"
                    }
                  ]
                },
                {
                  "allOf": [
                    { "$ref": "#/definitions/id3" },
                    {
                      "description": "id3_1-key"
                    }
                  ]
                },
                {
                  "allOf": [
                    { "$ref": "#/definitions/id3" },
                    {
                      "description": "id3_2-key"
                    }
                  ]
                }
              ],
              "additionalItems": false
            },
            definitions: {
              "id1": { "type": "string" },
              "id2": { "type": "string" },
              "id3": { "type": "string" }
            }
          }
        )
      })

      it("optionalKey properties", () => {
        assertDraft07(
          Schema.Tuple([
            Schema.optionalKey(Schema.String)
          ]),
          {
            schema: {
              "type": "array",
              "items": [
                { "type": "string" }
              ],
              "minItems": 0,
              "additionalItems": false
            }
          }
        )
      })

      it("optionalKey to required key", () => {
        assertDraft07(
          Schema.Tuple([
            Schema.optionalKey(Schema.String).pipe(Schema.encodeTo(Schema.String))
          ]),
          {
            schema: {
              "type": "array",
              "items": [
                {
                  "type": "string"
                }
              ],
              "additionalItems": false
            }
          }
        )
      })

      it("optional properties", () => {
        assertDraft07(
          Schema.Tuple([
            Schema.optional(Schema.String),
            Schema.optional(Schema.String.annotate({ description: "b" })),
            Schema.optional(Schema.String).annotate({ description: "c" }),
            Schema.optional(Schema.String).annotateKey({ description: "d-key" }),
            Schema.optional(Schema.String.annotate({ description: "e" })).annotateKey({ description: "e-key" })
          ]),
          {
            schema: {
              "type": "array",
              "items": [
                {
                  "type": "string"
                },
                {
                  "type": "string",
                  "description": "b"
                },
                {
                  "type": "string",
                  "description": "c"
                },
                {
                  "type": "string",
                  "description": "d-key"
                },
                {
                  "type": "string",
                  "description": "e",
                  "allOf": [{
                    "description": "e-key"
                  }]
                }
              ],
              "minItems": 0,
              "additionalItems": false
            }
          }
        )
      })

      it("UndefinedOr elements", () => {
        const schema = Schema.Tuple([
          Schema.UndefinedOr(Schema.String),
          Schema.UndefinedOr(Schema.String.annotate({ description: "b-inner-description" })),
          Schema.UndefinedOr(Schema.String.annotate({ description: "c-inner-description" })).annotate({
            description: "c-outer-description"
          }),
          Schema.UndefinedOr(Schema.String.annotate({ description: "d-inner-description" })).annotateKey({
            description: "d-key-description"
          })
        ])
        assertDraft07(schema, {
          schema: {
            "type": "array",
            "items": [
              {
                "type": "string"
              },
              {
                "type": "string",
                "description": "b-inner-description"
              },
              {
                "anyOf": [
                  {
                    "description": "c-inner-description",
                    "type": "string"
                  }
                ],
                "description": "c-outer-description"
              },
              {
                "type": "string",
                "description": "d-inner-description",
                "allOf": [{
                  "description": "d-key-description"
                }]
              }
            ],
            "minItems": 0,
            "additionalItems": false
          }
        })
      })
    })

    describe("Array", () => {
      it("Array", () => {
        assertDraft07(
          Schema.Array(Schema.String),
          {
            schema: {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        )
        assertDraft07(
          Schema.Array(Schema.String).annotate({ description: "description" }),
          {
            schema: {
              "type": "array",
              "items": { "type": "string" },
              "description": "description"
            }
          }
        )
      })

      it("UniqueArray", () => {
        assertDraft07(
          Schema.UniqueArray(Schema.String),
          {
            schema: {
              "type": "array",
              "items": { "type": "string" },
              "uniqueItems": true
            }
          }
        )
      })
    })

    describe("Union", () => {
      it("empty union", () => {
        const schema = Schema.Union([])
        assertDraft07(schema, {
          schema: {
            "not": {}
          }
        })
        const jsonAnnotations = {
          "title": "title",
          "description": "description"
        }
        assertDraft07(schema.annotate({ ...jsonAnnotations }), {
          schema: {
            "not": {},
            ...jsonAnnotations
          }
        })
      })

      it("single member", () => {
        const schema = Schema.Union([Schema.String])
        assertDraft07(schema, {
          schema: {
            "type": "string"
          }
        })
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": "a",
          "examples": ["a", "b"]
        }
        assertDraft07(schema.annotate({ ...jsonAnnotations }), {
          schema: {
            "type": "string",
            ...jsonAnnotations
          }
        })
        assertDraft07(
          Schema.Union([Schema.String.annotate({
            description: "inner-description",
            title: "inner-title"
          })]).annotate({
            description: "outer-description"
          }),
          {
            schema: {
              "anyOf": [
                {
                  "type": "string",
                  "description": "inner-description",
                  "title": "inner-title"
                }
              ],
              "description": "outer-description"
            }
          }
        )
      })

      it("String | Number", () => {
        assertDraft07(
          Schema.Union([
            Schema.String,
            Schema.Number
          ]),
          {
            schema: {
              "anyOf": [
                { "type": "string" },
                { "type": "number" }
              ]
            }
          }
        )
        assertDraft07(
          Schema.Union([
            Schema.String,
            Schema.Number
          ]).annotate({ description: "description" }),
          {
            schema: {
              "anyOf": [
                { "type": "string" },
                { "type": "number" }
              ],
              "description": "description"
            }
          }
        )
      })

      it(`1 | 2 | string`, () => {
        assertDraft07(
          Schema.Union([
            Schema.Literal(1),
            Schema.Literal(2).annotate({ description: "2-description" }),
            Schema.String
          ]),
          {
            schema: {
              "anyOf": [
                { "type": "number", "enum": [1] },
                { "type": "number", "enum": [2], "description": "2-description" },
                { "type": "string" }
              ]
            }
          }
        )
      })

      it(`(1 | 2) | string`, () => {
        assertDraft07(
          Schema.Union([
            Schema.Literals([1, 2]).annotate({ description: "1-2-description" }),
            Schema.String
          ]),
          {
            schema: {
              "anyOf": [
                {
                  "anyOf": [
                    { "type": "number", "enum": [1] },
                    { "type": "number", "enum": [2] }
                  ],
                  "description": "1-2-description"
                },
                { "type": "string" }
              ]
            }
          }
        )
      })
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
        assertDraft07(schema, {
          schema: {
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
        })
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
        assertDraft07(schema, {
          schema: {
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
        })
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
        assertDraft07(
          schema,
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
          }
        )
      })
    })

    describe("checks", () => {
      it("isInt", () => {
        assertDraft07(
          Schema.Number.annotate({ description: "description" }).check(Schema.isInt()),
          {
            schema: {
              "type": "integer",
              "description": "description"
            }
          }
        )
      })

      it("isInt32", () => {
        assertDraft07(
          Schema.Number.annotate({ description: "description" }).check(Schema.isInt32()),
          {
            schema: {
              "type": "integer",
              "description": "description",
              "maximum": 2147483647,
              "minimum": -2147483648
            }
          }
        )
      })

      it("isUint32", () => {
        assertDraft07(
          Schema.Number.annotate({ description: "description" }).check(Schema.isUint32()),
          {
            schema: {
              "type": "integer",
              "description": "description",
              "maximum": 4294967295,
              "minimum": 0
            }
          }
        )
      })

      it("isGreaterThan", () => {
        assertDraft07(
          Schema.Number.check(Schema.isGreaterThan(1)),
          {
            schema: {
              "type": "number",
              "exclusiveMinimum": 1
            }
          }
        )
      })

      it("isGreaterThanOrEqualTo", () => {
        assertDraft07(
          Schema.Number.check(Schema.isGreaterThanOrEqualTo(1)),
          {
            schema: {
              "type": "number",
              "minimum": 1
            }
          }
        )
      })

      it("isLessThan", () => {
        assertDraft07(Schema.Number.check(Schema.isLessThan(1)), {
          schema: {
            "type": "number",
            "exclusiveMaximum": 1
          }
        })
      })

      it("isLessThanOrEqualTo", () => {
        assertDraft07(Schema.Number.check(Schema.isLessThanOrEqualTo(1)), {
          schema: {
            "type": "number",
            "maximum": 1
          }
        })
      })

      it("isPattern", () => {
        assertDraft07(Schema.String.check(Schema.isPattern(/^abb+$/)), {
          schema: {
            "type": "string",
            "pattern": "^abb+$"
          }
        })
      })

      it("isTrimmed", () => {
        const schema = Schema.Trimmed
        assertDraft07(schema, {
          schema: {
            "type": "string",
            "pattern": "^\\S[\\s\\S]*\\S$|^\\S$|^$"
          }
        })
      })

      it("isLowercased", () => {
        const schema = Schema.String.check(Schema.isLowercased())
        assertDraft07(schema, {
          schema: {
            "type": "string",
            "pattern": "^[^A-Z]*$"
          }
        })
      })

      it("isUppercased", () => {
        const schema = Schema.String.check(Schema.isUppercased())
        assertDraft07(schema, {
          schema: {
            "type": "string",
            "pattern": "^[^a-z]*$"
          }
        })
      })

      it("isCapitalized", () => {
        const schema = Schema.String.check(Schema.isCapitalized())
        assertDraft07(schema, {
          schema: {
            "type": "string",
            "pattern": "^[^a-z]?.*$"
          }
        })
      })

      it("isUncapitalized", () => {
        const schema = Schema.String.check(Schema.isUncapitalized())
        assertDraft07(schema, {
          schema: {
            "type": "string",
            "pattern": "^[^A-Z]?.*$"
          }
        })
      })

      describe("isLength", () => {
        it("String", () => {
          assertDraft07(
            Schema.String.check(Schema.isLength(2)),
            {
              schema: {
                "type": "string",
                "maxLength": 2,
                "minLength": 2
              }
            }
          )
        })

        it("Array", () => {
          assertDraft07(
            Schema.Array(Schema.String).check(Schema.isLength(2)),
            {
              schema: {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "minItems": 2,
                "maxItems": 2
              }
            }
          )
        })

        it("NonEmptyArray", () => {
          assertDraft07(
            Schema.NonEmptyArray(Schema.String).check(Schema.isLength(2)),
            {
              schema: {
                "type": "array",
                "items": [{
                  "type": "string"
                }],
                "additionalItems": {
                  "type": "string"
                },
                "minItems": 2,
                "maxItems": 2
              }
            }
          )
        })
      })

      describe("isMinLength", () => {
        it("String", () => {
          assertDraft07(
            Schema.String.check(Schema.isMinLength(2)),
            {
              schema: {
                "type": "string",
                "minLength": 2
              }
            }
          )
        })

        it("Array", () => {
          assertDraft07(
            Schema.Array(Schema.String).check(Schema.isMinLength(2)),
            {
              schema: {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "minItems": 2
              }
            }
          )
        })

        it("NonEmptyArray", () => {
          assertDraft07(
            Schema.NonEmptyArray(Schema.String).check(Schema.isMinLength(2)),
            {
              schema: {
                "type": "array",
                "items": [{
                  "type": "string"
                }],
                "additionalItems": {
                  "type": "string"
                },
                "minItems": 2
              }
            }
          )
        })
      })

      describe("isMaxLength", () => {
        it("String", () => {
          assertDraft07(
            Schema.String.check(Schema.isMaxLength(2)),
            {
              schema: {
                "type": "string",
                "maxLength": 2
              }
            }
          )
        })

        it("Array", () => {
          assertDraft07(
            Schema.Array(Schema.String).check(Schema.isMaxLength(2)),
            {
              schema: {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "maxItems": 2
              }
            }
          )
        })

        it("NonEmptyArray", () => {
          assertDraft07(
            Schema.NonEmptyArray(Schema.String).check(Schema.isMaxLength(2)),
            {
              schema: {
                "type": "array",
                "items": [{
                  "type": "string"
                }],
                "additionalItems": {
                  "type": "string"
                },
                "maxItems": 2
              }
            }
          )
        })
      })

      it("isUUID", () => {
        assertDraft07(
          Schema.String.annotate({ description: "description" }).check(Schema.isUUID()),
          {
            schema: {
              "type": "string",
              "description": "description",
              "format": "uuid",
              "pattern":
                "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$"
            }
          }
        )
      })

      it("isBase64", () => {
        assertDraft07(
          Schema.String.annotate({ description: "description" }).check(Schema.isBase64()),
          {
            schema: {
              "type": "string",
              "description": "description",
              "pattern": "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$"
            }
          }
        )
      })

      it("isBase64Url", () => {
        assertDraft07(
          Schema.String.annotate({ description: "description" }).check(Schema.isBase64Url()),
          {
            schema: {
              "type": "string",
              "description": "description",
              "pattern": "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$"
            }
          }
        )
      })
    })

    describe("fromJsonString", () => {
      it("top level fromJsonString", () => {
        assertDraft07(
          Schema.fromJsonString(Schema.FiniteFromString),
          {
            schema: {
              "type": "string",
              "description": "a string that will be decoded as JSON"
            }
          }
        )
      })

      it("nested fromJsonString", () => {
        assertDraft07(
          Schema.fromJsonString(Schema.Struct({
            a: Schema.fromJsonString(Schema.FiniteFromString)
          })),
          {
            schema: {
              "type": "string",
              "description": "a string that will be decoded as JSON"
            }
          }
        )
      })
    })

    describe("Class", () => {
      it("fields", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}
        assertDraft07(
          A,
          {
            schema: {
              "$ref": "#/definitions/A"
            },
            definitions: {
              "A": {
                "type": "object",
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          }
        )
      })

      it("fields & annotations", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }, { description: "description" }) {}
        assertDraft07(
          A,
          {
            schema: {
              "$ref": "#/definitions/A"
            },
            definitions: {
              "A": {
                "type": "object",
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          }
        )
      })
    })

    describe("ErrorClass", () => {
      it("fields", () => {
        class E extends Schema.ErrorClass<E>("E")({
          a: Schema.String
        }) {}
        assertDraft07(E, {
          schema: {
            "$ref": "#/definitions/E"
          },
          definitions: {
            "E": {
              "type": "object",
              "properties": {
                "a": { "type": "string" }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        })
      })
    })

    it("Uint8ArrayFromHex", () => {
      assertDraft07(
        Schema.Uint8ArrayFromHex,
        {
          schema: {
            "type": "string",
            "description": "a string that will be decoded as Uint8Array"
          }
        }
      )
    })

    it("Uint8ArrayFromBase64", () => {
      assertDraft07(
        Schema.Uint8ArrayFromBase64,
        {
          schema: {
            "type": "string",
            "description": "a string that will be decoded as Uint8Array"
          }
        }
      )
    })

    it("Uint8ArrayFromBase64Url", () => {
      assertDraft07(
        Schema.Uint8ArrayFromBase64Url,
        {
          schema: {
            "type": "string",
            "description": "a string that will be decoded as Uint8Array"
          }
        }
      )
    })
  })

  describe("draft-2020-12", () => {
    describe("refs", () => {
      it(`refs should be created using the pattern: "#/$defs/IDENTIFIER"`, () => {
        assertDraft2020_12(
          Schema.String.annotate({ identifier: "ID" }),
          {
            schema: {
              "$ref": "#/$defs/ID"
            },
            definitions: {
              "ID": {
                "type": "string"
              }
            }
          }
        )
      })
    })

    describe("Tuple", () => {
      it("empty tuple", () => {
        const schema = Schema.Tuple([])
        assertDraft2020_12(
          schema,
          {
            schema: {
              "type": "array",
              "items": false
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": [] as const,
          "examples": [[] as const]
        }
        assertDraft2020_12(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "type": "array",
              "items": false,
              ...jsonAnnotations
            }
          }
        )
      })

      it("required element", () => {
        const Id3 = Schema.String.annotate({ identifier: "id3" })
        assertDraft2020_12(
          Schema.Tuple([
            Schema.String,
            Schema.String.annotate({ description: "b" }),
            Schema.String.annotateKey({ description: "c-key" }),
            Schema.String.annotate({ description: "d" }).annotateKey({ description: "d-key" }),
            Schema.String.annotate({ identifier: "id1" }),
            Schema.String.annotate({ identifier: "id2" }).annotateKey({ description: "id2-key" }),
            Id3.annotateKey({ description: "id3_1-key" }),
            Id3.annotateKey({ description: "id3_2-key" })
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                {
                  "type": "string"
                },
                {
                  "type": "string",
                  "description": "b"
                },
                {
                  "type": "string",
                  "description": "c-key"
                },
                {
                  "type": "string",
                  "description": "d",
                  "allOf": [{
                    "description": "d-key"
                  }]
                },
                { "$ref": "#/$defs/id1" },
                {
                  "allOf": [
                    { "$ref": "#/$defs/id2" },
                    {
                      "description": "id2-key"
                    }
                  ]
                },
                {
                  "allOf": [
                    { "$ref": "#/$defs/id3" },
                    {
                      "description": "id3_1-key"
                    }
                  ]
                },
                {
                  "allOf": [
                    { "$ref": "#/$defs/id3" },
                    {
                      "description": "id3_2-key"
                    }
                  ]
                }
              ],
              "items": false
            },
            definitions: {
              "id1": { "type": "string" },
              "id2": { "type": "string" },
              "id3": { "type": "string" }
            }
          }
        )
      })

      it("optionalKey properties", () => {
        assertDraft2020_12(
          Schema.Tuple([
            Schema.optionalKey(Schema.String)
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                { "type": "string" }
              ],
              "minItems": 0,
              "items": false
            }
          }
        )
      })

      it("optionalKey to required key", () => {
        assertDraft2020_12(
          Schema.Tuple([
            Schema.optionalKey(Schema.String).pipe(Schema.encodeTo(Schema.String))
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                {
                  "type": "string"
                }
              ],
              "items": false
            }
          }
        )
      })

      it("optional properties", () => {
        assertDraft2020_12(
          Schema.Tuple([
            Schema.optional(Schema.String),
            Schema.optional(Schema.String.annotate({ description: "b" })),
            Schema.optional(Schema.String).annotate({ description: "c" }),
            Schema.optional(Schema.String).annotateKey({ description: "d-key" }),
            Schema.optional(Schema.String.annotate({ description: "e" })).annotateKey({ description: "e-key" })
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                {
                  "type": "string"
                },
                {
                  "type": "string",
                  "description": "b"
                },
                {
                  "type": "string",
                  "description": "c"
                },
                {
                  "type": "string",
                  "description": "d-key"
                },
                {
                  "type": "string",
                  "description": "e",
                  "allOf": [{
                    "description": "e-key"
                  }]
                }
              ],
              "minItems": 0,
              "items": false
            }
          }
        )
      })

      it("UndefinedOr elements", () => {
        const schema = Schema.Tuple([
          Schema.UndefinedOr(Schema.String),
          Schema.UndefinedOr(Schema.String.annotate({ description: "b-inner-description" })),
          Schema.UndefinedOr(Schema.String.annotate({ description: "c-inner-description" })).annotate({
            description: "c-outer-description"
          }),
          Schema.UndefinedOr(Schema.String.annotate({ description: "d-inner-description" })).annotateKey({
            description: "d-key-description"
          })
        ])
        assertDraft2020_12(schema, {
          schema: {
            "type": "array",
            "prefixItems": [
              {
                "type": "string"
              },
              {
                "type": "string",
                "description": "b-inner-description"
              },
              {
                "anyOf": [
                  {
                    "description": "c-inner-description",
                    "type": "string"
                  }
                ],
                "description": "c-outer-description"
              },
              {
                "type": "string",
                "description": "d-inner-description",
                "allOf": [{
                  "description": "d-key-description"
                }]
              }
            ],
            "minItems": 0,
            "items": false
          }
        })
      })
    })

    describe("fromJsonString", () => {
      it("top level fromJsonString", () => {
        assertDraft2020_12(
          Schema.fromJsonString(Schema.FiniteFromString),
          {
            schema: {
              "type": "string",
              "description": "a string that will be decoded as JSON",
              "contentMediaType": "application/json",
              "contentSchema": {
                "type": "string",
                "description": "a string that will be decoded as a finite number"
              }
            }
          }
        )
      })

      it("nested fromJsonString", () => {
        assertDraft2020_12(
          Schema.fromJsonString(Schema.Struct({
            a: Schema.fromJsonString(Schema.FiniteFromString)
          })),
          {
            schema: {
              "type": "string",
              "description": "a string that will be decoded as JSON",
              "contentMediaType": "application/json",
              "contentSchema": {
                "type": "object",
                "properties": {
                  "a": {
                    "type": "string",
                    "description": "a string that will be decoded as JSON",
                    "contentMediaType": "application/json",
                    "contentSchema": {
                      "type": "string",
                      "description": "a string that will be decoded as a finite number"
                    }
                  }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          }
        )
      })
    })
  })

  describe("openApi3.1", () => {
    describe("refs", () => {
      it(`refs should be created using the pattern: "#/components/schemas/IDENTIFIER"`, () => {
        assertOpenApi3_1(
          Schema.String.annotate({ identifier: "ID" }),
          {
            schema: {
              "$ref": "#/components/schemas/ID"
            },
            definitions: {
              "ID": {
                "type": "string"
              }
            }
          }
        )
      })
    })

    describe("Tuple", () => {
      it("empty tuple", () => {
        const schema = Schema.Tuple([])
        assertOpenApi3_1(
          schema,
          {
            schema: {
              "type": "array",
              "items": false
            }
          }
        )
        const jsonAnnotations = {
          "title": "title",
          "description": "description",
          "default": [] as const,
          "examples": [[] as const]
        }
        assertOpenApi3_1(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "type": "array",
              "items": false,
              ...jsonAnnotations
            }
          }
        )
      })

      it("required element", () => {
        const Id3 = Schema.String.annotate({ identifier: "id3" })
        assertOpenApi3_1(
          Schema.Tuple([
            Schema.String,
            Schema.String.annotate({ description: "b" }),
            Schema.String.annotateKey({ description: "c-key" }),
            Schema.String.annotate({ description: "d" }).annotateKey({ description: "d-key" }),
            Schema.String.annotate({ identifier: "id1" }),
            Schema.String.annotate({ identifier: "id2" }).annotateKey({ description: "id2-key" }),
            Id3.annotateKey({ description: "id3_1-key" }),
            Id3.annotateKey({ description: "id3_2-key" })
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                {
                  "type": "string"
                },
                {
                  "type": "string",
                  "description": "b"
                },
                {
                  "type": "string",
                  "description": "c-key"
                },
                {
                  "type": "string",
                  "description": "d",
                  "allOf": [{
                    "description": "d-key"
                  }]
                },
                { "$ref": "#/components/schemas/id1" },
                {
                  "allOf": [
                    { "$ref": "#/components/schemas/id2" },
                    {
                      "description": "id2-key"
                    }
                  ]
                },
                {
                  "allOf": [
                    { "$ref": "#/components/schemas/id3" },
                    {
                      "description": "id3_1-key"
                    }
                  ]
                },
                {
                  "allOf": [
                    { "$ref": "#/components/schemas/id3" },
                    {
                      "description": "id3_2-key"
                    }
                  ]
                }
              ],
              "items": false
            },
            definitions: {
              "id1": { "type": "string" },
              "id2": { "type": "string" },
              "id3": { "type": "string" }
            }
          }
        )
      })

      it("optionalKey properties", () => {
        assertOpenApi3_1(
          Schema.Tuple([
            Schema.optionalKey(Schema.String)
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                { "type": "string" }
              ],
              "minItems": 0,
              "items": false
            }
          }
        )
      })

      it("optionalKey to required key", () => {
        assertOpenApi3_1(
          Schema.Tuple([
            Schema.optionalKey(Schema.String).pipe(Schema.encodeTo(Schema.String))
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                {
                  "type": "string"
                }
              ],
              "items": false
            }
          }
        )
      })

      it("optional properties", () => {
        assertOpenApi3_1(
          Schema.Tuple([
            Schema.optional(Schema.String),
            Schema.optional(Schema.String.annotate({ description: "b" })),
            Schema.optional(Schema.String).annotate({ description: "c" }),
            Schema.optional(Schema.String).annotateKey({ description: "d-key" }),
            Schema.optional(Schema.String.annotate({ description: "e" })).annotateKey({ description: "e-key" })
          ]),
          {
            schema: {
              "type": "array",
              "prefixItems": [
                {
                  "type": "string"
                },
                {
                  "type": "string",
                  "description": "b"
                },
                {
                  "type": "string",
                  "description": "c"
                },
                {
                  "type": "string",
                  "description": "d-key"
                },
                {
                  "type": "string",
                  "description": "e",
                  "allOf": [{
                    "description": "e-key"
                  }]
                }
              ],
              "minItems": 0,
              "items": false
            }
          }
        )
      })

      it("UndefinedOr elements", () => {
        const schema = Schema.Tuple([
          Schema.UndefinedOr(Schema.String),
          Schema.UndefinedOr(Schema.String.annotate({ description: "b-inner-description" })),
          Schema.UndefinedOr(Schema.String.annotate({ description: "c-inner-description" })).annotate({
            description: "c-outer-description"
          }),
          Schema.UndefinedOr(Schema.String.annotate({ description: "d-inner-description" })).annotateKey({
            description: "d-key-description"
          })
        ])
        assertOpenApi3_1(schema, {
          schema: {
            "type": "array",
            "prefixItems": [
              {
                "type": "string"
              },
              {
                "type": "string",
                "description": "b-inner-description"
              },
              {
                "anyOf": [
                  {
                    "description": "c-inner-description",
                    "type": "string"
                  }
                ],
                "description": "c-outer-description"
              },
              {
                "type": "string",
                "description": "d-inner-description",
                "allOf": [{
                  "description": "d-key-description"
                }]
              }
            ],
            "minItems": 0,
            "items": false
          }
        })
      })
    })

    describe("fromJsonString", () => {
      it("top level fromJsonString", () => {
        assertOpenApi3_1(
          Schema.fromJsonString(Schema.FiniteFromString),
          {
            schema: {
              "type": "string",
              "description": "a string that will be decoded as JSON",
              "contentMediaType": "application/json",
              "contentSchema": {
                "type": "string",
                "description": "a string that will be decoded as a finite number"
              }
            }
          }
        )
      })

      it("nested fromJsonString", () => {
        assertOpenApi3_1(
          Schema.fromJsonString(Schema.Struct({
            a: Schema.fromJsonString(Schema.FiniteFromString)
          })),
          {
            schema: {
              "type": "string",
              "description": "a string that will be decoded as JSON",
              "contentMediaType": "application/json",
              "contentSchema": {
                "type": "object",
                "properties": {
                  "a": {
                    "type": "string",
                    "description": "a string that will be decoded as JSON",
                    "contentMediaType": "application/json",
                    "contentSchema": {
                      "type": "string",
                      "description": "a string that will be decoded as a finite number"
                    }
                  }
                },
                "required": ["a"],
                "additionalProperties": false
              }
            }
          }
        )
      })
    })
  })

  describe("options", () => {
    describe("topLevelReferenceStrategy", () => {
      describe(`"skip"`, () => {
        it("String", () => {
          const definitions = {}
          assertDraft07(
            Schema.String.annotate({ identifier: "ID" }),
            {
              schema: {
                "type": "string"
              }
            },
            {
              referenceStrategy: "skip",
              definitions
            }
          )
          deepStrictEqual(definitions, {})
        })

        it("nested identifiers", () => {
          class A extends Schema.Class<A>("A")({ s: Schema.String.annotate({ identifier: "ID4" }) }) {}
          const schema = Schema.Struct({
            a: Schema.String.annotate({ identifier: "ID" }),
            b: Schema.Struct({
              c: Schema.String.annotate({ identifier: "ID3" })
            }).annotate({ identifier: "ID2" }),
            d: A
          })
          assertDraft07(schema, {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                },
                "b": {
                  "type": "object",
                  "properties": {
                    "c": { "type": "string" }
                  },
                  "required": ["c"],
                  "additionalProperties": false
                },
                "d": {
                  "type": "object",
                  "properties": {
                    "s": { "type": "string" }
                  },
                  "required": ["s"],
                  "additionalProperties": false
                }
              },
              "required": ["a", "b", "d"],
              "additionalProperties": false
            }
          }, {
            referenceStrategy: "skip"
          })
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
            assertDraft07(schema, {
              schema: {
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
            }, {
              referenceStrategy: "skip"
            })
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
            assertDraft07(schema, {
              schema: {
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
            }, {
              referenceStrategy: "skip"
            })
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
            assertDraft07(
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
                      "items": { "$ref": "#/definitions/A" }
                    }
                  },
                  "required": ["a", "as"],
                  "additionalProperties": false
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
              {
                referenceStrategy: "skip"
              }
            )
          })
        })
      })
    })

    describe("additionalProperties", () => {
      it(`false (default)`, () => {
        const schema = Schema.Struct({ a: Schema.String })

        assertDraft07(schema, {
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
        }, {
          additionalProperties: false
        })
      })

      it(`true`, () => {
        const schema = Schema.Struct({ a: Schema.String })

        assertDraft07(schema, {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string"
              }
            },
            "required": ["a"],
            "additionalProperties": true
          }
        }, {
          additionalProperties: true
        })
      })

      it(`schema`, () => {
        const schema = Schema.Struct({ a: Schema.String })

        assertDraft07(schema, {
          schema: {
            "type": "object",
            "properties": {
              "a": {
                "type": "string"
              }
            },
            "required": ["a"],
            "additionalProperties": { "type": "string" }
          }
        }, {
          additionalProperties: { "type": "string" }
        })
      })
    })
  })
})
