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
  strictEqual(ajv2020.errors, null)
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

function expectError(schema: Schema.Top, message: string) {
  throws(() => ToJsonSchema.makeDraft07(schema), new Error(message))
}

describe("ToJsonSchema", () => {
  describe("options", () => {
    it("definitionsPath", async () => {
      const schema = Schema.String.annotate({ id: "ID" })
      const definitions = {}
      await assertDraft7(schema, {
        "$schema": "http://json-schema.org/draft-07/schema",
        "$defs": {
          "ID": {
            "type": "string"
          }
        },
        "$ref": "#/components/schemas/ID"
      }, {
        getRef: (id) => `#/components/schemas/${id}`,
        definitions
      })
      deepStrictEqual(definitions, {
        "ID": {
          "type": "string"
        }
      })
    })

    describe("topLevelReferenceStrategy", () => {
      it(`"skip"`, async () => {
        const schema = Schema.String.annotate({ id: "ID" })
        const definitions = {}
        await assertDraft7(schema, {
          "$schema": "http://json-schema.org/draft-07/schema",
          "type": "string"
        }, {
          topLevelReferenceStrategy: "skip",
          definitions
        })
        deepStrictEqual(definitions, {})
      })
    })

    describe("additionalPropertiesStrategy", () => {
      it(`"allow"`, async () => {
        const schema = Schema.Struct({ a: Schema.String })

        await assertDraft7(schema, {
          "$schema": "http://json-schema.org/draft-07/schema",
          "type": "object",
          "properties": {
            "a": {
              "type": "string"
            }
          },
          "required": ["a"],
          "additionalProperties": true
        }, {
          additionalPropertiesStrategy: "allow"
        })
      })
    })
  })

  describe("Unsupported schemas", () => {
    it("Tuple with an unsupported component", () => {
      expectError(
        Schema.Tuple([Schema.Undefined]),
        `cannot generate JSON Schema for UndefinedKeyword at [0]`
      )
    })

    it("Struct with an unsupported field", () => {
      expectError(
        Schema.Struct({ a: Schema.Symbol }),
        `cannot generate JSON Schema for SymbolKeyword at ["a"]`
      )
    })

    it("Declaration", async () => {
      expectError(
        Schema.instanceOf(globalThis.URL),
        `cannot generate JSON Schema for Declaration at root`
      )
    })

    it("Undefined", async () => {
      expectError(
        Schema.Undefined,
        `cannot generate JSON Schema for UndefinedKeyword at root`
      )
    })

    it("BigInt", async () => {
      expectError(
        Schema.BigInt,
        `cannot generate JSON Schema for BigIntKeyword at root`
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
        `cannot generate JSON Schema for SymbolKeyword at root`
      )
    })

    it("Literal(bigint)", () => {
      expectError(
        Schema.Literal(1n),
        `cannot generate JSON Schema for LiteralType at root`
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
        "cannot generate JSON Schema for Suspend at [\"as\"][0], required `id` annotation"
      )
    })

    it("Unsupported property signature key", () => {
      const a = Symbol.for("effect/Schema/test/a")
      expectError(
        Schema.Struct({ [a]: Schema.String }),
        `cannot generate JSON Schema for TypeLiteral at [Symbol(effect/Schema/test/a)]`
      )
    })

    it("Unsupported index signature parameter", () => {
      expectError(
        Schema.Record(Schema.Symbol, Schema.Number),
        `cannot generate JSON Schema for SymbolKeyword at root`
      )
    })

    it("Unsupported post-rest elements", () => {
      expectError(
        Schema.TupleWithRest(Schema.Tuple([]), [Schema.Number, Schema.String]),
        "Generating a JSON Schema for post-rest elements is not currently supported. You're welcome to contribute by submitting a Pull Request"
      )
    })
  })

  describe("Draft 07", () => {
    describe("Declaration", () => {
      it("should throw if the schema is a declaration", () => {
        const schema = Schema.Option(Schema.String)
        throws(() => ToJsonSchema.makeDraft07(schema), new Error(`cannot generate JSON Schema for Declaration at root`))
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

    describe("Void", () => {
      it("Void", async () => {
        const schema = Schema.Void
        await assertDraft7(schema, {})
      })

      it("Void & annotations", async () => {
        const schema = Schema.Void.annotate({
          title: "title",
          description: "description",
          default: void 0,
          examples: [void 0]
        })
        await assertDraft7(schema, {
          title: "title",
          description: "description",
          default: void 0,
          examples: [void 0]
        })
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
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          title: "title",
          description: "description",
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
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          title: "title",
          description: "description",
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
          default: null,
          examples: [null]
        })
      })
    })

    describe("String", () => {
      it("String", async () => {
        const schema = Schema.String
        await assertDraft7(schema, {
          "type": "string"
        })
        assertAjvDraft7Success(schema, "a")
        assertAjvDraft7Failure(schema, null)
      })

      it("String & annotations", async () => {
        const schema = Schema.String.annotate({
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          title: "title",
          description: "description",
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
          default: "default",
          examples: ["a"]
        }).check(Check.minLength(1))
        await assertDraft7(schema, {
          type: "string",
          title: "title",
          description: "description",
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
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          title: "title",
          description: "description",
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
          default: 1,
          examples: [2]
        })
        await assertDraft7(schema, {
          type: "number",
          title: "title",
          description: "description",
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
          default: 1,
          examples: [2]
        }).check(Check.int())
        await assertDraft7(schema, {
          type: "integer",
          title: "title",
          description: "description",
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
          default: true,
          examples: [false]
        })
        await assertDraft7(schema, {
          type: "boolean",
          title: "title",
          description: "description",
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
          default: "a",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          enum: ["a"],
          title: "title",
          description: "description",
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
          default: 1,
          examples: [1]
        })
        await assertDraft7(schema, {
          type: "number",
          enum: [1],
          title: "title",
          description: "description",
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
          default: true,
          examples: [true]
        })
        await assertDraft7(schema, {
          type: "boolean",
          enum: [true],
          title: "title",
          description: "description",
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
          default: "a",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          pattern: "^(a)([\\s\\S]*?)$",
          title: "title",
          description: "description",
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
          default: ["a"],
          examples: [["a"]]
        })
        await assertDraft7(schema, {
          type: "array",
          items: { type: "string" },
          title: "title",
          description: "description",
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
          const schema = Schema.Tuple([
            Schema.String,
            Schema.String.annotate({ description: "1" }),
            Schema.String.annotate({ description: "2-inner" }).annotateKey({ description: "2-outer" })
          ])
          await assertDraft7(schema, {
            type: "array",
            items: [
              { type: "string" },
              { type: "string", description: "1" },
              { type: "string", description: "2-outer" }
            ],
            additionalItems: false
          })
        })

        it("required elements & annotations", async () => {
          const schema = Schema.Tuple([Schema.String, Schema.Number]).annotate({
            title: "title",
            description: "description",
            default: ["a", 1],
            examples: [["a", 1]]
          })
          await assertDraft7(schema, {
            type: "array",
            items: [{ type: "string" }, { type: "number" }],
            title: "title",
            description: "description",
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

    describe("Struct", () => {
      it("required properties", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String.annotate({ description: "b" }),
          c: Schema.String.annotate({ description: "c-inner" }).annotateKey({ description: "c-outer" })
        })
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "string", description: "b" },
            c: { type: "string", description: "c-outer" }
          },
          required: ["a", "b", "c"],
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
          required: ["a", "b"],
          additionalProperties: true
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
        default: ["a", 1],
        examples: [["a", 1]]
      })
      await assertDraft202012(schema, {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }],
        title: "title",
        description: "description",
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
          { type: "null" }
        ]
      })
    })
  })

  describe("fromJsonString", () => {
    it("top level fromJsonString", async () => {
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
              "type": "string",
              "contentMediaType": "application/json",
              "contentSchema": {
                "type": "string"
              }
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

/*
describe("v3 tests", () => {
  describe("Draft 07", () => {
    describe("nullable handling", () => {
      it("Null", async () => {
        const schema = Schema.Null
        await assertDraft7(schema, { "type": "null" })
      })

      it("NullOr(String)", async () => {
        const schema = Schema.NullOr(Schema.String)
        await assertDraft7(schema, {
          "anyOf": [
            { "type": "string" },
            { "type": "null" }
          ]
        })
      })

      it("NullOr(Any)", async () => {
        const schema = Schema.NullOr(Schema.Any)
        await assertDraft7(schema, {
          "anyOf": [
            {},
            { "type": "null" }
          ]
        })
      })

      it("NullOr(Unknown)", async () => {
        const schema = Schema.NullOr(Schema.Unknown)
        await assertDraft7(schema, {
          "anyOf": [
            {},
            { "type": "null" }
          ]
        })
      })

      it("NullOr(Void)", async () => {
        const schema = Schema.NullOr(Schema.Void)
        await assertDraft7(schema, {
          "anyOf": [
            {},
            { "type": "null" }
          ]
        })
      })

      it("Literal | null", async () => {
        const schema = Schema.Union([Schema.Literal("a"), Schema.Null])
        await assertDraft7(schema, {
          "anyOf": [
            {
              "type": "string",
              "enum": ["a"]
            },
            { "type": "null" }
          ]
        })
      })

      it("Literal | null(with description)", async () => {
        const schema = Schema.Union([Schema.Literal("a"), Schema.Null.annotate({ description: "mydescription" })])
        await assertDraft7(schema, {
          "anyOf": [
            {
              "type": "string",
              "enum": ["a"]
            },
            {
              "type": "null",
              "description": "mydescription"
            }
          ]
        })
      })

      it("Nested nullable unions", async () => {
        const schema = Schema.Union([Schema.NullOr(Schema.String), Schema.Union([Schema.Literal("a"), Schema.Null])])
        await assertDraft7(schema, {
          "anyOf": [
            {
              "anyOf": [
                { "type": "string" },
                { "type": "null" }
              ]
            },
            {
              "anyOf": [
                { "type": "string", "enum": ["a"] },
                { "type": "null" }
              ]
            }
          ]
        })
      })
    })

    it("fromJsonString handling", async () => {
      const schema = Schema.fromJsonString(Schema.Struct({
        a: Schema.fromJsonString(Schema.FiniteFromString)
      }))
      await assertDraft7(
        schema,
        { "type": "string" }
      )
    })

    describe("primitives", () => {
      it("Never", async () => {
        await assertDraft7(Schema.Never, {
          "not": {}
        })
        await assertDraft7(Schema.Never.annotate({ description: "description" }), {
          "not": {},
          "description": "description"
        })
      })

      it("Void", async () => {
        await assertDraft7(Schema.Void, {})
        await assertDraft7(Schema.Void.annotate({ description: "description" }), {
          "description": "description"
        })
      })

      it("Unknown", async () => {
        await assertDraft7(Schema.Unknown, {})
        await assertDraft7(Schema.Unknown.annotate({ description: "description" }), {
          "description": "description"
        })
      })

      it("Any", async () => {
        await assertDraft7(Schema.Any, {})
        await assertDraft7(Schema.Any.annotate({ description: "description" }), {
          "description": "description"
        })
      })

      it("Object", async () => {
        await assertDraft7(Schema.Object, {
          "anyOf": [
            { "type": "object" },
            { "type": "array" }
          ]
        })
        await assertDraft7(Schema.Object.annotate({ description: "description" }), {
          "anyOf": [
            { "type": "object" },
            { "type": "array" }
          ],
          "description": "description"
        })
      })

      it("String", async () => {
        const schema = Schema.String
        await assertDraft7(schema, {
          "type": "string"
        })
        await assertDraft7(schema.annotate({ description: "description" }), {
          "type": "string",
          "description": "description"
        })
        assertAjvDraft7Success(schema, "a")
        assertAjvDraft7Failure(schema, null)
      })

      it("Number", async () => {
        await assertDraft7(Schema.Number, {
          "type": "number"
        })
        await assertDraft7(Schema.Number.annotate({ description: "description" }), {
          "type": "number",
          "description": "description"
        })
      })

      it("Boolean", async () => {
        await assertDraft7(Schema.Boolean, {
          "type": "boolean"
        })
        await assertDraft7(Schema.Boolean.annotate({ description: "description" }), {
          "type": "boolean",
          "description": "description"
        })
      })
    })

    it("Null", async () => {
      const schema = Schema.Null
      await assertDraft7(schema, {
        "type": "null"
      })
      await assertDraft7(schema.annotate({ description: "description" }), {
        "type": "null",
        "description": "description"
      })
      assertAjvDraft7Success(schema, null)
      assertAjvDraft7Failure(schema, "a")
    })

    describe("Literal", () => {
      it("string literal", async () => {
        await assertDraft7(Schema.Literal("a"), {
          "type": "string",
          "enum": ["a"]
        })
        await assertDraft7(Schema.Literal("a").annotate({ description: "description" }), {
          "type": "string",
          "enum": ["a"],
          "description": "description"
        })
      })

      it("number literal", async () => {
        await assertDraft7(Schema.Literal(1), {
          "type": "number",
          "enum": [1]
        })
        await assertDraft7(Schema.Literal(1).annotate({ description: "description" }), {
          "type": "number",
          "enum": [1],
          "description": "description"
        })
      })

      it("boolean literal", async () => {
        await assertDraft7(Schema.Literal(true), {
          "type": "boolean",
          "enum": [true]
        })
        await assertDraft7(Schema.Literal(true).annotate({ description: "description" }), {
          "type": "boolean",
          "enum": [true],
          "description": "description"
        })
      })
    })

    describe("Literals", () => {
      it("string literals", async () => {
        await assertDraft7(Schema.Literals(["a", "b"]), {
          "type": "string",
          "enum": ["a", "b"]
        })
      })

      it("number literals", async () => {
        await assertDraft7(Schema.Literals([1, 2]), {
          "type": "number",
          "enum": [1, 2]
        })
      })

      it("boolean literals", async () => {
        await assertDraft7(Schema.Literals([true, false]), {
          "type": "boolean",
          "enum": [true, false]
        })
      })

      it("mixed literals", async () => {
        await assertDraft7(Schema.Literals([1, "a", true]), {
          "anyOf": [
            { "type": "number", "enum": [1] },
            { "type": "string", "enum": ["a"] },
            { "type": "boolean", "enum": [true] }
          ]
        })
        await assertDraft7(Schema.Literals(["a", "b", 1]), {
          "anyOf": [
            { "type": "string", "enum": ["a", "b"] },
            { "type": "number", "enum": [1] }
          ]
        })
        await assertDraft7(Schema.Literals(["a", 1, "b"]), {
          "anyOf": [
            { "type": "string", "enum": ["a"] },
            { "type": "number", "enum": [1] },
            { "type": "string", "enum": ["b"] }
          ]
        })
      })
    })

    describe("Enums", () => {
      it("empty enum", async () => {
        enum Empty {}
        await assertDraft7(Schema.Enums(Empty), {
          "$id": "/schemas/never",
          "not": {}
        })
        await assertDraft7(Schema.Enums(Empty).annotate({ description: "description" }), {
          "$id": "/schemas/never",
          "not": {},
          "description": "description"
        })
      })

      it("single enum", async () => {
        enum Fruits {
          Apple
        }
        await assertDraft7(Schema.Enums(Fruits), {
          "$comment": "/schemas/enums",
          "anyOf": [
            { "type": "number", "title": "Apple", "enum": [0] }
          ]
        })
        await assertDraft7(Schema.Enums(Fruits).annotate({ description: "description" }), {
          "$comment": "/schemas/enums",
          "anyOf": [
            { "type": "number", "title": "Apple", "enum": [0] }
          ],
          "description": "description"
        })
      })

      it("numeric enums", async () => {
        enum Fruits {
          Apple,
          Banana
        }
        await assertDraft7(Schema.Enums(Fruits), {
          "$comment": "/schemas/enums",
          "anyOf": [
            { "type": "number", "title": "Apple", "enum": [0] },
            { "type": "number", "title": "Banana", "enum": [1] }
          ]
        })
      })

      it("string enums", async () => {
        enum Fruits {
          Apple = "apple",
          Banana = "banana"
        }
        await assertDraft7(Schema.Enums(Fruits), {
          "$comment": "/schemas/enums",
          "anyOf": [
            { "type": "string", "title": "Apple", "enum": ["apple"] },
            { "type": "string", "title": "Banana", "enum": ["banana"] }
          ]
        })
      })

      it("mix of string/number enums", async () => {
        enum Fruits {
          Apple = "apple",
          Banana = "banana",
          Cantaloupe = 0
        }
        await assertDraft7(Schema.Enums(Fruits), {
          "$comment": "/schemas/enums",
          "anyOf": [
            { "type": "string", "title": "Apple", "enum": ["apple"] },
            { "type": "string", "title": "Banana", "enum": ["banana"] },
            { "type": "number", "title": "Cantaloupe", "enum": [0] }
          ]
        })
      })

      it("const enums", async () => {
        const Fruits = {
          Apple: "apple",
          Banana: "banana",
          Cantaloupe: 3
        } as const
        await assertDraft7(Schema.Enums(Fruits), {
          "$comment": "/schemas/enums",
          "anyOf": [
            { "type": "string", "title": "Apple", "enum": ["apple"] },
            { "type": "string", "title": "Banana", "enum": ["banana"] },
            { "type": "number", "title": "Cantaloupe", "enum": [3] }
          ]
        })
      })
    })

    it("TemplateLiteral", async () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number])
      await assertDraft7(schema, {
        "type": "string",
        "pattern": "^a[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?$",
        "title": "`a${number}`",
        "description": "a template literal"
      })
    })

    describe("Refinement", () => {
      it("itemsCount (Array)", async () => {
        await assertDraft7(Schema.Array(Schema.String).check(Check.length(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "an array of exactly 2 item(s)",
          "title": "itemsCount(2)",
          "minItems": 2,
          "maxItems": 2
        })
      })

      it("itemsCount (NonEmptyArray)", async () => {
        await assertDraft7(Schema.NonEmptyArray(Schema.String).check(Check.length(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "an array of exactly 2 item(s)",
          "title": "itemsCount(2)",
          "minItems": 2,
          "maxItems": 2
        })
      })

      it("minItems (Array)", async () => {
        await assertDraft7(Schema.Array(Schema.String).check(Check.minLength(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "an array of at least 2 item(s)",
          "title": "minItems(2)",
          "minItems": 2
        })
      })

      it("minItems (NonEmptyArray)", async () => {
        await assertDraft7(Schema.NonEmptyArray(Schema.String).check(Check.minLength(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "an array of at least 2 item(s)",
          "title": "minItems(2)",
          "minItems": 2
        })
      })

      it("maxItems (Array)", async () => {
        await assertDraft7(Schema.Array(Schema.String).check(Check.maxLength(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "an array of at most 2 item(s)",
          "title": "maxItems(2)",
          "maxItems": 2
        })
      })

      it("maxItems (NonEmptyArray)", async () => {
        await assertDraft7(Schema.NonEmptyArray(Schema.String).check(Check.maxLength(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "an array of at most 2 item(s)",
          "title": "maxItems(2)",
          "minItems": 1,
          "maxItems": 2
        })
      })

      it("minLength", async () => {
        await assertDraft7(Schema.String.check(Check.minLength(1)), {
          "type": "string",
          "title": "minLength(1)",
          "description": "a string at least 1 character(s) long",
          "minLength": 1
        })
      })

      it("maxLength", async () => {
        await assertDraft7(Schema.String.check(Check.maxLength(1)), {
          "type": "string",
          "title": "maxLength(1)",
          "description": "a string at most 1 character(s) long",
          "maxLength": 1
        })
      })

      it("length: number", async () => {
        await assertDraft7(Schema.String.check(Check.length(1)), {
          "type": "string",
          "title": "length(1)",
          "description": "a single character",
          "maxLength": 1,
          "minLength": 1
        })
      })

      it("length: { min, max }", async () => {
        await assertDraft7(Schema.String.check(Check.minLength(2), Check.maxLength(4)), {
          "type": "string",
          "title": "length({ min: 2, max: 4)",
          "description": "a string at least 2 character(s) and at most 4 character(s) long",
          "maxLength": 4,
          "minLength": 2
        })
      })

      it("greaterThan", async () => {
        await assertDraft7(Schema.Number.check(Check.greaterThan(1)), {
          "type": "number",
          "title": "greaterThan(1)",
          "description": "a number greater than 1",
          "exclusiveMinimum": 1
        })
      })

      it("greaterThanOrEqualTo", async () => {
        await assertDraft7(Schema.Number.check(Check.greaterThanOrEqualTo(1)), {
          "type": "number",
          "title": "greaterThanOrEqualTo(1)",
          "description": "a number greater than or equal to 1",
          "minimum": 1
        })
      })

      it("lessThan", async () => {
        await assertDraft7(Schema.Number.check(Check.lessThan(1)), {
          "type": "number",
          "title": "lessThan(1)",
          "description": "a number less than 1",
          "exclusiveMaximum": 1
        })
      })

      it("lessThanOrEqualTo", async () => {
        await assertDraft7(Schema.Number.check(Check.lessThanOrEqualTo(1)), {
          "type": "number",
          "title": "lessThanOrEqualTo(1)",
          "description": "a number less than or equal to 1",
          "maximum": 1
        })
      })

      it("pattern", async () => {
        await assertDraft7(Schema.String.check(Check.regex(/^abb+$/)), {
          "type": "string",
          "description": "a string matching the pattern ^abb+$",
          "pattern": "^abb+$"
        })
      })

      it("int", async () => {
        await assertDraft7(Schema.Number.check(Check.int()), {
          "type": "integer",
          "title": "int",
          "description": "an integer"
        })
      })

      it("Trimmed", async () => {
        const schema = Schema.Trimmed
        await assertDraft7(schema, {
          "$defs": {
            "Trimmed": {
              "title": "trimmed",
              "description": "a string with no leading or trailing whitespace",
              "pattern": "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              "type": "string"
            }
          },
          "$ref": "#/$defs/Trimmed"
        })
      })

      it("Lowercased", async () => {
        const schema = Schema.String.check(Check.lowercased())
        await assertDraft7(schema, {
          "$defs": {
            "Lowercased": {
              "title": "lowercased",
              "description": "a lowercase string",
              "pattern": "^[^A-Z]*$",
              "type": "string"
            }
          },
          "$ref": "#/$defs/Lowercased"
        })
      })

      it("Uppercased", async () => {
        const schema = Schema.String.check(Check.uppercased())
        await assertDraft7(schema, {
          "$defs": {
            "Uppercased": {
              "title": "uppercased",
              "description": "an uppercase string",
              "pattern": "^[^a-z]*$",
              "type": "string"
            }
          },
          "$ref": "#/$defs/Uppercased"
        })
      })

      it("Capitalized", async () => {
        const schema = Schema.String.check(Check.capitalized())
        await assertDraft7(schema, {
          "$defs": {
            "Capitalized": {
              "title": "capitalized",
              "description": "a capitalized string",
              "pattern": "^[^a-z]?.*$",
              "type": "string"
            }
          },
          "$ref": "#/$defs/Capitalized"
        })
      })

      it("Uncapitalized", async () => {
        const schema = Schema.String.check(Check.uncapitalized())
        await assertDraft7(schema, {
          "$defs": {
            "Uncapitalized": {
              "title": "uncapitalized",
              "description": "a uncapitalized string",
              "pattern": "^[^A-Z]?.*$",
              "type": "string"
            }
          },
          "$ref": "#/$defs/Uncapitalized"
        })
      })

      describe("should handle merge conflicts", () => {
        it("minLength + minLength", async () => {
          await assertDraft7(Schema.String.check(Check.minLength(1), Check.minLength(2)), {
            "type": "string",
            "title": "minLength(2)",
            "description": "a string at least 2 character(s) long",
            "minLength": 2
          })
          await assertDraft7(Schema.String.check(Check.minLength(2), Check.minLength(1)), {
            "type": "string",
            "title": "minLength(1)",
            "description": "a string at least 1 character(s) long",
            "minLength": 1,
            "allOf": [
              { "minLength": 2 }
            ]
          })
          await assertDraft7(Schema.String.check(Check.minLength(2), Check.minLength(1), Check.minLength(2)), {
            "type": "string",
            "title": "minLength(2)",
            "description": "a string at least 2 character(s) long",
            "minLength": 2
          })
        })

        it("maxLength + maxLength", async () => {
          await assertDraft7(Schema.String.check(Check.maxLength(1), Check.maxLength(2)), {
            "type": "string",
            "title": "maxLength(2)",
            "description": "a string at most 2 character(s) long",
            "maxLength": 2,
            "allOf": [
              { "maxLength": 1 }
            ]
          })
          await assertDraft7(Schema.String.check(Check.maxLength(2), Check.maxLength(1)), {
            "type": "string",
            "title": "maxLength(1)",
            "description": "a string at most 1 character(s) long",
            "maxLength": 1
          })
          await assertDraft7(Schema.String.check(Check.maxLength(1), Check.maxLength(2), Check.maxLength(1)), {
            "type": "string",
            "title": "maxLength(1)",
            "description": "a string at most 1 character(s) long",
            "maxLength": 1
          })
        })

        it("pattern + pattern", async () => {
          await assertDraft7(Schema.String.check(Check.startsWith("a"), Check.endsWith("c")), {
            "type": "string",
            "title": "endsWith(\"c\")",
            "description": "a string ending with \"c\"",
            "pattern": "^.*c$",
            "allOf": [
              { "pattern": "^a" }
            ]
          })
          await assertDraft7(
            Schema.String.check(Check.startsWith("a"), Check.endsWith("c"), Check.startsWith("a")),
            {
              "type": "string",
              "title": "startsWith(\"a\")",
              "description": "a string starting with \"a\"",
              "pattern": "^a",
              "allOf": [
                { "pattern": "^.*c$" }
              ]
            }
          )
          await assertDraft7(
            Schema.String.check(Check.endsWith("c"), Check.startsWith("a"), Check.endsWith("c")),
            {
              "type": "string",
              "title": "endsWith(\"c\")",
              "description": "a string ending with \"c\"",
              "pattern": "^.*c$",
              "allOf": [
                { "pattern": "^a" }
              ]
            }
          )
        })

        it("minItems + minItems", async () => {
          await assertDraft7(Schema.Array(Schema.String).check(Check.minLength(1), Check.minLength(2)), {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "an array of at least 2 item(s)",
            "title": "minItems(2)",
            "minItems": 2
          })
          await assertDraft7(Schema.Array(Schema.String).check(Check.minLength(2), Check.minLength(1)), {
            "type": "array",
            "items": {
              "type": "string"
            },
            "title": "minItems(1)",
            "description": "an array of at least 1 item(s)",
            "minItems": 1,
            "allOf": [
              { "minItems": 2 }
            ]
          })
          await assertDraft7(
            Schema.Array(Schema.String).check(Check.minLength(2), Check.minLength(1), Check.minLength(2)),
            {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "an array of at least 2 item(s)",
              "title": "minItems(2)",
              "minItems": 2
            }
          )
        })

        it("maxItems + maxItems", async () => {
          await assertDraft7(Schema.Array(Schema.String).check(Check.maxLength(1), Check.maxLength(2)), {
            "type": "array",
            "items": {
              "type": "string"
            },
            "title": "maxItems(2)",
            "description": "an array of at most 2 item(s)",
            "maxItems": 2,
            "allOf": [
              { "maxItems": 1 }
            ]
          })
          await assertDraft7(Schema.Array(Schema.String).check(Check.maxLength(2), Check.maxLength(1)), {
            "type": "array",
            "items": {
              "type": "string"
            },
            "title": "maxItems(1)",
            "description": "an array of at most 1 item(s)",
            "maxItems": 1
          })
          await assertDraft7(
            Schema.Array(Schema.String).check(Check.maxLength(1), Check.maxLength(2), Check.maxLength(1)),
            {
              "type": "array",
              "items": {
                "type": "string"
              },
              "title": "maxItems(1)",
              "description": "an array of at most 1 item(s)",
              "maxItems": 1
            }
          )
        })

        it("minimum + minimum", async () => {
          await assertDraft7(Schema.Number.check(Check.greaterThanOrEqualTo(1), Check.greaterThanOrEqualTo(2)), {
            "type": "number",
            "title": "greaterThanOrEqualTo(2)",
            "description": "a number greater than or equal to 2",
            "minimum": 2
          })
          await assertDraft7(Schema.Number.check(Check.greaterThanOrEqualTo(2), Check.greaterThanOrEqualTo(1)), {
            "type": "number",
            "minimum": 1,
            "title": "greaterThanOrEqualTo(1)",
            "description": "a number greater than or equal to 1",
            "allOf": [
              { "minimum": 2 }
            ]
          })
          await assertDraft7(
            Schema.Number.check(
              Check.greaterThanOrEqualTo(2),
              Check.greaterThanOrEqualTo(1),
              Check.greaterThanOrEqualTo(2)
            ),
            {
              "type": "number",
              "title": "greaterThanOrEqualTo(2)",
              "description": "a number greater than or equal to 2",
              "minimum": 2
            }
          )
        })

        it("maximum + maximum", async () => {
          await assertDraft7(Schema.Number.check(Check.lessThanOrEqualTo(1), Check.lessThanOrEqualTo(2)), {
            "type": "number",
            "title": "lessThanOrEqualTo(2)",
            "description": "a number less than or equal to 2",
            "maximum": 2,
            "allOf": [
              { "maximum": 1 }
            ]
          })
          await assertDraft7(Schema.Number.check(Check.lessThanOrEqualTo(2), Check.lessThanOrEqualTo(1)), {
            "type": "number",
            "title": "lessThanOrEqualTo(1)",
            "description": "a number less than or equal to 1",
            "maximum": 1
          })
          await assertDraft7(
            Schema.Number.check(Check.lessThanOrEqualTo(1), Check.lessThanOrEqualTo(2), Check.lessThanOrEqualTo(1)),
            {
              "type": "number",
              "title": "lessThanOrEqualTo(1)",
              "description": "a number less than or equal to 1",
              "maximum": 1
            }
          )
        })

        it("exclusiveMinimum + exclusiveMinimum", async () => {
          await assertDraft7(Schema.Number.check(Check.greaterThan(1), Check.greaterThan(2)), {
            "type": "number",
            "title": "greaterThan(2)",
            "description": "a number greater than 2",
            "exclusiveMinimum": 2
          })
          await assertDraft7(Schema.Number.check(Check.greaterThan(2), Check.greaterThan(1)), {
            "type": "number",
            "exclusiveMinimum": 1,
            "title": "greaterThan(1)",
            "description": "a number greater than 1",
            "allOf": [
              { "exclusiveMinimum": 2 }
            ]
          })
          await assertDraft7(
            Schema.Number.check(
              Check.greaterThan(2),
              Check.greaterThan(1),
              Check.greaterThan(2)
            ),
            {
              "type": "number",
              "title": "greaterThan(2)",
              "description": "a number greater than 2",
              "exclusiveMinimum": 2
            }
          )
        })

        it("exclusiveMaximum + exclusiveMaximum", async () => {
          await assertDraft7(Schema.Number.check(Check.lessThan(1), Check.lessThan(2)), {
            "type": "number",
            "title": "lessThan(2)",
            "description": "a number less than 2",
            "exclusiveMaximum": 2,
            "allOf": [
              { "exclusiveMaximum": 1 }
            ]
          })
          await assertDraft7(Schema.Number.check(Check.lessThan(2), Check.lessThan(1)), {
            "type": "number",
            "title": "lessThan(1)",
            "description": "a number less than 1",
            "exclusiveMaximum": 1
          })
          await assertDraft7(
            Schema.Number.check(Check.lessThan(1), Check.lessThan(2), Check.lessThan(1)),
            {
              "type": "number",
              "title": "lessThan(1)",
              "description": "a number less than 1",
              "exclusiveMaximum": 1
            }
          )
        })

        it("multipleOf + multipleOf", async () => {
          await assertDraft7(Schema.Number.check(Check.multipleOf(2), Check.multipleOf(3)), {
            "type": "number",
            "title": "multipleOf(3)",
            "description": "a number divisible by 3",
            "multipleOf": 3,
            "allOf": [
              { "multipleOf": 2 }
            ]
          })
          await assertDraft7(
            Schema.Number.check(Check.multipleOf(2), Check.multipleOf(3), Check.multipleOf(3)),
            {
              "type": "number",
              "title": "multipleOf(3)",
              "description": "a number divisible by 3",
              "multipleOf": 3,
              "allOf": [
                { "multipleOf": 2 }
              ]
            }
          )
          await assertDraft7(
            Schema.Number.check(Check.multipleOf(3), Check.multipleOf(2), Check.multipleOf(3)),
            {
              "type": "number",
              "title": "multipleOf(3)",
              "description": "a number divisible by 3",
              "multipleOf": 3,
              "allOf": [
                { "multipleOf": 2 }
              ]
            }
          )
        })
      })
    })

    describe("Tuple", () => {
      it("empty tuple", async () => {
        const schema = Schema.Tuple([])
        await assertDraft7(schema, {
          "type": "array",
          "maxItems": 0
        })
      })

      it("element", async () => {
        const schema = Schema.Tuple([Schema.Number])
        await assertDraft7(schema, {
          "type": "array",
          "items": [{
            "type": "number"
          }],
          "minItems": 1,
          "additionalItems": false
        })
      })

      it("element + inner annotations", async () => {
        await assertDraft7(
          Schema.Tuple([Schema.Number.annotate({ description: "inner" })]),
          {
            "type": "array",
            "items": [{
              "type": "number",
              "description": "inner"
            }],
            "minItems": 1,
            "additionalItems": false
          }
        )
      })

      it("annotateKey should override inner annotations", async () => {
        await assertDraft7(
          Schema.Tuple(
            [Schema.Number.annotate({ description: "inner" }).annotateKey({ description: "outer" })]
          ),
          {
            "type": "array",
            "items": [{
              "type": "number",
              "description": "outer"
            }],
            "minItems": 1,
            "additionalItems": false
          }
        )
      })

      it("optionalKey", async () => {
        const schema = Schema.Tuple([Schema.optionalKey(Schema.Number)])
        await assertDraft7(schema, {
          "type": "array",
          "minItems": 0,
          "items": [
            {
              "type": "number"
            }
          ],
          "additionalItems": false
        })
      })

      it("optionalKey + annotateKey", async () => {
        await assertDraft7(
          Schema.Tuple([Schema.optionalKey(Schema.Number).annotateKey({ description: "inner" })]),
          {
            "type": "array",
            "minItems": 0,
            "items": [
              {
                "type": "number",
                "description": "inner"
              }
            ],
            "additionalItems": false
          }
        )
      })

      it("optionalElement + outer annotations should override inner annotations", async () => {
        await assertDraft7(
          Schema.Tuple([
            Schema.optionalKey(Schema.Number.annotate({ description: "inner" })).annotateKey({
              description: "outer"
            })
          ]),
          {
            "type": "array",
            "minItems": 0,
            "items": [
              {
                "type": "number",
                "description": "outer"
              }
            ],
            "additionalItems": false
          }
        )
      })

      it("element + optionalElement", async () => {
        const schema = Schema.Tuple([
          Schema.String.annotate({ description: "inner" }).annotateKey({ description: "outer" }),
          Schema.optionalKey(Schema.Number.annotate({ description: "inner?" })).annotateKey({
            description: "outer?"
          })
        ])
        await assertDraft7(schema, {
          "type": "array",
          "minItems": 1,
          "items": [
            {
              "type": "string",
              "description": "outer"
            },
            {
              "type": "number",
              "description": "outer?"
            }
          ],
          "additionalItems": false
        })
      })

      it("rest", async () => {
        const schema = Schema.Array(Schema.Number)
        await assertDraft7(schema, {
          "type": "array",
          "items": {
            "type": "number"
          }
        })
      })

      it("rest + inner annotations", async () => {
        await assertDraft7(Schema.Array(Schema.Number.annotate({ description: "inner" })), {
          "type": "array",
          "items": {
            "type": "number",
            "description": "inner"
          }
        })
      })

      it("optionalKey + (rest + inner annotations)", async () => {
        const schema = Schema.TupleWithRest(Schema.Tuple([Schema.optionalKey(Schema.String)]), [
          Schema.Number.annotate({ description: "inner" })
        ])
        await assertDraft7(schema, {
          "type": "array",
          "minItems": 0,
          "items": [
            {
              "type": "string"
            }
          ],
          "additionalItems": {
            "type": "number",
            "description": "inner"
          }
        })
      })

      it("optionalKey + rest + outer annotations should override inner annotations", async () => {
        await assertDraft7(
          Schema.TupleWithRest(Schema.Tuple([Schema.optionalKey(Schema.String)]), [
            Schema.Number.annotate({ description: "inner" }).annotateKey({ description: "outer" })
          ]),
          {
            "type": "array",
            "minItems": 0,
            "items": [
              {
                "type": "string"
              }
            ],
            "additionalItems": {
              "type": "number",
              "description": "outer"
            }
          }
        )
      })

      it("element + rest", async () => {
        const schema = Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])
        await assertDraft7(schema, {
          "type": "array",
          "items": [{
            "type": "string"
          }],
          "minItems": 1,
          "additionalItems": {
            "type": "number"
          }
        })
      })

      it("NonEmptyArray", async () => {
        await assertDraft7(
          Schema.NonEmptyArray(Schema.String),
          {
            type: "array",
            minItems: 1,
            items: { type: "string" }
          }
        )
      })
    })

    describe("Struct", () => {
      it("empty struct: Schema.Struct({})", async () => {
        const schema = Schema.Struct({})
        await assertDraft7(schema, {
          "$id": "/schemas/%7B%7D",
          "anyOf": [{
            "type": "object"
          }, {
            "type": "array"
          }]
        })
      })

      it("required property signatures", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String.annotate({ description: "b-inner" }),
          c: Schema.String.annotate({ description: "c-outer" }),
          d: Schema.String.annotate({ description: "d-inner" }).annotateKey({
            description: "d-outer"
          })
        })
        await assertDraft7(schema, {
          "type": "object",
          "properties": {
            "a": { "type": "string" },
            "b": { "type": "string", "description": "b-inner" },
            "c": { "type": "string", "description": "c-outer" },
            "d": { "type": "string", "description": "d-outer" }
          },
          "required": ["a", "b", "c", "d"],
          "additionalProperties": false
        })
      })

      it("exact optional property signatures", async () => {
        const schema = Schema.Struct({
          a: Schema.optionalKey(Schema.String),
          b: Schema.optionalKey(Schema.String.annotate({ description: "b-inner" })),
          c: Schema.optionalKey(Schema.String).annotateKey({ description: "c-outer" }),
          d: Schema.optionalKey(Schema.String.annotate({ description: "d-inner" })).annotateKey({
            description: "d-outer"
          }),
          e: Schema.optionalKey(Schema.UndefinedOr(Schema.String))
        })
        await assertDraft7(schema, {
          "type": "object",
          "properties": {
            "a": { "type": "string" },
            "b": { "type": "string", "description": "b-inner" },
            "c": { "type": "string", "description": "c-outer" },
            "d": { "type": "string", "description": "d-outer" },
            "e": { "type": "string" }
          },
          "required": [],
          "additionalProperties": false
        })
      })

      it("exact optional property signatures", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.optional(Schema.String),
          c: Schema.optional(Schema.UndefinedOr(Schema.String))
        })
        await assertDraft7(schema, {
          "type": "object",
          "properties": {
            "a": { "type": "string" },
            "b": { "type": "string" },
            "c": { "type": "string" }
          },
          "required": ["a"],
          "additionalProperties": false
        })
      })

      it("Struct + Record", async () => {
        const schema = Schema.StructWithRest(
          Schema.Struct({
            a: Schema.String
          }),
          [Schema.Record(Schema.String, Schema.String)]
        )

        await assertDraft7(schema, {
          "type": "object",
          "required": [
            "a"
          ],
          "properties": {
            "a": {
              "type": "string"
            }
          },
          "additionalProperties": {
            "type": "string"
          }
        })
      })

      describe("identifier annotation", () => {
        it("should use the identifier annotation of the property signature values", async () => {
          const schemaWithIdentifier = Schema.String.annotate({
            id: "my-id"
          })

          const schema = Schema.Struct({
            a: schemaWithIdentifier,
            b: schemaWithIdentifier
          })

          await assertDraft7(schema, {
            "$defs": {
              "my-id": {
                "type": "string"
              }
            },
            "type": "object",
            "required": [
              "a",
              "b"
            ],
            "properties": {
              "a": {
                "$ref": "#/$defs/my-id"
              },
              "b": {
                "$ref": "#/$defs/my-id"
              }
            },
            "additionalProperties": false
          })
        })

        it("should ignore the identifier annotation when annotating the value schema", async () => {
          const schemaWithIdentifier = Schema.String.annotate({
            id: "my-id"
          })

          const schema = Schema.Struct({
            a: schemaWithIdentifier.annotate({
              description: "a-description"
            }),
            b: schemaWithIdentifier.annotate({
              description: "b-description"
            })
          })

          await assertDraft7(schema, {
            "type": "object",
            "required": [
              "a",
              "b"
            ],
            "properties": {
              "a": {
                "type": "string",
                "description": "a-description"
              },
              "b": {
                "type": "string",
                "description": "b-description"
              }
            },
            "additionalProperties": false
          })
        })

        it("should use the identifier annotation when annotating the property signature", async () => {
          const schemaWithIdentifier = Schema.String.annotate({
            id: "my-id"
          })

          const schema = Schema.Struct({
            a: schemaWithIdentifier.annotateKey({
              description: "a-description"
            }),
            b: schemaWithIdentifier.annotateKey({
              description: "b-description"
            })
          })

          await assertDraft7(schema, {
            "$defs": {
              "my-id": {
                "type": "string"
              }
            },
            "type": "object",
            "required": [
              "a",
              "b"
            ],
            "properties": {
              "a": {
                "allOf": [
                  {
                    "$ref": "#/$defs/my-id"
                  }
                ],
                "description": "a-description"
              },
              "b": {
                "allOf": [
                  {
                    "$ref": "#/$defs/my-id"
                  }
                ],
                "description": "b-description"
              }
            },
            "additionalProperties": false
          })
        })
      })
    })

    describe("Record", () => {
      it("Record(refinement, number)", async () => {
        await assertDraft7(
          Schema.Record(Schema.String.check(Check.minLength(1)), Schema.Number),
          {
            "type": "object",
            "required": [],
            "properties": {},
            "patternProperties": {
              "": {
                "type": "number"
              }
            },
            "propertyNames": {
              "type": "string",
              "title": "minLength(1)",
              "description": "a string at least 1 character(s) long",
              "minLength": 1
            }
          }
        )
      })

      it("Record(string, number)", async () => {
        await assertDraft7(Schema.Record(Schema.String, Schema.Number), {
          "type": "object",
          "properties": {},
          "required": [],
          "additionalProperties": {
            "type": "number"
          }
        })
      })

      it("Record('a' | 'b', number)", async () => {
        await assertDraft7(
          Schema.Record(Schema.Union([Schema.Literal("a"), Schema.Literal("b")]), Schema.Number),
          {
            "type": "object",
            "properties": {
              "a": {
                "type": "number"
              },
              "b": {
                "type": "number"
              }
            },
            "required": ["a", "b"],
            "additionalProperties": false
          }
        )
      })

      it("Record(${string}-${string}, number)", async () => {
        const schema = Schema.Record(
          Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.String]),
          Schema.Number
        )
        await assertDraft7(schema, {
          "type": "object",
          "required": [],
          "properties": {},
          "patternProperties": {
            "": { "type": "number" }
          },
          "propertyNames": {
            "pattern": "^[\\s\\S]*?-[\\s\\S]*?$",
            "type": "string"
          }
        })
      })

      it("Record(pattern, number)", async () => {
        const schema = Schema.Record(
          Schema.String.check(Check.regex(/^.*-.*$/)),
          Schema.Number
        )
        await assertDraft7(schema, {
          "type": "object",
          "required": [],
          "properties": {},
          "patternProperties": {
            "": {
              "type": "number"
            }
          },
          "propertyNames": {
            "description": "a string matching the pattern ^.*-.*$",
            "pattern": "^.*-.*$",
            "type": "string"
          }
        })
      })

      it("Record(Symbol & annotation, number)", async () => {
        await assertDraft7(
          Schema.Record(
            Schema.Symbol.annotate({
              jsonSchema: {
                _tag: "Override",
                override: () => ({ "type": "string" })
              }
            }),
            Schema.Number
          ),
          {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "required": [],
            "properties": {},
            "additionalProperties": {
              "type": "number"
            },
            "propertyNames": {
              "type": "string"
            }
          }
        )
      })

      it("Record(string, UndefinedOr(number))", async () => {
        await assertDraft7(Schema.Record(Schema.String, Schema.UndefinedOr(Schema.Number)), {
          "type": "object",
          "properties": {},
          "required": [],
          "additionalProperties": { "type": "number" }
        })
      })
    })

    describe("Union", () => {
      it("never members", async () => {
        await assertDraft7(Schema.Union([Schema.String, Schema.Never]), {
          "type": "string"
        })
        await assertDraft7(Schema.Union([Schema.String, Schema.Union([Schema.Never, Schema.Never])]), {
          "type": "string"
        })
      })

      it("String | Number", async () => {
        await assertDraft7(Schema.Union([Schema.String, Schema.Number]), {
          "anyOf": [
            { "type": "string" },
            { "type": "number" }
          ]
        })
      })

      describe("Union including literals", () => {
        it(`1 | 2`, async () => {
          await assertDraft7(
            Schema.Union([Schema.Literal(1), Schema.Literal(2)]),
            {
              "type": "number",
              "enum": [1, 2]
            }
          )
        })

        it(`1(with description) | 2`, async () => {
          await assertDraft7(
            Schema.Union([
              Schema.Literal(1).annotate({ description: "1-description" }),
              Schema.Literal(2)
            ]),
            {
              "anyOf": [
                {
                  "type": "number",
                  "enum": [1],
                  "description": "1-description"
                },
                { "type": "number", "enum": [2] }
              ]
            }
          )
        })

        it(`1 | 2(with description)`, async () => {
          await assertDraft7(
            Schema.Union([
              Schema.Literal(1),
              Schema.Literal(2).annotate({ description: "2-description" })
            ]),
            {
              "anyOf": [
                { "type": "number", "enum": [1] },
                {
                  "type": "number",
                  "enum": [2],
                  "description": "2-description"
                }
              ]
            }
          )
        })

        it(`1 | 2 | string`, async () => {
          await assertDraft7(Schema.Union([Schema.Literal(1), Schema.Literal(2), Schema.String]), {
            "anyOf": [
              { "type": "number", "enum": [1, 2] },
              { "type": "string" }
            ]
          })
        })

        it(`(1 | 2) | string`, async () => {
          await assertDraft7(Schema.Union([Schema.Literals([1, 2]), Schema.String]), {
            "anyOf": [
              { "type": "number", "enum": [1, 2] },
              { "type": "string" }
            ]
          })
        })

        it(`(1 | 2)(with description) | string`, async () => {
          await assertDraft7(
            Schema.Union([
              Schema.Literals([1, 2]).annotate({ description: "1-2-description" }),
              Schema.String
            ]),
            {
              "anyOf": [
                {
                  "type": "number",
                  "enum": [1, 2],
                  "description": "1-2-description"
                },
                { "type": "string" }
              ]
            }
          )
        })

        it(`(1 | 2)(with description) | 3 | string`, async () => {
          await assertDraft7(
            Schema.Union([
              Schema.Literals([1, 2]).annotate({ description: "1-2-description" }),
              Schema.Literal(3),
              Schema.String
            ]),
            {
              "anyOf": [
                {
                  "type": "number",
                  "enum": [1, 2],
                  "description": "1-2-description"
                },
                { "enum": [3], "type": "number" },
                {
                  "type": "string"
                }
              ]
            }
          )
        })

        it(`1(with description) | 2 | string`, async () => {
          await assertDraft7(
            Schema.Union([
              Schema.Literal(1).annotate({ description: "1-description" }),
              Schema.Literal(2),
              Schema.String
            ]),
            {
              "anyOf": [
                {
                  "type": "number",
                  "description": "1-description",
                  "enum": [1]
                },
                { "type": "number", "enum": [2] },
                { "type": "string" }
              ]
            }
          )
        })

        it(`1 | 2(with description) | string`, async () => {
          await assertDraft7(
            Schema.Union([
              Schema.Literal(1),
              Schema.Literal(2).annotate({ description: "2-description" }),
              Schema.String
            ]),
            {
              "anyOf": [
                { "type": "number", "enum": [1] },
                {
                  "type": "number",
                  "description": "2-description",
                  "enum": [2]
                },
                { "type": "string" }
              ]
            }
          )
        })

        it(`string | 1 | 2 `, async () => {
          await assertDraft7(Schema.Union([Schema.String, Schema.Literal(1), Schema.Literal(2)]), {
            "anyOf": [
              { "type": "string" },
              { "type": "number", "enum": [1, 2] }
            ]
          })
        })

        it(`string | (1 | 2) `, async () => {
          await assertDraft7(Schema.Union([Schema.String, Schema.Literals([1, 2])]), {
            "anyOf": [
              { "type": "string" },
              { "type": "number", "enum": [1, 2] }
            ]
          })
        })

        it(`string | 1(with description) | 2`, async () => {
          await assertDraft7(
            Schema.Union([
              Schema.String,
              Schema.Literal(1).annotate({ description: "1-description" }),
              Schema.Literal(2)
            ]),
            {
              "anyOf": [
                { "type": "string" },
                {
                  "type": "number",
                  "description": "1-description",
                  "enum": [1]
                },
                { "type": "number", "enum": [2] }
              ]
            }
          )
        })

        it(`string | 1 | 2(with description)`, async () => {
          await assertDraft7(
            Schema.Union([
              Schema.String,
              Schema.Literal(1),
              Schema.Literal(2).annotate({ description: "2-description" })
            ]),
            {
              "anyOf": [
                { "type": "string" },
                { "type": "number", "enum": [1] },
                {
                  "type": "number",
                  "description": "2-description",
                  "enum": [2]
                }
              ]
            }
          )
        })
      })
    })

    describe("Suspend", () => {
      it("suspend(() => schema).annotate({ id: '...' })", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema: Schema.Schema<A> = Schema.suspend(() =>
          Schema.Struct({
            a: Schema.String,
            as: Schema.Array(schema)
          })
        ).annotate({ id: "ID" })
        await assertDraft7(schema, {
          "$ref": "#/$defs/ID",
          "$defs": {
            "ID": {
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
                    "$ref": "#/$defs/ID"
                  }
                }
              },
              "additionalProperties": false
            }
          }
        })
      })

      it("suspend(() => schema.annotate({ id: '...' }))", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema: Schema.Schema<A> = Schema.suspend(() =>
          Schema.Struct({
            a: Schema.String,
            as: Schema.Array(schema)
          }).annotate({ id: "ID" })
        )
        await assertDraft7(schema, {
          "$ref": "#/$defs/ID",
          "$defs": {
            "ID": {
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
                    "$ref": "#/$defs/ID"
                  }
                }
              },
              "additionalProperties": false
            }
          }
        })
      })

      it("inner annotation", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(
            Schema.suspend((): Schema.Schema<A> => schema).annotate({
              id: "ID"
            })
          )
        })
        await assertDraft7(schema, {
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
                "$ref": "#/$defs/ID"
              }
            }
          },
          "additionalProperties": false,
          "$defs": {
            "ID": {
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
                    "$ref": "#/$defs/ID"
                  }
                }
              },
              "additionalProperties": false
            }
          }
        })
      })

      it("outer annotation", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Schema<A> => schema))
        }).annotate({ id: "ID" })
        await assertDraft7(schema, {
          "$ref": "#/$defs/ID",
          "$defs": {
            "ID": {
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
                    "$ref": "#/$defs/ID"
                  }
                }
              },
              "additionalProperties": false
            }
          }
        })
      })

      it("should support mutually suspended schemas", async () => {
        interface Expression {
          readonly type: "expression"
          readonly value: number | Operation
        }

        interface Operation {
          readonly type: "operation"
          readonly operator: "+" | "-"
          readonly left: Expression
          readonly right: Expression
        }

        // intended outer suspend
        const Expression: Schema.Schema<Expression> = Schema.suspend(() =>
          Schema.Struct({
            type: Schema.Literal("expression"),
            value: Schema.Union([Schema.Number, Operation])
          })
        ).annotate({ id: "2ad5683a-878f-4e4d-909c-496e59ce62e0" })

        // intended outer suspend
        const Operation: Schema.Schema<Operation> = Schema.suspend(() =>
          Schema.Struct({
            type: Schema.Literal("operation"),
            operator: Schema.Union([Schema.Literal("+"), Schema.Literal("-")]),
            left: Expression,
            right: Expression
          })
        ).annotate({ id: "e0f2ce47-eac7-4991-8730-90ebe4e0ffda" })

        await assertDraft7(Operation, {
          "$ref": "#/$defs/e0f2ce47-eac7-4991-8730-90ebe4e0ffda",
          "$defs": {
            "e0f2ce47-eac7-4991-8730-90ebe4e0ffda": {
              "type": "object",
              "required": [
                "type",
                "operator",
                "left",
                "right"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["operation"]
                },
                "operator": {
                  "type": "string",
                  "enum": ["+", "-"]
                },
                "left": {
                  "$ref": "#/$defs/2ad5683a-878f-4e4d-909c-496e59ce62e0"
                },
                "right": {
                  "$ref": "#/$defs/2ad5683a-878f-4e4d-909c-496e59ce62e0"
                }
              },
              "additionalProperties": false
            },
            "2ad5683a-878f-4e4d-909c-496e59ce62e0": {
              "type": "object",
              "required": [
                "type",
                "value"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["expression"]
                },
                "value": {
                  "anyOf": [
                    {
                      "type": "number"
                    },
                    {
                      "$ref": "#/$defs/e0f2ce47-eac7-4991-8730-90ebe4e0ffda"
                    }
                  ]
                }
              },
              "additionalProperties": false
            }
          }
        })
      })
    })

    describe("Class", () => {
      it("should use the identifier as JSON Schema identifier", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({ a: Schema.String })) {}
        await assertDraft7(A, {
          "$defs": {
            "A": {
              "type": "object",
              "required": [
                "a"
              ],
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "additionalProperties": false
            }
          },
          "$ref": "#/$defs/A"
        })
      })

      it("type side json schema annotation", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({ a: Schema.String }), {
          id: "A2"
        }) {}
        await assertDraft7(A, {
          "$defs": {
            "A2": {
              "type": "object",
              "required": [
                "a"
              ],
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "additionalProperties": false
            }
          },
          "$ref": "#/$defs/A2"
        })
      })

      it("transformation side json schema annotation", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({ a: Schema.String }).annotate({ id: "A2" })) {}
        await assertDraft7(A, {
          "$defs": {
            "A2": {
              "type": "object",
              "required": [
                "a"
              ],
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "additionalProperties": false
            }
          },
          "$ref": "#/$defs/A2"
        })
      })

      it("should escape special characters in the $ref", async () => {
        class A extends Schema.Class<A>("~package/name")(Schema.Struct({ a: Schema.String })) {}
        await assertDraft7(A, {
          "$defs": {
            "~package/name": {
              "type": "object",
              "required": [
                "a"
              ],
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "additionalProperties": false
            }
          },
          "$ref": "#/$defs/~0package~1name"
        })
      })
    })

    it("compose", async () => {
      const schema = Schema.Struct({
        a: Schema.NonEmptyString.pipe(Schema.decodeTo(Schema.FiniteFromString))
      })
      await assertDraft7(schema, {
        "$defs": {
          "NonEmptyString": {
            "type": "string",
            "title": "nonEmptyString",
            "description": "a non empty string",
            "minLength": 1
          }
        },
        "type": "object",
        "required": [
          "a"
        ],
        "properties": {
          "a": {
            "$ref": "#/$defs/NonEmptyString"
          }
        },
        "additionalProperties": false
      })
    })

    describe("identifier annotation support", () => {
      it("String", async () => {
        await assertDraft7(Schema.String.annotate({ id: "ID" }), {
          "$defs": {
            "ID": {
              "type": "string"
            }
          },
          "$ref": "#/$defs/ID"
        })
        await assertDraft7(Schema.String.annotate({ id: "ID", description: "description" }), {
          "$defs": {
            "ID": {
              "type": "string",
              "description": "description"
            }
          },
          "$ref": "#/$defs/ID"
        })
      })

      it("Refinement", async () => {
        await assertDraft7(
          Schema.String.check(Check.minLength(2)).annotate({ id: "ID" }),
          {
            "$defs": {
              "ID": {
                "type": "string",
                "title": "minLength(2)",
                "description": "a string at least 2 character(s) long",
                "minLength": 2
              }
            },
            "$ref": "#/$defs/ID"
          }
        )
      })

      describe("Struct", () => {
        it("annotation", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.String
            }).annotate({ id: "ID" }),
            {
              "$defs": {
                "ID": {
                  "type": "object",
                  "required": ["a"],
                  "properties": {
                    "a": { "type": "string" }
                  },
                  "additionalProperties": false
                }
              },
              "$ref": "#/$defs/ID"
            }
          )
        })

        it("field annotations", async () => {
          const Name = Schema.String.annotate({
            id: "ID",
            description: "description"
          })
          const schema = Schema.Struct({
            a: Name
          })
          await assertDraft7(schema, {
            "$defs": {
              "ID": {
                "type": "string",
                "description": "description"
              }
            },
            "type": "object",
            "required": ["a"],
            "properties": {
              "a": {
                "$ref": "#/$defs/ID"
              }
            },
            "additionalProperties": false
          })
        })

        it("self annotation + field annotations", async () => {
          const Name = Schema.String.annotate({
            id: "b49f125d-1646-4eb5-8120-9524ab6039de",
            description: "703b7ff0-cb8d-49de-aeeb-05d92faa4599",
            title: "4b6d9ea6-7c4d-4073-a427-8d1b82fd1677"
          })
          await assertDraft7(
            Schema.Struct({
              a: Name
            }).annotate({ id: "7e559891-9143-4138-ae3e-81a5f0907380" }),
            {
              "$defs": {
                "7e559891-9143-4138-ae3e-81a5f0907380": {
                  "type": "object",
                  "required": ["a"],
                  "properties": {
                    "a": { "$ref": "#/$defs/b49f125d-1646-4eb5-8120-9524ab6039de" }
                  },
                  "additionalProperties": false
                },
                "b49f125d-1646-4eb5-8120-9524ab6039de": {
                  "type": "string",
                  "description": "703b7ff0-cb8d-49de-aeeb-05d92faa4599",
                  "title": "4b6d9ea6-7c4d-4073-a427-8d1b82fd1677"
                }
              },
              "$ref": "#/$defs/7e559891-9143-4138-ae3e-81a5f0907380"
            }
          )
        })

        it("deeply nested field annotations", async () => {
          const Name = Schema.String.annotate({
            id: "434a08dd-3f8f-4de4-b91d-8846aab1fb05",
            description: "eb183f5c-404c-4686-b78b-1bd00d18f8fd",
            title: "c0cbd438-1fb5-47fe-bf81-1ff5527e779a"
          })
          const schema = Schema.Struct({ a: Name, b: Schema.Struct({ c: Name }) })
          await assertDraft7(schema, {
            "$defs": {
              "434a08dd-3f8f-4de4-b91d-8846aab1fb05": {
                "type": "string",
                "description": "eb183f5c-404c-4686-b78b-1bd00d18f8fd",
                "title": "c0cbd438-1fb5-47fe-bf81-1ff5527e779a"
              }
            },
            "type": "object",
            "required": ["a", "b"],
            "properties": {
              "a": {
                "$ref": "#/$defs/434a08dd-3f8f-4de4-b91d-8846aab1fb05"
              },
              "b": {
                "type": "object",
                "required": ["c"],
                "properties": {
                  "c": { "$ref": "#/$defs/434a08dd-3f8f-4de4-b91d-8846aab1fb05" }
                },
                "additionalProperties": false
              }
            },
            "additionalProperties": false
          })
        })
      })

      describe("Union", () => {
        it("Union of literals with identifiers", async () => {
          await assertDraft7(
            Schema.Union([
              Schema.Literal("a").annotate({
                description: "ef296f1c-01fe-4a20-bd35-ed449c964c49",
                id: "170d659f-112e-4e3b-85db-464b668f2aed"
              }),
              Schema.Literal("b").annotate({
                description: "effbf54b-a62d-455b-86fa-97a5af46c6f3",
                id: "2a4e4f67-3732-4f7b-a505-856e51dd1578"
              })
            ]),
            {
              "$defs": {
                "170d659f-112e-4e3b-85db-464b668f2aed": {
                  "type": "string",
                  "enum": ["a"],
                  "description": "ef296f1c-01fe-4a20-bd35-ed449c964c49"
                },
                "2a4e4f67-3732-4f7b-a505-856e51dd1578": {
                  "type": "string",
                  "enum": ["b"],
                  "description": "effbf54b-a62d-455b-86fa-97a5af46c6f3"
                }
              },
              "anyOf": [
                { "$ref": "#/$defs/170d659f-112e-4e3b-85db-464b668f2aed" },
                { "$ref": "#/$defs/2a4e4f67-3732-4f7b-a505-856e51dd1578" }
              ]
            }
          )
        })
      })
    })

    describe("should encode the examples", () => {
      it("property signatures", async () => {
        const schema = Schema.Struct({
          a: Schema.FiniteFromString.annotateKey({ examples: [1, 2] })
        })
        await assertDraft7(schema, {
          "$defs": {
            "NumberFromString": {
              "description": "a string to be decoded into a number",
              "type": "string"
            }
          },
          "type": "object",
          "required": [
            "a"
          ],
          "properties": {
            "a": {
              "allOf": [
                {
                  "$ref": "#/$defs/NumberFromString"
                }
              ],
              "examples": ["1", "2"]
            }
          },
          "additionalProperties": false
        })
      })

      it("elements", async () => {
        const schema = Schema.Tuple([Schema.FiniteFromString.annotateKey({ examples: [1, 2] })])
        await assertDraft7(schema, {
          "$defs": {
            "NumberFromString": {
              "description": "a string to be decoded into a number",
              "type": "string"
            }
          },
          "type": "array",
          "items": [
            {
              "allOf": [
                {
                  "$ref": "#/$defs/NumberFromString"
                }
              ],
              "examples": ["1", "2"]
            }
          ],
          "minItems": 1,
          "additionalItems": false
        })
      })
    })

    it("Exit", async () => {
      const schema = Schema.Exit(
        Schema.String,
        Schema.Number,
        Schema.Defect
      )
      await assertDraft7(schema, {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "$defs": {
          "CauseEncoded0": {
            "anyOf": [
              {
                "type": "object",
                "required": [
                  "_tag"
                ],
                "properties": {
                  "_tag": {
                    "type": "string",
                    "enum": [
                      "Empty"
                    ]
                  }
                },
                "additionalProperties": false
              },
              {
                "type": "object",
                "required": [
                  "_tag",
                  "error"
                ],
                "properties": {
                  "_tag": {
                    "type": "string",
                    "enum": [
                      "Fail"
                    ]
                  },
                  "error": {
                    "type": "string"
                  }
                },
                "additionalProperties": false
              },
              {
                "type": "object",
                "required": [
                  "_tag",
                  "defect"
                ],
                "properties": {
                  "_tag": {
                    "type": "string",
                    "enum": [
                      "Die"
                    ]
                  },
                  "defect": {
                    "$ref": "#/$defs/Defect"
                  }
                },
                "additionalProperties": false
              },
              {
                "type": "object",
                "required": [
                  "_tag",
                  "fiberId"
                ],
                "properties": {
                  "_tag": {
                    "type": "string",
                    "enum": [
                      "Interrupt"
                    ]
                  },
                  "fiberId": {
                    "$ref": "#/$defs/FiberIdEncoded"
                  }
                },
                "additionalProperties": false
              },
              {
                "type": "object",
                "required": [
                  "_tag",
                  "left",
                  "right"
                ],
                "properties": {
                  "_tag": {
                    "type": "string",
                    "enum": [
                      "Sequential"
                    ]
                  },
                  "left": {
                    "$ref": "#/$defs/CauseEncoded0"
                  },
                  "right": {
                    "$ref": "#/$defs/CauseEncoded0"
                  }
                },
                "additionalProperties": false
              },
              {
                "type": "object",
                "required": [
                  "_tag",
                  "left",
                  "right"
                ],
                "properties": {
                  "_tag": {
                    "type": "string",
                    "enum": [
                      "Parallel"
                    ]
                  },
                  "left": {
                    "$ref": "#/$defs/CauseEncoded0"
                  },
                  "right": {
                    "$ref": "#/$defs/CauseEncoded0"
                  }
                },
                "additionalProperties": false
              }
            ],
            "title": "CauseEncoded<string>"
          },
          "Defect": {
            "$id": "/schemas/unknown",
            "title": "unknown"
          },
          "FiberIdEncoded": {
            "anyOf": [
              {
                "$ref": "#/$defs/FiberIdNoneEncoded"
              },
              {
                "$ref": "#/$defs/FiberIdRuntimeEncoded"
              },
              {
                "$ref": "#/$defs/FiberIdCompositeEncoded"
              }
            ]
          },
          "FiberIdNoneEncoded": {
            "type": "object",
            "required": [
              "_tag"
            ],
            "properties": {
              "_tag": {
                "type": "string",
                "enum": [
                  "None"
                ]
              }
            },
            "additionalProperties": false
          },
          "FiberIdRuntimeEncoded": {
            "type": "object",
            "required": [
              "_tag",
              "id",
              "startTimeMillis"
            ],
            "properties": {
              "_tag": {
                "type": "string",
                "enum": [
                  "Runtime"
                ]
              },
              "id": {
                "$ref": "#/$defs/Int"
              },
              "startTimeMillis": {
                "$ref": "#/$defs/Int"
              }
            },
            "additionalProperties": false
          },
          "Int": {
            "type": "integer",
            "description": "an integer",
            "title": "int"
          },
          "FiberIdCompositeEncoded": {
            "type": "object",
            "required": [
              "_tag",
              "left",
              "right"
            ],
            "properties": {
              "_tag": {
                "type": "string",
                "enum": [
                  "Composite"
                ]
              },
              "left": {
                "$ref": "#/$defs/FiberIdEncoded"
              },
              "right": {
                "$ref": "#/$defs/FiberIdEncoded"
              }
            },
            "additionalProperties": false
          }
        },
        "anyOf": [
          {
            "type": "object",
            "required": [
              "_tag",
              "cause"
            ],
            "properties": {
              "_tag": {
                "type": "string",
                "enum": [
                  "Failure"
                ]
              },
              "cause": {
                "$ref": "#/$defs/CauseEncoded0"
              }
            },
            "additionalProperties": false
          },
          {
            "type": "object",
            "required": [
              "_tag",
              "value"
            ],
            "properties": {
              "_tag": {
                "type": "string",
                "enum": [
                  "Success"
                ]
              },
              "value": {
                "type": "number"
              }
            },
            "additionalProperties": false
          }
        ],
        "title": "ExitEncoded<number, string, Defect>"
      })
    })

    describe("Schema.encodedCodec", () => {
      describe("Suspend", () => {
        it("without inner transformations", async () => {
          interface Category {
            readonly name: string
            readonly categories: ReadonlyArray<Category>
          }

          const schema: Schema.Schema<Category> = Schema.Struct({
            name: Schema.String,
            categories: Schema.Array(
              Schema.suspend(() => schema).annotate({ id: "ID" })
            )
          })

          await assertDraft7(Schema.encodedCodec(schema), {
            "type": "object",
            "required": [
              "name",
              "categories"
            ],
            "properties": {
              "name": {
                "type": "string"
              },
              "categories": {
                "type": "array",
                "items": {
                  "$ref": "#/$defs/IDEncoded"
                }
              }
            },
            "additionalProperties": false,
            "$defs": {
              "IDEncoded": {
                "type": "object",
                "required": [
                  "name",
                  "categories"
                ],
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "categories": {
                    "type": "array",
                    "items": {
                      "$ref": "#/$defs/IDEncoded"
                    }
                  }
                },
                "additionalProperties": false
              }
            }
          })
        })

        it("with inner transformations", async () => {
          interface Category {
            readonly name: number
            readonly categories: ReadonlyArray<Category>
          }
          interface CategoryEncoded {
            readonly name: string
            readonly categories: ReadonlyArray<CategoryEncoded>
          }

          const schema: Schema.Codec<Category, CategoryEncoded> = Schema.Struct({
            name: Schema.FiniteFromString,
            categories: Schema.Array(
              Schema.suspend(() => schema).annotate({ id: "ID" })
            )
          })

          await assertDraft7(Schema.encodedCodec(schema), {
            "type": "object",
            "required": [
              "name",
              "categories"
            ],
            "properties": {
              "name": {
                "type": "string",
                "description": "a string to be decoded into a number"
              },
              "categories": {
                "type": "array",
                "items": {
                  "$ref": "#/$defs/IDEncoded"
                }
              }
            },
            "additionalProperties": false,
            "$defs": {
              "IDEncoded": {
                "type": "object",
                "required": [
                  "name",
                  "categories"
                ],
                "properties": {
                  "name": {
                    "type": "string",
                    "description": "a string to be decoded into a number"
                  },
                  "categories": {
                    "type": "array",
                    "items": {
                      "$ref": "#/$defs/IDEncoded"
                    }
                  }
                },
                "additionalProperties": false
              }
            }
          })
        })
      })
    })

    describe("jsonSchema annotation support", () => {
      describe("Class", () => {
        it("custom annotation", async () => {
          class A extends Schema.Class<A>("A")(
            Schema.Struct({ a: Schema.String }).annotate({
              jsonSchema: {
                _tag: "Override",
                override: () => ({ "type": "string" })
              }
            })
          ) {}
          await assertDraft7(A, {
            "$defs": {
              "A": {
                "type": "string"
              }
            },
            "$ref": "#/$defs/A"
          })
        })

        it("should support typeSchema(Class) with custom annotation", async () => {
          class A extends Schema.Class<A>("A")(
            Schema.Struct({ a: Schema.String }).annotate({
              jsonSchema: {
                _tag: "Override",
                override: () => ({ "type": "string" })
              }
            })
          ) {}
          await assertDraft7(Schema.typeCodec(A), {
            "$defs": {
              "A": {
                "type": "string"
              }
            },
            "$ref": "#/$defs/A"
          })
        })
      })

      it("Declaration", async () => {
        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        class MyType {}
        const schema = Schema.declare<MyType>((x) => x instanceof MyType, {
          jsonSchema: {
            _tag: "Override",
            override: () => ({
              "type": "string",
              "description": "default-description"
            })
          }
        })
        await assertDraft7(schema, {
          "type": "string",
          "description": "default-description"
        })
        await assertDraft7(
          schema.annotate({
            description: "description"
          }),
          {
            "type": "string",
            "description": "description"
          }
        )
      })

      it("Void", async () => {
        await assertDraft7(
          Schema.Void.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          {
            "type": "string"
          }
        )
      })

      it("Never", async () => {
        await assertDraft7(
          Schema.Never.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          {
            "type": "string"
          }
        )
      })

      it("Literal", async () => {
        await assertDraft7(
          Schema.Literal("a").annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          {
            "type": "string"
          }
        )
      })

      it("Symbol", async () => {
        await assertDraft7(
          Schema.Symbol.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          {
            "type": "string"
          }
        )
      })

      it("UniqueSymbol", async () => {
        await assertDraft7(
          Schema.UniqueSymbol(Symbol.for("effect/schema/test/a")).annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          { "type": "string" }
        )
      })

      it("TemplateLiteral", async () => {
        await assertDraft7(
          Schema.TemplateLiteral([Schema.Literal("a"), Schema.String, Schema.Literal("b")]).annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          { "type": "string" }
        )
      })

      it("Undefined", async () => {
        await assertDraft7(
          Schema.Undefined.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          {
            "type": "string"
          }
        )
      })

      it("Unknown", async () => {
        await assertDraft7(
          Schema.Unknown.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          {
            "type": "string"
          }
        )
      })

      it("Any", async () => {
        await assertDraft7(
          Schema.Any.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          {
            "type": "string"
          }
        )
      })

      it("Object", async () => {
        await assertDraft7(
          Schema.Object.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          {
            "type": "string"
          }
        )
      })

      it("String", async () => {
        await assertDraft7(
          Schema.String.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({
                "type": "string",
                "description": "description",
                "format": "uuid"
              })
            }
          }),
          {
            "type": "string",
            "description": "description",
            "format": "uuid"
          }
        )
        await assertDraft7(
          Schema.String.annotate({
            id: "630d10c4-7030-45e7-894d-2c0bf5acadcf",
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string", "description": "description" })
            }
          }),
          {
            "$defs": {
              "630d10c4-7030-45e7-894d-2c0bf5acadcf": {
                "type": "string",
                "description": "description"
              }
            },
            "$ref": "#/$defs/630d10c4-7030-45e7-894d-2c0bf5acadcf"
          }
        )
      })

      it("Number", async () => {
        await assertDraft7(
          Schema.Number.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          { "type": "string" }
        )
      })

      it("BigInt", async () => {
        await assertDraft7(
          Schema.BigInt.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          { "type": "string" }
        )
      })

      it("Boolean", async () => {
        await assertDraft7(
          Schema.Boolean.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          {
            "type": "string"
          }
        )
      })

      it("Enums", async () => {
        enum Fruits {
          Apple,
          Banana
        }
        await assertDraft7(
          Schema.Enums(Fruits).annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          { "type": "string" }
        )
      })

      it("Tuple", async () => {
        await assertDraft7(
          Schema.Tuple([Schema.String, Schema.Number]).annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          { "type": "string" }
        )
      })

      it("Struct", async () => {
        await assertDraft7(
          Schema.Struct({ a: Schema.String, b: Schema.Number }).annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          { "type": "string" }
        )
      })

      it("Union", async () => {
        await assertDraft7(
          Schema.Union([Schema.String, Schema.Number]).annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          { "type": "string" }
        )
      })

      it("Suspend", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(
            Schema.suspend((): Schema.Schema<A> => schema).annotate({ jsonSchema: { "type": "string" } })
          )
        })

        await assertDraft7(schema, {
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
                "type": "string"
              }
            }
          },
          "additionalProperties": false
        })
      })

      describe("Refinement", () => {
        it("Int", async () => {
          await assertDraft7(
            Schema.Int.annotate({
              jsonSchema: {
                _tag: "Override",
                override: () => ({ "type": "string" })
              }
            }),
            {
              "type": "string"
            }
          )
        })

        it("custom", async () => {
          await assertDraft7(
            Schema.String.check(Check.make(() => true, {
              jsonSchema: {
                _tag: "Constraint",
                constraint: () => ({})
              }
            })).annotate({
              id: "ID"
            }),
            {
              "$ref": "#/$defs/ID",
              "$defs": {
                "ID": {
                  "type": "string"
                }
              }
            }
          )
        })
      })

      it("Transformation", async () => {
        await assertDraft7(
          Schema.FiniteFromString.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string" })
            }
          }),
          { "type": "string" }
        )
      })

      it("refinement of a transformation with an override annotation", async () => {
        await assertDraft7(
          Schema.Date.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "type": "string", "format": "date-time" })
            }
          }),
          { "format": "date-time", "type": "string" }
        )
        await assertDraft7(
          Schema.Date.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "anyOf": [{ "type": "object" }, { "type": "array" }] })
            }
          }),
          {
            "anyOf": [{ "type": "object" }, { "type": "array" }]
          }
        )
        await assertDraft7(
          Schema.Date.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "$ref": "x" })
            }
          }),
          { "$ref": "x" }
        )
        await assertDraft7(
          Schema.Date.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "const": 1 })
            }
          }),
          { "const": 1 }
        )
        await assertDraft7(
          Schema.Date.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "enum": [1] })
            }
          }),
          { "enum": [1] }
        )
      })

      it("refinement of a transformation without an override annotation", async () => {
        await assertDraft7(Schema.Trim.check(Check.nonEmpty()), {
          "type": "string",
          "description": "a string that will be trimmed"
        })
        await assertDraft7(
          Schema.Trim.check(Check.nonEmpty({
            jsonSchema: {
              _tag: "Constraint",
              constraint: () => ({ "description": "description" })
            }
          })),
          {
            "type": "string",
            "description": "a string that will be trimmed"
          }
        )
        await assertDraft7(
          Schema.Trim.check(Check.nonEmpty()).annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ "description": "description" })
            }
          }),
          {
            "description": "description"
          }
        )
      })

      describe("Pruning `undefined` and make the property optional by default", () => {
        it.todo("Undefined", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.Undefined
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": {
                  "not": {}
                }
              },
              "additionalProperties": false
            }
          )
        })

        it("UndefinedOr(Undefined)", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.UndefinedOr(Schema.Undefined)
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": {
                  "not": {}
                }
              },
              "additionalProperties": false
            }
          )
        })

        it("Nested `Undefined`s", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.UndefinedOr(Schema.UndefinedOr(Schema.Undefined))
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": {
                  "not": {}
                }
              },
              "additionalProperties": false
            }
          )
        })

        it("Schema.optional", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.optional(Schema.String)
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": { "type": "string" }
              },
              "additionalProperties": false
            }
          )
        })

        it("Schema.optional + inner annotation", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.optional(Schema.String.annotate({ description: "inner" }))
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": {
                  "type": "string",
                  "description": "inner"
                }
              },
              "additionalProperties": false
            }
          )
        })

        it("Schema.optional + outer annotation should override inner annotation", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.optional(Schema.String.annotate({ description: "inner" })).annotate({
                description: "outer"
              })
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": {
                  "type": "string",
                  "description": "outer"
                }
              },
              "additionalProperties": false
            }
          )
        })

        it("UndefinedOr", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.UndefinedOr(Schema.String)
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "additionalProperties": false
            }
          )
        })

        it("UndefinedOr + inner annotation", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.UndefinedOr(Schema.String.annotate({ description: "inner" }))
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": {
                  "type": "string",
                  "description": "inner"
                }
              },
              "additionalProperties": false
            }
          )
        })

        it.todo("UndefinedOr + annotation should not override inner annotations", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.UndefinedOr(Schema.String.annotate({ description: "inner" })).annotate({
                description: "middle"
              })
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": {
                  "type": "string",
                  "description": "inner"
                }
              },
              "additionalProperties": false
            }
          )
        })

        it("UndefinedOr + propertySignature annotation should override inner and middle annotations", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.UndefinedOr(Schema.String.annotate({ description: "inner" })).annotate({
                description: "middle"
              }).annotateKey({ description: "outer" })
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": {
                  "type": "string",
                  "description": "outer"
                }
              },
              "additionalProperties": false
            }
          )
        })

        it.todo("UndefinedOr + jsonSchema annotation should keep the property required", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.UndefinedOr(Schema.String).annotate({
                jsonSchema: {
                  _tag: "Override",
                  override: () => ({ "type": "string" })
                }
              })
            }),
            {
              "type": "object",
              "required": ["a"],
              "properties": {
                "a": { "type": "string" }
              },
              "additionalProperties": false
            }
          )
        })

        it.todo("Suspend", async () => {
          await assertDraft7(
            Schema.Struct({
              a: Schema.suspend(() => Schema.UndefinedOr(Schema.String))
            }),
            {
              "type": "object",
              "required": [],
              "properties": {
                "a": {
                  "type": "string"
                }
              },
              "additionalProperties": false
            }
          )
        })
      })
    })

    describe("Draft 2019-09", () => {
      describe("nullable handling", () => {
        it("Null", async () => {
          const schema = Schema.Null
          await assertDraft202012(schema, { "type": "null" })
        })

        it("NullOr(String)", async () => {
          const schema = Schema.NullOr(Schema.String)
          await assertDraft202012(schema, {
            "anyOf": [
              { "type": "string" },
              { "type": "null" }
            ]
          })
        })

        it("NullOr(Any)", async () => {
          const schema = Schema.NullOr(Schema.Any)
          await assertDraft202012(schema, {
            "anyOf": [
              {},
              { "type": "null" }
            ]
          })
        })

        it("NullOr(Unknown)", async () => {
          const schema = Schema.NullOr(Schema.Unknown)
          await assertDraft202012(schema, {
            "anyOf": [
              {},
              { "type": "null" }
            ]
          })
        })

        it("NullOr(Void)", async () => {
          const schema = Schema.NullOr(Schema.Void)
          await assertDraft202012(schema, {
            "anyOf": [
              {},
              { "type": "null" }
            ]
          })
        })

        it("Literal | null", async () => {
          const schema = Schema.Union([Schema.Literal("a"), Schema.Null])
          await assertDraft202012(schema, {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              { "type": "null" }
            ]
          })
        })

        it("Literal | null(with description)", async () => {
          const schema = Schema.Union([Schema.Literal("a"), Schema.Null.annotate({ description: "mydescription" })])
          await assertDraft202012(schema, {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "null",
                "description": "mydescription"
              }
            ]
          })
        })

        it("Nested nullable unions", async () => {
          const schema = Schema.Union([Schema.NullOr(Schema.String), Schema.Literal("a"), Schema.Null])
          await assertDraft202012(schema, {
            "anyOf": [
              {
                "anyOf": [
                  { "type": "string" },
                  { "type": "null" }
                ]
              },
              { "type": "string", "enum": ["a"] },
              { "type": "null" }
            ]
          })
        })
      })

      it("fromJsonString handling", async () => {
        const schema = Schema.fromJsonString(Schema.Struct({
          a: Schema.fromJsonString(Schema.FiniteFromString)
        }))
        await assertDraft202012(
          schema,
          {
            "type": "string",
            "contentMediaType": "application/json",
            "contentSchema": {
              "type": "object",
              "required": ["a"],
              "properties": {
                "a": {
                  "type": "string",
                  "contentMediaType": "application/json",
                  "contentSchema": {
                    "type": "string"
                  }
                }
              },
              "additionalProperties": false
            }
          }
        )
      })
    })

    describe("OpenAPI 3.1", () => {
      describe("nullable handling", () => {
        it("Null", async () => {
          const schema = Schema.Null
          await assertOpenApi3_1(schema, { "type": "null" })
        })

        it("NullOr(String)", async () => {
          const schema = Schema.NullOr(Schema.String)
          await assertOpenApi3_1(schema, {
            "anyOf": [
              { "type": "string" },
              { "type": "null" }
            ]
          })
        })

        it("NullOr(Any)", async () => {
          const schema = Schema.NullOr(Schema.Any)
          await assertOpenApi3_1(schema, {
            "anyOf": [
              {},
              { "type": "null" }
            ]
          })
        })

        it("NullOr(Unknown)", async () => {
          const schema = Schema.NullOr(Schema.Unknown)
          await assertOpenApi3_1(schema, {
            "anyOf": [
              {},
              { "type": "null" }
            ]
          })
        })

        it("NullOr(Void)", async () => {
          const schema = Schema.NullOr(Schema.Void)
          await assertOpenApi3_1(schema, {
            "anyOf": [
              {},
              { "type": "null" }
            ]
          })
        })

        it("Literal | null", async () => {
          const schema = Schema.Union([Schema.Literal("a"), Schema.Null])
          await assertOpenApi3_1(schema, {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              { "type": "null" }
            ]
          })
        })

        it("Literal | null(with description)", async () => {
          const schema = Schema.Union([Schema.Literal("a"), Schema.Null.annotate({ description: "mydescription" })])
          await assertOpenApi3_1(schema, {
            "anyOf": [
              {
                "type": "string",
                "enum": ["a"]
              },
              {
                "type": "null",
                "description": "mydescription"
              }
            ]
          })
        })

        it("Nested nullable unions", async () => {
          const schema = Schema.Union([Schema.NullOr(Schema.String), Schema.Literal("a"), Schema.Null])
          await assertOpenApi3_1(schema, {
            "anyOf": [
              {
                "anyOf": [
                  { "type": "string" },
                  { "type": "null" }
                ]
              },
              { "type": "string", "enum": ["a"] },
              { "type": "null" }
            ]
          })
        })
      })

      it("fromJsonString handling", async () => {
        const schema = Schema.fromJsonString(Schema.Struct({
          a: Schema.fromJsonString(Schema.FiniteFromString)
        }))
        await assertOpenApi3_1(
          schema,
          {
            "type": "string",
            "contentMediaType": "application/json",
            "contentSchema": {
              "type": "object",
              "required": ["a"],
              "properties": {
                "a": {
                  "type": "string",
                  "contentMediaType": "application/json",
                  "contentSchema": {
                    "type": "string"
                  }
                }
              },
              "additionalProperties": false
            }
          }
        )
      })
    })
  })
})
*/
