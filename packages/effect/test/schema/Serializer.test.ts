import { Cause, Effect } from "effect"
import { Option, Redacted } from "effect/data"
import { Check, Issue, Schema, Serializer, ToParser, Transformation } from "effect/schema"
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
        it("Declaration without defaultIsoSerializer annotation", async () => {
          class A {
            readonly _tag = "A"
          }

          await assertions.serialization.json.typeCodec.fail(
            Schema.declare((u): u is A => u instanceof A),
            new A(),
            "cannot serialize to JSON, required `defaultJsonSerializer` or `defaultIsoSerializer` annotation for Declaration"
          )
        })

        it("Unknown", async () => {
          await assertions.serialization.json.typeCodec.fail(
            Schema.Unknown,
            "a",
            "cannot serialize to JSON, required `defaultJsonSerializer` or `defaultIsoSerializer` annotation for UnknownKeyword"
          )
        })

        it("Object", async () => {
          await assertions.serialization.json.typeCodec.fail(
            Schema.Object,
            {},
            "cannot serialize to JSON, required `defaultJsonSerializer` or `defaultIsoSerializer` annotation for ObjectKeyword"
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
            "cannot serialize to JSON, TypeLiteral property names must be strings"
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

      it("should apply the construction process to the provided link in the defaultIsoSerializer annotation", async () => {
        const schema = Schema.Struct({
          a: Schema.Date.annotate({
            defaultIsoSerializer: () =>
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

      describe("instanceOf with defaultIsoSerializer annotation", () => {
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
              defaultIsoSerializer: () =>
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
                defaultIsoSerializer: () =>
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
        await assertions.deserialization.json.typeCodec.succeed(schema, 1)
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

      it("UniqueSymbol", async () => {
        const schema = Schema.UniqueSymbol(Symbol.for("a"))
        await assertions.serialization.json.typeCodec.succeed(schema, Symbol.for("a"), "Symbol(a)")
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
          DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"),
          "2021-01-01T00:00:00.000Z"
        )
        await assertions.deserialization.json.typeCodec.succeed(
          schema,
          "2021-01-01T00:00:00.000Z",
          DateTime.makeUnsafe("2021-01-01T00:00:00.000Z")
        )
      })

      it("Option(Date)", async () => {
        const schema = Schema.Option(Schema.Date)

        await assertions.serialization.json.typeCodec.succeed(schema, Option.some(new Date("2021-01-01")), {
          _tag: "Some",
          value: "2021-01-01T00:00:00.000Z"
        })
        await assertions.serialization.json.typeCodec.succeed(schema, Option.none(), { _tag: "None" })
      })

      describe("Redacted", () => {
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
          await assertions.deserialization.json.typeCodec.succeed(
            schema,
            { _tag: "None" },
            Redacted.make(Option.none())
          )
          await assertions.deserialization.json.typeCodec.succeed(
            schema,
            { _tag: "Some", value: "a" },
            Redacted.make(Option.some("a"))
          )
        })

        it("encoding a Redacted with a label", async () => {
          await assertions.serialization.json.typeCodec.fail(
            Schema.Redacted(Schema.String),
            Redacted.make("a", { label: "API key" }),
            `Cannot serialize Redacted with label: "API key"`
          )
          await assertions.serialization.json.typeCodec.fail(
            Schema.Redacted(Schema.String, { label: "password" }),
            Redacted.make("a", { label: "API key" }),
            `Expected "password", got "API key"
  at ["label"]`
          )
        })
      })

      it("Map", async () => {
        const schema = Schema.Map(Schema.Option(Schema.Date), FiniteFromDate)

        await assertions.serialization.json.typeCodec.succeed(
          schema,
          new Map([[Option.some(new Date("2021-01-01")), 0]]),
          [[
            { _tag: "Some", value: "2021-01-01T00:00:00.000Z" },
            0
          ]]
        )
        await assertions.deserialization.json.typeCodec.succeed(
          schema,
          [[{ _tag: "Some", value: "2021-01-01T00:00:00.000Z" }, 0]],
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

        await assertions.serialization.json.codec.succeed(schema, Option.some(Option.some(0)), {
          _tag: "Some",
          value: {
            _tag: "Some",
            value: "1970-01-01T00:00:00.000Z"
          }
        })
      })

      it("Map(Option(Symbol), Date)", async () => {
        const schema = Schema.Map(Schema.Option(Schema.Symbol), Schema.Date)

        await assertions.serialization.json.codec.succeed(
          schema,
          new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]]),
          [[
            { _tag: "Some", value: "Symbol(a)" },
            "2021-01-01T00:00:00.000Z"
          ]]
        )
        await assertions.deserialization.json.codec.succeed(
          schema,
          [[{ _tag: "Some", value: "Symbol(a)" }, "2021-01-01T00:00:00.000Z"]],
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
          error: { _tag: "Some", value: 1 }
        }])
        await assertions.serialization.json.codec.succeed(schema, Cause.die(Option.some("a")), [{
          _tag: "Die",
          defect: { _tag: "Some", value: "a" }
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
          DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"),
          "2021-01-01T00:00:00.000Z"
        )
        await assertions.deserialization.json.codec.succeed(
          schema,
          "2021-01-01T00:00:00.000Z",
          DateTime.makeUnsafe("2021-01-01T00:00:00.000Z")
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

      const r = ToParser.decodeUnknownExit(schema)({ a: "", c: [] }, { errors: "all" })

      assertTrue(r._tag === "Failure")
      assertTrue(r.cause.failures.length === 1)
      const failure = r.cause.failures[0]
      assertTrue(failure._tag === "Fail")

      const failureResult = Issue.makeStandardSchemaV1({
        leafHook: Issue.defaultLeafHook
      }).format(failure.error)
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

  describe("stringPojo", () => {
    describe("should return the same reference if nothing changed", () => {
      it("String", async () => {
        const schema = Schema.String
        const serializer = Serializer.stringPojo(schema)
        strictEqual(serializer.ast, schema.ast)
      })

      it("Struct({ a: String })", async () => {
        const schema = Schema.Struct({
          a: Schema.String
        })
        const serializer = Serializer.stringPojo(schema)
        strictEqual(serializer.ast, schema.ast)
      })
    })

    describe("should memoize the result", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.Finite
        })
        const serializer = Serializer.stringPojo(schema)
        strictEqual(serializer.ast, Serializer.stringPojo(serializer).ast)
      })

      it("Array", async () => {
        const schema = Schema.Array(Schema.Finite)
        const serializer = Serializer.stringPojo(schema)
        strictEqual(serializer.ast, Serializer.stringPojo(serializer).ast)
      })
    })

    describe("default serialization", () => {
      describe("Unsupported schemas", () => {
        it("Declaration without annotation", async () => {
          class A {
            readonly _tag = "A"
          }

          await assertions.serialization.stringPojo.typeCodec.fail(
            Schema.declare((u): u is A => u instanceof A),
            new A(),
            "cannot serialize to StringPojo, required `defaultIsoSerializer` or `defaultJsonSerializer` annotation for Declaration"
          )
        })

        it("Unknown", async () => {
          await assertions.serialization.stringPojo.typeCodec.fail(
            Schema.Unknown,
            "a",
            "cannot serialize to StringPojo, required `defaultIsoSerializer` or `defaultJsonSerializer` annotation for UnknownKeyword"
          )
        })

        it("Object", async () => {
          await assertions.serialization.stringPojo.typeCodec.fail(
            Schema.Object,
            {},
            "cannot serialize to StringPojo, required `defaultIsoSerializer` or `defaultJsonSerializer` annotation for ObjectKeyword"
          )
        })

        it("Struct with Symbol property name", async () => {
          const a = Symbol.for("a")
          const schema = Schema.Struct({
            [a]: Schema.String
          })

          await assertions.serialization.stringPojo.typeCodec.fail(
            schema,
            { [a]: "b" },
            "cannot serialize to StringPojo, TypeLiteral property names must be strings"
          )
        })
      })

      it("Any", async () => {
        const schema = Schema.Any

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, (() => {}) as any)
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, (() => {}) as any)
      })

      it("Undefined", async () => {
        const schema = Schema.Undefined

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, undefined)
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, undefined)
      })

      it("Void", async () => {
        const schema = Schema.Void

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, undefined)
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, undefined)
      })

      it("Null", async () => {
        const schema = Schema.Null

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, null, undefined)
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, undefined, null)
      })

      it("String", async () => {
        const schema = Schema.String

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, "a")
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "a")
      })

      it("Number", async () => {
        const schema = Schema.Number

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, 1, "1")
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, Infinity, "Infinity")
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, -Infinity, "-Infinity")
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, NaN, "NaN")
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "1", 1)
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "Infinity", Infinity)
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "-Infinity", -Infinity)
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "NaN", NaN)
      })

      it("Boolean", async () => {
        const schema = Schema.Boolean

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, true, "true")
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, false, "false")
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "true", true)
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "false", false)
      })

      it("Symbol", async () => {
        const schema = Schema.Symbol

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, Symbol.for("a"), "Symbol(a)")
        await assertions.serialization.stringPojo.typeCodec.fail(
          schema,
          Symbol("a"),
          "cannot serialize to string, Symbol is not registered"
        )
        await assertions.serialization.stringPojo.typeCodec.fail(
          schema,
          Symbol(),
          "cannot serialize to string, Symbol has no description"
        )

        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "Symbol(a)", Symbol.for("a"))
      })

      it("UniqueSymbol", async () => {
        const schema = Schema.UniqueSymbol(Symbol.for("a"))
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, Symbol.for("a"), "Symbol(a)")
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "Symbol(a)", Symbol.for("a"))
      })

      it("BigInt", async () => {
        const schema = Schema.BigInt

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, 1n, "1")
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "1", 1n)
      })

      it("PropertyKey", async () => {
        const schema = Schema.PropertyKey
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, "a", "a")
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, 1, "1")
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, Symbol.for("a"), "Symbol(a)")

        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "a", "a")
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "1", "1")
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "Symbol(a)", Symbol.for("a"))
      })

      describe("Literal", () => {
        it("string", async () => {
          const schema = Schema.Literal("a")

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, "a", "a")
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "a", "a")
        })

        it("number", async () => {
          const schema = Schema.Literal(1)

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, 1, "1")
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "1", 1)
        })

        it("boolean", async () => {
          const schema = Schema.Literal(true)

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, true, "true")
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "true", true)
        })

        it("bigint", async () => {
          const schema = Schema.Literal(1n)

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, 1n, "1")
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "1", 1n)
        })
      })

      it("Literals", async () => {
        const schema = Schema.Literals(["a", 1, 2n, true])
        await assertions.deserialization.stringPojo.typeCodec.fail(
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

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, Fruits.Apple, "0")
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, Fruits.Banana, "1")
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "0", Fruits.Apple)
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "1", Fruits.Banana)
      })

      describe("Struct", () => {
        it("Date", async () => {
          const schema = Schema.Struct({
            a: Schema.Date
          })

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
        })

        it("UndefinedOr(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.UndefinedOr(Schema.Date)
          })

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, { a: undefined }, { a: undefined })

          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, { a: undefined }, { a: undefined })
        })

        it("NullOr(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.NullOr(Schema.Date)
          })

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, { a: null }, { a: undefined })

          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, { a: undefined }, { a: null })
        })

        it("optionalKey(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.optionalKey(Schema.Date)
          })

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, {}, {})

          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, {}, {})
        })

        it("optional(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.optional(Schema.Date)
          })

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, { a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, {}, {})
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, { a: undefined }, { a: undefined })

          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, { a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, {}, {})
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, { a: undefined }, { a: undefined })
        })
      })

      it("Record(Symbol, Date)", async () => {
        const schema = Schema.Record(Schema.Symbol, Schema.Date)

        await assertions.serialization.stringPojo.typeCodec.succeed(
          schema,
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") },
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" }
        )

        await assertions.deserialization.stringPojo.typeCodec.succeed(
          schema,
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" },
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") }
        )
      })

      describe("Tuple", () => {
        it("Date", async () => {
          const schema = Schema.Tuple([Schema.Date])

          await assertions.serialization.stringPojo.typeCodec.succeed(
            schema,
            [new Date("2021-01-01")],
            ["2021-01-01T00:00:00.000Z"]
          )
          await assertions.deserialization.stringPojo.typeCodec.succeed(
            schema,
            ["2021-01-01T00:00:00.000Z"],
            [new Date("2021-01-01")]
          )
        })

        it("UndefinedOr(Date)", async () => {
          const schema = Schema.Tuple([Schema.UndefinedOr(Schema.Date)])

          await assertions.serialization.stringPojo.typeCodec.succeed(
            schema,
            [new Date("2021-01-01")],
            ["2021-01-01T00:00:00.000Z"]
          )
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, [undefined])

          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, [undefined])
        })

        it("NullOr(Date)", async () => {
          const schema = Schema.Tuple([Schema.NullOr(Schema.Date)])

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, [new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, [null], [undefined])

          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, [undefined], [null])
        })

        it("optionalKey(Date)", async () => {
          const schema = Schema.Tuple([Schema.optionalKey(Schema.Date)])

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, [new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, [], [])

          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, [], [])
        })

        it("optional(Date)", async () => {
          const schema = Schema.Tuple([Schema.optional(Schema.Date)])

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, [new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, [], [])
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, [undefined])

          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, ["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, [], [])
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, [undefined])
        })
      })

      it("Array(Date)", async () => {
        const schema = Schema.Array(Schema.Date)

        await assertions.serialization.stringPojo.typeCodec.succeed(
          schema,
          [new Date("2021-01-01"), new Date("2021-01-02")],
          ["2021-01-01T00:00:00.000Z", "2021-01-02T00:00:00.000Z"]
        )
      })

      describe("Union", () => {
        it("NullOr(Date)", async () => {
          const schema = Schema.NullOr(Schema.String)

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, "a", "a")
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, null, undefined)
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, undefined, null)
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "a", "a")
        })

        it("NullOr(Number)", async () => {
          const schema = Schema.NullOr(Schema.Number)

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, 1, "1")
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, null, undefined)
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, undefined, null)
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, "1", 1)
        })

        it("Array(NullOr(Number))", async () => {
          const schema = Schema.Array(Schema.NullOr(Schema.Number))

          await assertions.serialization.stringPojo.typeCodec.succeed(schema, [1, null], ["1", undefined])
          await assertions.deserialization.stringPojo.typeCodec.succeed(schema, ["1", undefined], [1, null])
        })

        it("Union(Schema.Date, FiniteFromDate)", async () => {
          const schema = Schema.Union([Schema.Date, FiniteFromDate])

          await assertions.serialization.stringPojo.typeCodec.succeed(
            schema,
            new Date("2021-01-01"),
            "2021-01-01T00:00:00.000Z"
          )
          await assertions.serialization.stringPojo.typeCodec.succeed(schema, 0, "0")
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

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, { a: 1, categories: [] }, {
          a: "1",
          categories: []
        })
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, {
          a: 1,
          categories: [{ a: 2, categories: [] }]
        }, {
          a: "1",
          categories: [
            { a: "2", categories: [] }
          ]
        })
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, {
          a: "1",
          categories: []
        }, { a: 1, categories: [] })
        await assertions.deserialization.stringPojo.typeCodec.succeed(schema, {
          a: "1",
          categories: [
            { a: "2", categories: [] }
          ]
        }, { a: 1, categories: [{ a: 2, categories: [] }] })
      })

      it("FiniteFromDate", async () => {
        const schema = FiniteFromDate

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, 0, "0")
      })

      it("Class", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({
          a: FiniteFromDate
        })) {}

        await assertions.serialization.stringPojo.typeCodec.succeed(A, new A({ a: 0 }), { a: "0" })
        await assertions.deserialization.stringPojo.typeCodec.succeed(A, { a: "0" }, new A({ a: 0 }))
      })

      it("ErrorClass", async () => {
        class E extends Schema.ErrorClass<E>("E")({
          a: FiniteFromDate
        }) {}

        await assertions.serialization.stringPojo.typeCodec.succeed(E, new E({ a: 0 }), { a: "0" })
        await assertions.deserialization.stringPojo.typeCodec.succeed(E, { a: "0" }, new E({ a: 0 }))
      })

      it("Date", async () => {
        const schema = Schema.Date

        await assertions.serialization.stringPojo.typeCodec.succeed(
          schema,
          new Date("2021-01-01"),
          "2021-01-01T00:00:00.000Z"
        )
      })

      it("Error", async () => {
        const schema = Schema.Error

        await assertions.serialization.stringPojo.typeCodec.succeed(
          schema,
          new Error("a"),
          { name: "Error", message: "a" }
        )
        // Error: message only
        await assertions.deserialization.stringPojo.typeCodec.succeed(
          schema,
          { message: "a" },
          new Error("a", { cause: { message: "a" } })
        )
        // Error: message and name
        await assertions.deserialization.stringPojo.typeCodec.succeed(
          schema,
          { name: "b", message: "a" },
          (() => {
            const err = new Error("a", { cause: { message: "a", name: "b" } })
            err.name = "b"
            return err
          })()
        )
        // Error: message, name, and stack
        await assertions.deserialization.stringPojo.typeCodec.succeed(
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

        await assertions.serialization.stringPojo.typeCodec.succeed(
          schema,
          new URL("https://example.com"),
          "https://example.com/"
        )
        await assertions.deserialization.stringPojo.typeCodec.succeed(
          schema,
          "https://example.com",
          new URL("https://example.com")
        )
        await assertions.deserialization.stringPojo.typeCodec.succeed(
          schema,
          "https://example.com/",
          new URL("https://example.com")
        )
        await assertions.deserialization.stringPojo.typeCodec.fail(
          schema,
          "not a url",
          isDeno ? `TypeError: Invalid URL: 'not a url'` : `TypeError: Invalid URL`
        )
      })

      it("Option(Date)", async () => {
        const schema = Schema.Option(Schema.Date)

        await assertions.serialization.stringPojo.typeCodec.succeed(schema, Option.some(new Date("2021-01-01")), {
          _tag: "Some",
          value: "2021-01-01T00:00:00.000Z"
        })
        await assertions.serialization.stringPojo.typeCodec.succeed(schema, Option.none(), { _tag: "None" })
      })

      it("Redacted(Option(String))", async () => {
        const schema = Schema.Redacted(Schema.Option(Schema.String))

        await assertions.serialization.stringPojo.typeCodec.fail(
          schema,
          Redacted.make(Option.none()),
          `Cannot serialize Redacted`
        )
        await assertions.serialization.stringPojo.typeCodec.fail(
          schema,
          Redacted.make(Option.some("a")),
          `Cannot serialize Redacted`
        )
        await assertions.deserialization.stringPojo.typeCodec.succeed(
          schema,
          { _tag: "None" },
          Redacted.make(Option.none())
        )
        await assertions.deserialization.stringPojo.typeCodec.succeed(
          schema,
          { _tag: "Some", value: "a" },
          Redacted.make(Option.some("a"))
        )
      })

      it("Map", async () => {
        const schema = Schema.Map(Schema.Option(Schema.Date), FiniteFromDate)

        await assertions.serialization.stringPojo.typeCodec.succeed(
          schema,
          new Map([[Option.some(new Date("2021-01-01")), 0]]),
          [[
            { _tag: "Some", value: "2021-01-01T00:00:00.000Z" },
            "0"
          ]]
        )
        await assertions.deserialization.stringPojo.typeCodec.succeed(
          schema,
          [[{ _tag: "Some", value: "2021-01-01T00:00:00.000Z" }, "0"]],
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
        const serializer = Serializer.ensureArray(Serializer.stringPojo(schema))
        strictEqual(serializer.ast, Serializer.ensureArray(Serializer.stringPojo(serializer)).ast)
      })

      it("Array", async () => {
        const schema = Schema.Array(Schema.Finite)
        const serializer = Serializer.ensureArray(Serializer.stringPojo(schema))
        strictEqual(serializer.ast, Serializer.ensureArray(Serializer.stringPojo(serializer)).ast)
      })
    })

    it("should handle optional keys", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.NonEmptyArray(Schema.String))
      })
      const serializer = Serializer.ensureArray(Serializer.stringPojo(schema))

      await assertions.decoding.succeed(serializer, {})
      await assertions.decoding.succeed(serializer, { a: ["a"] })
      await assertions.decoding.succeed(serializer, { a: "a" }, { expected: { a: ["a"] } })
    })
  })

  describe("xmlEncoder", () => {
    async function assertXml<T, E, RD>(schema: Schema.Codec<T, E, RD>, value: T, expected: string) {
      const serializer = Serializer.xmlEncoder(Serializer.stringPojo(schema))
      strictEqual(await Effect.runPromise(serializer(value)), expected)
    }

    async function assertXmlFailure<T, E, RD>(schema: Schema.Codec<T, E, RD>, value: T, message: string) {
      const serializer = Serializer.xmlEncoder(Serializer.stringPojo(schema))
      const effect = serializer(value).pipe(Effect.mapError((err) => err.issue))
      await assertions.effect.fail(effect, message)
    }

    describe("Unsupported schemas", () => {
      it("Unknown", async () => {
        await assertXmlFailure(
          Schema.Unknown,
          "test",
          "cannot serialize to StringPojo, required `defaultIsoSerializer` or `defaultJsonSerializer` annotation for UnknownKeyword"
        )
      })

      it("Never", async () => {
        await assertXmlFailure(Schema.Never, "test", `Expected never, got "test"`)
      })

      it("Object", async () => {
        await assertXmlFailure(
          Schema.Object,
          {},
          "cannot serialize to StringPojo, required `defaultIsoSerializer` or `defaultJsonSerializer` annotation for ObjectKeyword"
        )
      })
    })

    it("should use the identifier as the root name", async () => {
      await assertXml(Schema.String.annotate({ identifier: "a" }), "value", "<a>value</a>")
      await assertXml(Schema.String.annotate({ identifier: "a b" }), "value", `<a_b data-name="a b">value</a_b>`)
      await assertXml(Schema.String.annotate({ identifier: "a", title: "b" }), "value", "<a>value</a>")
    })

    it("should use the title as the root name", async () => {
      await assertXml(Schema.String.annotate({ title: "a" }), "value", "<a>value</a>")
      await assertXml(Schema.String.annotate({ title: "a b" }), "value", `<a_b data-name="a b">value</a_b>`)
    })

    it("should escape the text", async () => {
      await assertXml(Schema.String, "value&", `<root>value&amp;</root>`)
      await assertXml(Schema.String, "<value/>", `<root>&lt;value/&gt;</root>`)
    })

    it("should escape the attributes", async () => {
      await assertXml(Schema.String.annotate({ title: "value&" }), "", `<value_ data-name="value&amp;"></value_>`)
      await assertXml(
        Schema.String.annotate({ title: "<value/>" }),
        "",
        `<__value__ data-name="&lt;value/&gt;"></__value__>`
      )
    })

    it("Any", async () => {
      await assertXml(Schema.Any, "test", "<root>test</root>")
      await assertXml(Schema.Any, 42, "<root/>")
      await assertXml(
        Schema.Any,
        { a: 1 },
        `<root>
  <a/>
</root>`
      )
    })

    it("Void", async () => {
      await assertXml(Schema.Void, undefined, "<root/>")
    })

    it("Undefined", async () => {
      await assertXml(Schema.Undefined, undefined, "<root/>")
    })

    it("Null", async () => {
      await assertXml(Schema.Null, null, "<root/>")
    })

    it("Number", async () => {
      await assertXml(Schema.Number, 1, "<root>1</root>")
      await assertXml(Schema.Number, 0, "<root>0</root>")
      await assertXml(Schema.Number, -1.5, "<root>-1.5</root>")
      await assertXml(Schema.Number, Infinity, "<root>Infinity</root>")
      await assertXml(Schema.Number, -Infinity, "<root>-Infinity</root>")
      await assertXml(Schema.Number, NaN, "<root>NaN</root>")
    })

    it("Boolean", async () => {
      await assertXml(Schema.Boolean, true, "<root>true</root>")
      await assertXml(Schema.Boolean, false, "<root>false</root>")
    })

    it("BigInt", async () => {
      await assertXml(Schema.BigInt, BigInt(42), "<root>42</root>")
      await assertXml(Schema.BigInt, BigInt(0), "<root>0</root>")
      await assertXml(Schema.BigInt, BigInt(-123), "<root>-123</root>")
    })

    it("Symbol", async () => {
      const sym = Symbol.for("test")
      await assertXml(Schema.Symbol, sym, "<root>Symbol(test)</root>")
    })

    it("TemplateLiteral", async () => {
      const schema = Schema.TemplateLiteral([Schema.Literal("Hello "), Schema.String, Schema.Literal("!")])
      await assertXml(schema, "Hello World!", "<root>Hello World!</root>")
    })

    it("Struct", async () => {
      await assertXml(
        Schema.Struct({
          a: Schema.Number,
          "a b": Schema.Number
        }),
        { a: 1, "a b": 2 },
        `<root>
  <a>1</a>
  <a_b data-name="a b">2</a_b>
</root>`
      )
    })

    it("Array", async () => {
      await assertXml(Schema.Array(Schema.Number), [], "<root/>")
      await assertXml(
        Schema.Array(Schema.Number),
        [1, 2, 3],
        `<root>
  <item>1</item>
  <item>2</item>
  <item>3</item>
</root>`
      )
    })

    it("Array with custom item name", async () => {
      const serializer = Serializer.xmlEncoder(Serializer.stringPojo(Schema.Array(Schema.Number)), {
        arrayItemName: "number"
      })
      strictEqual(
        await Effect.runPromise(serializer([1, 2, 3])),
        `<root>
  <number>1</number>
  <number>2</number>
  <number>3</number>
</root>`
      )
    })

    it("Union", async () => {
      await assertXml(Schema.Union([Schema.String, Schema.Number]), "test", "<root>test</root>")
      await assertXml(Schema.Union([Schema.String, Schema.Number]), 42, "<root>42</root>")
    })

    it("Tuple", async () => {
      await assertXml(Schema.Tuple([]), [], "<root/>")
      await assertXml(
        Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]),
        ["a", 1, true],
        `<root>
  <item>a</item>
  <item>1</item>
  <item>true</item>
</root>`
      )
    })

    it("Record", async () => {
      await assertXml(Schema.Record(Schema.String, Schema.Number), {}, "<root/>")
      await assertXml(
        Schema.Record(Schema.String, Schema.Number),
        { a: 1, b: 2 },
        `<root>
  <a>1</a>
  <b>2</b>
</root>`
      )
    })

    it("NullOr", async () => {
      await assertXml(Schema.NullOr(Schema.String), "test", "<root>test</root>")
      await assertXml(Schema.NullOr(Schema.String), null, "<root/>")
    })

    it("TaggedUnion", async () => {
      const schema = Schema.TaggedUnion({
        A: { value: Schema.String },
        B: { value: Schema.Number }
      })
      await assertXml(
        schema,
        { _tag: "A", value: "test" },
        `<root>
  <_tag>A</_tag>
  <value>test</value>
</root>`
      )
      await assertXml(
        schema,
        { _tag: "B", value: 42 },
        `<root>
  <_tag>B</_tag>
  <value>42</value>
</root>`
      )
    })

    it("TaggedStruct", async () => {
      const schema = Schema.TaggedStruct("User", {
        name: Schema.String,
        age: Schema.Number
      })
      await assertXml(
        schema,
        { _tag: "User", name: "John", age: 30 },
        `<root>
  <_tag>User</_tag>
  <age>30</age>
  <name>John</name>
</root>`
      )
    })

    it("Enums", async () => {
      const schema = Schema.Enums({
        A: "a",
        B: "b"
      })
      await assertXml(schema, "a", "<root>a</root>")
      await assertXml(schema, "b", "<root>b</root>")
    })

    it("Literals", async () => {
      const schema = Schema.Literals(["a", 1, true, 1n])
      await assertXml(schema, "a", "<root>a</root>")
      await assertXml(schema, 1, "<root>1</root>")
      await assertXml(schema, true, "<root>true</root>")
      await assertXml(schema, 1n, "<root>1</root>")
    })

    it("Nested Structures", async () => {
      const schema = Schema.Struct({
        user: Schema.Struct({
          name: Schema.String,
          age: Schema.Number
        }),
        tags: Schema.Array(Schema.String)
      })
      await assertXml(
        schema,
        { user: { name: "John", age: 30 }, tags: ["admin", "user"] },
        `<root>
  <tags>
    <item>admin</item>
    <item>user</item>
  </tags>
  <user>
    <age>30</age>
    <name>John</name>
  </user>
</root>`
      )
    })

    it("Special Characters in Text", async () => {
      await assertXml(Schema.String, "&<>\"'", `<root>&amp;&lt;&gt;"'</root>`)
      await assertXml(
        Schema.String,
        "line1\nline2",
        `<root>line1
line2</root>`
      )
      await assertXml(Schema.String, "tab\there", "<root>tab	here</root>")
    })

    it("Special Characters in Attributes", async () => {
      await assertXml(
        Schema.String.annotate({ title: "test&value" }),
        "content",
        `<test_value data-name="test&amp;value">content</test_value>`
      )
      await assertXml(
        Schema.String.annotate({ title: "test<value>" }),
        "content",
        `<test_value_ data-name="test&lt;value&gt;">content</test_value_>`
      )
      await assertXml(
        Schema.String.annotate({ title: "test\"value" }),
        "content",
        `<test_value data-name="test&quot;value">content</test_value>`
      )
    })

    it("XML Reserved Names", async () => {
      await assertXml(
        Schema.String.annotate({ title: "xml" }),
        "content",
        `<_xml data-name="xml">content</_xml>`
      )
      await assertXml(
        Schema.String.annotate({ title: "XML" }),
        "content",
        `<_XML data-name="XML">content</_XML>`
      )
      await assertXml(
        Schema.String.annotate({ title: "xmlns" }),
        "content",
        `<_xmlns data-name="xmlns">content</_xmlns>`
      )
    })

    it("Invalid XML Tag Names", async () => {
      await assertXml(
        Schema.String.annotate({ title: "123invalid" }),
        "content",
        `<_123invalid data-name="123invalid">content</_123invalid>`
      )
      await assertXml(
        Schema.String.annotate({ title: "invalid name" }),
        "content",
        `<invalid_name data-name="invalid name">content</invalid_name>`
      )
    })

    it("Empty String", async () => {
      await assertXml(Schema.String, "", "<root></root>")
    })

    it("Whitespace Only String", async () => {
      await assertXml(Schema.String, "   ", "<root>   </root>")
      await assertXml(Schema.String, "\n\t", "<root>\n\t</root>")
    })

    it("Unicode Characters", async () => {
      await assertXml(Schema.String, "Hello 世界", "<root>Hello 世界</root>")
      await assertXml(Schema.String, "🚀🌟✨", "<root>🚀🌟✨</root>")
      await assertXml(Schema.String, "αβγδε", "<root>αβγδε</root>")
    })

    it("XML Encoder Options - rootName", async () => {
      const serializer = Serializer.xmlEncoder(Serializer.stringPojo(Schema.String), {
        rootName: "custom"
      })
      strictEqual(await Effect.runPromise(serializer("test")), "<custom>test</custom>")
    })

    it("XML Encoder Options - pretty: false", async () => {
      const serializer = Serializer.xmlEncoder(
        Serializer.stringPojo(Schema.Struct({
          a: Schema.Number,
          b: Schema.String
        })),
        {
          pretty: false
        }
      )
      strictEqual(await Effect.runPromise(serializer({ a: 1, b: "test" })), "<root><a>1</a><b>test</b></root>")
    })

    it("XML Encoder Options - custom indent", async () => {
      const serializer = Serializer.xmlEncoder(
        Serializer.stringPojo(Schema.Struct({
          a: Schema.Number
        })),
        {
          indent: "    "
        }
      )
      strictEqual(
        await Effect.runPromise(serializer({ a: 1 })),
        `<root>
    <a>1</a>
</root>`
      )
    })

    it("XML Encoder Options - sortKeys: false", async () => {
      const serializer = Serializer.xmlEncoder(
        Serializer.stringPojo(Schema.Struct({
          z: Schema.Number,
          a: Schema.Number,
          m: Schema.Number
        })),
        {
          sortKeys: false
        }
      )
      strictEqual(
        await Effect.runPromise(serializer({ z: 3, a: 1, m: 2 })),
        `<root>
  <z>3</z>
  <a>1</a>
  <m>2</m>
</root>`
      )
    })

    it("Circular Reference Detection", async () => {
      const obj: any = { name: "test" }
      obj.self = obj

      const serializer = Serializer.xmlEncoder(Serializer.stringPojo(Schema.Any))
      try {
        await Effect.runPromise(serializer(obj))
        throw new Error("Expected error")
      } catch (error: any) {
        strictEqual(error.message, "Cycle detected while serializing to XML.")
      }
    })

    it("Nested Arrays", async () => {
      const schema = Schema.Array(Schema.Array(Schema.Number))
      await assertXml(
        schema,
        [[1, 2], [3, 4]],
        `<root>
  <item>
    <item>1</item>
    <item>2</item>
  </item>
  <item>
    <item>3</item>
    <item>4</item>
  </item>
</root>`
      )
    })

    it("Record with Number Keys", async () => {
      const schema = Schema.Record(Schema.Number, Schema.String)
      await assertXml(
        schema,
        { 1: "one", 2: "two" },
        `<root>
  <_1 data-name="1">one</_1>
  <_2 data-name="2">two</_2>
</root>`
      )
    })

    it("Record with Symbol Keys", async () => {
      const sym1 = Symbol.for("key1")
      const sym2 = Symbol.for("key2")
      const schema = Schema.Record(Schema.Symbol, Schema.String)
      await assertXml(
        schema,
        { [sym1]: "value1", [sym2]: "value2" },
        `<root>
  <Symbol_key1_ data-name="Symbol(key1)">value1</Symbol_key1_>
  <Symbol_key2_ data-name="Symbol(key2)">value2</Symbol_key2_>
</root>`
      )
    })

    it("Tuple with Rest", async () => {
      const schema = Schema.TupleWithRest(Schema.Tuple([Schema.String, Schema.Number]), [Schema.Boolean])
      await assertXml(
        schema,
        ["test", 42, true, false],
        `<root>
  <item>test</item>
  <item>42</item>
  <item>true</item>
  <item>false</item>
</root>`
      )
    })

    it("Readonly and Mutable", async () => {
      const readonlySchema = Schema.readonly(Schema.Struct({ a: Schema.Number }))
      const mutableSchema = Schema.mutable(Schema.Struct({ a: Schema.Number }))

      await assertXml(
        readonlySchema,
        { a: 1 },
        `<root>
  <a>1</a>
</root>`
      )
      await assertXml(
        mutableSchema,
        { a: 1 },
        `<root>
  <a>1</a>
</root>`
      )
    })

    it("Branded Types", async () => {
      const UserId = Schema.Number.pipe(Schema.brand("UserId"))
      await assertXml(UserId, 123 as any, "<root>123</root>")
    })

    it("Transformed Types", async () => {
      const StringToNumber = Schema.String.pipe(
        Schema.decodeTo(
          Schema.Number,
          Transformation.transform({
            decode: (s) => Number(s),
            encode: (n) => String(n)
          })
        )
      )
      await assertXml(StringToNumber, 42, "<root>42</root>")
    })

    it("Suspend (Recursive Types)", async () => {
      interface Tree {
        readonly value: number
        readonly children: ReadonlyArray<Tree>
      }

      const Tree: Schema.Codec<Tree> = Schema.Struct({
        value: Schema.Number,
        children: Schema.Array(Schema.suspend(() => Tree))
      })

      const tree: Tree = {
        value: 1,
        children: [
          { value: 2, children: [] },
          { value: 3, children: [] }
        ]
      }

      await assertXml(
        Tree,
        tree,
        `<root>
  <children>
    <item>
      <children/>
      <value>2</value>
    </item>
    <item>
      <children/>
      <value>3</value>
    </item>
  </children>
  <value>1</value>
</root>`
      )
    })

    it("Property Signatures with Different Optionality", async () => {
      const schema = Schema.Struct({
        required: Schema.String,
        optional: Schema.optional(Schema.String),
        nullable: Schema.NullOr(Schema.String),
        optionalNullable: Schema.optional(Schema.NullOr(Schema.String))
      })

      await assertXml(
        schema,
        { required: "test", optional: "opt", nullable: null, optionalNullable: undefined },
        `<root>
  <nullable/>
  <optional>opt</optional>
  <optionalNullable/>
  <required>test</required>
</root>`
      )
    })
  })
})
