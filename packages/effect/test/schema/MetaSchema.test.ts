import { MetaSchema, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { strictEqual, throws } from "../utils/assert.ts"

function assertCode(schema: Schema.Top, expected: string) {
  const ast = MetaSchema.toMetaAST(schema.ast)
  strictEqual(MetaSchema.code(ast), expected)
}

describe("MetaSchema", () => {
  describe("code", () => {
    describe("primitive types", () => {
      it("Null", () => {
        assertCode(Schema.Null, "Schema.Null")
        assertCode(Schema.Null.annotate({ "description": "a" }), `Schema.Null.annotate({ "description": "a" })`)
        assertCode(Schema.Null.annotate({}), "Schema.Null")
      })

      it("Undefined", () => {
        assertCode(Schema.Undefined, "Schema.Undefined")
        assertCode(
          Schema.Undefined.annotate({ "description": "b" }),
          `Schema.Undefined.annotate({ "description": "b" })`
        )
      })

      it("Void", () => {
        assertCode(Schema.Void, "Schema.Void")
        assertCode(Schema.Void.annotate({ "description": "c" }), `Schema.Void.annotate({ "description": "c" })`)
      })

      it("Never", () => {
        assertCode(Schema.Never, "Schema.Never")
        assertCode(Schema.Never.annotate({ "description": "d" }), `Schema.Never.annotate({ "description": "d" })`)
      })

      it("Unknown", () => {
        assertCode(Schema.Unknown, "Schema.Unknown")
        assertCode(Schema.Unknown.annotate({ "description": "e" }), `Schema.Unknown.annotate({ "description": "e" })`)
      })

      it("Any", () => {
        assertCode(Schema.Any, "Schema.Any")
        assertCode(Schema.Any.annotate({ "description": "f" }), `Schema.Any.annotate({ "description": "f" })`)
      })

      it("String", () => {
        assertCode(Schema.String, "Schema.String")
        assertCode(Schema.String.annotate({ "description": "g" }), `Schema.String.annotate({ "description": "g" })`)
      })

      it("Number", () => {
        assertCode(Schema.Number, "Schema.Number")
        assertCode(Schema.Number.annotate({ "description": "h" }), `Schema.Number.annotate({ "description": "h" })`)
      })

      it("Boolean", () => {
        assertCode(Schema.Boolean, "Schema.Boolean")
        assertCode(Schema.Boolean.annotate({ "description": "i" }), `Schema.Boolean.annotate({ "description": "i" })`)
      })

      it("BigInt", () => {
        assertCode(Schema.BigInt, "Schema.BigInt")
        assertCode(Schema.BigInt.annotate({ "description": "j" }), `Schema.BigInt.annotate({ "description": "j" })`)
      })

      it("Symbol", () => {
        assertCode(Schema.Symbol, "Schema.Symbol")
        assertCode(Schema.Symbol.annotate({ "description": "k" }), `Schema.Symbol.annotate({ "description": "k" })`)
      })

      it("ObjectKeyword", () => {
        assertCode(Schema.ObjectKeyword, "Schema.ObjectKeyword")
        assertCode(
          Schema.ObjectKeyword.annotate({ "description": "l" }),
          `Schema.ObjectKeyword.annotate({ "description": "l" })`
        )
      })
    })

    describe("Literal", () => {
      it("string literal", () => {
        assertCode(Schema.Literal("hello"), `Schema.Literal("hello")`)
        assertCode(
          Schema.Literal("hello").annotate({ "description": "m" }),
          `Schema.Literal("hello").annotate({ "description": "m" })`
        )
      })

      it("number literal", () => {
        assertCode(Schema.Literal(42), "Schema.Literal(42)")
        assertCode(
          Schema.Literal(42).annotate({ "description": "n" }),
          `Schema.Literal(42).annotate({ "description": "n" })`
        )
      })

      it("boolean literal", () => {
        assertCode(Schema.Literal(true), "Schema.Literal(true)")
        assertCode(
          Schema.Literal(true).annotate({ "description": "o" }),
          `Schema.Literal(true).annotate({ "description": "o" })`
        )
      })

      it("bigint literal", () => {
        assertCode(Schema.Literal(100n), "Schema.Literal(100n)")
        assertCode(
          Schema.Literal(100n).annotate({ "description": "p" }),
          `Schema.Literal(100n).annotate({ "description": "p" })`
        )
      })
    })

    describe("UniqueSymbol", () => {
      it("should format unique symbol", () => {
        assertCode(Schema.UniqueSymbol(Symbol.for("test")), `Schema.UniqueSymbol(Symbol.for("test"))`)
      })

      it("should throw error for symbol created without Symbol.for()", () => {
        const sym = Symbol("test")
        const ast = MetaSchema.toMetaAST(Schema.UniqueSymbol(sym).ast)
        throws(
          () => MetaSchema.code(ast),
          "Cannot generate code for UniqueSymbol created without Symbol.for()"
        )
      })
    })

    describe("Enum", () => {
      it("should format enum with string values", () => {
        assertCode(
          Schema.Enum({
            A: "a",
            B: "b"
          }),
          `Schema.Enum([["A", "a"], ["B", "b"]])`
        )
        assertCode(
          Schema.Enum({
            A: "a",
            B: "b"
          }).annotate({ "description": "q" }),
          `Schema.Enum([["A", "a"], ["B", "b"]]).annotate({ "description": "q" })`
        )
      })

      it("should format enum with number values", () => {
        assertCode(
          Schema.Enum({
            One: 1,
            Two: 2
          }),
          `Schema.Enum([["One", 1], ["Two", 2]])`
        )
        assertCode(
          Schema.Enum({
            One: 1,
            Two: 2
          }).annotate({ "description": "r" }),
          `Schema.Enum([["One", 1], ["Two", 2]]).annotate({ "description": "r" })`
        )
      })

      it("should format enum with mixed values", () => {
        assertCode(
          Schema.Enum({
            A: "a",
            One: 1
          }),
          `Schema.Enum([["A", "a"], ["One", 1]])`
        )
        assertCode(
          Schema.Enum({
            A: "a",
            One: 1
          }).annotate({ "description": "s" }),
          `Schema.Enum([["A", "a"], ["One", 1]]).annotate({ "description": "s" })`
        )
      })
    })

    describe("TemplateLiteral", () => {
      it("should format template literal", () => {
        assertCode(
          Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]),
          `Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number])`
        )
        assertCode(
          Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ "description": "ad" }),
          `Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ "description": "ad" })`
        )
      })
    })

    describe("Arrays", () => {
      it("empty tuple", () => {
        assertCode(Schema.Tuple([]), "Schema.Tuple([])")
        assertCode(
          Schema.Tuple([]).annotate({ "description": "t" }),
          `Schema.Tuple([]).annotate({ "description": "t" })`
        )
      })

      it("tuple with elements", () => {
        assertCode(
          Schema.Tuple([Schema.String, Schema.Number]),
          "Schema.Tuple([Schema.String, Schema.Number])"
        )
        assertCode(
          Schema.Tuple([Schema.String, Schema.Number]).annotate({ "description": "u" }),
          `Schema.Tuple([Schema.String, Schema.Number]).annotate({ "description": "u" })`
        )
      })

      it("array with rest only", () => {
        assertCode(Schema.Array(Schema.String), "Schema.Array(Schema.String)")
        assertCode(
          Schema.Array(Schema.String).annotate({ "description": "v" }),
          `Schema.Array(Schema.String).annotate({ "description": "v" })`
        )
      })

      it("tuple with rest", () => {
        assertCode(
          Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]),
          "Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])"
        )
        assertCode(
          Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]).annotate({ "description": "w" }),
          `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]).annotate({ "description": "w" })`
        )
      })
    })

    describe("Objects", () => {
      it("empty struct", () => {
        assertCode(Schema.Struct({}), "Schema.Struct({  })")
        assertCode(
          Schema.Struct({}).annotate({ "description": "x" }),
          `Schema.Struct({  }).annotate({ "description": "x" })`
        )
      })

      it("struct with required properties", () => {
        assertCode(
          Schema.Struct({
            name: Schema.String,
            age: Schema.Number
          }),
          `Schema.Struct({ "name": Schema.String, "age": Schema.Number })`
        )
        assertCode(
          Schema.Struct({
            name: Schema.String,
            age: Schema.Number
          }).annotate({ "description": "y" }),
          `Schema.Struct({ "name": Schema.String, "age": Schema.Number }).annotate({ "description": "y" })`
        )
      })

      it("struct with optional properties", () => {
        assertCode(
          Schema.Struct({
            name: Schema.String,
            age: Schema.optionalKey(Schema.Number)
          }),
          `Schema.Struct({ "name": Schema.String, "age": Schema.optionalKey(Schema.Number) })`
        )
      })

      it("struct with mixed required and optional properties", () => {
        assertCode(
          Schema.Struct({
            name: Schema.String,
            age: Schema.optionalKey(Schema.Number),
            active: Schema.Boolean
          }),
          `Schema.Struct({ "name": Schema.String, "age": Schema.optionalKey(Schema.Number), "active": Schema.Boolean })`
        )
      })

      it("struct with symbol property key", () => {
        const sym = Symbol.for("test")
        assertCode(
          Schema.Struct({
            [sym]: Schema.String
          }),
          `Schema.Struct({ ${String(sym)}: Schema.String })`
        )
      })
    })

    describe("Union", () => {
      it("union with anyOf mode (default)", () => {
        assertCode(
          Schema.Union([Schema.String, Schema.Number]),
          "Schema.Union([Schema.String, Schema.Number])"
        )
        assertCode(
          Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "z" }),
          `Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "z" })`
        )
      })

      it("union with oneOf mode", () => {
        assertCode(
          Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }),
          `Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" })`
        )
        assertCode(
          Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }).annotate({ "description": "aa" }),
          `Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }).annotate({ "description": "aa" })`
        )
      })

      it("union with multiple types", () => {
        assertCode(
          Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
          "Schema.Union([Schema.String, Schema.Number, Schema.Boolean])"
        )
        assertCode(
          Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).annotate({ "description": "ab" }),
          `Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).annotate({ "description": "ab" })`
        )
      })
    })

    describe("nested structures", () => {
      it("nested struct", () => {
        assertCode(
          Schema.Struct({
            user: Schema.Struct({
              name: Schema.String,
              age: Schema.Number
            })
          }),
          `Schema.Struct({ "user": Schema.Struct({ "name": Schema.String, "age": Schema.Number }) })`
        )
        assertCode(
          Schema.Struct({
            user: Schema.Struct({
              name: Schema.String,
              age: Schema.Number
            })
          }).annotate({ "description": "ac" }),
          `Schema.Struct({ "user": Schema.Struct({ "name": Schema.String, "age": Schema.Number }) }).annotate({ "description": "ac" })`
        )
      })

      it("union of structs", () => {
        assertCode(
          Schema.Union([
            Schema.Struct({ type: Schema.Literal("a"), value: Schema.String }),
            Schema.Struct({ type: Schema.Literal("b"), value: Schema.Number })
          ]),
          `Schema.Union([Schema.Struct({ "type": Schema.Literal("a"), "value": Schema.String }), Schema.Struct({ "type": Schema.Literal("b"), "value": Schema.Number })])`
        )
      })

      it("tuple with struct elements", () => {
        assertCode(
          Schema.Tuple([
            Schema.Struct({ name: Schema.String }),
            Schema.Struct({ age: Schema.Number })
          ]),
          `Schema.Tuple([Schema.Struct({ "name": Schema.String }), Schema.Struct({ "age": Schema.Number })])`
        )
      })
    })
  })
})
