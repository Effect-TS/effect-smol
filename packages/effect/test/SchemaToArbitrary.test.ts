import { Schema } from "effect"
import { describe, it } from "vitest"
import * as Util from "./SchemaTest.js"
import { deepStrictEqual, fail, strictEqual, throws } from "./utils/assert.js"

const assertions = Util.assertions({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

describe("SchemaToArbitrary", () => {
  it("String", () => {
    const schema = Schema.String
    assertions.arbitrary.satisfy(schema)
  })

  it("Number", () => {
    const schema = Schema.Number
    assertions.arbitrary.satisfy(schema)
  })

  it("Boolean", () => {
    const schema = Schema.Boolean
    assertions.arbitrary.satisfy(schema)
  })

  it("BigInt", () => {
    const schema = Schema.BigInt
    assertions.arbitrary.satisfy(schema)
  })

  it("Symbol", () => {
    const schema = Schema.Symbol
    assertions.arbitrary.satisfy(schema)
  })

  it("UniqueSymbol", () => {
    const schema = Schema.UniqueSymbol(Symbol.for("a"))
    assertions.arbitrary.satisfy(schema)
  })

  it("Literal", () => {
    const schema = Schema.Literal("a")
    assertions.arbitrary.satisfy(schema)
  })

  it("TemplateLiteral", () => {
    const schema = Schema.TemplateLiteral(["a", Schema.String])
    assertions.arbitrary.satisfy(schema)
  })

  it("Enums", () => {
    enum Fruits {
      Apple,
      Banana,
      Orange = "orange"
    }
    const schema = Schema.Enums(Fruits)
    assertions.arbitrary.satisfy(schema)
  })

  it("Union", () => {
    const schema = Schema.Union([Schema.String, Schema.Number])
    assertions.arbitrary.satisfy(schema)
  })

  describe("Tuple", () => {
    it("required elements", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number])
      assertions.arbitrary.satisfy(schema)
    })

    it("optionalKey elements", () => {
      const schema = Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])
      assertions.arbitrary.satisfy(schema)
    })

    it("optional elements", () => {
      const schema = Schema.Tuple([Schema.String, Schema.optional(Schema.Number)])
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("Array", () => {
    it("Array", () => {
      const schema = Schema.Array(Schema.String)
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("TupleWithRest", () => {
    it("tuple & rest", () => {
      const schema = Schema.TupleWithRest(Schema.Tuple([Schema.Boolean]), [Schema.Number, Schema.String])
      assertions.arbitrary.satisfy(schema)
    })

    it("rest", () => {
      const schema = Schema.TupleWithRest(Schema.Tuple([]), [Schema.Number, Schema.String])
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("Struct", () => {
    it("Struct", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("Record", () => {
    it("Record(String, Number)", () => {
      const schema = Schema.Record(Schema.String, Schema.Number)
      assertions.arbitrary.satisfy(schema)
    })
  })

  describe("StructWithRest", () => {
    it("Record(String, Number)", () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.String, Schema.Number)]
      )
      assertions.arbitrary.satisfy(schema)
    })
  })

  it("Option(String)", () => {
    const schema = Schema.Option(Schema.String)
    assertions.arbitrary.satisfy(schema)
  })
})
