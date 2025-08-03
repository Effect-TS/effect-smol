import type { Options as AjvOptions } from "ajv"
// eslint-disable-next-line import-x/no-named-as-default
import Ajv from "ajv"
import { Check, Schema, ToJsonSchema } from "effect/schema"
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
  expected: object,
  options?: ToJsonSchema.Draft07Options
) {
  const jsonSchema = ToJsonSchema.makeDraft07(schema, options)
  deepStrictEqual(jsonSchema, {
    "$schema": "http://json-schema.org/draft-07/schema",
    ...expected
  })
  const valid = ajvDraft7.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
  return jsonSchema
}

async function assertDraft202012<S extends Schema.Top>(
  schema: S,
  expected: object,
  options?: ToJsonSchema.Draft2020Options
) {
  const jsonSchema = ToJsonSchema.makeDraft2020(schema, options)
  deepStrictEqual(jsonSchema, {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    ...expected
  })
  const valid = ajv2020.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
  return jsonSchema
}

async function assertOpenApi3_1<S extends Schema.Top>(
  schema: S,
  expected: object,
  options?: ToJsonSchema.OpenApi3_1Options
) {
  const jsonSchema = ToJsonSchema.makeOpenApi3_1(schema, options)
  deepStrictEqual(jsonSchema, {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    ...expected
  })
  const valid = ajv2020.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
  return jsonSchema
}

function assertAjvDraft7Success<S extends Schema.Top>(
  schema: S,
  input: S["Type"]
) {
  const jsonSchema = ToJsonSchema.makeDraft07(schema)
  const validate = getAjvValidate(jsonSchema)
  assertTrue(validate(input))
}

function assertAjvDraft7Failure<S extends Schema.Top>(
  schema: S,
  input: unknown
) {
  const jsonSchema = ToJsonSchema.makeDraft07(schema)
  const validate = getAjvValidate(jsonSchema)
  assertFalse(validate(input))
}

describe("ToJsonSchema", () => {
  describe("Draft 07", () => {
    describe("Declaration", () => {
      it("should throw if the schema is a declaration", () => {
        const schema = Schema.Option(Schema.String)
        throws(() => ToJsonSchema.makeDraft07(schema), new Error(`cannot generate JSON Schema for Declaration at root`))
      })
    })

    describe("Void", () => {
      it("should throw if the schema is a Void", () => {
        const schema = Schema.Void
        throws(() => ToJsonSchema.makeDraft07(schema), new Error(`cannot generate JSON Schema for VoidKeyword at root`))
      })
    })

    describe("Undefined", () => {
      it("should throw if the schema is a declaration", () => {
        const schema = Schema.Undefined
        throws(
          () => ToJsonSchema.makeDraft07(schema),
          new Error(`cannot generate JSON Schema for UndefinedKeyword at root`)
        )
      })
    })

    describe("BigInt", () => {
      it("should throw if the schema is a declaration", () => {
        const schema = Schema.BigInt
        throws(
          () => ToJsonSchema.makeDraft07(schema),
          new Error(`cannot generate JSON Schema for BigIntKeyword at root`)
        )
      })
    })

    describe("Symbol", () => {
      it("should throw if the schema is a declaration", () => {
        const schema = Schema.Symbol
        throws(
          () => ToJsonSchema.makeDraft07(schema),
          new Error(`cannot generate JSON Schema for SymbolKeyword at root`)
        )
      })
    })

    describe("UniqueSymbol", () => {
      it("should throw if the schema is a declaration", () => {
        const schema = Schema.UniqueSymbol(Symbol.for("a"))
        throws(
          () => ToJsonSchema.makeDraft07(schema),
          new Error(`cannot generate JSON Schema for UniqueSymbol at root`)
        )
      })
    })

    describe("Any", () => {
      it("Any", async () => {
        const schema = Schema.Any
        await assertDraft7(schema, {})
      })

      it("Any & annotations", async () => {
        const schema = Schema.Any.annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "default",
          examples: ["a"]
        })
      })
    })

    describe("Unknown", () => {
      it("Unknown", async () => {
        const schema = Schema.Unknown
        await assertDraft7(schema, {})
      })

      it("Unknown & annotations", async () => {
        const schema = Schema.Unknown.annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "default",
          examples: ["a"]
        })
      })
    })

    describe("Never", () => {
      it("Never", async () => {
        const schema = Schema.Never
        await assertDraft7(schema, {
          not: {}
        })
      })

      it("Never & annotations", async () => {
        const schema = Schema.Never.annotate({
          title: "title",
          description: "description"
        })
        await assertDraft7(schema, {
          not: {},
          title: "title",
          description: "description"
        })
      })
    })

    describe("Null", () => {
      it("Null", async () => {
        const schema = Schema.Null
        await assertDraft7(schema, {
          type: "null"
        })
        assertAjvDraft7Success(schema, null)
        assertAjvDraft7Failure(schema, "a")
      })

      it("Null & annotations", async () => {
        const schema = Schema.Null.annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: null,
          examples: [null],
          allOf: [
            {
              type: "null"
            }
          ]
        })
        await assertDraft7(schema, {
          type: "null",
          title: "title",
          description: "description",
          documentation: "documentation",
          default: null,
          examples: [null]
        })
      })
    })

    describe("String", () => {
      it("String", async () => {
        const schema = Schema.String
        await assertDraft7(schema, {
          type: "string"
        })
        assertAjvDraft7Success(schema, "a")
        assertAjvDraft7Failure(schema, null)
      })

      it("String & annotations", async () => {
        const schema = Schema.String.annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "default",
          examples: ["a"]
        })
      })

      it("String & minLength", async () => {
        const schema = Schema.String.check(Check.minLength(1))
        await assertDraft7(schema, {
          type: "string",
          minLength: 1,
          title: "minLength(1)",
          description: "a value with a length of at least 1"
        })
      })

      it("String & minLength & maxlength", async () => {
        const schema = Schema.String.check(Check.minLength(1), Check.maxLength(2))
        await assertDraft7(schema, {
          type: "string",
          minLength: 1,
          title: "minLength(1)",
          description: "a value with a length of at least 1",
          allOf: [
            {
              description: "a value with a length of at most 2",
              maxLength: 2,
              title: "maxLength(2)"
            }
          ]
        })
      })

      it("String & annotations & minLength", async () => {
        const schema = Schema.String.annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "default",
          examples: ["a"]
        }).check(Check.minLength(1))
        await assertDraft7(schema, {
          type: "string",
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "default",
          examples: ["a"],
          allOf: [
            {
              description: "a value with a length of at least 1",
              minLength: 1,
              title: "minLength(1)"
            }
          ]
        })
      })

      it("String & minLength & annotations", async () => {
        const schema = Schema.String.check(Check.minLength(1)).annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "default",
          examples: ["a"],
          minLength: 1
        })
      })

      it("String & minLength(1) & minLength(2)", async () => {
        const schema = Schema.String.check(Check.minLength(1), Check.minLength(2))
        await assertDraft7(schema, {
          type: "string",
          description: "a value with a length of at least 1",
          minLength: 1,
          title: "minLength(1)",
          allOf: [
            {
              description: "a value with a length of at least 2",
              minLength: 2,
              title: "minLength(2)"
            }
          ]
        })
      })

      it("String & minLength(2) & minLength(1)", async () => {
        const schema = Schema.String.check(Check.minLength(2), Check.minLength(1))
        await assertDraft7(schema, {
          type: "string",
          description: "a value with a length of at least 2",
          minLength: 2,
          title: "minLength(2)",
          allOf: [
            {
              description: "a value with a length of at least 1",
              minLength: 1,
              title: "minLength(1)"
            }
          ]
        })
      })
    })

    describe("Number", () => {
      it("Number", async () => {
        const schema = Schema.Number
        await assertDraft7(schema, {
          type: "number"
        })
      })

      it("Number & annotations", async () => {
        const schema = Schema.Number.annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: 1,
          examples: [2]
        })
        await assertDraft7(schema, {
          type: "number",
          title: "title",
          description: "description",
          documentation: "documentation",
          default: 1,
          examples: [2]
        })
      })

      it("Integer", async () => {
        const schema = Schema.Number.check(Check.int())
        await assertDraft7(schema, {
          type: "integer",
          description: "an integer",
          title: "int"
        })
      })

      it("Integer & annotations", async () => {
        const schema = Schema.Number.annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: 1,
          examples: [2]
        }).check(Check.int())
        await assertDraft7(schema, {
          type: "integer",
          title: "title",
          description: "description",
          documentation: "documentation",
          default: 1,
          examples: [2],
          allOf: [
            {
              description: "an integer",
              title: "int"
            }
          ]
        })
      })
    })

    describe("Boolean", () => {
      it("Boolean", async () => {
        const schema = Schema.Boolean
        await assertDraft7(schema, {
          type: "boolean"
        })
      })

      it("Boolean & annotations", async () => {
        const schema = Schema.Boolean.annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: true,
          examples: [false]
        })
        await assertDraft7(schema, {
          type: "boolean",
          title: "title",
          description: "description",
          documentation: "documentation",
          default: true,
          examples: [false]
        })
      })
    })

    describe("Object", () => {
      it("Object", async () => {
        const schema = Schema.Object
        await assertDraft7(schema, {
          anyOf: [
            { type: "object" },
            { type: "array" }
          ]
        })
      })

      it("Object & annotations", async () => {
        const schema = Schema.Object.annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: {},
          examples: [{}, []]
        })
        await assertDraft7(schema, {
          anyOf: [
            { type: "object" },
            { type: "array" }
          ],
          title: "title",
          description: "description",
          documentation: "documentation",
          default: {},
          examples: [{}, []]
        })
      })
    })

    describe("Literal", () => {
      it("should throw if the literal is a bigint", async () => {
        const schema = Schema.Literal(1n)
        throws(
          () => ToJsonSchema.makeDraft07(schema),
          new Error(`cannot generate JSON Schema for LiteralType at root`)
        )
      })

      it("string", async () => {
        const schema = Schema.Literal("a")
        await assertDraft7(schema, {
          type: "string",
          enum: ["a"]
        })
      })

      it("string & annotations", async () => {
        const schema = Schema.Literal("a").annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "a",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          enum: ["a"],
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "a",
          examples: ["a"]
        })
      })

      it("number", async () => {
        const schema = Schema.Literal(1)
        await assertDraft7(schema, {
          type: "number",
          enum: [1]
        })
      })

      it("number & annotations", async () => {
        const schema = Schema.Literal(1).annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: 1,
          examples: [1]
        })
        await assertDraft7(schema, {
          type: "number",
          enum: [1],
          title: "title",
          description: "description",
          documentation: "documentation",
          default: 1,
          examples: [1]
        })
      })

      it("boolean", async () => {
        const schema = Schema.Literal(true)
        await assertDraft7(schema, {
          type: "boolean",
          enum: [true]
        })
      })

      it("boolean & annotations", async () => {
        const schema = Schema.Literal(true).annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: true,
          examples: [true]
        })
        await assertDraft7(schema, {
          type: "boolean",
          enum: [true],
          title: "title",
          description: "description",
          documentation: "documentation",
          default: true,
          examples: [true]
        })
      })
    })

    describe("Literals", () => {
      it("strings", async () => {
        const schema = Schema.Literals(["a", "b"])
        await assertDraft7(schema, {
          anyOf: [
            { type: "string", enum: ["a"] },
            { type: "string", enum: ["b"] }
          ]
        })
      })
    })

    describe("Enums", () => {
      enum Fruits {
        Apple,
        Banana,
        Orange = "orange"
      }

      it("Enums", async () => {
        const schema = Schema.Enums(Fruits)
        await assertDraft7(schema, {
          anyOf: [
            { type: "number", enum: [0], title: "Apple" },
            { type: "number", enum: [1], title: "Banana" },
            { type: "string", enum: ["orange"], title: "Orange" }
          ]
        })
      })

      it("Enums & annotations", async () => {
        const schema = Schema.Enums(Fruits).annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: Fruits.Apple,
          examples: [Fruits.Banana, "orange"]
        })
        await assertDraft7(schema, {
          anyOf: [
            { type: "number", enum: [0], title: "Apple" },
            { type: "number", enum: [1], title: "Banana" },
            { type: "string", enum: ["orange"], title: "Orange" }
          ],
          title: "title",
          description: "description",
          documentation: "documentation",
          default: Fruits.Apple,
          examples: [Fruits.Banana, "orange"]
        })
      })
    })

    describe("TemplateLiteral", () => {
      it("TemplateLiteral", async () => {
        const schema = Schema.TemplateLiteral(["a", Schema.String])
        await assertDraft7(schema, {
          type: "string",
          pattern: "^(a)([\\s\\S]*?)$"
        })
      })

      it("TemplateLiteral & annotations", async () => {
        const schema = Schema.TemplateLiteral(["a", Schema.String]).annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "a",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          pattern: "^(a)([\\s\\S]*?)$",
          title: "title",
          description: "description",
          documentation: "documentation",
          default: "a",
          examples: ["a"]
        })
      })
    })

    describe("Array", () => {
      it("Array", async () => {
        const schema = Schema.Array(Schema.String)
        await assertDraft7(schema, {
          type: "array",
          items: { type: "string" }
        })
      })

      it("Array & annotations", async () => {
        const schema = Schema.Array(Schema.String).annotate({
          title: "title",
          description: "description",
          documentation: "documentation",
          default: ["a"],
          examples: [["a"]]
        })
        await assertDraft7(schema, {
          type: "array",
          items: { type: "string" },
          title: "title",
          description: "description",
          documentation: "documentation",
          default: ["a"],
          examples: [["a"]]
        })
      })
    })

    it("UniqueArray", async () => {
      const schema = Schema.UniqueArray(Schema.String)
      await assertDraft7(schema, {
        type: "array",
        items: { type: "string" },
        title: "unique",
        uniqueItems: true
      })
    })

    describe("Tuple", () => {
      describe("draft-07", () => {
        it("empty tuple", async () => {
          const schema = Schema.Tuple([])
          await assertDraft7(schema, {
            type: "array",
            items: false
          })
        })

        it("required elements", async () => {
          const schema = Schema.Tuple([Schema.String, Schema.Number])
          await assertDraft7(schema, {
            type: "array",
            items: [{ type: "string" }, { type: "number" }],
            additionalItems: false
          })
        })

        it("required elements & annotations", async () => {
          const schema = Schema.Tuple([Schema.String, Schema.Number]).annotate({
            title: "title",
            description: "description",
            documentation: "documentation",
            default: ["a", 1],
            examples: [["a", 1]]
          })
          await assertDraft7(schema, {
            type: "array",
            items: [{ type: "string" }, { type: "number" }],
            title: "title",
            description: "description",
            documentation: "documentation",
            default: ["a", 1],
            examples: [["a", 1]],
            additionalItems: false
          })
        })

        it("optionalKey elements", async () => {
          const schema = Schema.Tuple([
            Schema.String,
            Schema.optionalKey(Schema.Number),
            Schema.optionalKey(Schema.Boolean)
          ])
          await assertDraft7(schema, {
            type: "array",
            items: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
            minItems: 1,
            additionalItems: false
          })
        })

        it("optional elements", async () => {
          const schema = Schema.Tuple([
            Schema.String,
            Schema.optional(Schema.Number),
            Schema.optional(Schema.Boolean)
          ])
          await assertDraft7(schema, {
            type: "array",
            items: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
            minItems: 1,
            additionalItems: false
          })
        })

        it("undefined elements", async () => {
          const schema = Schema.Tuple([
            Schema.String,
            Schema.UndefinedOr(Schema.Number)
          ])
          await assertDraft7(schema, {
            type: "array",
            items: [{ type: "string" }, { type: "number" }],
            minItems: 1,
            additionalItems: false
          })
        })
      })
    })

    describe("Object", () => {
      it("required properties", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.Number
        })
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "number" }
          },
          required: ["a", "b"],
          additionalProperties: false
        })
      })

      it("additionalPropertiesStrategy: allow", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.Number
        })
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "number" }
          },
          required: ["a", "b"]
        }, {
          additionalPropertiesStrategy: "allow"
        })
      })

      it("optionalKey properties", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.optionalKey(Schema.Number)
        })
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "number" }
          },
          required: ["a"],
          additionalProperties: false
        })
      })

      it("optional properties", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.optional(Schema.Number)
        })
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "number" }
          },
          required: ["a"],
          additionalProperties: false
        })
      })
    })

    describe("Record", () => {
      it("Record(String, Number)", async () => {
        const schema = Schema.Record(Schema.String, Schema.Number)
        await assertDraft7(schema, {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: {
            type: "number"
          }
        })
      })

      it("Record(String & minLength(1), Number) & annotations", async () => {
        const schema = Schema.Record(Schema.String.check(Check.minLength(1)), Schema.Number)
        await assertDraft7(schema, {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: {
            type: "number"
          }
        })
      })

      it("Record(`a${string}`, Number) & annotations", async () => {
        const schema = Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Number)
        await assertDraft7(schema, {
          type: "object",
          properties: {},
          required: [],
          patternProperties: {
            "^(a)([\\s\\S]*?)$": {
              type: "number"
            }
          }
        })
      })
    })

    describe("Suspend", () => {
      it("inner annotation", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema.annotate({ id: "A" })))
        })
        await assertDraft7(schema, {
          "$defs": {
            "A": {
              "type": "object",
              "required": [
                "a",
                "as"
              ],
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
              "additionalProperties": false
            }
          },
          "type": "object",
          "required": [
            "a",
            "as"
          ],
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
          "additionalProperties": false
        })
      })

      it("outer annotation", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema).annotate({ id: "A" }))
        })
        await assertDraft7(schema, {
          "$defs": {
            "A": {
              "type": "object",
              "required": [
                "a",
                "as"
              ],
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
              "additionalProperties": false
            }
          },
          "type": "object",
          "required": [
            "a",
            "as"
          ],
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
          "additionalProperties": false
        })
      })

      it("top annotation", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
        }).annotate({ id: "A" })
        await assertDraft7(schema, {
          "$ref": "#/$defs/A",
          "$defs": {
            "A": {
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
              "required": [
                "a",
                "as"
              ],
              "additionalProperties": false
            }
          }
        })
      })

      it(`top annotation but topLevelReferenceStrategy === "skip"`, async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
        }).annotate({ id: "A" })
        await assertDraft7(schema, {
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
          "required": [
            "a",
            "as"
          ],
          "additionalProperties": false,
          "$defs": {
            "A": {
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
              "required": [
                "a",
                "as"
              ],
              "additionalProperties": false
            }
          }
        }, {
          topLevelReferenceStrategy: "skip"
        })
      })
    })

    describe("Class", () => {
      it("Class", async () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}
        const schema = A
        await assertDraft7(schema, {
          "$ref": "#/$defs/A",
          "$defs": {
            "A": {
              type: "object",
              properties: {
                a: { type: "string" }
              },
              required: ["a"],
              additionalProperties: false
            }
          }
        })
      })
    })

    describe("id", () => {
      it(`topLevelReferenceStrategy: "skip"`, async () => {
        const schema = Schema.String.annotate({ id: "A" })
        await assertDraft7(schema, {
          "type": "string"
        }, {
          topLevelReferenceStrategy: "skip"
        })
      })

      describe(`topLevelReferenceStrategy: "keep" (default)`, () => {
        it(`String & annotation`, async () => {
          const schema = Schema.String.annotate({ id: "A" })
          await assertDraft7(schema, {
            "$ref": "#/$defs/A",
            "$defs": {
              "A": {
                "type": "string"
              }
            }
          })
        })

        it(`String & annotation & check`, async () => {
          const schema = Schema.String.annotate({ id: "A" }).check(Check.nonEmpty())
          await assertDraft7(schema, {
            "type": "string",
            "description": "a value with a length of at least 1",
            "title": "minLength(1)",
            "minLength": 1
          })
        })

        it(`String & annotation & check & annotation`, async () => {
          const schema = Schema.String.annotate({ id: "A" }).check(Check.nonEmpty({ id: "B" }))
          await assertDraft7(schema, {
            "$ref": "#/$defs/B",
            "$defs": {
              "B": {
                "type": "string",
                "title": "minLength(1)",
                "description": "a value with a length of at least 1",
                "minLength": 1
              }
            }
          })
        })

        it(`String & annotation & check & annotation & check`, async () => {
          const schema = Schema.String.annotate({ id: "A" }).check(
            Check.nonEmpty({ id: "B" }),
            Check.maxLength(2)
          )
          await assertDraft7(schema, {
            "type": "string",
            "allOf": [
              {
                "title": "maxLength(2)",
                "description": "a value with a length of at most 2",
                "maxLength": 2
              }
            ],
            "title": "minLength(1)",
            "description": "a value with a length of at least 1",
            "minLength": 1
          })
        })
      })
    })

    describe("Annotations", () => {
      describe("Override", () => {
        it("Number", async () => {
          const schema = Schema.Number.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ type: "integer" })
            }
          })
          await assertDraft7(schema, {
            "type": "integer"
          })
        })

        it("Number & positive + annotation", async () => {
          const schema = Schema.Number.check(Check.greaterThan(0)).annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ type: "integer" })
            }
          })
          await assertDraft7(schema, {
            "type": "integer"
          })
        })

        it("Number + annotation & positive", async () => {
          const schema = Schema.Number.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ type: "integer" })
            }
          }).check(Check.greaterThan(0))
          await assertDraft7(schema, {
            "type": "integer"
          })
        })
      })
    })
  })

  describe("draft-2020-12", () => {
    it("empty tuple", async () => {
      const schema = Schema.Tuple([])
      await assertDraft202012(schema, {
        type: "array",
        items: false
      })
    })

    it("required elements", async () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number])
      await assertDraft202012(schema, {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }],
        items: false
      })
    })

    it("required elements & annotations", async () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number]).annotate({
        title: "title",
        description: "description",
        documentation: "documentation",
        default: ["a", 1],
        examples: [["a", 1]]
      })
      await assertDraft202012(schema, {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }],
        title: "title",
        description: "description",
        documentation: "documentation",
        default: ["a", 1],
        examples: [["a", 1]],
        items: false
      })
    })

    it("optionalKey elements", async () => {
      const schema = Schema.Tuple([
        Schema.String,
        Schema.optionalKey(Schema.Number),
        Schema.optionalKey(Schema.Boolean)
      ])
      await assertDraft202012(schema, {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
        minItems: 1,
        items: false
      })
    })

    it("optional elements", async () => {
      const schema = Schema.Tuple([
        Schema.String,
        Schema.optional(Schema.Number),
        Schema.optional(Schema.Boolean)
      ])
      await assertDraft202012(schema, {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
        minItems: 1,
        items: false
      })
    })

    it("undefined elements", async () => {
      const schema = Schema.Tuple([
        Schema.String,
        Schema.UndefinedOr(Schema.Number)
      ])
      await assertDraft202012(schema, {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }],
        minItems: 1,
        items: false
      })
    })
  })

  describe("openApi3.1", () => {
    it("does not support null type keyword", async () => {
      const schema = Schema.NullOr(Schema.Number)
      await assertOpenApi3_1(schema, {
        anyOf: [
          { type: "number" },
          { enum: [null] }
        ]
      })
    })
  })

  describe("fromJsonString", () => {
    it("nested fromJsonString", async () => {
      const schema = Schema.fromJsonString(Schema.FiniteFromString)
      const expected = {
        "type": "string",
        "contentMediaType": "application/json",
        "contentSchema": {
          "type": "string"
        }
      }
      await assertDraft202012(schema, expected)
      await assertOpenApi3_1(schema, expected)
    })

    it("nested fromJsonString", async () => {
      const schema = Schema.fromJsonString(Schema.Struct({
        a: Schema.fromJsonString(Schema.FiniteFromString)
      }))
      const expected = {
        "type": "string",
        "contentMediaType": "application/json",
        "contentSchema": {
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
      await assertDraft202012(schema, expected)
      await assertOpenApi3_1(schema, expected)
    })
  })
})
