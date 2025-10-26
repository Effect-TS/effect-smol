import type { Options as AjvOptions } from "ajv"
// eslint-disable-next-line import-x/no-named-as-default
import Ajv from "ajv"
import { Schema } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual, throws } from "../utils/assert.ts"

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

async function assertDraft07<S extends Schema.Top>(
  schema: S,
  expected: { schema: object; definitions?: Record<string, object> },
  options?: Schema.JsonSchemaOptions
) {
  const { definitions, jsonSchema, uri } = Schema.makeJsonSchemaDraft07(schema, options)
  strictEqual(uri, "http://json-schema.org/draft-07/schema")
  deepStrictEqual(jsonSchema, expected.schema)
  deepStrictEqual(definitions, expected.definitions ?? {})
  const valid = ajvDraft07.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft07.errors, null)
  return jsonSchema
}

export async function assertDraft2020_12<S extends Schema.Top>(
  schema: S,
  expected: { schema: object; definitions?: Record<string, object> },
  options?: Schema.JsonSchemaOptions
) {
  const { definitions, jsonSchema, uri } = Schema.makeJsonSchemaDraft2020_12(schema, options)
  strictEqual(uri, "https://json-schema.org/draft/2020-12/schema")
  deepStrictEqual(jsonSchema, expected.schema)
  deepStrictEqual(definitions, expected.definitions ?? {})
  const valid = ajvDraft2020_12.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft07.errors, null)
  return jsonSchema
}

export async function assertOpenApi3_1<S extends Schema.Top>(
  schema: S,
  expected: { schema: object; definitions?: Record<string, object> },
  options?: Schema.JsonSchemaOptions
) {
  const { definitions, jsonSchema, uri } = Schema.makeJsonSchemaOpenApi3_1(schema, options)
  strictEqual(uri, "https://json-schema.org/draft/2020-12/schema")
  deepStrictEqual(jsonSchema, expected.schema)
  deepStrictEqual(definitions, expected.definitions ?? {})
  const valid = ajvDraft2020_12.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft2020_12.errors, null)
  return jsonSchema
}

describe("ToJsonSchema", () => {
  describe("Unsupported schemas", () => {
    it("Declaration", async () => {
      assertUnsupportedSchema(
        Schema.instanceOf(globalThis.URL),
        `Unsupported schema Declaration at root`
      )
    })

    it("Undefined", async () => {
      assertUnsupportedSchema(
        Schema.Undefined,
        `Unsupported schema Undefined at root`
      )
    })

    it("BigInt", async () => {
      assertUnsupportedSchema(
        Schema.BigInt,
        `Unsupported schema BigInt at root`
      )
    })

    it("UniqueSymbol", async () => {
      assertUnsupportedSchema(
        Schema.UniqueSymbol(Symbol.for("effect/Schema/test/a")),
        `Unsupported schema UniqueSymbol at root`
      )
    })

    it("Symbol", async () => {
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
      it("when returns a JSON Schema", async () => {
        await assertDraft07(
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

      it("when returns undefined", async () => {
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
    it("declare", async () => {
      const schema = Schema.instanceOf(URL, {
        jsonSchema: {
          _tag: "Override",
          override: () => ({ "type": "string" })
        }
      })
      await assertDraft07(schema, {
        schema: {
          "$comment": "Override",
          "type": "string"
        }
      })
    })

    describe("String", () => {
      it("String & override", async () => {
        const schema = Schema.String.annotate({
          jsonSchema: {
            _tag: "Override",
            override: () => ({ "type": "string", minLength: 1 })
          }
        })
        await assertDraft07(
          schema,
          {
            schema: {
              "$comment": "Override",
              "type": "string",
              "minLength": 1
            }
          }
        )
        await assertDraft07(
          schema.annotate({ description: "description" }),
          {
            schema: {
              "$comment": "Override",
              "type": "string",
              "minLength": 1,
              "description": "description"
            }
          }
        )
      })

      it("String & identifier & override", async () => {
        await assertDraft07(
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
                "$comment": "Override",
                "type": "string",
                minLength: 1
              }
            }
          }
        )
      })

      it("String & check & override", async () => {
        await assertDraft07(
          Schema.String.check(Schema.isMinLength(2)).annotate({
            jsonSchema: { _tag: "Override", override: () => ({ "type": "string", minLength: 1 }) }
          }),
          {
            schema: {
              "$comment": "Override",
              "type": "string",
              minLength: 1
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

      it("String", async () => {
        await assertDraft07(
          Schema.String,
          {
            schema: {
              "type": "string"
            }
          }
        )
        await assertDraft07(
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

      it("String & identifier", async () => {
        await assertDraft07(
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
        await assertDraft07(
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

      it("should ignore the key json annotations if the schema is not contextual", async () => {
        await assertDraft07(
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

      it("String & check", async () => {
        await assertDraft07(
          Schema.String.check(Schema.isMinLength(2)),
          {
            schema: {
              "type": "string",
              "allOf": [
                {
                  "$comment": "Filter",
                  title: "isMinLength(2)",
                  description: "a value with a length of at least 2",
                  minLength: 2
                }
              ]
            }
          }
        )
      })

      it("String & override & check", async () => {
        await assertDraft07(
          Schema.String.annotate({
            jsonSchema: { _tag: "Override", override: () => ({ "type": "string", minLength: 1 }) }
          }).check(Schema.isMinLength(2)),
          {
            schema: {
              "$comment": "Override",
              "type": "string",
              minLength: 1,
              "allOf": [
                {
                  "$comment": "Filter",
                  title: "isMinLength(2)",
                  description: "a value with a length of at least 2",
                  minLength: 2
                }
              ]
            }
          }
        )
      })

      it("String & check & identifier", async () => {
        await assertDraft07(
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

      it("String & json annotations & check", async () => {
        await assertDraft07(
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

      it("String & json annotations & check & identifier", async () => {
        await assertDraft07(
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

      it("String & check & json annotations", async () => {
        await assertDraft07(
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

      it("String & check & json annotations + identifier", async () => {
        await assertDraft07(
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

      it("String & check & check", async () => {
        await assertDraft07(
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

      it("String & check & check & json annotations", async () => {
        await assertDraft07(
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

    it("Void", async () => {
      const schema = Schema.Void
      await assertDraft07(
        schema,
        {
          schema: {}
        }
      )
      const jsonAnnotations = {
        "title": "title",
        "description": "description"
      }
      await assertDraft07(
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

    it("Unknown", async () => {
      const schema = Schema.Unknown
      await assertDraft07(
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
      await assertDraft07(
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

    it("Any", async () => {
      const schema = Schema.Any
      await assertDraft07(
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
      await assertDraft07(
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

    it("Never", async () => {
      const schema = Schema.Never
      await assertDraft07(
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
      await assertDraft07(
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

    it("Null", async () => {
      const schema = Schema.Null
      await assertDraft07(
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
      await assertDraft07(
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

    it("Number", async () => {
      const schema = Schema.Number
      await assertDraft07(
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
      await assertDraft07(
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

    it("Boolean", async () => {
      const schema = Schema.Boolean
      await assertDraft07(
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
      await assertDraft07(
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

    it("ObjectKeyword", async () => {
      const schema = Schema.ObjectKeyword
      await assertDraft07(
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
      await assertDraft07(
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
      it("string", async () => {
        const schema = Schema.Literal("a")
        await assertDraft07(
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
        await assertDraft07(
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

      it("number", async () => {
        const schema = Schema.Literal(1)
        await assertDraft07(
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
        await assertDraft07(
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

      it("boolean", async () => {
        const schema = Schema.Literal(true)
        await assertDraft07(
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
        await assertDraft07(
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
      it("empty literals", async () => {
        const schema = Schema.Literals([])
        await assertDraft07(
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
        await assertDraft07(
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

      it("strings", async () => {
        const schema = Schema.Literals(["a", "b"])
        await assertDraft07(
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
        await assertDraft07(
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

      it("numbers", async () => {
        const schema = Schema.Literals([1, 2])
        await assertDraft07(
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
        await assertDraft07(
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

      it("booleans", async () => {
        const schema = Schema.Literals([true, false])
        await assertDraft07(
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
        await assertDraft07(
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

      it("strings & numbers", async () => {
        const schema = Schema.Literals(["a", 1])
        await assertDraft07(
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
        await assertDraft07(
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
      it("strings", async () => {
        const schema = Schema.Union([
          Schema.Literal("a"),
          Schema.Literal("b")
        ])
        await assertDraft07(
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
        await assertDraft07(
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

      it("strings & inner annotate", async () => {
        const schema = Schema.Union([
          Schema.Literal("a"),
          Schema.Literal("b").annotate({ description: "b-description" })
        ])
        await assertDraft07(
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
        await assertDraft07(
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

      it("numbers", async () => {
        const schema = Schema.Union([
          Schema.Literal(1),
          Schema.Literal(2)
        ])
        await assertDraft07(
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
        await assertDraft07(
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

      it("booleans", async () => {
        const schema = Schema.Union([
          Schema.Literal(true),
          Schema.Literal(false)
        ])
        await assertDraft07(
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
        await assertDraft07(
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

      it("strings & numbers", async () => {
        const schema = Schema.Union([
          Schema.Literal("a"),
          Schema.Literal(1)
        ])
        await assertDraft07(
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
        await assertDraft07(
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
      it("empty enum", async () => {
        enum Empty {}
        const schema = Schema.Enum(Empty)
        await assertDraft07(
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
        await assertDraft07(
          schema.annotate({ ...jsonAnnotations }),
          {
            schema: {
              "not": {},
              ...jsonAnnotations
            }
          }
        )
      })

      it("single enum", async () => {
        enum Fruits {
          Apple
        }
        const schema = Schema.Enum(Fruits)
        await assertDraft07(
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
        await assertDraft07(
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
        await assertDraft07(
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

      it("mixed enums (number & string)", async () => {
        enum Fruits {
          Apple,
          Banana,
          Orange = "orange"
        }
        const schema = Schema.Enum(Fruits)
        await assertDraft07(
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
        await assertDraft07(
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

      it("const enum", async () => {
        const Fruits = {
          Apple: "apple",
          Banana: "banana",
          Cantaloupe: 3
        } as const
        const schema = Schema.Enum(Fruits)
        await assertDraft07(
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

    it("TemplateLiteral", async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String])
      await assertDraft07(schema, {
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
      await assertDraft07(schema.annotate({ ...jsonAnnotations }), {
        schema: {
          "type": "string",
          "pattern": "^(a)([\\s\\S]*?)$",
          ...jsonAnnotations
        }
      })
    })

    describe("Struct", () => {
      it("empty struct", async () => {
        const schema = Schema.Struct({})
        await assertDraft07(
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
        await assertDraft07(
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

      it("required property", async () => {
        const Id3 = Schema.String.annotate({ identifier: "id3" })
        await assertDraft07(
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

      it("required key + required: false annotation", async () => {
        await assertDraft07(
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
                  "$comment": "Override",
                  "type": "string"
                }
              },
              "required": [],
              "additionalProperties": false
            }
          }
        )
      })

      it("optionalKey properties", async () => {
        await assertDraft07(
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

      it("optionalKey + required: true annotation", async () => {
        await assertDraft07(
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
                  "$comment": "Override",
                  "type": "string"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })

      it("optionalKey to required key", async () => {
        await assertDraft07(
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

      it("optional properties", async () => {
        await assertDraft07(
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

      it("optional + required: true annotation", async () => {
        await assertDraft07(
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
                  "$comment": "Override",
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

      it("UndefinedOr fields", async () => {
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
        await assertDraft07(schema, {
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
      it("empty union", async () => {
        const schema = Schema.Union([])
        await assertDraft07(schema, {
          schema: {
            "not": {}
          }
        })
        const jsonAnnotations = {
          "title": "title",
          "description": "description"
        }
        await assertDraft07(schema.annotate({ ...jsonAnnotations }), {
          schema: {
            "not": {},
            ...jsonAnnotations
          }
        })
      })

      it("single member", async () => {
        const schema = Schema.Union([Schema.String])
        await assertDraft07(schema, {
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
        await assertDraft07(schema.annotate({ ...jsonAnnotations }), {
          schema: {
            "anyOf": [
              { "type": "string" }
            ],
            ...jsonAnnotations
          }
        })
        await assertDraft07(
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

      it("String | Number", async () => {
        await assertDraft07(
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
      it("isInt", async () => {
        await assertDraft07(
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

      it("isInt32", async () => {
        await assertDraft07(
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

      it("isUint32", async () => {
        await assertDraft07(
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

      it("isBase64", async () => {
        await assertDraft07(
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

      it("isBase64Url", async () => {
        await assertDraft07(
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
      it("top level fromJsonString", async () => {
        await assertDraft07(
          Schema.fromJsonString(Schema.FiniteFromString),
          {
            schema: {
              "$comment": "Override",
              "type": "string",
              "description": "a string that will be decoded as JSON"
            }
          }
        )
      })

      it("nested fromJsonString", async () => {
        await assertDraft07(
          Schema.fromJsonString(Schema.Struct({
            a: Schema.fromJsonString(Schema.FiniteFromString)
          })),
          {
            schema: {
              "$comment": "Override",
              "type": "string",
              "description": "a string that will be decoded as JSON"
            }
          }
        )
      })
    })

    it("Uint8ArrayFromHex", async () => {
      await assertDraft07(
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

    it("Uint8ArrayFromBase64", async () => {
      await assertDraft07(
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

    it("Uint8ArrayFromBase64Url", async () => {
      await assertDraft07(
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
      it("isInt", async () => {
        await assertDraft2020_12(
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

      it("isInt32", async () => {
        await assertDraft2020_12(
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

      it("isUint32", async () => {
        await assertDraft2020_12(
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

      it("isBase64", async () => {
        await assertDraft2020_12(
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

      it("isBase64Url", async () => {
        await assertDraft2020_12(
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
      it("top level fromJsonString", async () => {
        await assertDraft2020_12(
          Schema.fromJsonString(Schema.FiniteFromString),
          {
            schema: {
              "$comment": "Override",
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

      it("nested fromJsonString", async () => {
        await assertDraft2020_12(
          Schema.fromJsonString(Schema.Struct({
            a: Schema.fromJsonString(Schema.FiniteFromString)
          })),
          {
            schema: {
              "$comment": "Override",
              "type": "string",
              "description": "a string that will be decoded as JSON",
              "contentMediaType": "application/json",
              "contentSchema": {
                "type": "object",
                "properties": {
                  "a": {
                    "$comment": "Override",
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
    describe("checks", () => {
      it("isInt", async () => {
        await assertOpenApi3_1(
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

      it("isInt32", async () => {
        await assertOpenApi3_1(
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

      it("isUint32", async () => {
        await assertOpenApi3_1(
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

      it("isBase64", async () => {
        await assertOpenApi3_1(
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

      it("isBase64Url", async () => {
        await assertOpenApi3_1(
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
  })
})
