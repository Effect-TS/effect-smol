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

      await assertions.serialization.schema.fail(
        schema,
        undefined,
        `unknown <-> undefined
└─ decoding / encoding failure
   └─ cannot serialize to JSON, annotation is required`
      )
    })

    it("String", async () => {
      const schema = Schema.String

      await assertions.serialization.schema.succeed(schema, "a")
    })

    it("Symbol", async () => {
      const schema = Schema.Symbol

      await assertions.serialization.schema.succeed(schema, Symbol.for("a"), "a")
      await assertions.serialization.schema.fail(
        schema,
        Symbol("a"),
        `string <-> symbol
└─ decoding / encoding failure
   └─ Symbol is not registered`
      )
      await assertions.serialization.schema.fail(
        schema,
        Symbol(),
        `string <-> symbol
└─ decoding / encoding failure
   └─ Symbol has no description`
      )

      await assertions.deserialization.schema.succeed(schema, "a", Symbol.for("a"))
    })

    it("Declaration without annotation", async () => {
      class A {
        readonly _tag = "A"
      }
      const schema = Schema.declare({ guard: (u): u is A => u instanceof A })
      await assertions.serialization.schema.fail(
        schema,
        new A(),
        `unknown <-> <Declaration>
└─ decoding / encoding failure
   └─ cannot serialize to JSON, annotation is required`
      )
    })

    it("Date", async () => {
      const schema = Schema.Date

      await assertions.serialization.schema.succeed(schema, new Date("2021-01-01"), "2021-01-01T00:00:00.000Z")
    })

    it("Option(Date)", async () => {
      const schema = Schema.Option(Schema.Date)

      await assertions.serialization.schema.succeed(schema, Option.some(new Date("2021-01-01")), {
        _tag: "Some",
        value: "2021-01-01T00:00:00.000Z"
      })
      await assertions.serialization.schema.succeed(schema, Option.none(), { _tag: "None" })
    })

    it("Struct", async () => {
      const schema = Schema.Struct({
        a: Schema.Date,
        b: Schema.Date
      })

      await assertions.serialization.schema.succeed(
        schema,
        { a: new Date("2021-01-01"), b: new Date("2021-01-01") },
        { a: "2021-01-01T00:00:00.000Z", b: "2021-01-01T00:00:00.000Z" }
      )
    })

    it("ReadonlyRecord(Schema.Symbol, Schema.Date)", async () => {
      const schema = Schema.ReadonlyRecord(Schema.Symbol, Schema.Date)

      await assertions.deserialization.schema.succeed(
        schema,
        { "a": "2021-01-01T00:00:00.000Z", "b": "2021-01-01T00:00:00.000Z" },
        { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") }
      )

      await assertions.serialization.schema.succeed(
        schema,
        { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") },
        { "a": "2021-01-01T00:00:00.000Z", "b": "2021-01-01T00:00:00.000Z" }
      )
    })

    it("ReadonlyTuple(Schema.Date, Schema.Date)", async () => {
      const schema = Schema.ReadonlyTuple([Schema.Date, Schema.Date])

      await assertions.serialization.schema.succeed(
        schema,
        [new Date("2021-01-01"), new Date("2021-01-01")],
        ["2021-01-01T00:00:00.000Z", "2021-01-01T00:00:00.000Z"]
      )
    })

    it("FiniteFromDate", async () => {
      const schema = FiniteFromDate

      await assertions.serialization.schema.succeed(schema, 0, 0)
    })

    it("Union(Schema.Date, Schema.Date)", async () => {
      const schema = Schema.Union([Schema.Date, FiniteFromDate])

      await assertions.serialization.schema.succeed(schema, new Date("2021-01-01"), "2021-01-01T00:00:00.000Z")
      await assertions.serialization.schema.succeed(schema, 0, 0)
    })

    it("Map", async () => {
      const schema = Schema.Map(Schema.Option(Schema.Date), FiniteFromDate)

      await assertions.serialization.schema.succeed(schema, new Map([[Option.some(new Date("2021-01-01")), 0]]), [[
        { _tag: "Some", value: "2021-01-01T00:00:00.000Z" },
        0
      ]])
      await assertions.deserialization.schema.succeed(
        schema,
        [[{ _tag: "Some", value: "2021-01-01T00:00:00.000Z" }, 0]],
        new Map([[Option.some(new Date("2021-01-01")), 0]])
      )
    })

    it("Class", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: FiniteFromDate
      })) {}

      await assertions.serialization.schema.succeed(A, new A({ a: 0 }), { a: 0 })
      await assertions.deserialization.schema.succeed(A, { a: 0 }, new A({ a: 0 }))
    })

    it("TaggedError", async () => {
      class E extends Schema.TaggedError<E>()("E", {
        a: FiniteFromDate
      }) {}

      await assertions.serialization.schema.succeed(E, new E({ a: 0 }), { a: 0 })
      await assertions.deserialization.schema.succeed(E, { a: 0 }, new E({ a: 0 }))
    })
  })

  describe("custom serialization", () => {
    it("FiniteFromDate", async () => {
      const schema = FiniteFromDate

      await assertions.serialization.codec.succeed(schema, 0, "1970-01-01T00:00:00.000Z")
    })

    it("Struct", async () => {
      const schema = Schema.Struct({
        a: FiniteFromDate,
        b: FiniteFromDate
      })

      await assertions.serialization.codec.succeed(
        schema,
        { a: 0, b: 0 },
        { a: "1970-01-01T00:00:00.000Z", b: "1970-01-01T00:00:00.000Z" }
      )
    })

    it("ReadonlyTuple(Schema.Date, Schema.Date)", async () => {
      const schema = Schema.ReadonlyTuple([FiniteFromDate, FiniteFromDate])

      await assertions.serialization.codec.succeed(
        schema,
        [0, 0],
        ["1970-01-01T00:00:00.000Z", "1970-01-01T00:00:00.000Z"]
      )
    })

    it("Option(Option(FiniteFromDate))", async () => {
      const schema = Schema.Option(Schema.Option(FiniteFromDate))

      await assertions.serialization.codec.succeed(schema, Option.some(Option.some(0)), {
        _tag: "Some",
        value: {
          _tag: "Some",
          value: "1970-01-01T00:00:00.000Z"
        }
      })
    })

    it("Map(Option(Symbol), Date)", async () => {
      const schema = Schema.Map(Schema.Option(Schema.Symbol), Schema.Date)

      await assertions.serialization.codec.succeed(
        schema,
        new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]]),
        [[
          { _tag: "Some", value: "a" },
          "2021-01-01T00:00:00.000Z"
        ]]
      )
      await assertions.deserialization.codec.succeed(
        schema,
        [[{ _tag: "Some", value: "a" }, "2021-01-01T00:00:00.000Z"]],
        new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]])
      )
    })
  })

  it("Class", async () => {
    class A extends Schema.Class<A>("A")(Schema.Struct({
      a: FiniteFromDate
    })) {}

    await assertions.serialization.codec.succeed(A, new A({ a: 0 }), { a: "1970-01-01T00:00:00.000Z" })
    await assertions.deserialization.codec.succeed(A, { a: "1970-01-01T00:00:00.000Z" }, new A({ a: 0 }))
  })

  it("TaggedError", async () => {
    class E extends Schema.TaggedError<E>()("E", {
      a: FiniteFromDate
    }) {}

    await assertions.serialization.codec.succeed(E, new E({ a: 0 }), { a: "1970-01-01T00:00:00.000Z" })
    await assertions.deserialization.codec.succeed(E, { a: "1970-01-01T00:00:00.000Z" }, new E({ a: 0 }))
  })
})
