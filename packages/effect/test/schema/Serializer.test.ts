import { Cause } from "effect"
import { Option, Redacted } from "effect/data"
import { Check, Formatter, Schema, Serializer, ToParser, Transformation } from "effect/schema"
import { DateTime, Duration } from "effect/time"
import { describe, it } from "vitest"
import { assertTrue, strictEqual } from "../utils/assert.ts"
import { assertions } from "../utils/schema.ts"

const isDeno = "Deno" in globalThis

const FiniteFromDate = Schema.Date.pipe(Schema.decodeTo(
  Schema.Number,
  Transformation.transform({
    decode: (date) => date.getTime(),
    encode: (n) => new Date(n)
  })
))

describe("Serializer", () => {
  describe("json", () => {
    describe("default serialization", () => {
      describe("Unsupported schemas", () => {
        it("Declaration without defaultJsonSerializer annotation", async () => {
          class A {
            readonly _tag = "A"
          }

          await assertions.serialization.json.typeCodec.fail(
            Schema.declare((u): u is A => u instanceof A),
            new A(),
            `cannot serialize to JSON, required \`defaultJsonSerializer\` annotation for Declaration`
          )
        })

        it("Unknown", async () => {
          await assertions.serialization.json.typeCodec.fail(
            Schema.Unknown,
            "a",
            `cannot serialize to JSON, required \`defaultJsonSerializer\` annotation for UnknownKeyword`
          )
        })

        it("Object", async () => {
          await assertions.serialization.json.typeCodec.fail(
            Schema.Object,
            {},
            `cannot serialize to JSON, required \`defaultJsonSerializer\` annotation for ObjectKeyword`
          )
        })

        it("Struct with Symbol property name", async () => {
          const a = Symbol.for("a")
          const schema = Schema.Struct({
            [a]: Schema.String
          })

          await assertions.serialization.json.typeCodec.fail(
            schema,
            { [a]: "b" },
            "cannot serialize to JSON, property names must be strings"
          )
        })
      })

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

      it("should apply the construction process to the provided link in the defaultJsonSerializer annotation", async () => {
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
        await assertions.serialization.json.typeCodec.succeed(schema, { a: new Date("2021-01-01"), b: 1 }, {
          a: "2021-01-01T00:00:00.000Z",
          b: 1
        })
      })

      describe("instanceOf with defaultJsonSerializer annotation", () => {
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

          await assertions.serialization.json.typeCodec.succeed(schema, new MyError("a"), "a")
          await assertions.deserialization.json.typeCodec.succeed(schema, "a", new MyError("a"))
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

          await assertions.serialization.json.typeCodec.succeed(schema, new MyError({ message: "a", cause: "b" }), {
            message: "a",
            cause: "b"
          })
          await assertions.deserialization.json.typeCodec.succeed(
            schema,
            { message: "a", cause: "b" },
            new MyError({ message: "a", cause: "b" })
          )
        })
      })

      it("Any", async () => {
        const schema = Schema.Any

        await assertions.serialization.json.typeCodec.succeed(schema, () => {})
        await assertions.deserialization.json.typeCodec.succeed(schema, () => {})
      })

      it("Undefined", async () => {
        const schema = Schema.Undefined

        await assertions.serialization.json.typeCodec.succeed(schema, undefined, null)
      })

      it("Void", async () => {
        const schema = Schema.Void

        await assertions.serialization.json.typeCodec.succeed(schema, undefined, null)
      })

      it("Null", async () => {
        const schema = Schema.Null

        await assertions.serialization.json.typeCodec.succeed(schema, null)
      })

      it("String", async () => {
        const schema = Schema.String

        await assertions.serialization.json.typeCodec.succeed(schema, "a")
        await assertions.deserialization.json.typeCodec.succeed(schema, "a", "a")
      })

      it("Number", async () => {
        const schema = Schema.Number

        await assertions.serialization.json.typeCodec.succeed(schema, 1)
        await assertions.deserialization.json.typeCodec.succeed(schema, 1, 1)
      })

      it("Boolean", async () => {
        const schema = Schema.Boolean

        await assertions.serialization.json.typeCodec.succeed(schema, true)
        await assertions.deserialization.json.typeCodec.succeed(schema, true)
      })

      it("Symbol", async () => {
        const schema = Schema.Symbol

        await assertions.serialization.json.typeCodec.succeed(schema, Symbol.for("a"), "Symbol(a)")
        await assertions.serialization.json.typeCodec.fail(
          schema,
          Symbol("a"),
          "cannot serialize to string, Symbol is not registered"
        )
        await assertions.serialization.json.typeCodec.fail(
          schema,
          Symbol(),
          "cannot serialize to string, Symbol has no description"
        )

        await assertions.deserialization.json.typeCodec.succeed(schema, "Symbol(a)", Symbol.for("a"))
      })

      it("BigInt", async () => {
        const schema = Schema.BigInt

        await assertions.serialization.json.typeCodec.succeed(schema, 1n, "1")
        await assertions.deserialization.json.typeCodec.succeed(schema, "1", 1n)
      })

      it("PropertyKey", async () => {
        const schema = Schema.PropertyKey
        await assertions.serialization.json.typeCodec.succeed(schema, "a", "a")
        await assertions.serialization.json.typeCodec.succeed(schema, 1, 1)
        await assertions.serialization.json.typeCodec.succeed(schema, Symbol.for("a"), "Symbol(a)")

        await assertions.deserialization.json.typeCodec.succeed(schema, "a", "a")
        await assertions.deserialization.json.typeCodec.succeed(schema, 1, 1)
        await assertions.deserialization.json.typeCodec.succeed(schema, "Symbol(a)", Symbol.for("a"))
      })

      describe("Literal", () => {
        it("string", async () => {
          const schema = Schema.Literal("a")

          await assertions.serialization.json.typeCodec.succeed(schema, "a", "a")
          await assertions.deserialization.json.typeCodec.succeed(schema, "a", "a")
        })

        it("number", async () => {
          const schema = Schema.Literal(1)

          await assertions.serialization.json.typeCodec.succeed(schema, 1, 1)
          await assertions.deserialization.json.typeCodec.succeed(schema, 1, 1)
        })

        it("boolean", async () => {
          const schema = Schema.Literal(true)

          await assertions.serialization.json.typeCodec.succeed(schema, true)
          await assertions.deserialization.json.typeCodec.succeed(schema, true)
        })

        it("bigint", async () => {
          const schema = Schema.Literal(1n)

          await assertions.serialization.json.typeCodec.succeed(schema, 1n, "1")
          await assertions.deserialization.json.typeCodec.succeed(schema, "1", 1n)
        })
      })

      it("Literals", async () => {
        const schema = Schema.Literals(["a", 1, 2n, true])
        await assertions.deserialization.json.typeCodec.fail(
          schema,
          "-",
          `Expected "a" | 1 | 2 | true, got "-"`
        )
      })

      describe("TemplateLiteral", () => {
        it("1n + string", async () => {
          const schema = Schema.TemplateLiteral([1n, Schema.String])

          await assertions.serialization.json.typeCodec.succeed(schema, "1a")
          await assertions.deserialization.json.typeCodec.succeed(schema, "1a")
        })

        it(`"a" + bigint`, async () => {
          const schema = Schema.TemplateLiteral(["a", Schema.BigInt])

          await assertions.serialization.json.typeCodec.succeed(schema, "a1")
          await assertions.deserialization.json.typeCodec.succeed(schema, "a1")
        })
      })

      it("Enums", async () => {
        enum Fruits {
          Apple,
          Banana
        }
        const schema = Schema.Enums(Fruits)

        await assertions.serialization.json.typeCodec.succeed(schema, Fruits.Apple, 0)
        await assertions.serialization.json.typeCodec.succeed(schema, Fruits.Banana, 1)
        await assertions.deserialization.json.typeCodec.succeed(schema, 0, Fruits.Apple)
        await assertions.deserialization.json.typeCodec.succeed(schema, 1, Fruits.Banana)
      })

      describe("Struct", () => {
        it("Date", async () => {
          const schema = Schema.Struct({
            a: Schema.Date
          })

          await assertions.serialization.json.typeCodec.succeed(
            schema,
            { a: new Date("2021-01-01") },
            { a: "2021-01-01T00:00:00.000Z" }
          )
        })

        it("UndefinedOr(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.UndefinedOr(Schema.Date)
          })

          await assertions.serialization.json.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.json.typeCodec.succeed(schema, { a: undefined }, { a: null })

          await assertions.deserialization.json.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.json.typeCodec.succeed(schema, { a: null }, { a: undefined })
        })

        it("NullOr(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.NullOr(Schema.Date)
          })

          await assertions.serialization.json.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.json.typeCodec.succeed(schema, { a: null }, { a: null })

          await assertions.deserialization.json.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.json.typeCodec.succeed(schema, { a: null }, { a: null })
        })

        it("optionalKey(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.optionalKey(Schema.Date)
          })

          await assertions.serialization.json.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.json.typeCodec.succeed(schema, {}, {})

          await assertions.deserialization.json.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.json.typeCodec.succeed(schema, {}, {})
        })

        it("optional(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.optional(Schema.Date)
          })

          await assertions.serialization.json.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.json.typeCodec.succeed(schema, {}, {})
          await assertions.serialization.json.typeCodec.succeed(schema, { a: undefined }, { a: null })

          await assertions.deserialization.json.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.json.typeCodec.succeed(schema, {}, {})
          await assertions.deserialization.json.typeCodec.succeed(schema, { a: null }, { a: undefined })
        })
      })

      it("Record(Symbol, Date)", async () => {
        const schema = Schema.Record(Schema.Symbol, Schema.Date)

        await assertions.serialization.json.typeCodec.succeed(
          schema,
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") },
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" }
        )

        await assertions.deserialization.json.typeCodec.succeed(
          schema,
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" },
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") }
        )
      })

      describe("Tuple", () => {
        it("Date", async () => {
          const schema = Schema.Tuple([Schema.Date])

          await assertions.serialization.json.typeCodec.succeed(
            schema,
            [new Date("2021-01-01")],
            ["2021-01-01T00:00:00.000Z"]
          )
          await assertions.deserialization.json.typeCodec.succeed(
            schema,
            ["2021-01-01T00:00:00.000Z"],
            [new Date("2021-01-01")]
          )
        })

        it("UndefinedOr(Date)", async () => {
          const schema = Schema.Tuple([Schema.UndefinedOr(Schema.Date)])

          await assertions.serialization.json.typeCodec.succeed(
            schema,
            [new Date("2021-01-01")],
            ["2021-01-01T00:00:00.000Z"]
          )
          await assertions.serialization.json.typeCodec.succeed(schema, [undefined], [null])

          await assertions.deserialization.json.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.json.typeCodec.succeed(schema, [null], [undefined])
        })

        it("NullOr(Date)", async () => {
          const schema = Schema.Tuple([Schema.NullOr(Schema.Date)])

          await assertions.serialization.json.typeCodec.succeed(schema, [new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await assertions.serialization.json.typeCodec.succeed(schema, [null], [null])

          await assertions.deserialization.json.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.json.typeCodec.succeed(schema, [null], [null])
        })

        it("optionalKey(Date)", async () => {
          const schema = Schema.Tuple([Schema.optionalKey(Schema.Date)])

          await assertions.serialization.json.typeCodec.succeed(schema, [new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await assertions.serialization.json.typeCodec.succeed(schema, [], [])

          await assertions.deserialization.json.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.json.typeCodec.succeed(schema, [], [])
        })

        it("optional(Date)", async () => {
          const schema = Schema.Tuple([Schema.optional(Schema.Date)])

          await assertions.serialization.json.typeCodec.succeed(schema, [new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await assertions.serialization.json.typeCodec.succeed(schema, [], [])
          await assertions.serialization.json.typeCodec.succeed(schema, [undefined], [null])

          await assertions.deserialization.json.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.json.typeCodec.succeed(schema, [], [])
          await assertions.deserialization.json.typeCodec.succeed(schema, [null], [undefined])
        })
      })

      it("Array(Date)", async () => {
        const schema = Schema.Array(Schema.Date)

        await assertions.serialization.json.typeCodec.succeed(
          schema,
          [new Date("2021-01-01"), new Date("2021-01-02")],
          ["2021-01-01T00:00:00.000Z", "2021-01-02T00:00:00.000Z"]
        )
      })

      describe("Union", () => {
        it("NullOr(Date)", async () => {
          const schema = Schema.NullOr(Schema.String)

          await assertions.serialization.json.typeCodec.succeed(schema, "a", "a")
          await assertions.serialization.json.typeCodec.succeed(schema, null)
          await assertions.deserialization.json.typeCodec.succeed(schema, null)
          await assertions.deserialization.json.typeCodec.succeed(schema, "a", "a")
        })

        it("NullOr(Number)", async () => {
          const schema = Schema.NullOr(Schema.Number)

          await assertions.serialization.json.typeCodec.succeed(schema, 1, 1)
          await assertions.serialization.json.typeCodec.succeed(schema, null)
          await assertions.deserialization.json.typeCodec.succeed(schema, null)
          await assertions.deserialization.json.typeCodec.succeed(schema, 1, 1)
        })

        it("Array(NullOr(Number))", async () => {
          const schema = Schema.Array(Schema.NullOr(Schema.Number))

          await assertions.serialization.json.typeCodec.succeed(schema, [1, null], [1, null])
          await assertions.deserialization.json.typeCodec.succeed(schema, [1, null], [1, null])
        })

        it("Union(Schema.Date, FiniteFromDate)", async () => {
          const schema = Schema.Union([Schema.Date, FiniteFromDate])

          await assertions.serialization.json.typeCodec.succeed(
            schema,
            new Date("2021-01-01"),
            "2021-01-01T00:00:00.000Z"
          )
          await assertions.serialization.json.typeCodec.succeed(schema, 0)
        })
      })

      it("Suspend", async () => {
        interface Category<A, T> {
          readonly a: A
          readonly categories: ReadonlyArray<T>
        }
        interface CategoryType extends Category<number, CategoryType> {}
        interface CategoryEncoded extends Category<string, CategoryEncoded> {}

        const schema = Schema.Struct({
          a: Schema.FiniteFromString.check(Check.greaterThan(0)),
          categories: Schema.Array(Schema.suspend((): Schema.Codec<CategoryType, CategoryEncoded> => schema))
        })

        await assertions.serialization.json.typeCodec.succeed(schema, { a: 1, categories: [] }, {
          a: 1,
          categories: []
        })
        await assertions.serialization.json.typeCodec.succeed(schema, {
          a: 1,
          categories: [{ a: 2, categories: [] }]
        }, {
          a: 1,
          categories: [
            { a: 2, categories: [] }
          ]
        })
        await assertions.deserialization.json.typeCodec.succeed(schema, {
          a: 1,
          categories: []
        }, { a: 1, categories: [] })
        await assertions.deserialization.json.typeCodec.succeed(schema, {
          a: 1,
          categories: [
            { a: 2, categories: [] }
          ]
        }, { a: 1, categories: [{ a: 2, categories: [] }] })
      })

      it("FiniteFromDate", async () => {
        const schema = FiniteFromDate

        await assertions.serialization.json.typeCodec.succeed(schema, 0)
      })

      it("Class", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({
          a: FiniteFromDate
        })) {}

        await assertions.serialization.json.typeCodec.succeed(A, new A({ a: 0 }), { a: 0 })
        await assertions.deserialization.json.typeCodec.succeed(A, { a: 0 }, new A({ a: 0 }))
      })

      it("ErrorClass", async () => {
        class E extends Schema.ErrorClass<E>("E")({
          a: FiniteFromDate
        }) {}

        await assertions.serialization.json.typeCodec.succeed(E, new E({ a: 0 }), { a: 0 })
        await assertions.deserialization.json.typeCodec.succeed(E, { a: 0 }, new E({ a: 0 }))
      })

      it("Date", async () => {
        const schema = Schema.Date

        await assertions.serialization.json.typeCodec.succeed(
          schema,
          new Date("2021-01-01"),
          "2021-01-01T00:00:00.000Z"
        )
      })

      it("Error", async () => {
        const schema = Schema.Error

        await assertions.serialization.json.typeCodec.succeed(
          schema,
          new Error("a"),
          { name: "Error", message: "a" }
        )
        // Error: message only
        await assertions.deserialization.json.typeCodec.succeed(
          schema,
          { message: "a" },
          new Error("a", { cause: { message: "a" } })
        )
        // Error: message and name
        await assertions.deserialization.json.typeCodec.succeed(
          schema,
          { name: "b", message: "a" },
          (() => {
            const err = new Error("a", { cause: { message: "a", name: "b" } })
            err.name = "b"
            return err
          })()
        )
        // Error: message, name, and stack
        await assertions.deserialization.json.typeCodec.succeed(
          schema,
          { name: "b", message: "a", stack: "c" },
          (() => {
            const err = new Error("a", { cause: { message: "a", name: "b", stack: "c" } })
            err.name = "b"
            err.stack = "c"
            return err
          })()
        )
      })

      it("URL", async () => {
        const schema = Schema.URL

        await assertions.serialization.json.typeCodec.succeed(
          schema,
          new URL("https://example.com"),
          "https://example.com/"
        )
        await assertions.deserialization.json.typeCodec.succeed(
          schema,
          "https://example.com",
          new URL("https://example.com")
        )
        await assertions.deserialization.json.typeCodec.succeed(
          schema,
          "https://example.com/",
          new URL("https://example.com")
        )
        await assertions.deserialization.json.typeCodec.fail(
          schema,
          "not a url",
          isDeno ? `TypeError: Invalid URL: 'not a url'` : `TypeError: Invalid URL`
        )
      })

      it("Uint8Array", async () => {
        const schema = Schema.Uint8Array
        await assertions.serialization.json.typeCodec.succeed(schema, new Uint8Array([1, 2, 3]), "AQID")
        await assertions.deserialization.json.typeCodec.succeed(schema, "AQID", new Uint8Array([1, 2, 3]))
        await assertions.deserialization.json.typeCodec.fail(
          schema,
          "not a base64 string",
          "Length must be a multiple of 4, but is 19"
        )
      })

      it("Duration", async () => {
        const schema = Schema.Duration
        await assertions.serialization.json.typeCodec.succeed(schema, Duration.infinity, "Infinity")
        await assertions.serialization.json.typeCodec.succeed(schema, Duration.nanos(1000n), "1000")
        await assertions.serialization.json.typeCodec.succeed(schema, Duration.millis(1), 1)
        await assertions.serialization.json.typeCodec.succeed(schema, Duration.zero, 0)
        await assertions.deserialization.json.typeCodec.succeed(schema, "Infinity", Duration.infinity)
        await assertions.deserialization.json.typeCodec.succeed(schema, 1, Duration.millis(1))
        await assertions.deserialization.json.typeCodec.succeed(schema, "1000", Duration.nanos(1000n))
      })

      it("DateTimeUtc", async () => {
        const schema = Schema.DateTimeUtc
        await assertions.serialization.json.typeCodec.succeed(
          schema,
          DateTime.unsafeMake("2021-01-01T00:00:00.000Z"),
          "2021-01-01T00:00:00.000Z"
        )
        await assertions.deserialization.json.typeCodec.succeed(
          schema,
          "2021-01-01T00:00:00.000Z",
          DateTime.unsafeMake("2021-01-01T00:00:00.000Z")
        )
      })

      it("Option(Date)", async () => {
        const schema = Schema.Option(Schema.Date)

        await assertions.serialization.json.typeCodec.succeed(schema, Option.some(new Date("2021-01-01")), [
          "2021-01-01T00:00:00.000Z"
        ])
        await assertions.serialization.json.typeCodec.succeed(schema, Option.none(), [])
      })

      it("Redacted(Option(String))", async () => {
        const schema = Schema.Redacted(Schema.Option(Schema.String))

        await assertions.serialization.json.typeCodec.fail(
          schema,
          Redacted.make(Option.none()),
          `Cannot serialize Redacted`
        )
        await assertions.serialization.json.typeCodec.fail(
          schema,
          Redacted.make(Option.some("a")),
          `Cannot serialize Redacted`
        )
        await assertions.deserialization.json.typeCodec.succeed(schema, [], Redacted.make(Option.none()))
        await assertions.deserialization.json.typeCodec.succeed(schema, ["a"], Redacted.make(Option.some("a")))
      })

      it("Map", async () => {
        const schema = Schema.Map(Schema.Option(Schema.Date), FiniteFromDate)

        await assertions.serialization.json.typeCodec.succeed(
          schema,
          new Map([[Option.some(new Date("2021-01-01")), 0]]),
          [[
            ["2021-01-01T00:00:00.000Z"],
            0
          ]]
        )
        await assertions.deserialization.json.typeCodec.succeed(
          schema,
          [[["2021-01-01T00:00:00.000Z"], 0]],
          new Map([[Option.some(new Date("2021-01-01")), 0]])
        )
      })
    })

    describe("custom serialization", () => {
      it("FiniteFromDate", async () => {
        const schema = FiniteFromDate

        await assertions.serialization.json.codec.succeed(schema, 0, "1970-01-01T00:00:00.000Z")
      })

      it("Struct", async () => {
        const schema = Schema.Struct({
          a: FiniteFromDate,
          b: FiniteFromDate
        })

        await assertions.serialization.json.codec.succeed(
          schema,
          { a: 0, b: 0 },
          { a: "1970-01-01T00:00:00.000Z", b: "1970-01-01T00:00:00.000Z" }
        )
      })

      it("Tuple(Schema.Date, Schema.Date)", async () => {
        const schema = Schema.Tuple([FiniteFromDate, FiniteFromDate])

        await assertions.serialization.json.codec.succeed(
          schema,
          [0, 0],
          ["1970-01-01T00:00:00.000Z", "1970-01-01T00:00:00.000Z"]
        )
      })

      it("Class", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({
          a: FiniteFromDate
        })) {}

        await assertions.serialization.json.codec.succeed(A, new A({ a: 0 }), { a: "1970-01-01T00:00:00.000Z" })
        await assertions.deserialization.json.codec.succeed(A, { a: "1970-01-01T00:00:00.000Z" }, new A({ a: 0 }))
      })

      it("Error", async () => {
        class E extends Schema.ErrorClass<E>("E")({
          a: FiniteFromDate
        }) {}

        await assertions.serialization.json.codec.succeed(E, new E({ a: 0 }), { a: "1970-01-01T00:00:00.000Z" })
        await assertions.deserialization.json.codec.succeed(E, { a: "1970-01-01T00:00:00.000Z" }, new E({ a: 0 }))
      })

      it("Enums", async () => {
        enum Fruits {
          Apple,
          Banana = "banana"
        }
        const schema = Schema.Enums(Fruits)

        await assertions.serialization.json.codec.succeed(schema, Fruits.Apple, 0)
        await assertions.serialization.json.codec.succeed(schema, Fruits.Banana, "banana")
        await assertions.deserialization.json.codec.succeed(schema, 0, Fruits.Apple)
        await assertions.deserialization.json.codec.succeed(schema, "banana", Fruits.Banana)
      })

      it("Option(Option(FiniteFromDate))", async () => {
        const schema = Schema.Option(Schema.Option(FiniteFromDate))

        await assertions.serialization.json.codec.succeed(schema, Option.some(Option.some(0)), [[
          "1970-01-01T00:00:00.000Z"
        ]])
      })

      it("Map(Option(Symbol), Date)", async () => {
        const schema = Schema.Map(Schema.Option(Schema.Symbol), Schema.Date)

        await assertions.serialization.json.codec.succeed(
          schema,
          new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]]),
          [[
            ["Symbol(a)"],
            "2021-01-01T00:00:00.000Z"
          ]]
        )
        await assertions.deserialization.json.codec.succeed(
          schema,
          [[["Symbol(a)"], "2021-01-01T00:00:00.000Z"]],
          new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]])
        )
      })

      it("Defect", async () => {
        const schema = Schema.Defect
        await assertions.serialization.json.codec.succeed(schema, new Error("a"), { name: "Error", message: "a" })
        await assertions.serialization.json.codec.succeed(schema, "a", "a")
        await assertions.serialization.json.codec.succeed(schema, { toString: () => "a" }, "a")
      })

      it("Cause(Option(Finite), Option(String))", async () => {
        const schema = Schema.Cause(Schema.Option(Schema.Finite), Schema.Option(Schema.String))
        await assertions.serialization.json.codec.succeed(schema, Cause.fail(Option.some(1)), [{
          _tag: "Fail",
          error: [1]
        }])
        await assertions.serialization.json.codec.succeed(schema, Cause.die(Option.some("a")), [{
          _tag: "Die",
          defect: ["a"]
        }])
        await assertions.serialization.json.codec.succeed(schema, Cause.interrupt(1), [{
          _tag: "Interrupt",
          fiberId: 1
        }])
        await assertions.serialization.json.codec.succeed(schema, Cause.interrupt(), [{
          _tag: "Interrupt",
          fiberId: null
        }])
      })

      it("DateTimeUtcFromValidDate", async () => {
        const schema = Schema.DateTimeUtcFromDate
        await assertions.serialization.json.codec.succeed(
          schema,
          DateTime.unsafeMake("2021-01-01T00:00:00.000Z"),
          "2021-01-01T00:00:00.000Z"
        )
        await assertions.deserialization.json.codec.succeed(
          schema,
          "2021-01-01T00:00:00.000Z",
          DateTime.unsafeMake("2021-01-01T00:00:00.000Z")
        )
      })
    })

    it("StandardSchemaV1FailureResult", async () => {
      const b = Symbol.for("b")

      const schema = Schema.Struct({
        a: Schema.NonEmptyString,
        [b]: Schema.Finite,
        c: Schema.Tuple([Schema.String])
      })

      const r = ToParser.decodeUnknownResult(schema)({ a: "", c: [] }, { errors: "all" })

      assertTrue(r._tag === "Failure")

      const failureResult = Formatter.makeStandardSchemaV1({
        leafHook: Formatter.defaultLeafHook
      }).format(r.failure)
      await assertions.serialization.json.codec.succeed(Schema.StandardSchemaV1FailureResult, failureResult, {
        issues: [
          { path: ["a"], message: `Expected a value with a length of at least 1, got ""` },
          { path: ["c", 0], message: "Missing key" },
          { path: ["Symbol(b)"], message: "Missing key" }
        ]
      })
      await assertions.deserialization.json.codec.succeed(Schema.StandardSchemaV1FailureResult, {
        issues: [
          { path: ["a"], message: `Expected a value with a length of at least 1, got ""` },
          { path: ["c", 0], message: "Missing key" },
          { path: ["Symbol(b)"], message: "Missing key" }
        ]
      }, failureResult)
    })
  })

  describe("stringLeafJson", () => {
    describe("should return the same reference if nothing changed", () => {
      it("String", async () => {
        const schema = Schema.String
        const serializer = Serializer.stringLeafJson(schema)
        strictEqual(serializer.ast, schema.ast)
      })

      it("Struct({ a: String })", async () => {
        const schema = Schema.Struct({
          a: Schema.String
        })
        const serializer = Serializer.stringLeafJson(schema)
        strictEqual(serializer.ast, schema.ast)
      })
    })

    describe("should memoize the result", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.Finite
        })
        const serializer = Serializer.stringLeafJson(schema)
        strictEqual(serializer.ast, Serializer.stringLeafJson(serializer).ast)
      })

      it("Array", async () => {
        const schema = Schema.Array(Schema.Finite)
        const serializer = Serializer.stringLeafJson(schema)
        strictEqual(serializer.ast, Serializer.stringLeafJson(serializer).ast)
      })
    })

    describe("default serialization", () => {
      describe("Unsupported schemas", () => {
        it("Declaration without annotation", async () => {
          class A {
            readonly _tag = "A"
          }

          await assertions.serialization.stringLeafJson.typeCodec.fail(
            Schema.declare((u): u is A => u instanceof A),
            new A(),
            `cannot serialize to JSON, required \`defaultJsonSerializer\` annotation for Declaration`
          )
        })

        it("Unknown", async () => {
          await assertions.serialization.stringLeafJson.typeCodec.fail(
            Schema.Unknown,
            "a",
            `cannot serialize to JSON, required \`defaultJsonSerializer\` annotation for UnknownKeyword`
          )
        })

        it("Object", async () => {
          await assertions.serialization.stringLeafJson.typeCodec.fail(
            Schema.Object,
            {},
            `cannot serialize to JSON, required \`defaultJsonSerializer\` annotation for ObjectKeyword`
          )
        })

        it("Struct with Symbol property name", async () => {
          const a = Symbol.for("a")
          const schema = Schema.Struct({
            [a]: Schema.String
          })

          await assertions.serialization.stringLeafJson.typeCodec.fail(
            schema,
            { [a]: "b" },
            "cannot serialize to JSON, property names must be strings"
          )
        })
      })

      it("Any", async () => {
        const schema = Schema.Any

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, (() => {}) as any)
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, (() => {}) as any)
      })

      it("Undefined", async () => {
        const schema = Schema.Undefined

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, undefined)
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, undefined)
      })

      it("Void", async () => {
        const schema = Schema.Void

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, undefined)
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, undefined)
      })

      it("Null", async () => {
        const schema = Schema.Null

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, null, undefined)
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, undefined, null)
      })

      it("String", async () => {
        const schema = Schema.String

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, "a")
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "a")
      })

      it("Number", async () => {
        const schema = Schema.Number

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, 1, "1")
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "1", 1)
      })

      it("Boolean", async () => {
        const schema = Schema.Boolean

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, true, "true")
        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, false, "false")
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "true", true)
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "false", false)
      })

      it("Symbol", async () => {
        const schema = Schema.Symbol

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, Symbol.for("a"), "Symbol(a)")
        await assertions.serialization.stringLeafJson.typeCodec.fail(
          schema,
          Symbol("a"),
          "cannot serialize to string, Symbol is not registered"
        )
        await assertions.serialization.stringLeafJson.typeCodec.fail(
          schema,
          Symbol(),
          "cannot serialize to string, Symbol has no description"
        )

        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "Symbol(a)", Symbol.for("a"))
      })

      it("BigInt", async () => {
        const schema = Schema.BigInt

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, 1n, "1")
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "1", 1n)
      })

      it("PropertyKey", async () => {
        const schema = Schema.PropertyKey
        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, "a", "a")
        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, 1, "1")
        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, Symbol.for("a"), "Symbol(a)")

        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "a", "a")
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "1", "1")
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "Symbol(a)", Symbol.for("a"))
      })

      describe("Literal", () => {
        it("string", async () => {
          const schema = Schema.Literal("a")

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, "a", "a")
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "a", "a")
        })

        it("number", async () => {
          const schema = Schema.Literal(1)

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, 1, "1")
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "1", 1)
        })

        it("boolean", async () => {
          const schema = Schema.Literal(true)

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, true, "true")
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "true", true)
        })

        it("bigint", async () => {
          const schema = Schema.Literal(1n)

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, 1n, "1")
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "1", 1n)
        })
      })

      it("Literals", async () => {
        const schema = Schema.Literals(["a", 1, 2n, true])
        await assertions.deserialization.stringLeafJson.typeCodec.fail(
          schema,
          "-",
          `Expected "a" | 1 | 2 | true, got "-"`
        )
      })

      describe("TemplateLiteral", () => {
        it("1n + string", async () => {
          const schema = Schema.TemplateLiteral([1n, Schema.String])

          await assertions.serialization.json.typeCodec.succeed(schema, "1a")
          await assertions.deserialization.json.typeCodec.succeed(schema, "1a")
        })

        it(`"a" + bigint`, async () => {
          const schema = Schema.TemplateLiteral(["a", Schema.BigInt])

          await assertions.serialization.json.typeCodec.succeed(schema, "a1")
          await assertions.deserialization.json.typeCodec.succeed(schema, "a1")
        })
      })

      it("Enums", async () => {
        enum Fruits {
          Apple,
          Banana
        }
        const schema = Schema.Enums(Fruits)

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, Fruits.Apple, "0")
        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, Fruits.Banana, "1")
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "0", Fruits.Apple)
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "1", Fruits.Banana)
      })

      describe("Struct", () => {
        it("Date", async () => {
          const schema = Schema.Struct({
            a: Schema.Date
          })

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
        })

        it("UndefinedOr(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.UndefinedOr(Schema.Date)
          })

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, { a: undefined }, { a: undefined })

          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, { a: undefined }, { a: undefined })
        })

        it("NullOr(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.NullOr(Schema.Date)
          })

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, { a: null }, { a: undefined })

          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, { a: undefined }, { a: null })
        })

        it("optionalKey(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.optionalKey(Schema.Date)
          })

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, {}, {})

          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, {}, {})
        })

        it("optional(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.optional(Schema.Date)
          })

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, {}, {})
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, { a: undefined }, { a: undefined })

          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, {}, {})
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, { a: undefined }, { a: undefined })
        })
      })

      it("Record(Symbol, Date)", async () => {
        const schema = Schema.Record(Schema.Symbol, Schema.Date)

        await assertions.serialization.stringLeafJson.typeCodec.succeed(
          schema,
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") },
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" }
        )

        await assertions.deserialization.stringLeafJson.typeCodec.succeed(
          schema,
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" },
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") }
        )
      })

      describe("Tuple", () => {
        it("Date", async () => {
          const schema = Schema.Tuple([Schema.Date])

          await assertions.serialization.stringLeafJson.typeCodec.succeed(
            schema,
            [new Date("2021-01-01")],
            ["2021-01-01T00:00:00.000Z"]
          )
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(
            schema,
            ["2021-01-01T00:00:00.000Z"],
            [new Date("2021-01-01")]
          )
        })

        it("UndefinedOr(Date)", async () => {
          const schema = Schema.Tuple([Schema.UndefinedOr(Schema.Date)])

          await assertions.serialization.stringLeafJson.typeCodec.succeed(
            schema,
            [new Date("2021-01-01")],
            ["2021-01-01T00:00:00.000Z"]
          )
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, [undefined])

          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, [undefined])
        })

        it("NullOr(Date)", async () => {
          const schema = Schema.Tuple([Schema.NullOr(Schema.Date)])

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, [new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, [null], [undefined])

          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, [undefined], [null])
        })

        it("optionalKey(Date)", async () => {
          const schema = Schema.Tuple([Schema.optionalKey(Schema.Date)])

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, [new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, [], [])

          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, [], [])
        })

        it("optional(Date)", async () => {
          const schema = Schema.Tuple([Schema.optional(Schema.Date)])

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, [new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, [], [])
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, [undefined])

          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, [], [])
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, [undefined])
        })
      })

      it("Array(Date)", async () => {
        const schema = Schema.Array(Schema.Date)

        await assertions.serialization.stringLeafJson.typeCodec.succeed(
          schema,
          [new Date("2021-01-01"), new Date("2021-01-02")],
          ["2021-01-01T00:00:00.000Z", "2021-01-02T00:00:00.000Z"]
        )
      })

      describe("Union", () => {
        it("NullOr(Date)", async () => {
          const schema = Schema.NullOr(Schema.String)

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, "a", "a")
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, null, undefined)
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, undefined, null)
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "a", "a")
        })

        it("NullOr(Number)", async () => {
          const schema = Schema.NullOr(Schema.Number)

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, 1, "1")
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, null, undefined)
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, undefined, null)
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, "1", 1)
        })

        it("Array(NullOr(Number))", async () => {
          const schema = Schema.Array(Schema.NullOr(Schema.Number))

          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, [1, null], ["1", undefined])
          await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, ["1", undefined], [1, null])
        })

        it("Union(Schema.Date, FiniteFromDate)", async () => {
          const schema = Schema.Union([Schema.Date, FiniteFromDate])

          await assertions.serialization.stringLeafJson.typeCodec.succeed(
            schema,
            new Date("2021-01-01"),
            "2021-01-01T00:00:00.000Z"
          )
          await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, 0, "0")
        })
      })

      it("Suspend", async () => {
        interface Category<A, T> {
          readonly a: A
          readonly categories: ReadonlyArray<T>
        }
        interface CategoryType extends Category<number, CategoryType> {}
        interface CategoryEncoded extends Category<string, CategoryEncoded> {}

        const schema = Schema.Struct({
          a: Schema.FiniteFromString.check(Check.greaterThan(0)),
          categories: Schema.Array(Schema.suspend((): Schema.Codec<CategoryType, CategoryEncoded> => schema))
        })

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, { a: 1, categories: [] }, {
          a: "1",
          categories: []
        })
        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, {
          a: 1,
          categories: [{ a: 2, categories: [] }]
        }, {
          a: "1",
          categories: [
            { a: "2", categories: [] }
          ]
        })
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, {
          a: "1",
          categories: []
        }, { a: 1, categories: [] })
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, {
          a: "1",
          categories: [
            { a: "2", categories: [] }
          ]
        }, { a: 1, categories: [{ a: 2, categories: [] }] })
      })

      it("FiniteFromDate", async () => {
        const schema = FiniteFromDate

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, 0, "0")
      })

      it("Class", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({
          a: FiniteFromDate
        })) {}

        await assertions.serialization.stringLeafJson.typeCodec.succeed(A, new A({ a: 0 }), { a: "0" })
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(A, { a: "0" }, new A({ a: 0 }))
      })

      it("ErrorClass", async () => {
        class E extends Schema.ErrorClass<E>("E")({
          a: FiniteFromDate
        }) {}

        await assertions.serialization.stringLeafJson.typeCodec.succeed(E, new E({ a: 0 }), { a: "0" })
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(E, { a: "0" }, new E({ a: 0 }))
      })

      it("Date", async () => {
        const schema = Schema.Date

        await assertions.serialization.stringLeafJson.typeCodec.succeed(
          schema,
          new Date("2021-01-01"),
          "2021-01-01T00:00:00.000Z"
        )
      })

      it("Error", async () => {
        const schema = Schema.Error

        await assertions.serialization.stringLeafJson.typeCodec.succeed(
          schema,
          new Error("a"),
          { name: "Error", message: "a" }
        )
        // Error: message only
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(
          schema,
          { message: "a" },
          new Error("a", { cause: { message: "a" } })
        )
        // Error: message and name
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(
          schema,
          { name: "b", message: "a" },
          (() => {
            const err = new Error("a", { cause: { message: "a", name: "b" } })
            err.name = "b"
            return err
          })()
        )
        // Error: message, name, and stack
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(
          schema,
          { name: "b", message: "a", stack: "c" },
          (() => {
            const err = new Error("a", { cause: { message: "a", name: "b", stack: "c" } })
            err.name = "b"
            err.stack = "c"
            return err
          })()
        )
      })

      it("URL", async () => {
        const schema = Schema.URL

        await assertions.serialization.stringLeafJson.typeCodec.succeed(
          schema,
          new URL("https://example.com"),
          "https://example.com/"
        )
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(
          schema,
          "https://example.com",
          new URL("https://example.com")
        )
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(
          schema,
          "https://example.com/",
          new URL("https://example.com")
        )
        await assertions.deserialization.stringLeafJson.typeCodec.fail(
          schema,
          "not a url",
          isDeno ? `TypeError: Invalid URL: 'not a url'` : `TypeError: Invalid URL`
        )
      })

      it("Option(Date)", async () => {
        const schema = Schema.Option(Schema.Date)

        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, Option.some(new Date("2021-01-01")), [
          "2021-01-01T00:00:00.000Z"
        ])
        await assertions.serialization.stringLeafJson.typeCodec.succeed(schema, Option.none(), [])
      })

      it("Redacted(Option(String))", async () => {
        const schema = Schema.Redacted(Schema.Option(Schema.String))

        await assertions.serialization.stringLeafJson.typeCodec.fail(
          schema,
          Redacted.make(Option.none()),
          `Cannot serialize Redacted`
        )
        await assertions.serialization.stringLeafJson.typeCodec.fail(
          schema,
          Redacted.make(Option.some("a")),
          `Cannot serialize Redacted`
        )
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(schema, [], Redacted.make(Option.none()))
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(
          schema,
          ["a"],
          Redacted.make(Option.some("a"))
        )
      })

      it("Map", async () => {
        const schema = Schema.Map(Schema.Option(Schema.Date), FiniteFromDate)

        await assertions.serialization.stringLeafJson.typeCodec.succeed(
          schema,
          new Map([[Option.some(new Date("2021-01-01")), 0]]),
          [[
            ["2021-01-01T00:00:00.000Z"],
            "0"
          ]]
        )
        await assertions.deserialization.stringLeafJson.typeCodec.succeed(
          schema,
          [[["2021-01-01T00:00:00.000Z"], "0"]],
          new Map([[Option.some(new Date("2021-01-01")), 0]])
        )
      })
    })
  })

  describe("ensureArray", () => {
    describe("should memoize the result", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.Finite
        })
        const serializer = Serializer.ensureArray(Serializer.stringLeafJson(schema))
        strictEqual(serializer.ast, Serializer.ensureArray(Serializer.stringLeafJson(serializer)).ast)
      })

      it("Array", async () => {
        const schema = Schema.Array(Schema.Finite)
        const serializer = Serializer.ensureArray(Serializer.stringLeafJson(schema))
        strictEqual(serializer.ast, Serializer.ensureArray(Serializer.stringLeafJson(serializer)).ast)
      })
    })

    it("should handle optional keys", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.NonEmptyArray(Schema.String))
      })
      const serializer = Serializer.ensureArray(Serializer.stringLeafJson(schema))

      await assertions.decoding.succeed(serializer, {})
      await assertions.decoding.succeed(serializer, { a: ["a"] })
      await assertions.decoding.succeed(serializer, { a: "a" }, { expected: { a: ["a"] } })
    })
  })
})
