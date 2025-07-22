import { Option } from "effect/data"
import { Schema, Serializer, Transformation } from "effect/schema"
import { describe, it } from "vitest"
import { strictEqual } from "../utils/assert.ts"
import { assertions } from "../utils/schema.ts"

const FiniteFromDate = Schema.Date.pipe(Schema.decodeTo(
  Schema.Number,
  Transformation.transform({
    decode: (date) => date.getTime(),
    encode: (n) => new Date(n)
  })
))

describe("Serializer", () => {
  describe("default serialization", () => {
    describe("should return the same reference if nothing changed", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.Number
        })
        const serializer = Serializer.json(schema)
        strictEqual(serializer.ast, schema.ast)
      })

      it("Record", async () => {
        const schema = Schema.Record(Schema.String, Schema.Number)
        const serializer = Serializer.json(schema)
        strictEqual(serializer.ast, schema.ast)
      })

      it("Tuple", async () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number])
        const serializer = Serializer.json(schema)
        strictEqual(serializer.ast, schema.ast)
      })

      it("Array", async () => {
        const schema = Schema.Array(Schema.String)
        const serializer = Serializer.json(schema)
        strictEqual(serializer.ast, schema.ast)
      })

      it("Union", async () => {
        const schema = Schema.Union([Schema.String, Schema.Number])
        const serializer = Serializer.json(schema)
        strictEqual(serializer.ast, schema.ast)
      })
    })

    it("should apply the construction process to the provided link in the annotations", async () => {
      const schema = Schema.Struct({
        a: Schema.Date.annotate({
          defaultJsonSerializer: () =>
            Schema.link<Date>()(
              Schema.Date,
              Transformation.passthrough()
            )
        }),
        b: Schema.Number
      })
      await assertions.serialization.schema.succeed(schema, { a: new Date("2021-01-01"), b: 1 }, {
        a: "2021-01-01T00:00:00.000Z",
        b: 1
      })
    })

    it("Undefined", async () => {
      const schema = Schema.Undefined

      await assertions.serialization.schema.fail(
        schema,
        undefined,
        "cannot serialize to JSON, required `defaultJsonSerializer` annotation"
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
        "cannot serialize to JSON, Symbol is not registered"
      )
      await assertions.serialization.schema.fail(
        schema,
        Symbol(),
        "cannot serialize to JSON, Symbol has no description"
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
      await assertions.deserialization.schema.fail(
        schema,
        "not a url",
        `Invalid data "not a url"`
      )
    })

    it("declareRefinement without annotation", async () => {
      class A {
        readonly _tag = "A"
      }
      const schema = Schema.declare((u): u is A => u instanceof A)
      await assertions.serialization.schema.fail(
        schema,
        new A(),
        "cannot serialize to JSON, required `defaultJsonSerializer` annotation"
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

    it("Record(Symbol, Date)", async () => {
      const schema = Schema.Record(Schema.Symbol, Schema.Date)

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

    it("Tuple(Date, Date)", async () => {
      const schema = Schema.Tuple([Schema.Date, Schema.Date])

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

    it("Class", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: FiniteFromDate
      })) {}

      await assertions.serialization.schema.succeed(A, new A({ a: 0 }), { a: 0 })
      await assertions.deserialization.schema.succeed(A, { a: 0 }, new A({ a: 0 }))
    })

    it("ErrorClass", async () => {
      class E extends Schema.ErrorClass<E>("E")({
        a: FiniteFromDate
      }) {}

      await assertions.serialization.schema.succeed(E, new E({ a: 0 }), { a: 0 })
      await assertions.deserialization.schema.succeed(E, { a: 0 }, new E({ a: 0 }))
    })

    it("Enums", async () => {
      enum Fruits {
        Apple,
        Banana
      }
      const schema = Schema.Enums(Fruits)

      await assertions.serialization.schema.succeed(schema, Fruits.Apple, 0)
      await assertions.serialization.schema.succeed(schema, Fruits.Banana, 1)
      await assertions.deserialization.schema.succeed(schema, 0, Fruits.Apple)
      await assertions.deserialization.schema.succeed(schema, 1, Fruits.Banana)
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

    it("Tuple(Schema.Date, Schema.Date)", async () => {
      const schema = Schema.Tuple([FiniteFromDate, FiniteFromDate])

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

      const schema = Schema.instanceOf(
        MyError,
        {
          title: "MyError",
          defaultJsonSerializer: () =>
            Schema.link<MyError>()(
              Schema.String,
              Transformation.transform({
                decode: (message) => new MyError(message),
                encode: (e) => e.message
              })
            )
        }
      )

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

        static schema = Schema.instanceOf(
          MyError,
          {
            title: "MyError",
            defaultJsonSerializer: () =>
              Schema.link<MyError>()(
                MyError.Props,
                Transformation.transform({
                  decode: (props) => new MyError(props),
                  encode: (e) => ({
                    message: e.message,
                    cause: typeof e.cause === "string" ? e.cause : String(e.cause)
                  })
                })
              )
          }
        )
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

  it("Class", async () => {
    class A extends Schema.Class<A>("A")(Schema.Struct({
      a: FiniteFromDate
    })) {}

    await assertions.serialization.codec.succeed(A, new A({ a: 0 }), { a: "1970-01-01T00:00:00.000Z" })
    await assertions.deserialization.codec.succeed(A, { a: "1970-01-01T00:00:00.000Z" }, new A({ a: 0 }))
  })

  it("Error", async () => {
    class E extends Schema.ErrorClass<E>("E")({
      a: FiniteFromDate
    }) {}

    await assertions.serialization.codec.succeed(E, new E({ a: 0 }), { a: "1970-01-01T00:00:00.000Z" })
    await assertions.deserialization.codec.succeed(E, { a: "1970-01-01T00:00:00.000Z" }, new E({ a: 0 }))
  })

  it("Enums", async () => {
    enum Fruits {
      Apple,
      Banana
    }
    const schema = Schema.Enums(Fruits)

    await assertions.serialization.codec.succeed(schema, Fruits.Apple, 0)
    await assertions.serialization.codec.succeed(schema, Fruits.Banana, 1)
    await assertions.deserialization.codec.succeed(schema, 0, Fruits.Apple)
    await assertions.deserialization.codec.succeed(schema, 1, Fruits.Banana)
  })
})
