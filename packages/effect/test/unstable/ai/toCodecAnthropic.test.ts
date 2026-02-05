import { assert, describe, it } from "@effect/vitest"
import { type JsonSchema, Schema } from "effect"
import { TestSchema } from "effect/testing"
import { toCodecAnthropic } from "effect/unstable/ai/toCodecAnthropic"

function assertJsonSchema(schema: Schema.Top, expected: JsonSchema.JsonSchema) {
  const document = Schema.toJsonSchemaDocument(toCodecAnthropic(schema))
  const jsonSchema = Object.keys(document.definitions).length > 0 ?
    {
      ...document.schema,
      $defs: document.definitions
    } :
    document.schema
  assert.deepStrictEqual(jsonSchema, expected)
}

function assertError(schema: Schema.Top, message: string) {
  assert.throws(() => toCodecAnthropic(schema), message)
}

describe("toCodecAnthropic", () => {
  describe("Unsupported AST", () => {
    it("Undefined", () => {
      assertError(Schema.Undefined, "Unsupported AST Undefined")
    })

    it("suspend", () => {
      interface A {
        readonly a: string
        readonly as: ReadonlyArray<A>
      }
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
      })
      assertError(Schema.suspend(() => Schema.String), "Unsupported AST Suspend")
      assertError(schema, "Unsupported AST Suspend")
    })

    it("Arrays + post-rest elements", () => {
      assertError(
        Schema.TupleWithRest(Schema.Tuple([]), [Schema.String, Schema.String]),
        "Post-rest elements are not supported for arrays"
      )
    })

    it("Unsupported property signature name", () => {
      assertError(
        Schema.Struct({ [Symbol.for("effect/Schema/test/a")]: Schema.String }),
        "Property names must be strings"
      )
    })
  })

  it("Null", () => {
    assertJsonSchema(Schema.Null, {
      "type": "null"
    })
  })

  describe("String", () => {
    it("String", () => {
      assertJsonSchema(Schema.String, {
        "type": "string"
      })
      assertJsonSchema(Schema.String.annotate({ description: "description" }), {
        "type": "string",
        "description": "description"
      })
      assertJsonSchema(Schema.String.annotate({ title: "title" }), {
        "type": "string",
        "description": "title"
      })
    })

    it("String + supported format", () => {
      assertJsonSchema(Schema.String.annotate({ format: "date-time" }), {
        "type": "string",
        "format": "date-time"
      })
    })

    it("String + unsupported format", () => {
      assertJsonSchema(Schema.String.annotate({ format: "int32" }), {
        "type": "string",
        "description": "a value with a format of int32"
      })
    })

    it("String + isMinLength", () => {
      assertJsonSchema(Schema.String.check(Schema.isMinLength(1)), {
        "type": "string",
        "description": "a value with a length of at least 1"
      })
    })

    it("String + isMinLength + isMaxLength", () => {
      assertJsonSchema(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(2)), {
        "type": "string",
        "description": "a value with a length of at least 1 and a value with a length of at most 2"
      })
    })

    it("String + startsWith", () => {
      assertJsonSchema(Schema.String.check(Schema.isStartsWith("a")), {
        "type": "string",
        "description": `a string starting with "a"`,
        "allOf": [
          { "pattern": "^a" }
        ]
      })
    })

    it("String + startsWith + endsWith", () => {
      assertJsonSchema(Schema.String.check(Schema.isStartsWith("a"), Schema.isEndsWith("b")), {
        "type": "string",
        "description": `a string starting with "a" and a string ending with "b"`,
        "allOf": [
          { "pattern": "^a" },
          { "pattern": "b$" }
        ]
      })
    })

    it("String + pattern", () => {
      assertJsonSchema(Schema.String.check(Schema.isPattern(/^a/)), {
        "type": "string",
        "description": `a string matching the RegExp ^a`,
        "allOf": [
          { "pattern": "^a" }
        ]
      })
    })
  })

  it("Number", () => {
    assertJsonSchema(Schema.Number, {
      "anyOf": [
        { "type": "number" },
        { "type": "string", "enum": ["NaN"] },
        { "type": "string", "enum": ["Infinity"] },
        { "type": "string", "enum": ["-Infinity"] }
      ]
    })
  })

  describe("Finite", () => {
    it("Finite", () => {
      assertJsonSchema(Schema.Finite, {
        "type": "number"
      })
      assertJsonSchema(Schema.Finite.annotate({ description: "description" }), {
        "type": "number",
        "description": "description"
      })
      assertJsonSchema(Schema.Finite.annotate({ title: "title" }), {
        "type": "number",
        "description": "title"
      })
    })

    it("Finite + supported format", () => {
      assertJsonSchema(Schema.Finite.annotate({ format: "duration" }), {
        "type": "number",
        "format": "duration"
      })
    })

    it("Finite + unsupported format", () => {
      assertJsonSchema(Schema.Finite.annotate({ format: "int32" }), {
        "type": "number",
        "description": "a value with a format of int32"
      })
    })

    it("Finite + minimum", () => {
      assertJsonSchema(Schema.Finite.check(Schema.isGreaterThan(1)), {
        "type": "number",
        "description": "a value greater than 1"
      })
    })

    it("Finite + minimum + maximum", () => {
      assertJsonSchema(Schema.Finite.check(Schema.isGreaterThan(1), Schema.isLessThan(2)), {
        "type": "number",
        "description": "a value greater than 1 and a value less than 2"
      })
    })
  })

  describe("Int", () => {
    it("Int", () => {
      assertJsonSchema(Schema.Int, {
        "type": "integer"
      })
      assertJsonSchema(Schema.Int.annotate({ description: "description" }), {
        "type": "integer",
        "description": "description"
      })
      assertJsonSchema(Schema.Int.annotate({ title: "title" }), {
        "type": "integer",
        "description": "title"
      })
    })

    it("Int + supported format", () => {
      assertJsonSchema(Schema.Int.annotate({ format: "duration" }), {
        "type": "integer",
        "format": "duration"
      })
    })

    it("Int + unsupported format", () => {
      assertJsonSchema(Schema.Int.annotate({ format: "int32" }), {
        "type": "integer",
        "description": "a value with a format of int32"
      })
    })

    it("Int + minimum", () => {
      assertJsonSchema(Schema.Int.check(Schema.isGreaterThan(1)), {
        "type": "integer",
        "description": "a value greater than 1"
      })
    })

    it("Int + minimum + maximum", () => {
      assertJsonSchema(Schema.Int.check(Schema.isGreaterThan(1), Schema.isLessThan(2)), {
        "type": "integer",
        "description": "a value greater than 1 and a value less than 2"
      })
    })
  })

  describe("Union", () => {
    it("oneOf", () => {
      assertJsonSchema(Schema.Union([Schema.String, Schema.Finite], { mode: "oneOf" }), {
        "anyOf": [
          { "type": "string" },
          { "type": "number" }
        ]
      })
    })

    it("Union(NonEmptyString, Int)", () => {
      assertJsonSchema(Schema.Union([Schema.NonEmptyString, Schema.Int]), {
        "anyOf": [
          { "type": "string", "description": "a value with a length of at least 1" },
          { "type": "integer" }
        ]
      })
    })
  })

  describe("Arrays", () => {
    describe("Array", () => {
      it("Array(String)", () => {
        assertJsonSchema(Schema.Array(Schema.String), {
          "type": "array",
          "items": { "type": "string" }
        })
        assertJsonSchema(Schema.Array(Schema.String).annotate({ description: "description" }), {
          "type": "array",
          "items": { "type": "string" },
          "description": "description"
        })
      })

      it("Array(String) + isMinLength", () => {
        assertJsonSchema(Schema.Array(Schema.String).check(Schema.isMinLength(1)), {
          "type": "array",
          "items": { "type": "string" },
          "description": "a value with a length of at least 1"
        })
      })

      it("Array(String) + isMinLength + isMaxLength", () => {
        assertJsonSchema(Schema.Array(Schema.String).check(Schema.isMinLength(1), Schema.isMaxLength(2)), {
          "type": "array",
          "items": { "type": "string" },
          "description": "a value with a length of at least 1 and a value with a length of at most 2"
        })
      })
    })

    describe("Tuple", () => {
      it("Tuple([])", () => {
        assertJsonSchema(Schema.Tuple([]), {
          "type": "array",
          "items": false
        })
      })

      it("Tuple([String, Finite])", async () => {
        const schema = Schema.Tuple([Schema.String, Schema.Finite])
        assertJsonSchema(schema, {
          "type": "object",
          "properties": {
            "0": { "type": "string" },
            "1": { "type": "number" }
          },
          "required": ["0", "1"],
          "additionalProperties": false
        })

        const codec = toCodecAnthropic(schema)
        const asserts = new TestSchema.Asserts(codec)

        const encoding = asserts.encoding()
        await encoding.succeed(["a", 1], { "0": "a", "1": 1 })

        const decoding = asserts.decoding()
        await decoding.succeed({ "0": "a", "1": 1 }, ["a", 1])
      })

      it("Tuple([String, Finite?])", async () => {
        const schema = Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Finite)])
        assertJsonSchema(schema, {
          "type": "object",
          "properties": {
            "0": { "type": "string" },
            "1": {
              "anyOf": [
                { "type": "number" },
                { "type": "null" }
              ]
            }
          },
          "required": ["0", "1"],
          "additionalProperties": false
        })

        const codec = toCodecAnthropic(schema)
        const asserts = new TestSchema.Asserts(codec)

        const encoding = asserts.encoding()
        await encoding.succeed(["a", 1], { "0": "a", "1": 1 })

        const decoding = asserts.decoding()
        await decoding.succeed({ "0": "a", "1": 1 }, ["a", 1])
      })
    })

    describe("TupleWithRest", () => {
      it("TupleWithRest([String, Finite], Boolean)", async () => {
        const schema = Schema.TupleWithRest(
          Schema.Tuple([Schema.String, Schema.Finite]),
          [Schema.Boolean]
        )
        assertJsonSchema(schema, {
          "type": "object",
          "properties": {
            "0": { "type": "string" },
            "1": { "type": "number" },
            "__rest__": { "type": "array", "items": { "type": "boolean" } }
          },
          "required": ["0", "1", "__rest__"],
          "additionalProperties": false
        })
        const codec = toCodecAnthropic(schema)
        const asserts = new TestSchema.Asserts(codec)

        const encoding = asserts.encoding()
        await encoding.succeed(["a", 1], { "0": "a", "1": 1, "__rest__": [] })
        await encoding.succeed(["a", 1, true], { "0": "a", "1": 1, "__rest__": [true] })
        await encoding.succeed(["a", 1, true, false], { "0": "a", "1": 1, "__rest__": [true, false] })

        const decoding = asserts.decoding()
        await decoding.succeed({ "0": "a", "1": 1, "__rest__": [] }, ["a", 1])
        await decoding.succeed({ "0": "a", "1": 1, "__rest__": [true] }, ["a", 1, true])
        await decoding.succeed({ "0": "a", "1": 1, "__rest__": [true, false] }, ["a", 1, true, false])
      })
    })
  })

  describe("Objects", () => {
    it("Struct({ a: String })", () => {
      assertJsonSchema(Schema.Struct({ a: Schema.String }), {
        "type": "object",
        "properties": {
          "a": { "type": "string" }
        },
        "required": ["a"],
        "additionalProperties": false
      })
    })

    it("Struct({ a: String, b: Finite? })", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.optionalKey(Schema.Finite)
      })
      assertJsonSchema(
        schema,
        {
          "type": "object",
          "properties": {
            "a": { "type": "string" },
            "b": {
              "anyOf": [
                { "type": "number" },
                { "type": "null" }
              ]
            }
          },
          "required": ["a", "b"],
          "additionalProperties": false
        }
      )
      const codec = toCodecAnthropic(schema)
      const asserts = new TestSchema.Asserts(codec)

      const encoding = asserts.encoding()
      await encoding.succeed({ a: "a", b: 1 })
      await encoding.succeed({ a: "a" }, { a: "a", b: null })

      const decoding = asserts.decoding()
      await decoding.succeed({ "a": "a", "b": 1 })
      await decoding.succeed({ "a": "a", "b": null }, { a: "a" })
    })

    it("Record(String, Finite)", async () => {
      const schema = Schema.Record(Schema.String, Schema.Finite)
      assertJsonSchema(schema, {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "0": { "type": "string" },
            "1": { "type": "number" }
          },
          "required": ["0", "1"],
          "additionalProperties": false
        }
      })
      const codec = toCodecAnthropic(schema)
      const asserts = new TestSchema.Asserts(codec)

      const encoding = asserts.encoding()
      await encoding.succeed({ "a": 1, "b": 2 }, [{ 0: "a", 1: 1 }, { 0: "b", 1: 2 }])

      const decoding = asserts.decoding()
      await decoding.succeed([{ 0: "a", 1: 1 }, { 0: "b", 1: 2 }], { "a": 1, "b": 2 })
    })
  })
})
