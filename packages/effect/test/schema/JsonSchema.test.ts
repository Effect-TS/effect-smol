import type { Options as AjvOptions } from "ajv"
// eslint-disable-next-line import-x/no-named-as-default
import Ajv from "ajv"
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
  describe("Unsupported schemas", () => {
    it("Declaration", () => {
      assertUnsupportedSchema(
        Schema.instanceOf(globalThis.URL),
        `Unsupported schema Declaration at root`
      )
    })

    it("Undefined", () => {
      assertUnsupportedSchema(
        Schema.Undefined,
        `Unsupported schema Undefined at root`
      )
    })

    it("BigInt", () => {
      assertUnsupportedSchema(
        Schema.BigInt,
        `Unsupported schema BigInt at root`
      )
    })

    it("UniqueSymbol", () => {
      assertUnsupportedSchema(
        Schema.UniqueSymbol(Symbol.for("effect/Schema/test/a")),
        `Unsupported schema UniqueSymbol at root`
      )
    })

    it("Symbol", () => {
      assertUnsupportedSchema(
        Schema.Symbol,
        `Unsupported schema Symbol at root`
      )
    })

    it("Literal(bigint)", () => {
      assertUnsupportedSchema(
        Schema.Literal(1n),
        `Unsupported literal 1n at root`
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
        `Missing identifier for Suspend at ["as"][0]`
      )
    })

    describe("Tuple", () => {
      it("Unsupported element", () => {
        assertUnsupportedSchema(
          Schema.Tuple([Schema.Symbol]),
          `Unsupported schema Symbol at [0]`
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
          `Unsupported schema Symbol at ["a"]`
        )
      })

      it("Unsupported property signature name", () => {
        const a = Symbol.for("effect/Schema/test/a")
        assertUnsupportedSchema(
          Schema.Struct({ [a]: Schema.String }),
          `Unsupported property signature name Symbol(effect/Schema/test/a) at [Symbol(effect/Schema/test/a)]`
        )
      })

      it("Unsupported index signature parameter", () => {
        assertUnsupportedSchema(
          Schema.Record(Schema.Symbol, Schema.Number),
          `Unsupported index signature parameter Symbol at root`
        )
      })
    })

    describe("onMissingJsonSchemaAnnotation", () => {
      it("when returns a JSON Schema", () => {
        assertDraft07(
          Schema.Date,
          {
            schema: {
              title: "Date"
            }
          },
          {
            onMissingJsonSchemaAnnotation: () => ({})
          }
        )
      })

      it("when returns undefined", () => {
        assertUnsupportedSchema(
          Schema.Date,
          `Unsupported schema Declaration at root`,
          {
            onMissingJsonSchemaAnnotation: () => undefined
          }
        )
      })
    })
  })

  describe("Override", () => {
    it("declare", () => {
      const schema = Schema.instanceOf(URL, {
        jsonSchema: {
          _tag: "Override",
          override: () => ({ "type": "string" })
        }
      })
      assertDraft07(schema, {
        schema: {
          "$comment": "Override annotation",
          "type": "string"
        }
      })
    })

    it("should ignore errors when generating the default JSON Schema passed in the override context", () => {
      const schema = Schema.Symbol.annotate({
        jsonSchema: {
          _tag: "Override",
          override: () => ({ type: "string" })
        }
      })
      assertDraft07(
        schema,
        {
          schema: {
            "$comment": "Override annotation",
            "type": "string"
          }
        }
      )
    })

    describe("String", () => {
      it("String & override", () => {
        const schema = Schema.String.annotate({
          jsonSchema: {
            _tag: "Override",
            override: () => ({ "type": "string", minLength: 1 })
          }
        })
        assertDraft07(
          schema,
          {
            schema: {
              "$comment": "Override annotation",
              "type": "string",
              "minLength": 1
            }
          }
        )
        assertDraft07(
          schema.annotate({ description: "description" }),
          {
            schema: {
              "$comment": "Override annotation",
              "type": "string",
              "minLength": 1,
              "description": "description"
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
              override: () => ({ "type": "string", minLength: 1 })
            }
          }),
          {
            schema: {
              "$ref": "#/definitions/ID"
            },
            definitions: {
              "ID": {
                "$comment": "Override annotation",
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
            jsonSchema: { _tag: "Override", override: () => ({ "type": "string", minLength: 1 }) }
          }),
          {
            schema: {
              "$comment": "Override annotation",
              "type": "string",
              "minLength": 1
            }
          }
        )
      })
    })
  })

  describe("draft-07", () => {
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
      })

      it("String & identifier", () => {
        assertDraft07(
          Schema.String.annotate({
            identifier: "ID"
          }),
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
                "$comment": "Encoding",
                "type": "number",
                "enum": [2]
              }
            ]
          },
          definitions: {
            "ID": {
              "$comment": "Encoding",
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

      it("String & check", () => {
        assertDraft07(
          Schema.String.check(Schema.isMinLength(2)),
          {
            schema: {
              "type": "string",
              "allOf": [
                {
                  "$comment": "Filter",
                  "title": "isMinLength(2)",
                  "description": "a value with a length of at least 2",
                  "minLength": 2
                }
              ]
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
            jsonSchema: { _tag: "Override", override: () => ({ "type": "string", minLength: 1 }) }
          }).check(Schema.isMinLength(2)),
          {
            schema: {
              "$comment": "Override annotation",
              "type": "string",
              "minLength": 1,
              "allOf": [
                {
                  "$comment": "Filter",
                  "title": "isMinLength(2)",
                  "description": "a value with a length of at least 2",
                  "minLength": 2
                }
              ]
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
                "allOf": [
                  {
                    "$comment": "Filter",
                    "title": "isMinLength(2)",
                    "description": "a value with a length of at least 2",
                    "minLength": 2
                  }
                ]
              }
            }
          }
        )
      })

      it("String & json annotations & check", () => {
        assertDraft07(
          Schema.String.annotate({
            ...jsonAnnotations
          }).check(Schema.isMinLength(2)),
          {
            schema: {
              "type": "string",
              ...jsonAnnotations,
              "allOf": [
                {
                  "$comment": "Filter",
                  "title": "isMinLength(2)",
                  "description": "a value with a length of at least 2",
                  "minLength": 2
                }
              ]
            }
          }
        )
      })

      it("String & json annotations & check & identifier", () => {
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
                ...jsonAnnotations,
                "allOf": [
                  {
                    "$comment": "Filter",
                    "title": "isMinLength(2)",
                    "description": "a value with a length of at least 2",
                    "minLength": 2
                  }
                ]
              }
            }
          }
        )
      })

      it("String & check & json annotations", () => {
        assertDraft07(
          Schema.String.check(Schema.isMinLength(2)).annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "type": "string",
              "allOf": [
                {
                  "$comment": "Filter",
                  "minLength": 2,
                  ...jsonAnnotations
                }
              ]
            }
          }
        )
      })

      it("String & check & json annotations + identifier", () => {
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
                "allOf": [
                  {
                    "$comment": "Filter",
                    "minLength": 2,
                    ...jsonAnnotations
                  }
                ]
              }
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
              "allOf": [
                {
                  "$comment": "Filter",
                  "title": "isMinLength(2)",
                  "description": "a value with a length of at least 2",
                  "minLength": 2
                },
                {
                  "$comment": "Filter",
                  "title": "isMaxLength(3)",
                  "description": "a value with a length of at most 3",
                  "maxLength": 3
                }
              ]
            }
          }
        )
      })

      it("String & check & check & json annotations", () => {
        assertDraft07(
          Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(3)).annotate({
            ...jsonAnnotations
          }),
          {
            schema: {
              "type": "string",
              "allOf": [
                {
                  "$comment": "Filter",
                  "title": "isMinLength(2)",
                  "description": "a value with a length of at least 2",
                  "minLength": 2
                },
                {
                  "$comment": "Filter",
                  "maxLength": 3,
                  ...jsonAnnotations
                }
              ]
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
              "anyOf": [
                {
                  "type": "number",
                  "enum": [0],
                  "title": "Apple"
                }
              ]
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
              "anyOf": [
                {
                  "type": "number",
                  "enum": [0],
                  "title": "Apple"
                }
              ],
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
                "anyOf": [
                  {
                    "type": "number",
                    "enum": [0],
                    "title": "Apple"
                  }
                ],
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
                  "allOf": [{
                    "$comment": "key annotations",
                    "description": "c-key"
                  }]
                },
                "d": {
                  "type": "string",
                  "description": "d",
                  "allOf": [{
                    "$comment": "key annotations",
                    "description": "d-key"
                  }]
                },
                "id1": { "$ref": "#/definitions/id1" },
                "id2": {
                  "allOf": [
                    { "$ref": "#/definitions/id2" },
                    {
                      "$comment": "key annotations",
                      "description": "id2-key"
                    }
                  ]
                },
                "id3_1": {
                  "allOf": [
                    { "$ref": "#/definitions/id3" },
                    {
                      "$comment": "key annotations",
                      "description": "id3_1-key"
                    }
                  ]
                },
                "id3_2": {
                  "allOf": [
                    { "$ref": "#/definitions/id3" },
                    {
                      "$comment": "key annotations",
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

      it("required key + required: false annotation", () => {
        assertDraft07(
          Schema.Struct({
            a: Schema.String.annotate({
              jsonSchema: {
                _tag: "Override",
                override: (ctx) => ctx.jsonSchema,
                required: false
              }
            })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "$comment": "Override annotation",
                  "type": "string"
                }
              },
              "required": [],
              "additionalProperties": false
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

      it("optionalKey + required: true annotation", () => {
        assertDraft07(
          Schema.Struct({
            a: Schema.optionalKey(Schema.String).annotate({
              jsonSchema: {
                _tag: "Override",
                override: (ctx) => ctx.jsonSchema,
                required: true
              }
            })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "$comment": "Override annotation",
                  "type": "string"
                }
              },
              "required": ["a"],
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
                  "$comment": "Encoding",
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
                  "anyOf": [
                    { "type": "string" },
                    { "$comment": "Undefined", "not": {} }
                  ]
                },
                "b": {
                  "anyOf": [
                    { "type": "string", "description": "b" },
                    { "$comment": "Undefined", "not": {} }
                  ]
                },
                "c": {
                  "anyOf": [
                    { "type": "string" },
                    { "$comment": "Undefined", "not": {} }
                  ],
                  "description": "c"
                },
                "d": {
                  "anyOf": [
                    { "type": "string" },
                    { "$comment": "Undefined", "not": {} }
                  ],
                  "allOf": [{
                    "$comment": "key annotations",
                    "description": "d-key"
                  }]
                },
                "e": {
                  "anyOf": [
                    { "type": "string", "description": "e" },
                    { "$comment": "Undefined", "not": {} }
                  ],
                  "allOf": [{
                    "$comment": "key annotations",
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

      it("optional + required: true annotation", () => {
        assertDraft07(
          Schema.Struct({
            a: Schema.optional(Schema.String).annotate({
              jsonSchema: {
                _tag: "Override",
                override: (ctx) => ctx.jsonSchema,
                required: true
              }
            })
          }),
          {
            schema: {
              "type": "object",
              "properties": {
                "a": {
                  "$comment": "Override annotation",
                  "anyOf": [
                    { "type": "string" },
                    { "$comment": "Undefined", "not": {} }
                  ]
                }
              },
              "required": ["a"],
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
                "anyOf": [
                  { "type": "string" },
                  { "$comment": "Undefined", not: {} }
                ]
              },
              "b": {
                "anyOf": [
                  {
                    "type": "string",
                    "description": "b-inner-description"
                  },
                  { "$comment": "Undefined", not: {} }
                ]
              },
              "c": {
                "anyOf": [
                  {
                    "description": "c-inner-description",
                    "type": "string"
                  },
                  { "$comment": "Undefined", "not": {} }
                ],
                "description": "c-outer-description"
              },
              "d": {
                "anyOf": [
                  {
                    "type": "string",
                    "description": "d-inner-description"
                  },
                  { "$comment": "Undefined", "not": {} }
                ],
                "allOf": [{
                  "$comment": "key annotations",
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
            "anyOf": [
              { "type": "string" }
            ]
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
            "anyOf": [
              { "type": "string" }
            ],
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
          Schema.Union([Schema.String, Schema.Number]),
          {
            schema: {
              "anyOf": [
                { "type": "string" },
                { "type": "number" }
              ]
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
              "type": "number",
              "description": "description",
              "allOf": [
                {
                  "$comment": "Filter",
                  "type": "integer",
                  "description": "an integer",
                  "title": "isInt"
                }
              ]
            }
          }
        )
      })

      it("isInt32", () => {
        assertDraft07(
          Schema.Number.annotate({ description: "description" }).check(Schema.isInt32()),
          {
            schema: {
              "type": "number",
              "description": "description",
              "allOf": [
                {
                  "$comment": "FilterGroup",
                  "description": "a 32-bit integer",
                  "title": "isInt32",
                  "allOf": [
                    {
                      "$comment": "Filter",
                      "type": "integer",
                      "description": "an integer",
                      "title": "isInt"
                    },
                    {
                      "$comment": "Filter",
                      "description": "a value between -2147483648 and 2147483647",
                      "maximum": 2147483647,
                      "minimum": -2147483648,
                      "title": "isBetween(-2147483648, 2147483647)"
                    }
                  ]
                }
              ]
            }
          }
        )
      })

      it("isUint32", () => {
        assertDraft07(
          Schema.Number.annotate({ description: "description" }).check(Schema.isUint32()),
          {
            schema: {
              "type": "number",
              "description": "description",
              "allOf": [
                {
                  "$comment": "FilterGroup",
                  "description": "a 32-bit unsigned integer",
                  "title": "isUint32",
                  "allOf": [
                    {
                      "$comment": "Filter",
                      "type": "integer",
                      "description": "an integer",
                      "title": "isInt"
                    },
                    {
                      "$comment": "Filter",
                      "description": "a value between 0 and 4294967295",
                      "maximum": 4294967295,
                      "minimum": 0,
                      "title": "isBetween(0, 4294967295)"
                    }
                  ]
                }
              ]
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
              "allOf": [
                {
                  "$comment": "Filter",
                  "description": "a base64 encoded string",
                  "title": "isBase64",
                  "pattern": "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$"
                }
              ]
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
              "allOf": [
                {
                  "$comment": "Filter",
                  "description": "a base64url encoded string",
                  "title": "isBase64Url",
                  "pattern": "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$"
                }
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
    })

    describe("fromJsonString", () => {
      it("top level fromJsonString", () => {
        assertDraft07(
          Schema.fromJsonString(Schema.FiniteFromString),
          {
            schema: {
              "$comment": "Override annotation",
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
              "$comment": "Override annotation",
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
                "$comment": "Encoding",
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
                "$comment": "Encoding",
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
              "$comment": "Encoding",
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
            "$comment": "Encoding",
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
            "$comment": "Encoding",
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
            "$comment": "Encoding",
            "type": "string",
            "description": "a string that will be decoded as Uint8Array"
          }
        }
      )
    })
  })

  describe("draft-2020-12", () => {
    describe("checks", () => {
      it("isInt", () => {
        assertDraft2020_12(
          Schema.Number.annotate({ description: "description" }).check(Schema.isInt()),
          {
            schema: {
              "type": "number",
              "description": "description",
              "allOf": [
                {
                  "$comment": "Filter",
                  "type": "integer",
                  "description": "an integer",
                  "title": "isInt"
                }
              ]
            }
          }
        )
      })

      it("isInt32", () => {
        assertDraft2020_12(
          Schema.Number.annotate({ description: "description" }).check(Schema.isInt32()),
          {
            schema: {
              "type": "number",
              "description": "description",
              "allOf": [
                {
                  "$comment": "FilterGroup",
                  "description": "a 32-bit integer",
                  "title": "isInt32",
                  "allOf": [
                    {
                      "$comment": "Filter",
                      "type": "integer",
                      "description": "an integer",
                      "title": "isInt"
                    },
                    {
                      "$comment": "Filter",
                      "description": "a value between -2147483648 and 2147483647",
                      "maximum": 2147483647,
                      "minimum": -2147483648,
                      "title": "isBetween(-2147483648, 2147483647)"
                    }
                  ]
                }
              ]
            }
          }
        )
      })

      it("isUint32", () => {
        assertDraft2020_12(
          Schema.Number.annotate({ description: "description" }).check(Schema.isUint32()),
          {
            schema: {
              "type": "number",
              "description": "description",
              "allOf": [
                {
                  "$comment": "FilterGroup",
                  "description": "a 32-bit unsigned integer",
                  "title": "isUint32",
                  "allOf": [
                    {
                      "$comment": "Filter",
                      "type": "integer",
                      "description": "an integer",
                      "title": "isInt"
                    },
                    {
                      "$comment": "Filter",
                      "description": "a value between 0 and 4294967295",
                      "maximum": 4294967295,
                      "minimum": 0,
                      "title": "isBetween(0, 4294967295)"
                    }
                  ]
                }
              ]
            }
          }
        )
      })

      it("isBase64", () => {
        assertDraft2020_12(
          Schema.String.annotate({ description: "description" }).check(Schema.isBase64()),
          {
            schema: {
              "type": "string",
              "description": "description",
              "allOf": [
                {
                  "$comment": "Filter",
                  "description": "a base64 encoded string",
                  "title": "isBase64",
                  "pattern": "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$"
                }
              ]
            }
          }
        )
      })

      it("isBase64Url", () => {
        assertDraft2020_12(
          Schema.String.annotate({ description: "description" }).check(Schema.isBase64Url()),
          {
            schema: {
              "type": "string",
              "description": "description",
              "allOf": [
                {
                  "$comment": "Filter",
                  "description": "a base64url encoded string",
                  "title": "isBase64Url",
                  "pattern": "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$"
                }
              ]
            }
          }
        )
      })
    })

    describe("fromJsonString", () => {
      it("top level fromJsonString", () => {
        assertDraft2020_12(
          Schema.fromJsonString(Schema.FiniteFromString),
          {
            schema: {
              "$comment": "Override annotation",
              "type": "string",
              "description": "a string that will be decoded as JSON",
              "contentMediaType": "application/json",
              "contentSchema": {
                "$comment": "Encoding",
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
              "$comment": "Override annotation",
              "type": "string",
              "description": "a string that will be decoded as JSON",
              "contentMediaType": "application/json",
              "contentSchema": {
                "type": "object",
                "properties": {
                  "a": {
                    "$comment": "Override annotation",
                    "type": "string",
                    "description": "a string that will be decoded as JSON",
                    "contentMediaType": "application/json",
                    "contentSchema": {
                      "$comment": "Encoding",
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
    it("String & identifier", () => {
      assertOpenApi3_1(
        Schema.String.annotate({
          identifier: "ID"
        }),
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
})
