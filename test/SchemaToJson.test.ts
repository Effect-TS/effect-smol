import { Option, Schema, SchemaParser, SchemaTransformation } from "effect"
import { describe, it } from "vitest"
import * as Util from "./SchemaTest.js"
import { deepStrictEqual, fail, strictEqual, throws } from "./utils/assert.js"

const assertions = Util.assertions({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

const FiniteFromDate = Schema.Date.pipe(Schema.decodeTo(
  Schema.Number,
  new SchemaTransformation.Transformation(
    SchemaParser.lift((date) => date.getTime()),
    SchemaParser.lift((n) => new Date(n))
  )
))

describe("SchemaToJson", () => {
  describe("default serialization", () => {
    it("Undefined", async () => {
      const schema = Schema.Undefined

      await assertions.serialization.default.fail(
        schema,
        undefined,
        `unknown <-> undefined
└─ decoding / encoding failure
   └─ cannot serialize to JSON, annotation is required`
      )
    })

    it("String", async () => {
      const schema = Schema.String

      await assertions.serialization.default.succeed(schema, "a")
    })

    it("Symbol", async () => {
      const schema = Schema.Symbol

      await assertions.serialization.default.succeed(schema, Symbol.for("a"), "a")
      await assertions.serialization.default.fail(
        schema,
        Symbol("a"),
        `string <-> symbol
└─ decoding / encoding failure
   └─ Symbol is not registered`
      )
      await assertions.serialization.default.fail(
        schema,
        Symbol(),
        `string <-> symbol
└─ decoding / encoding failure
   └─ Symbol has no description`
      )

      await assertions.deserialization.default.succeed(schema, "a", Symbol.for("a"))
    })

    it("Declaration without annotation", async () => {
      class A {
        readonly _tag = "A"
      }
      const schema = Schema.declare({ guard: (u): u is A => u instanceof A })
      await assertions.serialization.default.fail(
        schema,
        new A(),
        `unknown <-> <Declaration>
└─ decoding / encoding failure
   └─ cannot serialize to JSON, annotation is required`
      )
    })

    it("Date", async () => {
      const schema = Schema.Date

      await assertions.serialization.default.succeed(schema, new Date("2021-01-01"), "2021-01-01T00:00:00.000Z")
    })

    it("Option(Date)", async () => {
      const schema = Schema.Option(Schema.Date)

      await assertions.serialization.default.succeed(schema, Option.some(new Date("2021-01-01")), {
        _tag: "Some",
        value: "2021-01-01T00:00:00.000Z"
      })
      await assertions.serialization.default.succeed(schema, Option.none(), { _tag: "None" })
    })

    it("Struct", async () => {
      const schema = Schema.Struct({
        a: Schema.Date,
        b: Schema.Date
      })

      await assertions.serialization.default.succeed(
        schema,
        { a: new Date("2021-01-01"), b: new Date("2021-01-01") },
        { a: "2021-01-01T00:00:00.000Z", b: "2021-01-01T00:00:00.000Z" }
      )
    })

    it("ReadonlyRecord(Schema.Symbol, Schema.Date)", async () => {
      const schema = Schema.ReadonlyRecord(Schema.Symbol, Schema.Date)

      await assertions.deserialization.default.succeed(
        schema,
        { "a": "2021-01-01T00:00:00.000Z", "b": "2021-01-01T00:00:00.000Z" },
        { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") }
      )

      await assertions.serialization.default.succeed(
        schema,
        { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") },
        { "a": "2021-01-01T00:00:00.000Z", "b": "2021-01-01T00:00:00.000Z" }
      )
    })

    it("ReadonlyTuple(Schema.Date, Schema.Date)", async () => {
      const schema = Schema.ReadonlyTuple([Schema.Date, Schema.Date])

      await assertions.serialization.default.succeed(
        schema,
        [new Date("2021-01-01"), new Date("2021-01-01")],
        ["2021-01-01T00:00:00.000Z", "2021-01-01T00:00:00.000Z"]
      )
    })

    it("FiniteFromDate", async () => {
      const schema = FiniteFromDate

      await assertions.serialization.default.succeed(schema, 0, 0)
    })

    it("Union(Schema.Date, Schema.Date)", async () => {
      const schema = Schema.Union([Schema.Date, FiniteFromDate])

      await assertions.serialization.default.succeed(schema, new Date("2021-01-01"), "2021-01-01T00:00:00.000Z")
      await assertions.serialization.default.succeed(schema, 0, 0)
    })

    it("Map", async () => {
      const schema = Schema.Map(Schema.Option(Schema.Date), FiniteFromDate)

      await assertions.serialization.default.succeed(schema, new Map([[Option.some(new Date("2021-01-01")), 0]]), [[
        { _tag: "Some", value: "2021-01-01T00:00:00.000Z" },
        0
      ]])
      await assertions.deserialization.default.succeed(
        schema,
        [[{ _tag: "Some", value: "2021-01-01T00:00:00.000Z" }, 0]],
        new Map([[Option.some(new Date("2021-01-01")), 0]])
      )
    })
  })

  describe("custom serialization", () => {
    it("FiniteFromDate", async () => {
      const schema = FiniteFromDate

      await assertions.serialization.custom.succeed(schema, 0, "1970-01-01T00:00:00.000Z")
    })

    it("Struct", async () => {
      const schema = Schema.Struct({
        a: FiniteFromDate,
        b: FiniteFromDate
      })

      await assertions.serialization.custom.succeed(
        schema,
        { a: 0, b: 0 },
        { a: "1970-01-01T00:00:00.000Z", b: "1970-01-01T00:00:00.000Z" }
      )
    })

    it("ReadonlyTuple(Schema.Date, Schema.Date)", async () => {
      const schema = Schema.ReadonlyTuple([FiniteFromDate, FiniteFromDate])

      await assertions.serialization.custom.succeed(
        schema,
        [0, 0],
        ["1970-01-01T00:00:00.000Z", "1970-01-01T00:00:00.000Z"]
      )
    })

    it("Option(Option(FiniteFromDate))", async () => {
      const schema = Schema.Option(Schema.Option(FiniteFromDate))

      await assertions.serialization.custom.succeed(schema, Option.some(Option.some(0)), {
        _tag: "Some",
        value: {
          _tag: "Some",
          value: "1970-01-01T00:00:00.000Z"
        }
      })
    })

    it("Map(Option(Symbol), Date)", async () => {
      const schema = Schema.Map(Schema.Option(Schema.Symbol), Schema.Date)

      await assertions.serialization.custom.succeed(
        schema,
        new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]]),
        [[
          { _tag: "Some", value: "a" },
          "2021-01-01T00:00:00.000Z"
        ]]
      )
      await assertions.deserialization.custom.succeed(
        schema,
        [[{ _tag: "Some", value: "a" }, "2021-01-01T00:00:00.000Z"]],
        new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]])
      )
    })
  })
})
