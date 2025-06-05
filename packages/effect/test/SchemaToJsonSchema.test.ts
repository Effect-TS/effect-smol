// eslint-disable-next-line import-x/no-named-as-default
import Ajv from "ajv"
import { Schema, SchemaCheck, SchemaToJsonSchema } from "effect"
import { describe, it } from "vitest"
import { assertFalse, assertTrue, deepStrictEqual, throws } from "./utils/assert.js"

const ajvOptions: Ajv.Options = {
  strictTuples: false,
  allowMatchingProperties: true
}

function getAjvValidate(jsonSchema: SchemaToJsonSchema.Root): Ajv.ValidateFunction {
  return new Ajv.default(ajvOptions).compile(jsonSchema)
}

function assertJsonSchema(options: SchemaToJsonSchema.Options) {
  return function<S extends Schema.Top>(
    schema: S,
    expected: SchemaToJsonSchema.Root,
    overrideOptions?: SchemaToJsonSchema.Options
  ) {
    const jsonSchema = SchemaToJsonSchema.make(schema, { ...options, ...overrideOptions })
    const $SCHEMA = SchemaToJsonSchema.getTargetSchema(options.target)
    deepStrictEqual(jsonSchema, {
      "$schema": $SCHEMA,
      ...expected
    })
    return jsonSchema
  }
}

const assertDraft7 = assertJsonSchema({
  target: "draft-07"
})

const assertDraft202012 = assertJsonSchema({
  target: "draft-2020-12"
})

function assertAjvSuccess<S extends Schema.Top>(
  schema: S,
  input: S["Type"]
) {
  const jsonSchema = SchemaToJsonSchema.make(schema)
  const validate = getAjvValidate(jsonSchema)
  assertTrue(validate(input))
}

function assertAjvFailure<S extends Schema.Top>(
  schema: S,
  input: unknown
) {
  const jsonSchema = SchemaToJsonSchema.make(schema)
  const validate = getAjvValidate(jsonSchema)
  assertFalse(validate(input))
}

describe("SchemaToJsonSchema", () => {
  describe("Declaration", () => {
    it("should throw if the schema is a declaration", async () => {
      const schema = Schema.Option(Schema.String)
      throws(() => SchemaToJsonSchema.make(schema), new Error(`cannot generate JSON Schema for Declaration at root`))
    })
  })

  describe("Void", () => {
    it("should throw if the schema is a Void", async () => {
      const schema = Schema.Void
      throws(() => SchemaToJsonSchema.make(schema), new Error(`cannot generate JSON Schema for VoidKeyword at root`))
    })
  })

  describe("Undefined", () => {
    it("should throw if the schema is a declaration", async () => {
      const schema = Schema.Undefined
      throws(
        () => SchemaToJsonSchema.make(schema),
        new Error(`cannot generate JSON Schema for UndefinedKeyword at root`)
      )
    })
  })

  describe("BigInt", () => {
    it("should throw if the schema is a declaration", async () => {
      const schema = Schema.BigInt
      throws(
        () => SchemaToJsonSchema.make(schema),
        new Error(`cannot generate JSON Schema for BigIntKeyword at root`)
      )
    })
  })

  describe("Symbol", () => {
    it("should throw if the schema is a declaration", async () => {
      const schema = Schema.Symbol
      throws(
        () => SchemaToJsonSchema.make(schema),
        new Error(`cannot generate JSON Schema for SymbolKeyword at root`)
      )
    })
  })

  describe("UniqueSymbol", () => {
    it("should throw if the schema is a declaration", async () => {
      const schema = Schema.UniqueSymbol(Symbol.for("a"))
      throws(
        () => SchemaToJsonSchema.make(schema),
        new Error(`cannot generate JSON Schema for UniqueSymbol at root`)
      )
    })
  })

  describe("Any", () => {
    it("Any", async () => {
      const schema = Schema.Any
      assertDraft7(schema, {})
    })

    it("Any & annotations", async () => {
      const schema = Schema.Any.annotate({
        title: "title",
        description: "description",
        documentation: "documentation",
        default: "default",
        examples: ["a"]
      })
      assertDraft7(schema, {
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
      assertDraft7(schema, {})
    })

    it("Unknown & annotations", async () => {
      const schema = Schema.Unknown.annotate({
        title: "title",
        description: "description",
        documentation: "documentation",
        default: "default",
        examples: ["a"]
      })
      assertDraft7(schema, {
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
      assertDraft7(schema, {
        not: {}
      })
    })

    it("Never & annotations", async () => {
      const schema = Schema.Never.annotate({
        title: "title",
        description: "description"
      })
      assertDraft7(schema, {
        not: {},
        title: "title",
        description: "description"
      })
    })
  })

  describe("Null", () => {
    it("Null", async () => {
      const schema = Schema.Null
      assertDraft7(schema, {
        type: "null"
      })
      assertAjvSuccess(schema, null)
      assertAjvFailure(schema, "a")
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
      assertDraft7(schema, {
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
      assertDraft7(schema, {
        type: "string"
      })
      assertAjvSuccess(schema, "a")
      assertAjvFailure(schema, null)
    })

    it("String & annotations", async () => {
      const schema = Schema.String.annotate({
        title: "title",
        description: "description",
        documentation: "documentation",
        default: "default",
        examples: ["a"]
      })
      assertDraft7(schema, {
        type: "string",
        title: "title",
        description: "description",
        documentation: "documentation",
        default: "default",
        examples: ["a"]
      })
    })

    it("String & minLength", async () => {
      const schema = Schema.String.check(SchemaCheck.minLength(1))
      assertDraft7(schema, {
        type: "string",
        minLength: 1,
        title: "minLength(1)",
        description: "a value with a length of at least 1"
      })
    })

    it("String & minLength & maxlength", async () => {
      const schema = Schema.String.check(SchemaCheck.minLength(1), SchemaCheck.maxLength(2))
      assertDraft7(schema, {
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
      }).check(SchemaCheck.minLength(1))
      assertDraft7(schema, {
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
      const schema = Schema.String.check(SchemaCheck.minLength(1)).annotate({
        title: "title",
        description: "description",
        documentation: "documentation",
        default: "default",
        examples: ["a"]
      })
      assertDraft7(schema, {
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

    it("String & minLength(1) & minLength(2)", async () => {
      const schema = Schema.String.check(SchemaCheck.minLength(1), SchemaCheck.minLength(2))
      assertDraft7(schema, {
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
      const schema = Schema.String.check(SchemaCheck.minLength(2), SchemaCheck.minLength(1))
      assertDraft7(schema, {
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
      assertDraft7(schema, {
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
      assertDraft7(schema, {
        type: "number",
        title: "title",
        description: "description",
        documentation: "documentation",
        default: 1,
        examples: [2]
      })
    })

    it("Integer", async () => {
      const schema = Schema.Number.check(SchemaCheck.int)
      assertDraft7(schema, {
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
      }).check(SchemaCheck.int)
      assertDraft7(schema, {
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
      assertDraft7(schema, {
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
      assertDraft7(schema, {
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
      assertDraft7(schema, {
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
      assertDraft7(schema, {
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
        () => SchemaToJsonSchema.make(schema),
        new Error(`cannot generate JSON Schema for LiteralType at root`)
      )
    })

    it("string", () => {
      const schema = Schema.Literal("a")
      assertDraft7(schema, {
        type: "string",
        enum: ["a"]
      })
    })

    it("string & annotations", () => {
      const schema = Schema.Literal("a").annotate({
        title: "title",
        description: "description",
        documentation: "documentation",
        default: "a",
        examples: ["a"]
      })
      assertDraft7(schema, {
        type: "string",
        enum: ["a"],
        title: "title",
        description: "description",
        documentation: "documentation",
        default: "a",
        examples: ["a"]
      })
    })

    it("number", () => {
      const schema = Schema.Literal(1)
      assertDraft7(schema, {
        type: "number",
        enum: [1]
      })
    })

    it("number & annotations", () => {
      const schema = Schema.Literal(1).annotate({
        title: "title",
        description: "description",
        documentation: "documentation",
        default: 1,
        examples: [1]
      })
      assertDraft7(schema, {
        type: "number",
        enum: [1],
        title: "title",
        description: "description",
        documentation: "documentation",
        default: 1,
        examples: [1]
      })
    })

    it("boolean", () => {
      const schema = Schema.Literal(true)
      assertDraft7(schema, {
        type: "boolean",
        enum: [true]
      })
    })

    it("boolean & annotations", () => {
      const schema = Schema.Literal(true).annotate({
        title: "title",
        description: "description",
        documentation: "documentation",
        default: true,
        examples: [true]
      })
      assertDraft7(schema, {
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
    it("strings", () => {
      const schema = Schema.Literals(["a", "b"])
      assertDraft7(schema, {
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

    it("Enums", () => {
      const schema = Schema.Enums(Fruits)
      assertDraft7(schema, {
        anyOf: [
          { type: "number", enum: [0], title: "Apple" },
          { type: "number", enum: [1], title: "Banana" },
          { type: "string", enum: ["orange"], title: "Orange" }
        ]
      })
    })

    it("Enums & annotations", () => {
      const schema = Schema.Enums(Fruits).annotate({
        title: "title",
        description: "description",
        documentation: "documentation",
        default: Fruits.Apple,
        examples: [Fruits.Banana, "orange"]
      })
      assertDraft7(schema, {
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
    it("TemplateLiteral", () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String])
      assertDraft7(schema, {
        type: "string",
        pattern: "^(a)([\\s\\S]*)$"
      })
    })

    it("TemplateLiteral & annotations", () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String]).annotate({
        title: "title",
        description: "description",
        documentation: "documentation",
        default: "a",
        examples: ["a"]
      })
      assertDraft7(schema, {
        type: "string",
        pattern: "^(a)([\\s\\S]*)$",
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
      assertDraft7(schema, {
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
      assertDraft7(schema, {
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

  describe("Tuple", () => {
    describe("draft-07", () => {
      it("empty tuple", () => {
        const schema = Schema.Tuple([])
        assertDraft7(schema, {
          type: "array",
          items: false
        })
      })

      it("required elements", async () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number])
        assertDraft7(schema, {
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
        assertDraft7(schema, {
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
        assertDraft7(schema, {
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
        assertDraft7(schema, {
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
        assertDraft7(schema, {
          type: "array",
          items: [{ type: "string" }, { type: "number" }],
          minItems: 1,
          additionalItems: false
        })
      })
    })
  })

  describe("draft-2020-12", () => {
    it("empty tuple", () => {
      const schema = Schema.Tuple([])
      assertDraft202012(schema, {
        type: "array",
        items: false
      })
    })

    it("required elements", async () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number])
      assertDraft202012(schema, {
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
      assertDraft202012(schema, {
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
      assertDraft202012(schema, {
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
      assertDraft202012(schema, {
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
      assertDraft202012(schema, {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }],
        minItems: 1,
        items: false
      })
    })
  })

  describe("Object", () => {
    it("required properties", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })
      assertDraft7(schema, {
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
      assertDraft7(schema, {
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
      assertDraft7(schema, {
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
      assertDraft7(schema, {
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
      assertDraft7(schema, {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: {
          type: "number"
        }
      })
    })

    it("Record(String & minLength(1), Number) & annotations", async () => {
      const schema = Schema.Record(Schema.String.check(SchemaCheck.minLength(1)), Schema.Number)
      assertDraft7(schema, {
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
      assertDraft7(schema, {
        type: "object",
        properties: {},
        required: [],
        patternProperties: {
          "^(a)([\\s\\S]*)$": {
            type: "number"
          }
        }
      })
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
      assertDraft7(schema, {
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

    it("outer annotation", () => {
      interface A {
        readonly a: string
        readonly as: ReadonlyArray<A>
      }
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema).annotate({ identifier: "A" }))
      })
      assertDraft7(schema, {
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

    it("top annotation", () => {
      interface A {
        readonly a: string
        readonly as: ReadonlyArray<A>
      }
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
      }).annotate({ identifier: "A" })
      assertDraft7(schema, {
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

    it(`top annotation but topLevelReferenceStrategy === "skip"`, () => {
      interface A {
        readonly a: string
        readonly as: ReadonlyArray<A>
      }
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
      }).annotate({ identifier: "A" })
      assertDraft7(schema, {
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
      assertDraft7(schema, {
        type: "object",
        properties: {
          a: { type: "string" }
        },
        required: ["a"],
        additionalProperties: false
      })
    })
  })

  describe("identifier", () => {
    it(`topLevelReferenceStrategy: "keep"`, () => {
      const schema = Schema.String.annotate({ identifier: "A" })
      assertDraft7(schema, {
        "$ref": "#/$defs/A",
        "$defs": {
          "A": {
            "type": "string"
          }
        }
      })
    })

    it(`topLevelReferenceStrategy: "skip"`, () => {
      const schema = Schema.String.annotate({ identifier: "A" })
      assertDraft7(schema, {
        "type": "string"
      }, {
        topLevelReferenceStrategy: "skip"
      })
    })
  })

  describe("override jsonSchema annotation", () => {
    it("pre check", () => {
      const schema = Schema.Number.check(SchemaCheck.greaterThan(0)).annotate({
        jsonSchema: {
          type: "override",
          override: (jsonSchema) => ({ ...jsonSchema, type: "integer" })
        }
      })
      assertDraft7(schema, {
        "type": "integer",
        "description": "a value greater than 0",
        "exclusiveMinimum": 0,
        "title": "greaterThan(0)"
      })
    })

    it("post check", () => {
      const schema = Schema.Number.check(SchemaCheck.greaterThan(0)).annotate({
        jsonSchema: {
          type: "override",
          override: (jsonSchema) => ({ ...jsonSchema, type: "integer" })
        }
      }).check(SchemaCheck.lessThan(5))
      assertDraft7(schema, {
        "type": "integer",
        "description": "a value greater than 0",
        "exclusiveMinimum": 0,
        "title": "greaterThan(0)",
        "allOf": [
          {
            "description": "a value less than 5",
            "exclusiveMaximum": 5,
            "title": "lessThan(5)"
          }
        ]
      })
    })
  })
})
