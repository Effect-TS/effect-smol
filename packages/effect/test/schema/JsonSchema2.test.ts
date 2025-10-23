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
  expected: object,
  options?: Schema.JsonSchemaOptions
) {
  const { jsonSchema, uri } = Schema.makeJsonSchemaDraft2020_12(schema, options)
  strictEqual(uri, "https://json-schema.org/draft/2020-12/schema")
  deepStrictEqual(jsonSchema, expected)
  const valid = ajv2020.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
  return jsonSchema
}

export async function assertOpenApi3_1<S extends Schema.Top>(
  schema: S,
  expected: object,
  options?: Schema.JsonSchemaOptions
) {
  const { jsonSchema, uri } = Schema.makeJsonSchemaOpenApi3_1(schema, options)
  strictEqual(uri, "https://json-schema.org/draft/2020-12/schema")
  deepStrictEqual(jsonSchema, expected)
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
        `cannot generate JSON Schema for <Declaration> at root`
      )
    })

    it("Undefined", async () => {
      expectError(
        Schema.Undefined,
        `cannot generate JSON Schema for undefined at root`
      )
    })

    it("BigInt", async () => {
      expectError(
        Schema.BigInt,
        `cannot generate JSON Schema for bigint at root`
      )
    })

    it("UniqueSymbol", async () => {
      expectError(
        Schema.UniqueSymbol(Symbol.for("effect/Schema/test/a")),
        `cannot generate JSON Schema for Symbol(effect/Schema/test/a) at root`
      )
    })

    it("Symbol", async () => {
      expectError(
        Schema.Symbol,
        `cannot generate JSON Schema for symbol at root`
      )
    })

    it("Literal(bigint)", () => {
      expectError(
        Schema.Literal(1n),
        `cannot generate JSON Schema for Literal at root`
      )
    })

    it("Suspend", () => {
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
          `cannot generate JSON Schema for symbol at [0]`
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
          `cannot generate JSON Schema for symbol at ["a"]`
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
        const schema = Schema.Date
        await assertDraft7(schema, { schema: {} }, {
          onMissingJsonSchemaAnnotation: () => ({})
        })
      })

      it("when returns undefined", async () => {
        const schema = Schema.Date
        expectError(
          schema,
          `cannot generate JSON Schema for Date at root`,
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
        const schema = Schema.String
        await assertDraft7(
          schema,
          {
            schema: {
              type: "string"
            }
          }
        )
      })

      it("String & annotate", async () => {
        const schema = Schema.String.annotate({
          title: "title",
          description: "description",
          default: "",
          examples: ["", "a", "aa", "aaa", "aaaa"]
        })
        await assertDraft7(schema, {
          schema: {
            type: "string",
            title: "title",
            description: "description",
            default: "",
            examples: ["", "a", "aa", "aaa", "aaaa"]
          }
        })
      })

      it("String & check", async () => {
        const schema = Schema.String.check(Schema.isMinLength(2))
        await assertDraft7(schema, {
          schema: {
            type: "string",
            title: "isMinLength(2)",
            description: "a value with a length of at least 2",
            minLength: 2
          }
        })
      })

      it("String & annotate & check", async () => {
        const schema = Schema.String.annotate({
          title: "title",
          description: "description",
          default: "aa",
          examples: ["", "a", "aa", "aaa", "aaaa"]
        }).check(Schema.isMinLength(2))
        await assertDraft7(schema, {
          schema: {
            type: "string",
            title: "isMinLength(2)",
            description: "a value with a length of at least 2",
            default: "aa",
            examples: ["aa", "aaa", "aaaa"],
            minLength: 2
          }
        })
      })

      it("String & check & annotate", async () => {
        const schema = Schema.String.check(Schema.isMinLength(2)).annotate({
          title: "title",
          description: "description",
          default: "default",
          examples: ["", "a", "aa", "aaa", "aaaa"]
        })
        await assertDraft7(schema, {
          schema: {
            type: "string",
            title: "title",
            description: "description",
            default: "default",
            examples: ["aa", "aaa", "aaaa"],
            minLength: 2
          }
        })
      })

      it("String & check & check", async () => {
        const schema = Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(3))
        await assertDraft7(schema, {
          schema: {
            type: "string",
            title: "isMaxLength(3)",
            description: "a value with a length of at most 3",
            maxLength: 3,
            allOf: [
              {
                title: "isMinLength(2)",
                description: "a value with a length of at least 2",
                minLength: 2
              }
            ]
          }
        })
      })

      it("String & check & check & annotate", async () => {
        const schema = Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(3)).annotate({
          title: "title",
          description: "description",
          default: "aaa",
          examples: ["", "a", "aa", "aaa", "aaaa"]
        })
        await assertDraft7(schema, {
          schema: {
            type: "string",
            title: "title",
            description: "description",
            maxLength: 3,
            default: "aaa",
            examples: ["aa", "aaa"],
            allOf: [
              {
                title: "isMinLength(2)",
                description: "a value with a length of at least 2",
                minLength: 2
              }
            ]
          }
        })
      })

      it("String & check & remove & check & annotate", async () => {
        const schema = Schema.String.check(
          Schema.isMinLength(2, { title: undefined, description: undefined }),
          Schema.isMaxLength(3)
        ).annotate({
          title: "title",
          description: "description",
          default: "aaa",
          examples: ["", "a", "aa", "aaa", "aaaa"]
        })
        await assertDraft7(schema, {
          schema: {
            type: "string",
            title: "title",
            description: "description",
            maxLength: 3,
            minLength: 2,
            default: "aaa",
            examples: ["aa", "aaa"]
          }
        })
      })

      it("String & check & remove & check & remove", async () => {
        const schema = Schema.String.check(
          Schema.isMinLength(2, { title: undefined, description: undefined }),
          Schema.isMaxLength(3, { title: undefined, description: undefined })
        )
        await assertDraft7(schema, {
          schema: {
            type: "string",
            maxLength: 3,
            minLength: 2
          }
        })
      })
    })

    describe("Struct", () => {
      it("Struct", async () => {
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
              a: { type: "string" },
              b: { type: "string", description: "b" },
              c: { type: "string", description: "c-key" },
              d: { type: "string", description: "d-key" },
              id1: { "$ref": "#/definitions/id1" },
              id2: {
                allOf: [
                  { "$ref": "#/definitions/id2" }
                ],
                description: "id2-key"
              },
              id3_1: {
                allOf: [
                  { "$ref": "#/definitions/id3" }
                ],
                description: "id3_1-key"
              },
              id3_2: {
                allOf: [
                  { "$ref": "#/definitions/id3" }
                ],
                description: "id3_2-key"
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
    })

    describe("Union", () => {
      it("String | Number", async () => {
        const schema = Schema.Union([Schema.String, Schema.Number])
        await assertDraft7(schema, {
          schema: { anyOf: [{ type: "string" }, { type: "number" }] }
        })
      })
    })
  })
})
