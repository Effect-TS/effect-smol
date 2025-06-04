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
    expected: SchemaToJsonSchema.Root
  ) {
    const jsonSchema = SchemaToJsonSchema.make(schema, options)
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

  describe("Any", () => {
    it("Any", async () => {
      const schema = Schema.Any
      assertDraft7(schema, {})
    })

    it("Any & annotations", async () => {
      const schema = Schema.Any.annotate({
        title: "title",
        description: "description",
        default: "default",
        examples: ["a"]
      })
      assertDraft7(schema, {
        title: "title",
        description: "description",
        default: "default",
        examples: ["a"]
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
        default: null,
        examples: [null]
      })
      assertDraft7(schema, {
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
        default: "default",
        examples: ["a"]
      })
      assertDraft7(schema, {
        type: "string",
        title: "title",
        description: "description",
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
        default: "default",
        examples: ["a"]
      }).check(SchemaCheck.minLength(1))
      assertDraft7(schema, {
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
      const schema = Schema.String.check(SchemaCheck.minLength(1)).annotate({
        title: "title",
        description: "description",
        default: "default",
        examples: ["a"]
      })
      assertDraft7(schema, {
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
        default: 1,
        examples: [2]
      })
      assertDraft7(schema, {
        type: "number",
        title: "title",
        description: "description",
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
        default: 1,
        examples: [2]
      }).check(SchemaCheck.int)
      assertDraft7(schema, {
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
        default: ["a"],
        examples: [["a"]]
      })
      assertDraft7(schema, {
        type: "array",
        items: { type: "string" },
        title: "title",
        description: "description",
        default: ["a"],
        examples: [["a"]]
      })
    })
  })

  describe("Tuple", () => {
    describe("draft-07", () => {
      it("Tuple", async () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number])
        assertDraft7(schema, {
          type: "array",
          items: [{ type: "string" }, { type: "number" }]
        })
      })

      it("Tuple & annotations", async () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number]).annotate({
          title: "title",
          description: "description",
          default: ["a", 1],
          examples: [["a", 1]]
        })
        assertDraft7(schema, {
          type: "array",
          items: [{ type: "string" }, { type: "number" }],
          title: "title",
          description: "description",
          default: ["a", 1],
          examples: [["a", 1]]
        })
      })
    })
  })

  describe("draft-2020-12", () => {
    it("Tuple", async () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number])
      assertDraft202012(schema, {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }],
        items: false
      })
    })

    it("Tuple & annotations", async () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number]).annotate({
        title: "title",
        description: "description",
        default: ["a", 1],
        examples: [["a", 1]]
      })
      assertDraft202012(schema, {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }],
        title: "title",
        description: "description",
        default: ["a", 1],
        examples: [["a", 1]],
        items: false
      })
    })
  })
})
