import { Option, Schema, SchemaAST, SchemaTransformation } from "effect"
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
  SchemaTransformation.transform(
    (date) => date.getTime(),
    (n) => new Date(n)
  )
))

describe("SchemaSerializerJson", () => {
  describe("default serialization", () => {
    it("Undefined", async () => {
      const schema = Schema.Undefined

      await assertions.serialization.schema.fail(
        schema,
        undefined,
        `unknown <-> undefined
└─ required annotation
   └─ cannot serialize to JSON, required \`serializer\` annotation`
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
└─ symbol encoding
   └─ Symbol is not registered`
      )
      await assertions.serialization.schema.fail(
        schema,
        Symbol(),
        `string <-> symbol
└─ symbol encoding
   └─ Symbol has no description`
      )

      await assertions.deserialization.schema.succeed(schema, "a", Symbol.for("a"))
    })

    it("BigInt", async () => {
      const schema = Schema.BigInt

      await assertions.serialization.schema.succeed(schema, 1n, "1")
      await assertions.deserialization.schema.succeed(schema, "1", 1n)
    })

    it("URL", async () => {
      const schema = Schema.URL

      await assertions.serialization.schema.succeed(schema, new URL("https://example.com"), "https://example.com/")
      await assertions.deserialization.schema.succeed(schema, "https://example.com", new URL("https://example.com"))
      await assertions.deserialization.schema.succeed(schema, "https://example.com/", new URL("https://example.com"))
    })

    it("declareRefinement without annotation", async () => {
      class A {
        readonly _tag = "A"
      }
      const schema = Schema.declareRefinement({ is: (u): u is A => u instanceof A })
      await assertions.serialization.schema.fail(
        schema,
        new A(),
        `unknown <-> <Declaration>
└─ required annotation
   └─ cannot serialize to JSON, required \`serializer\` annotation`
      )
    })

    it("Date", async () => {
      const schema = Schema.Date

      await assertions.serialization.schema.succeed(schema, new Date("2021-01-01"), "2021-01-01T00:00:00.000Z")
    })

    it("Option(Date)", async () => {
      const schema = Schema.Option(Schema.Date)

      await assertions.serialization.schema.succeed(schema, Option.some(new Date("2021-01-01")), [
        "2021-01-01T00:00:00.000Z"
      ])
      await assertions.serialization.schema.succeed(schema, Option.none(), [])
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
        ["2021-01-01T00:00:00.000Z"],
        0
      ]])
      await assertions.deserialization.schema.succeed(
        schema,
        [[["2021-01-01T00:00:00.000Z"], 0]],
        new Map([[Option.some(new Date("2021-01-01")), 0]])
      )
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

      await assertions.serialization.codec.succeed(schema, Option.some(Option.some(0)), [["1970-01-01T00:00:00.000Z"]])
    })

    it("Map(Option(Symbol), Date)", async () => {
      const schema = Schema.Map(Schema.Option(Schema.Symbol), Schema.Date)

      await assertions.serialization.codec.succeed(
        schema,
        new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]]),
        [[
          ["a"],
          "2021-01-01T00:00:00.000Z"
        ]]
      )
      await assertions.deserialization.codec.succeed(
        schema,
        [[["a"], "2021-01-01T00:00:00.000Z"]],
        new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]])
      )
    })
  })

  describe("instanceOf", () => {
    it("arg: message: string", async () => {
      class MyError extends Error {
        constructor(message?: string) {
          super(message)
          this.name = "MyError"
          Object.setPrototypeOf(this, MyError.prototype)
        }
      }

      const schema = Schema.instanceOf({
        constructor: MyError,
        annotations: {
          title: "MyError",
          serialization: {
            json: () =>
              new SchemaAST.Link(
                Schema.String.ast,
                SchemaTransformation.transform(
                  (message) => new MyError(message),
                  (e) => e.message
                )
              )
          }
        }
      })

      await assertions.serialization.schema.succeed(schema, new MyError("a"), "a")
      await assertions.deserialization.schema.succeed(schema, "a", new MyError("a"))
    })

    it("arg: struct", async () => {
      class MyError extends Error {
        static Props = Schema.Struct({
          message: Schema.String,
          cause: Schema.String
        })

        constructor(props: typeof MyError.Props["Type"]) {
          super(props.message, { cause: props.cause })
          this.name = "MyError"
          Object.setPrototypeOf(this, MyError.prototype)
        }

        static schema = Schema.instanceOf({
          constructor: MyError,
          annotations: {
            title: "MyError",
            serialization: {
              json: () =>
                new SchemaAST.Link(
                  MyError.Props.ast,
                  SchemaTransformation.transform(
                    (props) => new MyError(props),
                    (e) => ({
                      message: e.message,
                      cause: typeof e.cause === "string" ? e.cause : String(e.cause)
                    })
                  )
                )
            }
          }
        })
      }

      const schema = MyError.schema

      await assertions.serialization.schema.succeed(schema, new MyError({ message: "a", cause: "b" }), {
        message: "a",
        cause: "b"
      })
      await assertions.deserialization.schema.succeed(
        schema,
        { message: "a", cause: "b" },
        new MyError({ message: "a", cause: "b" })
      )
    })
  })
})
