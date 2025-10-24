import type { Options as AjvOptions } from "ajv"
// eslint-disable-next-line import-x/no-named-as-default
import Ajv from "ajv"
import { Schema } from "effect/schema"
import { describe, it } from "vitest"
import { assertFalse, assertTrue, deepStrictEqual, strictEqual, throws } from "../utils/assert.ts"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Ajv2020 = require("ajv/dist/2020")

const ajvOptions: Ajv.Options = {
  strictTuples: false,
  allowMatchingProperties: true
}

function getAjvValidate(jsonSchema: object): Ajv.ValidateFunction {
  return new Ajv.default(ajvOptions).compile(jsonSchema)
}

const baseAjvOptions: AjvOptions = {
  allErrors: true,
  strict: false, // warns/throws on unknown keywords depending on Ajv version
  validateSchema: true,
  code: { esm: true } // optional
}

const ajvDraft7 = new Ajv.default(baseAjvOptions)
const ajv2020 = new Ajv2020.default(baseAjvOptions)

async function assertDraft7<S extends Schema.Top>(
  schema: S,
  expected: { schema: object; definitions?: Record<string, object> },
  options?: Schema.JsonSchemaOptions
) {
  const { definitions, jsonSchema, uri } = Schema.makeJsonSchemaDraft07(schema, options)
  strictEqual(uri, "http://json-schema.org/draft-07/schema")
  deepStrictEqual(jsonSchema, expected.schema)
  deepStrictEqual(definitions, expected.definitions ?? {})
  const valid = ajvDraft7.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
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
  const valid = ajv2020.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
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
  const valid = ajv2020.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajv2020.errors, null)
  return jsonSchema
}

export function assertAjvDraft7Success<S extends Schema.Top>(
  schema: S,
  input: S["Type"]
) {
  const jsonSchema = Schema.makeJsonSchemaDraft07(schema)
  const validate = getAjvValidate(jsonSchema)
  assertTrue(validate(input))
}

export function assertAjvDraft7Failure<S extends Schema.Top>(
  schema: S,
  input: unknown
) {
  const jsonSchema = Schema.makeJsonSchemaDraft07(schema)
  const validate = getAjvValidate(jsonSchema)
  assertFalse(validate(input))
}

export function expectError(schema: Schema.Top, message: string, options?: Schema.JsonSchemaOptions) {
  throws(() => Schema.makeJsonSchemaDraft07(schema, options), new Error(message))
}

describe("ToJsonSchema", () => {
  describe("Unsupported schemas", () => {
    it("Declaration", async () => {
      expectError(
        Schema.instanceOf(globalThis.URL),
        `cannot generate JSON Schema for Declaration at root`
      )
    })

    it("Undefined", async () => {
      expectError(
        Schema.Undefined,
        `cannot generate JSON Schema for Undefined at root`
      )
    })

    it("BigInt", async () => {
      expectError(
        Schema.BigInt,
        `cannot generate JSON Schema for BigInt at root`
      )
    })

    it("UniqueSymbol", async () => {
      expectError(
        Schema.UniqueSymbol(Symbol.for("effect/Schema/test/a")),
        `cannot generate JSON Schema for UniqueSymbol at root`
      )
    })

    it("Symbol", async () => {
      expectError(
        Schema.Symbol,
        `cannot generate JSON Schema for Symbol at root`
      )
    })

    it("Literal(bigint)", () => {
      expectError(
        Schema.Literal(1n),
        `cannot generate JSON Schema for Literal at root`
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
      expectError(
        schema,
        "cannot generate JSON Schema for Suspend at [\"as\"][0], required `identifier` annotation"
      )
    })

    describe("Tuple", () => {
      it("Unsupported element", () => {
        expectError(
          Schema.Tuple([Schema.Symbol]),
          `cannot generate JSON Schema for Symbol at [0]`
        )
      })

      it("Unsupported post-rest elements", () => {
        expectError(
          Schema.TupleWithRest(Schema.Tuple([]), [Schema.Number, Schema.String]),
          "Generating a JSON Schema for post-rest elements is not currently supported. You're welcome to contribute by submitting a Pull Request"
        )
      })
    })

    describe("Struct", () => {
      it("Unsupported field", () => {
        expectError(
          Schema.Struct({ a: Schema.Symbol }),
          `cannot generate JSON Schema for Symbol at ["a"]`
        )
      })

      it("Unsupported property signature key", () => {
        const a = Symbol.for("effect/Schema/test/a")
        expectError(
          Schema.Struct({ [a]: Schema.String }),
          `cannot generate JSON Schema for Objects at [Symbol(effect/Schema/test/a)]`
        )
      })

      it("Unsupported index signature parameter", () => {
        expectError(
          Schema.Record(Schema.Symbol, Schema.Number),
          `cannot generate JSON Schema for Symbol at root`
        )
      })
    })

    describe("onMissingJsonSchemaAnnotation", () => {
      it("when returns a JSON Schema", async () => {
        await assertDraft7(
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
        expectError(
          Schema.Date,
          `cannot generate JSON Schema for Declaration at root`,
          {
            onMissingJsonSchemaAnnotation: () => undefined
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
        await assertDraft7(
          Schema.String,
          {
            schema: {
              "type": "string"
            }
          }
        )
        await assertDraft7(
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

      it("String & override", async () => {
        await assertDraft7(
          Schema.String.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string", minLength: 1 })
            }
          }),
          {
            schema: {
              "$comment": "Override",
              "type": "string",
              "minLength": 1
            }
          }
        )
        await assertDraft7(
          Schema.String.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string", minLength: 1 })
            },
            ...jsonAnnotations
          }),
          {
            schema: {
              "$comment": "Override",
              "type": "string",
              "minLength": 1,
              ...jsonAnnotations
            }
          }
        )
      })

      it("String & identifier", async () => {
        await assertDraft7(
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
        await assertDraft7(
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

      it("String & identifier & override", async () => {
        await assertDraft7(
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
        await assertDraft7(
          Schema.String.annotate({
            identifier: "ID",
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string", minLength: 1 })
            },
            ...jsonAnnotations
          }),
          {
            schema: {
              "$ref": "#/definitions/ID"
            },
            definitions: {
              "ID": {
                "$comment": "Override",
                "type": "string",
                minLength: 1,
                ...jsonAnnotations
              }
            }
          }
        )
      })

      it("should ignore the key json annotations if the schema is not contextual", async () => {
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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

      it("String & check & override", async () => {
        await assertDraft7(
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

      it("String & check & identifier", async () => {
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
      await assertDraft7(
        Schema.Void,
        {
          schema: {}
        }
      )
    })

    it("Unknown", async () => {
      await assertDraft7(
        Schema.Unknown,
        {
          schema: {}
        }
      )
    })

    it("Any", async () => {
      await assertDraft7(
        Schema.Any,
        {
          schema: {}
        }
      )
    })

    it("Never", async () => {
      await assertDraft7(
        Schema.Never,
        {
          schema: {
            "not": {}
          }
        }
      )
    })

    it("Null", async () => {
      await assertDraft7(
        Schema.Null,
        {
          schema: {
            "type": "null"
          }
        }
      )
    })

    it("Number", async () => {
      await assertDraft7(
        Schema.Number,
        {
          schema: {
            "type": "number"
          }
        }
      )
    })

    it("Boolean", async () => {
      await assertDraft7(
        Schema.Boolean,
        {
          schema: {
            "type": "boolean"
          }
        }
      )
    })

    it("ObjectKeyword", async () => {
      await assertDraft7(
        Schema.ObjectKeyword,
        {
          schema: {
            "anyOf": [
              { "type": "object" },
              { "type": "array" }
            ]
          }
        }
      )
    })

    describe("Literal", () => {
      it("string", async () => {
        await assertDraft7(
          Schema.Literal("a"),
          {
            schema: {
              "type": "string",
              "enum": ["a"]
            }
          }
        )
      })

      it("string & annotate", async () => {
        await assertDraft7(
          Schema.Literal("a").annotate({
            title: "title",
            description: "description",
            default: "a",
            examples: ["a"]
          }),
          {
            schema: {
              "type": "string",
              "enum": ["a"],
              "title": "title",
              "description": "description",
              "default": "a",
              "examples": ["a"]
            }
          }
        )
      })

      it("number", async () => {
        await assertDraft7(
          Schema.Literal(1),
          {
            schema: {
              "type": "number",
              "enum": [1]
            }
          }
        )
      })

      it("number & annotate", async () => {
        await assertDraft7(
          Schema.Literal(1).annotate({
            title: "title",
            description: "description",
            default: 1,
            examples: [1]
          }),
          {
            schema: {
              "type": "number",
              "enum": [1],
              "title": "title",
              "description": "description",
              "default": 1,
              "examples": [1]
            }
          }
        )
      })

      it("boolean", async () => {
        await assertDraft7(
          Schema.Literal(true),
          {
            schema: {
              "type": "boolean",
              "enum": [true]
            }
          }
        )
      })

      it("boolean & annotate", async () => {
        await assertDraft7(
          Schema.Literal(true).annotate({
            title: "title",
            description: "description",
            default: true,
            examples: [true]
          }),
          {
            schema: {
              "type": "boolean",
              "enum": [true],
              "title": "title",
              "description": "description",
              "default": true,
              "examples": [true]
            }
          }
        )
      })
    })

    describe("Literals", () => {
      it("strings", async () => {
        await assertDraft7(
          Schema.Literals(["a", "b"]),
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
      })

      it("strings & annotate", async () => {
        await assertDraft7(
          Schema.Literals(["a", "b"]).annotate({ description: "description" }),
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
              "description": "description"
            }
          }
        )
      })

      it("numbers", async () => {
        await assertDraft7(
          Schema.Literals([1, 2]),
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
      })

      it("booleans", async () => {
        await assertDraft7(
          Schema.Literals([true, false]),
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
      })

      it("strings & numbers", async () => {
        await assertDraft7(
          Schema.Literals(["a", 1]),
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
      })
    })

    describe("Union of literals", () => {
      it("strings", async () => {
        await assertDraft7(
          Schema.Union([
            Schema.Literal("a"),
            Schema.Literal("b")
          ]),
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
      })

      it("strings & outer annotate", async () => {
        await assertDraft7(
          Schema.Union([
            Schema.Literal("a"),
            Schema.Literal("b")
          ]).annotate({ description: "description" }),
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
              "description": "description"
            }
          }
        )
      })

      it("strings & inner annotate", async () => {
        await assertDraft7(
          Schema.Union([
            Schema.Literal("a"),
            Schema.Literal("b").annotate({ description: "description" })
          ]),
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
                  "description": "description"
                }
              ]
            }
          }
        )
      })

      it("strings & inner annotate & outer annotate", async () => {
        await assertDraft7(
          Schema.Union([
            Schema.Literal("a"),
            Schema.Literal("b").annotate({ description: "inner-description" })
          ]).annotate({ description: "outer-description" }),
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
                  "description": "inner-description"
                }
              ],
              "description": "outer-description"
            }
          }
        )
      })

      it("numbers", async () => {
        await assertDraft7(
          Schema.Union([Schema.Literal(1), Schema.Literal(2)]),
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
      })

      it("booleans", async () => {
        await assertDraft7(
          Schema.Union([Schema.Literal(true), Schema.Literal(false)]),
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
      })

      it("strings & numbers", async () => {
        await assertDraft7(
          Schema.Union([Schema.Literal("a"), Schema.Literal(1)]),
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
      })
    })

    describe("Enum", () => {
      it("empty enum", async () => {
        enum Empty {}
        await assertDraft7(
          Schema.Enum(Empty),
          {
            schema: {
              "not": {}
            }
          }
        )
        await assertDraft7(
          Schema.Enum(Empty).annotate({ description: "description" }),
          {
            schema: {
              "not": {},
              "description": "description"
            }
          }
        )
      })

      it("single enum", async () => {
        enum Fruits {
          Apple
        }
        await assertDraft7(
          Schema.Enum(Fruits),
          {
            schema: {
              "type": "number",
              "enum": [0],
              "title": "Apple"
            }
          }
        )
        await assertDraft7(
          Schema.Enum(Fruits).annotate({ description: "description" }),
          {
            schema: {
              "type": "number",
              "enum": [0],
              "title": "Apple",
              "description": "description"
            }
          }
        )
      })

      it("many enums", async () => {
        enum Fruits {
          Apple,
          Banana,
          Orange = "orange"
        }

        await assertDraft7(
          Schema.Enum(Fruits),
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
      })

      it("Enum & annotate", async () => {
        enum Fruits {
          Apple,
          Banana,
          Orange = "orange"
        }

        await assertDraft7(
          Schema.Enum(Fruits).annotate({
            title: "title",
            description: "description",
            default: Fruits.Apple,
            examples: [Fruits.Banana, Fruits.Orange]
          }),
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
              "title": "title",
              "description": "description",
              "default": Fruits.Apple,
              "examples": [Fruits.Banana, Fruits.Orange]
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
        await assertDraft7(Schema.Enum(Fruits), {
          schema: {
            "anyOf": [
              { "type": "string", "title": "Apple", "enum": ["apple"] },
              { "type": "string", "title": "Banana", "enum": ["banana"] },
              { "type": "number", "title": "Cantaloupe", "enum": [3] }
            ]
          }
        })
      })

      it("enum & identifier", async () => {
        enum Fruits {
          Apple
        }
        await assertDraft7(Schema.Enum(Fruits).annotate({ identifier: "ID", title: "title" }), {
          schema: {
            "$ref": "#/definitions/ID"
          },
          definitions: {
            "ID": {
              "type": "number",
              "title": "title",
              "enum": [0]
            }
          }
        })
      })
    })

    describe("TemplateLiteral", () => {
      it("TemplateLiteral", async () => {
        await assertDraft7(Schema.TemplateLiteral(["a", Schema.String]), {
          schema: {
            "type": "string",
            "pattern": "^(a)([\\s\\S]*?)$"
          }
        })
      })

      it("TemplateLiteral & annotate", async () => {
        await assertDraft7(
          Schema.TemplateLiteral(["a", Schema.String]).annotate({
            title: "title",
            description: "description",
            default: "a",
            examples: ["a"]
          }),
          {
            schema: {
              "type": "string",
              "pattern": "^(a)([\\s\\S]*?)$",
              "title": "title",
              "description": "description",
              "default": "a",
              "examples": ["a"]
            }
          }
        )
      })
    })

    describe("Struct", () => {
      it("required property", async () => {
        const Id3 = Schema.String.annotate({ identifier: "id3" })
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
                  "allOf": [{
                    "$comment": "key annotations",
                    "description": "d-key"
                  }]
                },
                "e": {
                  "type": "string",
                  "description": "e",
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
        await assertDraft7(
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
                  "type": "string"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        )
      })
    })

    describe("Tuple", () => {
      it("empty tuple", async () => {
        await assertDraft7(
          Schema.Tuple([]).annotate({ description: "description" }),
          {
            schema: {
              "type": "array",
              "items": false,
              "description": "description"
            }
          }
        )
      })

      it("required elements", async () => {
        await assertDraft7(
          Schema.Tuple([
            Schema.String,
            Schema.String.annotate({ description: "1" }),
            Schema.String.annotate({ description: "2-inner" }).annotateKey({ description: "2-outer" }),
            Schema.String.annotateKey({ default: "d", examples: ["d"] })
          ]).annotate({ description: "tuple-description" }),
          {
            schema: {
              "type": "array",
              "items": [
                {
                  "type": "string"
                },
                {
                  "type": "string",
                  "description": "1"
                },
                {
                  "type": "string",
                  "description": "2-inner",
                  "allOf": [{
                    "$comment": "key annotations",
                    "description": "2-outer"
                  }]
                },
                {
                  "type": "string",
                  "allOf": [{
                    "$comment": "key annotations",
                    "default": "d",
                    "examples": ["d"]
                  }]
                }
              ],
              "additionalItems": false,
              "description": "tuple-description"
            }
          }
        )
      })

      it("optionalKey elements", async () => {
        await assertDraft7(
          Schema.Tuple([
            Schema.optionalKey(Schema.String),
            Schema.optionalKey(Schema.String.annotate({ description: "b" })),
            Schema.optionalKey(
              Schema.String.annotate({ description: "c-inner" }).annotateKey({ description: "c-outer" })
            ),
            Schema.optionalKey(Schema.String.annotate({ description: "d-inner" })).annotateKey({
              description: "d-outer"
            })
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
                  "description": "c-inner",
                  "allOf": [{
                    "$comment": "key annotations",
                    "description": "c-outer"
                  }]
                },
                {
                  "type": "string",
                  "description": "d-inner",
                  "allOf": [{
                    "$comment": "key annotations",
                    "description": "d-outer"
                  }]
                }
              ],
              "minItems": 0,
              "additionalItems": false
            }
          }
        )
      })

      it("optional elements", async () => {
        await assertDraft7(
          Schema.Tuple([
            Schema.optional(Schema.String),
            Schema.optional(Schema.String.annotate({ description: "description-1" })),
            Schema.optional(Schema.String.annotate({ description: "description-2-inner" })).annotateKey({
              description: "description-2-outer"
            })
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
                  "description": "description-1"
                },
                {
                  "type": "string",
                  "description": "description-2-inner",
                  "allOf": [{
                    "$comment": "key annotations",
                    "description": "description-2-outer"
                  }]
                }
              ],
              "minItems": 0,
              "additionalItems": false
            }
          }
        )
      })

      it("UndefinedOr elements", async () => {
        const schema = Schema.Tuple([
          Schema.String,
          Schema.UndefinedOr(Schema.String),
          Schema.UndefinedOr(Schema.String.annotate({ description: "2-description" })),
          Schema.UndefinedOr(Schema.String.annotate({ description: "3-inner" })).annotate({ description: "3-outer" }),
          Schema.UndefinedOr(Schema.String.annotate({ description: "4-inner" })).annotateKey({
            description: "4-outer"
          })
        ])
        await assertDraft7(schema, {
          schema: {
            "type": "array",
            "items": [
              {
                "type": "string"
              },
              {
                "type": "string"
              },
              {
                "type": "string",
                "description": "2-description"
              },
              {
                "type": "string",
                "description": "3-outer"
              },
              {
                "type": "string",
                "description": "4-inner",
                "allOf": [{
                  "$comment": "key annotations",
                  "description": "4-outer"
                }]
              }
            ],
            "minItems": 1,
            "additionalItems": false
          }
        })
      })
    })

    describe("Union", () => {
      it("String | Number", async () => {
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
        await assertDraft7(
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
      await assertDraft7(
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
      await assertDraft7(
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
      await assertDraft7(
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
