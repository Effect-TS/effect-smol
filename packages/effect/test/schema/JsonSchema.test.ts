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
      it("String", async () => {
        await assertDraft7(
          Schema.String,
          {
            schema: {
              type: "string"
            }
          }
        )
      })

      it("String & identifier", async () => {
        await assertDraft7(
          Schema.String.annotate({ identifier: "ID" }),
          {
            schema: {
              $ref: "#/definitions/ID"
            },
            definitions: {
              ID: {
                type: "string"
              }
            }
          }
        )
      })

      it("String & json annotations", async () => {
        await assertDraft7(
          Schema.String.annotate({
            title: "title",
            description: "description",
            default: "",
            examples: ["", "a", "aa"]
          }),
          {
            schema: {
              type: "string",
              title: "title",
              description: "description",
              default: "",
              examples: ["", "a", "aa"]
            }
          }
        )
      })

      it("String & json annotations + identifier", async () => {
        await assertDraft7(
          Schema.String.annotate({
            title: "title",
            description: "description",
            default: "",
            examples: ["", "a", "aa"],
            identifier: "ID"
          }),
          {
            schema: {
              $ref: "#/definitions/ID"
            },
            definitions: {
              ID: {
                type: "string",
                title: "title",
                description: "description",
                default: "",
                examples: ["", "a", "aa"]
              }
            }
          }
        )
      })

      it("should ignore the key json annotations if the schema is not contextual", async () => {
        await assertDraft7(
          Schema.String.annotateKey({
            title: "title",
            description: "description",
            default: "",
            examples: ["", "a", "aa"]
          }),
          {
            schema: {
              type: "string"
            }
          }
        )
      })

      it("String & check", async () => {
        await assertDraft7(
          Schema.String.check(Schema.isMinLength(2)),
          {
            schema: {
              type: "string",
              allOf: [
                {
                  $comment: "Filter",
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
        await assertDraft7(
          Schema.String.check(Schema.isMinLength(2, { identifier: "ID" })),
          {
            schema: {
              $ref: "#/definitions/ID"
            },
            definitions: {
              ID: {
                type: "string",
                allOf: [
                  {
                    $comment: "Filter",
                    title: "isMinLength(2)",
                    description: "a value with a length of at least 2",
                    minLength: 2
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
            title: "title",
            description: "description",
            default: "", // invalid default
            examples: [
              "a", // invalid example
              "aa",
              "aaa"
            ]
          }).check(Schema.isMinLength(2)),
          {
            schema: {
              type: "string",
              title: "title",
              description: "description",
              examples: ["aa", "aaa"],
              allOf: [
                {
                  $comment: "Filter",
                  title: "isMinLength(2)",
                  description: "a value with a length of at least 2",
                  minLength: 2
                }
              ]
            }
          }
        )

        await assertDraft7(
          Schema.String.annotate({
            default: "aa" // valid default
          }).check(Schema.isMinLength(2)),
          {
            schema: {
              type: "string",
              default: "aa",
              allOf: [
                {
                  $comment: "Filter",
                  title: "isMinLength(2)",
                  description: "a value with a length of at least 2",
                  minLength: 2
                }
              ]
            }
          }
        )
      })

      it("String & json annotations & check & identifier", async () => {
        await assertDraft7(
          Schema.String.annotate({
            title: "title",
            description: "description",
            default: "", // invalid default
            examples: [
              "a", // invalid example
              "aa",
              "aaa"
            ]
          }).check(Schema.isMinLength(2, { identifier: "ID" })),
          {
            schema: {
              $ref: "#/definitions/ID"
            },
            definitions: {
              ID: {
                type: "string",
                title: "title",
                description: "description",
                examples: [
                  "aa",
                  "aaa"
                ],
                allOf: [
                  {
                    $comment: "Filter",
                    title: "isMinLength(2)",
                    description: "a value with a length of at least 2",
                    minLength: 2
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
            title: "title",
            description: "description",
            default: "", // invalid default
            examples: [
              "", // invalid example
              "a", // invalid example
              "aa",
              "aaa"
            ]
          }),
          {
            schema: {
              type: "string",
              allOf: [
                {
                  $comment: "Filter",
                  title: "title",
                  description: "description",
                  examples: ["aa", "aaa"],
                  minLength: 2
                }
              ]
            }
          }
        )

        await assertDraft7(
          Schema.String.check(Schema.isMinLength(2)).annotate({
            default: "aa" // valid default
          }),
          {
            schema: {
              type: "string",
              allOf: [
                {
                  $comment: "Filter",
                  title: "isMinLength(2)",
                  description: "a value with a length of at least 2",
                  default: "aa",
                  minLength: 2
                }
              ]
            }
          }
        )
      })

      it("String & check & json annotations + identifier", async () => {
        await assertDraft7(
          Schema.String.check(Schema.isMinLength(2)).annotate({
            title: "title",
            description: "description",
            default: "", // invalid default
            examples: [
              "", // invalid example
              "a", // invalid example
              "aa",
              "aaa"
            ],
            identifier: "ID"
          }),
          {
            schema: {
              $ref: "#/definitions/ID"
            },
            definitions: {
              ID: {
                type: "string",
                allOf: [
                  {
                    $comment: "Filter",
                    title: "title",
                    description: "description",
                    examples: ["aa", "aaa"],
                    minLength: 2
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
              type: "string",
              allOf: [
                {
                  $comment: "Filter",
                  title: "isMinLength(2)",
                  description: "a value with a length of at least 2",
                  minLength: 2
                },
                {
                  $comment: "Filter",
                  title: "isMaxLength(3)",
                  description: "a value with a length of at most 3",
                  maxLength: 3
                }
              ]
            }
          }
        )
      })

      it("String & check & check & json annotations", async () => {
        await assertDraft7(
          Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(3)).annotate({
            title: "title",
            description: "description",
            default: "", // invalid default
            examples: [
              "", // invalid example
              "a", // invalid example
              "aa",
              "aaa",
              "aaaa" // invalid example
            ]
          }),
          {
            schema: {
              type: "string",
              allOf: [
                {
                  $comment: "Filter",
                  title: "isMinLength(2)",
                  description: "a value with a length of at least 2",
                  minLength: 2
                },
                {
                  $comment: "Filter",
                  title: "title",
                  description: "description",
                  maxLength: 3,
                  examples: ["aa", "aaa"]
                }
              ]
            }
          }
        )

        await assertDraft7(
          Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(3)).annotate({
            default: "aa" // valid default
          }),
          {
            schema: {
              type: "string",
              allOf: [
                {
                  $comment: "Filter",
                  title: "isMinLength(2)",
                  description: "a value with a length of at least 2",
                  minLength: 2
                },
                {
                  $comment: "Filter",
                  title: "isMaxLength(3)",
                  description: "a value with a length of at most 3",
                  maxLength: 3,
                  default: "aa"
                }
              ]
            }
          }
        )
      })
    })

    describe("Struct", () => {
      it("required property", async () => {
        const Id3 = Schema.String.annotate({ identifier: "id3" })
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String.annotate({ description: "b" }),
          c: Schema.String.annotateKey({ description: "c-key" }),
          d: Schema.String.annotate({ description: "d" }).annotateKey({ description: "d-key" }),
          id1: Schema.String.annotate({ identifier: "id1" }),
          id2: Schema.String.annotate({ identifier: "id2" }).annotateKey({ description: "id2-key" }),
          id3_1: Id3.annotateKey({ description: "id3_1-key" }),
          id3_2: Id3.annotateKey({ description: "id3_2-key" })
        })
        await assertDraft7(schema, {
          schema: {
            type: "object",
            properties: {
              a: {
                type: "string"
              },
              b: {
                type: "string",
                description: "b"
              },
              c: {
                type: "string",
                allOf: [{
                  $comment: "key annotations",
                  description: "c-key"
                }]
              },
              d: {
                type: "string",
                description: "d",
                allOf: [{
                  $comment: "key annotations",
                  description: "d-key"
                }]
              },
              id1: { "$ref": "#/definitions/id1" },
              id2: {
                allOf: [
                  { "$ref": "#/definitions/id2" },
                  {
                    $comment: "key annotations",
                    description: "id2-key"
                  }
                ]
              },
              id3_1: {
                allOf: [
                  { "$ref": "#/definitions/id3" },
                  {
                    $comment: "key annotations",
                    description: "id3_1-key"
                  }
                ]
              },
              id3_2: {
                allOf: [
                  { "$ref": "#/definitions/id3" },
                  {
                    $comment: "key annotations",
                    description: "id3_2-key"
                  }
                ]
              }
            },
            required: ["a", "b", "c", "d", "id1", "id2", "id3_1", "id3_2"],
            additionalProperties: false
          },
          definitions: {
            id1: { type: "string" },
            id2: { type: "string" },
            id3: { type: "string" }
          }
        })
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
              type: "object",
              properties: {
                a: { type: "string" }
              },
              required: [],
              additionalProperties: false
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
              type: "object",
              properties: {
                a: { type: "string" }
              },
              required: [],
              additionalProperties: false
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
              type: "object",
              properties: {
                a: { type: "string" }
              },
              required: ["a"],
              additionalProperties: false
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
              type: "object",
              properties: {
                a: { type: "string" }
              },
              required: ["a"],
              additionalProperties: false
            }
          }
        )
      })

      it("optional properties", async () => {
        const schema = Schema.Struct({
          a: Schema.optional(Schema.String),
          b: Schema.optional(Schema.String.annotate({ description: "b" })),
          c: Schema.optional(Schema.String).annotate({ description: "c" }),
          d: Schema.optional(Schema.String).annotateKey({ description: "d-key" }),
          e: Schema.optional(Schema.String.annotate({ description: "e" })).annotateKey({ description: "e-key" })
        })
        await assertDraft7(schema, {
          schema: {
            type: "object",
            properties: {
              a: {
                type: "string"
              },
              b: {
                type: "string",
                description: "b"
              },
              c: {
                type: "string",
                description: "c"
              },
              d: {
                type: "string",
                allOf: [{
                  $comment: "key annotations",
                  description: "d-key"
                }]
              },
              e: {
                type: "string",
                description: "e",
                allOf: [{
                  $comment: "key annotations",
                  description: "e-key"
                }]
              }
            },
            required: [],
            additionalProperties: false
          }
        })
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
              type: "object",
              properties: {
                a: { type: "string" }
              },
              required: ["a"],
              additionalProperties: false
            }
          }
        )
      })
    })

    describe("Union", () => {
      it("String | Number", async () => {
        await assertDraft7(
          Schema.Union([Schema.String, Schema.Number]),
          {
            schema: {
              anyOf: [
                { type: "string" },
                { type: "number" }
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
              type: "number",
              description: "description",
              allOf: [
                {
                  $comment: "Filter",
                  type: "integer",
                  description: "an integer",
                  title: "isInt"
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
              type: "number",
              description: "description",
              allOf: [
                {
                  $comment: "FilterGroup",
                  description: "a 32-bit integer",
                  title: "isInt32",
                  allOf: [
                    {
                      $comment: "Filter",
                      type: "integer",
                      description: "an integer",
                      title: "isInt"
                    },
                    {
                      $comment: "Filter",
                      description: "a value between -2147483648 and 2147483647",
                      maximum: 2147483647,
                      minimum: -2147483648,
                      title: "isBetween(-2147483648, 2147483647)"
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
              type: "number",
              description: "description",
              allOf: [
                {
                  $comment: "FilterGroup",
                  description: "a 32-bit unsigned integer",
                  title: "isUint32",
                  allOf: [
                    {
                      $comment: "Filter",
                      type: "integer",
                      description: "an integer",
                      title: "isInt"
                    },
                    {
                      $comment: "Filter",
                      description: "a value between 0 and 4294967295",
                      maximum: 4294967295,
                      minimum: 0,
                      title: "isBetween(0, 4294967295)"
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
              type: "string",
              description: "description",
              allOf: [
                {
                  $comment: "Filter",
                  description: "a base64 encoded string",
                  title: "isBase64",
                  pattern: "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$"
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
              type: "string",
              description: "description",
              allOf: [
                {
                  $comment: "Filter",
                  description: "a base64url encoded string",
                  title: "isBase64Url",
                  pattern: "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$"
                }
              ]
            }
          }
        )
      })
    })
  })

  describe("draft-2020-12", () => {
    describe("checks", () => {
      it("isInt", async () => {
        await assertDraft2020_12(
          Schema.Number.annotate({ description: "description" }).check(Schema.isInt()),
          {
            schema: {
              type: "number",
              description: "description",
              allOf: [
                {
                  $comment: "Filter",
                  type: "integer",
                  description: "an integer",
                  title: "isInt"
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
              type: "number",
              description: "description",
              allOf: [
                {
                  $comment: "FilterGroup",
                  description: "a 32-bit integer",
                  title: "isInt32",
                  allOf: [
                    {
                      $comment: "Filter",
                      type: "integer",
                      description: "an integer",
                      title: "isInt"
                    },
                    {
                      $comment: "Filter",
                      description: "a value between -2147483648 and 2147483647",
                      maximum: 2147483647,
                      minimum: -2147483648,
                      title: "isBetween(-2147483648, 2147483647)"
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
              type: "number",
              description: "description",
              allOf: [
                {
                  $comment: "FilterGroup",
                  description: "a 32-bit unsigned integer",
                  title: "isUint32",
                  allOf: [
                    {
                      $comment: "Filter",
                      type: "integer",
                      description: "an integer",
                      title: "isInt"
                    },
                    {
                      $comment: "Filter",
                      description: "a value between 0 and 4294967295",
                      maximum: 4294967295,
                      minimum: 0,
                      title: "isBetween(0, 4294967295)"
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
              type: "string",
              description: "description",
              allOf: [
                {
                  $comment: "Filter",
                  contentEncoding: "base64",
                  description: "a base64 encoded string",
                  title: "isBase64",
                  pattern: "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$"
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
              type: "string",
              description: "description",
              allOf: [
                {
                  $comment: "Filter",
                  contentEncoding: "base64",
                  description: "a base64url encoded string",
                  title: "isBase64Url",
                  pattern: "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$"
                }
              ]
            }
          }
        )
      })
    })

    describe("fromJsonString", () => {
      it.todo("top level fromJsonString", async () => {
        await assertDraft2020_12(
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
    })
  })

  describe("openApi3.1", () => {
    describe("checks", () => {
      it("isInt", async () => {
        await assertOpenApi3_1(
          Schema.Number.annotate({ description: "description" }).check(Schema.isInt()),
          {
            schema: {
              type: "number",
              description: "description",
              allOf: [
                {
                  $comment: "Filter",
                  type: "integer",
                  description: "an integer",
                  title: "isInt"
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
              type: "number",
              description: "description",
              allOf: [
                {
                  $comment: "FilterGroup",
                  description: "a 32-bit integer",
                  title: "isInt32",
                  allOf: [
                    {
                      $comment: "Filter",
                      type: "integer",
                      description: "an integer",
                      title: "isInt"
                    },
                    {
                      $comment: "Filter",
                      description: "a value between -2147483648 and 2147483647",
                      maximum: 2147483647,
                      minimum: -2147483648,
                      title: "isBetween(-2147483648, 2147483647)"
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
              type: "number",
              description: "description",
              allOf: [
                {
                  $comment: "FilterGroup",
                  description: "a 32-bit unsigned integer",
                  title: "isUint32",
                  allOf: [
                    {
                      $comment: "Filter",
                      type: "integer",
                      description: "an integer",
                      title: "isInt"
                    },
                    {
                      $comment: "Filter",
                      description: "a value between 0 and 4294967295",
                      maximum: 4294967295,
                      minimum: 0,
                      title: "isBetween(0, 4294967295)"
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
              type: "string",
              description: "description",
              allOf: [
                {
                  $comment: "Filter",
                  contentEncoding: "base64",
                  description: "a base64 encoded string",
                  title: "isBase64",
                  pattern: "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$"
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
              type: "string",
              description: "description",
              allOf: [
                {
                  $comment: "Filter",
                  contentEncoding: "base64",
                  description: "a base64url encoded string",
                  title: "isBase64Url",
                  pattern: "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$"
                }
              ]
            }
          }
        )
      })
    })
  })
})
