import { Cause, DateTime, Duration, Effect } from "effect"
import { Option, Redacted, Result } from "effect/data"
import { Issue, Schema, ToParser, Transformation } from "effect/schema"
import { TestSchema } from "effect/testing"
import { deepStrictEqual } from "node:assert"
import { describe, it } from "vitest"
import { assertTrue, strictEqual } from "../utils/assert.ts"

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
    describe("typeCodec", () => {
      describe("Unsupported schemas", () => {
        it("Declaration without defaultIsoSerializer annotation", async () => {
          class A {
            readonly _tag = "A"
          }
          const schema = Schema.declare((u): u is A => u instanceof A)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            new A(),
            "required `defaultJsonSerializer` or `serializer` annotation for Declaration"
          )
        })

        it("Unknown", async () => {
          const schema = Schema.Unknown
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            "a",
            "required `defaultJsonSerializer` or `serializer` annotation for UnknownKeyword"
          )
        })

        it("Object", async () => {
          const schema = Schema.Object
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            {},
            "required `defaultJsonSerializer` or `serializer` annotation for ObjectKeyword"
          )
        })

        it("Struct with Symbol property name", async () => {
          const a = Symbol.for("a")
          const schema = Schema.Struct({
            [a]: Schema.String
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            { [a]: "b" },
            "TypeLiteral property names must be strings"
          )
        })
      })

      describe("should return the same reference if nothing changed", () => {
        it("Struct", async () => {
          const schema = Schema.Struct({
            a: Schema.String,
            b: Schema.Boolean
          })
          const serializer = Schema.makeSerializerJson(schema)
          strictEqual(serializer.ast, schema.ast)
        })

        it("Record", async () => {
          const schema = Schema.Record(Schema.String, Schema.Boolean)
          const serializer = Schema.makeSerializerJson(schema)
          strictEqual(serializer.ast, schema.ast)
        })

        it("Tuple", async () => {
          const schema = Schema.Tuple([Schema.String, Schema.Boolean])
          const serializer = Schema.makeSerializerJson(schema)
          strictEqual(serializer.ast, schema.ast)
        })

        it("Array", async () => {
          const schema = Schema.Array(Schema.String)
          const serializer = Schema.makeSerializerJson(schema)
          strictEqual(serializer.ast, schema.ast)
        })

        it("Union", async () => {
          const schema = Schema.Union([Schema.String, Schema.Boolean])
          const serializer = Schema.makeSerializerJson(schema)
          strictEqual(serializer.ast, schema.ast)
        })
      })

      it("should apply the construction process to the provided link in the serializer annotation", async () => {
        const schema = Schema.Struct({
          a: Schema.Date.annotate({
            serializer: () =>
              Schema.link<Date>()(
                Schema.Date,
                Transformation.passthrough()
              )
          }),
          b: Schema.Number
        })
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed({ a: new Date("2021-01-01"), b: 1 }, {
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
              serializer: () =>
                Schema.link<MyError>()(
                  Schema.String,
                  Transformation.transform({
                    decode: (message) => new MyError(message),
                    encode: (e) => e.message
                  })
                )
            }
          )
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(new MyError("a"), "a")

          const decoding = asserts.decoding()
          await decoding.succeed("a", new MyError("a"))
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
                serializer: () =>
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
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(new MyError({ message: "a", cause: "b" }), {
            message: "a",
            cause: "b"
          })

          const decoding = asserts.decoding()
          await decoding.succeed({ message: "a", cause: "b" }, new MyError({ message: "a", cause: "b" }))
        })
      })

      it("Any", async () => {
        const schema = Schema.Any
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(() => {})

        const decoding = asserts.decoding()
        await decoding.succeed(() => {})
      })

      it("Undefined", async () => {
        const schema = Schema.Undefined
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(undefined, null)
      })

      it("Void", async () => {
        const schema = Schema.Void
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(undefined, null)
      })

      it("Null", async () => {
        const schema = Schema.Null
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(null)
      })

      it("String", async () => {
        const schema = Schema.String
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed("a")

        const decoding = asserts.decoding()
        await decoding.succeed("a", "a")
      })

      it("Number", async () => {
        const schema = Schema.Number
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(1)
        await encoding.succeed(Infinity, "Infinity")
        await encoding.succeed(-Infinity, "-Infinity")
        await encoding.succeed(NaN, "NaN")

        const decoding = asserts.decoding()
        await decoding.succeed(1)
        await decoding.succeed("Infinity", Infinity)
        await decoding.succeed("-Infinity", -Infinity)
        await decoding.succeed("NaN", NaN)
      })

      it("Boolean", async () => {
        const schema = Schema.Boolean
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(true)

        const decoding = asserts.decoding()
        await decoding.succeed(true, true)
      })

      it("Symbol", async () => {
        const schema = Schema.Symbol
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(Symbol.for("a"), "Symbol(a)")
        await encoding.fail(
          Symbol("a"),
          "cannot serialize to string, Symbol is not registered"
        )
        await encoding.fail(
          Symbol(),
          "cannot serialize to string, Symbol has no description"
        )

        const decoding = asserts.decoding()
        await decoding.succeed("Symbol(a)", Symbol.for("a"))
      })

      it("UniqueSymbol", async () => {
        const schema = Schema.UniqueSymbol(Symbol.for("a"))
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(Symbol.for("a"), "Symbol(a)")

        const decoding = asserts.decoding()
        await decoding.succeed("Symbol(a)", Symbol.for("a"))
      })

      it("BigInt", async () => {
        const schema = Schema.BigInt
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(1n, "1")

        const decoding = asserts.decoding()
        await decoding.succeed("1", 1n)
      })

      it("PropertyKey", async () => {
        const schema = Schema.PropertyKey
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed("a")
        await encoding.succeed(1)
        await encoding.succeed(Symbol.for("a"), "Symbol(a)")

        const decoding = asserts.decoding()
        await decoding.succeed("a")
        await decoding.succeed(1)
        await decoding.succeed("Symbol(a)", Symbol.for("a"))
      })

      describe("Literal", () => {
        it("string", async () => {
          const schema = Schema.Literal("a")
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed("a")

          const decoding = asserts.decoding()
          await decoding.succeed("a")
        })

        it("number", async () => {
          const schema = Schema.Literal(1)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(1)

          const decoding = asserts.decoding()
          await decoding.succeed(1)
        })

        it("boolean", async () => {
          const schema = Schema.Literal(true)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(true)

          const decoding = asserts.decoding()
          await decoding.succeed(true)
        })

        it("bigint", async () => {
          const schema = Schema.Literal(1n)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(1n, "1")

          const decoding = asserts.decoding()
          await decoding.succeed("1", 1n)
        })
      })

      it("Literals", async () => {
        const schema = Schema.Literals(["a", 1, 2n, true])
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const decoding = asserts.decoding()
        await decoding.fail(
          "-",
          `Expected "a" | 1 | 2 | true, got "-"`
        )
      })

      describe("TemplateLiteral", () => {
        it("1n + string", async () => {
          const schema = Schema.TemplateLiteral([1n, Schema.String])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed("1a")

          const decoding = asserts.decoding()
          await decoding.succeed("1a")
        })

        it(`"a" + bigint`, async () => {
          const schema = Schema.TemplateLiteral(["a", Schema.BigInt])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed("a1")

          const decoding = asserts.decoding()
          await decoding.succeed("a1")
        })
      })

      it("Enums", async () => {
        enum Fruits {
          Apple,
          Banana
        }
        const schema = Schema.Enums(Fruits)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(Fruits.Apple, 0)
        await encoding.succeed(Fruits.Banana, 1)

        const decoding = asserts.decoding()
        await decoding.succeed(0, Fruits.Apple)
        await decoding.succeed(1, Fruits.Banana)
      })

      describe("Struct", () => {
        it("Date", async () => {
          const schema = Schema.Struct({
            a: Schema.Date
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(
            { a: new Date("2021-01-01") },
            { a: "2021-01-01T00:00:00.000Z" }
          )
        })

        it("UndefinedOr(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.UndefinedOr(Schema.Date)
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed({ a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await encoding.succeed({ a: undefined }, { a: null })

          const decoding = asserts.decoding()
          await decoding.succeed({ a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await decoding.succeed({ a: null }, { a: undefined })
        })

        it("NullOr(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.NullOr(Schema.Date)
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed({ a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await encoding.succeed({ a: null }, { a: null })

          const decoding = asserts.decoding()
          await decoding.succeed({ a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await decoding.succeed({ a: null }, { a: null })
        })

        it("optionalKey(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.optionalKey(Schema.Date)
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed({ a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await encoding.succeed({}, {})

          const decoding = asserts.decoding()
          await decoding.succeed({ a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await decoding.succeed({}, {})
        })

        it("optional(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.optional(Schema.Date)
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed({ a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await encoding.succeed({}, {})
          await encoding.succeed({ a: undefined }, { a: null })

          const decoding = asserts.decoding()
          await decoding.succeed({ a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await decoding.succeed({}, {})
          await decoding.succeed({ a: null }, { a: undefined })
        })
      })

      it("Record(Symbol, Date)", async () => {
        const schema = Schema.Record(Schema.Symbol, Schema.Date)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") },
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" }
        )

        const decoding = asserts.decoding()
        await decoding.succeed(
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" },
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") }
        )
      })

      describe("Tuple", () => {
        it("Date", async () => {
          const schema = Schema.Tuple([Schema.Date])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(
            [new Date("2021-01-01")],
            ["2021-01-01T00:00:00.000Z"]
          )

          const decoding = asserts.decoding()
          await decoding.succeed(
            ["2021-01-01T00:00:00.000Z"],
            [new Date("2021-01-01")]
          )
        })

        it("UndefinedOr(Date)", async () => {
          const schema = Schema.Tuple([Schema.UndefinedOr(Schema.Date)])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(
            [new Date("2021-01-01")],
            ["2021-01-01T00:00:00.000Z"]
          )
          await encoding.succeed([undefined], [null])

          const decoding = asserts.decoding()
          await decoding.succeed(["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await decoding.succeed([null], [undefined])
        })

        it("NullOr(Date)", async () => {
          const schema = Schema.Tuple([Schema.NullOr(Schema.Date)])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed([new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await encoding.succeed([null], [null])

          const decoding = asserts.decoding()
          await decoding.succeed(["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await decoding.succeed([null], [null])
        })

        it("optionalKey(Date)", async () => {
          const schema = Schema.Tuple([Schema.optionalKey(Schema.Date)])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed([new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await encoding.succeed([], [])

          const decoding = asserts.decoding()
          await decoding.succeed(["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await decoding.succeed([], [])
        })

        it("optional(Date)", async () => {
          const schema = Schema.Tuple([Schema.optional(Schema.Date)])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed([new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await encoding.succeed([], [])
          await encoding.succeed([undefined], [null])

          const decoding = asserts.decoding()
          await decoding.succeed(["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await decoding.succeed([], [])
          await decoding.succeed([null], [undefined])
        })
      })

      it("Array(Date)", async () => {
        const schema = Schema.Array(Schema.Date)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          [new Date("2021-01-01"), new Date("2021-01-02")],
          ["2021-01-01T00:00:00.000Z", "2021-01-02T00:00:00.000Z"]
        )
      })

      describe("Union", () => {
        it("NullOr(String)", async () => {
          const schema = Schema.NullOr(Schema.String)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed("a")
          await encoding.succeed(null)

          const decoding = asserts.decoding()
          await decoding.succeed(null)
          await decoding.succeed("a")
        })

        it("NullOr(Number)", async () => {
          const schema = Schema.NullOr(Schema.Number)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(1)
          await encoding.succeed(null)

          const decoding = asserts.decoding()
          await decoding.succeed(null)
          await decoding.succeed(1)
        })

        it("Array(NullOr(Number))", async () => {
          const schema = Schema.Array(Schema.NullOr(Schema.Number))
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed([1, null])

          const decoding = asserts.decoding()
          await decoding.succeed([1, null])
        })

        it("Union(Schema.Date, FiniteFromDate)", async () => {
          const schema = Schema.Union([Schema.Date, FiniteFromDate])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(
            new Date("2021-01-01"),
            "2021-01-01T00:00:00.000Z"
          )
          await encoding.succeed(0)
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
          a: Schema.FiniteFromString.check(Schema.isGreaterThan(0)),
          categories: Schema.Array(Schema.suspend((): Schema.Codec<CategoryType, CategoryEncoded> => schema))
        })
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed({ a: 1, categories: [] }, {
          a: 1,
          categories: []
        })
        await encoding.succeed({
          a: 1,
          categories: [{ a: 2, categories: [] }]
        }, {
          a: 1,
          categories: [
            { a: 2, categories: [] }
          ]
        })

        const decoding = asserts.decoding()
        await decoding.succeed({
          a: 1,
          categories: []
        }, { a: 1, categories: [] })
        await decoding.succeed({
          a: 1,
          categories: [
            { a: 2, categories: [] }
          ]
        }, { a: 1, categories: [{ a: 2, categories: [] }] })
      })

      it("FiniteFromDate", async () => {
        const schema = FiniteFromDate
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(0)
      })

      it("Class", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({
          a: FiniteFromDate
        })) {}
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(A)))

        const encoding = asserts.encoding()
        await encoding.succeed(new A({ a: 0 }), { a: 0 })

        const decoding = asserts.decoding()
        await decoding.succeed({ a: 0 }, new A({ a: 0 }))
      })

      it("ErrorClass", async () => {
        class E extends Schema.ErrorClass<E>("E")({
          a: FiniteFromDate
        }) {}
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(E)))

        const encoding = asserts.encoding()
        await encoding.succeed(new E({ a: 0 }), { a: 0 })

        const decoding = asserts.decoding()
        await decoding.succeed({ a: 0 }, new E({ a: 0 }))
      })

      it("Date", async () => {
        const schema = Schema.Date
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          new Date("2021-01-01"),
          "2021-01-01T00:00:00.000Z"
        )
      })

      it("Error", async () => {
        const schema = Schema.Error
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          new Error("a"),
          { name: "Error", message: "a" }
        )

        const decoding = asserts.decoding()
        // Error: message only
        await decoding.succeed(
          { message: "a" },
          new Error("a")
        )
        // Error: message and name
        await decoding.succeed(
          { name: "b", message: "a" },
          (() => {
            const err = new Error("a")
            err.name = "b"
            return err
          })()
        )
        // Error: message, name, and stack
        await decoding.succeed(
          { name: "b", message: "a", stack: "c" },
          (() => {
            const err = new Error("a")
            err.name = "b"
            err.stack = "c"
            return err
          })()
        )
      })

      it("URL", async () => {
        const schema = Schema.URL
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          new URL("https://example.com"),
          "https://example.com/"
        )

        const decoding = asserts.decoding()
        await decoding.succeed(
          "https://example.com",
          new URL("https://example.com")
        )
        await decoding.succeed(
          "https://example.com/",
          new URL("https://example.com")
        )
        await decoding.fail(
          "not a url",
          isDeno ? `TypeError: Invalid URL: 'not a url'` : `TypeError: Invalid URL`
        )
      })

      it("Uint8Array", async () => {
        const schema = Schema.Uint8Array
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(new Uint8Array([1, 2, 3]), "AQID")

        const decoding = asserts.decoding()
        await decoding.succeed("AQID", new Uint8Array([1, 2, 3]))
        await decoding.fail(
          "not a base64 string",
          "Length must be a multiple of 4, but is 19"
        )
      })

      it("Duration", async () => {
        const schema = Schema.Duration
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(Duration.infinity, "Infinity")
        await encoding.succeed(Duration.nanos(1000n), "1000")
        await encoding.succeed(Duration.millis(1), 1)
        await encoding.succeed(Duration.zero, 0)

        const decoding = asserts.decoding()
        await decoding.succeed("Infinity", Duration.infinity)
        await decoding.succeed(1, Duration.millis(1))
        await decoding.succeed("1000", Duration.nanos(1000n))
      })

      it("DateTimeUtc", async () => {
        const schema = Schema.DateTimeUtc
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"),
          "2021-01-01T00:00:00.000Z"
        )

        const decoding = asserts.decoding()
        await decoding.succeed(
          "2021-01-01T00:00:00.000Z",
          DateTime.makeUnsafe("2021-01-01T00:00:00.000Z")
        )
      })

      it("Option(Date)", async () => {
        const schema = Schema.Option(Schema.Date)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(Option.some(new Date("2021-01-01")), {
          _tag: "Some",
          value: "2021-01-01T00:00:00.000Z"
        })
        await encoding.succeed(Option.none(), { _tag: "None" })
      })

      describe("Redacted", () => {
        it("Redacted(Option(String))", async () => {
          const schema = Schema.Redacted(Schema.Option(Schema.String))
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            Redacted.make(Option.none()),
            `Cannot serialize Redacted`
          )
          await encoding.fail(
            Redacted.make(Option.some("a")),
            `Cannot serialize Redacted`
          )

          const decoding = asserts.decoding()
          await decoding.succeed(
            { _tag: "None" },
            Redacted.make(Option.none())
          )
          await decoding.succeed(
            { _tag: "Some", value: "a" },
            Redacted.make(Option.some("a"))
          )
        })

        it("encoding a Redacted with a label", async () => {
          const schema = Schema.Redacted(Schema.String, { label: "password" })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            Redacted.make("a", { label: "API key" }),
            `Expected "password", got "API key"
  at ["label"]`
          )
        })

        it("encoding a Redacted with a different label", async () => {
          const schema = Schema.Redacted(Schema.String)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            Redacted.make("a", { label: "API key" }),
            `Cannot serialize Redacted with label: "API key"`
          )
        })
      })

      it("ReadonlySet", async () => {
        const schema = Schema.ReadonlySet(Schema.Option(Schema.Date))
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(new Set([Option.some(new Date("2021-01-01"))]), [{
          _tag: "Some",
          value: "2021-01-01T00:00:00.000Z"
        }])

        const decoding = asserts.decoding()
        await decoding.succeed(
          [{ _tag: "Some", value: "2021-01-01T00:00:00.000Z" }],
          new Set([Option.some(new Date("2021-01-01"))])
        )
      })

      it("ReadonlyMap", async () => {
        const schema = Schema.ReadonlyMap(Schema.Option(Schema.Date), FiniteFromDate)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          new Map([[Option.some(new Date("2021-01-01")), 0]]),
          [[
            { _tag: "Some", value: "2021-01-01T00:00:00.000Z" },
            0
          ]]
        )

        const decoding = asserts.decoding()
        await decoding.succeed(
          [[{ _tag: "Some", value: "2021-01-01T00:00:00.000Z" }, 0]],
          new Map([[Option.some(new Date("2021-01-01")), 0]])
        )
      })
    })

    describe("plain", () => {
      it("FiniteFromDate", async () => {
        const schema = FiniteFromDate
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(schema))

        const encoding = asserts.encoding()
        await encoding.succeed(0, "1970-01-01T00:00:00.000Z")
      })

      it("Struct", async () => {
        const schema = Schema.Struct({
          a: FiniteFromDate,
          b: FiniteFromDate
        })
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(schema))

        const encoding = asserts.encoding()
        await encoding.succeed(
          { a: 0, b: 0 },
          { a: "1970-01-01T00:00:00.000Z", b: "1970-01-01T00:00:00.000Z" }
        )
      })

      it("Tuple(Schema.Date, Schema.Date)", async () => {
        const schema = Schema.Tuple([FiniteFromDate, FiniteFromDate])
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(schema))

        const encoding = asserts.encoding()
        await encoding.succeed(
          [0, 0],
          ["1970-01-01T00:00:00.000Z", "1970-01-01T00:00:00.000Z"]
        )
      })

      it("Class", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({
          a: FiniteFromDate
        })) {}
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(A))

        const encoding = asserts.encoding()
        await encoding.succeed(new A({ a: 0 }), { a: "1970-01-01T00:00:00.000Z" })

        const decoding = asserts.decoding()
        await decoding.succeed({ a: "1970-01-01T00:00:00.000Z" }, new A({ a: 0 }))
      })

      it("Error", async () => {
        class E extends Schema.ErrorClass<E>("E")({
          a: FiniteFromDate
        }) {}
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(E))

        const encoding = asserts.encoding()
        await encoding.succeed(new E({ a: 0 }), { a: "1970-01-01T00:00:00.000Z" })

        const decoding = asserts.decoding()
        await decoding.succeed({ a: "1970-01-01T00:00:00.000Z" }, new E({ a: 0 }))
      })

      it("Enums", async () => {
        enum Fruits {
          Apple,
          Banana = "banana"
        }
        const schema = Schema.Enums(Fruits)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(schema))

        const encoding = asserts.encoding()
        await encoding.succeed(Fruits.Apple, 0)
        await encoding.succeed(Fruits.Banana, "banana")

        const decoding = asserts.decoding()
        await decoding.succeed(0, Fruits.Apple)
      })

      it("Option(Option(FiniteFromDate))", async () => {
        const schema = Schema.Option(Schema.Option(FiniteFromDate))
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(schema))

        const encoding = asserts.encoding()
        await encoding.succeed(Option.some(Option.some(0)), {
          _tag: "Some",
          value: {
            _tag: "Some",
            value: "1970-01-01T00:00:00.000Z"
          }
        })
      })

      it("ReadonlyMap(Option(Symbol), Date)", async () => {
        const schema = Schema.ReadonlyMap(Schema.Option(Schema.Symbol), Schema.Date)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(schema))

        const encoding = asserts.encoding()
        await encoding.succeed(
          new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]]),
          [[
            { _tag: "Some", value: "Symbol(a)" },
            "2021-01-01T00:00:00.000Z"
          ]]
        )

        const decoding = asserts.decoding()
        await decoding.succeed(
          [[{ _tag: "Some", value: "Symbol(a)" }, "2021-01-01T00:00:00.000Z"]],
          new Map([[Option.some(Symbol.for("a")), new Date("2021-01-01")]])
        )
      })

      it("Defect", async () => {
        const schema = Schema.Defect
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(schema))

        const encoding = asserts.encoding()
        await encoding.succeed(new Error("a"), { name: "Error", message: "a" })
        await encoding.succeed("a")
        await encoding.succeed({ a: 1 })
      })

      it("Cause(Option(Finite), Option(String))", async () => {
        const schema = Schema.Cause(Schema.Option(Schema.Finite), Schema.Option(Schema.String))
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(schema))

        const encoding = asserts.encoding()
        await encoding.succeed(Cause.fail(Option.some(1)), [{
          _tag: "Fail",
          error: { _tag: "Some", value: 1 }
        }])
        await encoding.succeed(Cause.die(Option.some("a")), [{
          _tag: "Die",
          defect: { _tag: "Some", value: "a" }
        }])
        await encoding.succeed(Cause.interrupt(1), [{
          _tag: "Interrupt",
          fiberId: 1
        }])
        await encoding.succeed(Cause.interrupt(), [{
          _tag: "Interrupt",
          fiberId: null
        }])
      })

      it("DateTimeUtcFromValidDate", async () => {
        const schema = Schema.DateTimeUtcFromDate
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(schema))

        const encoding = asserts.encoding()
        await encoding.succeed(
          DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"),
          "2021-01-01T00:00:00.000Z"
        )

        const decoding = asserts.decoding()
        await decoding.succeed(
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

      const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.StandardSchemaV1FailureResult))

      const encoding = asserts.encoding()
      await encoding.succeed(failureResult, {
        issues: [
          { path: ["a"], message: `Expected a value with a length of at least 1, got ""` },
          { path: ["c", 0], message: "Missing key" },
          { path: ["Symbol(b)"], message: "Missing key" }
        ]
      })

      const decoding = asserts.decoding()
      await decoding.succeed({
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
        const serializer = Schema.makeSerializerStringPojo(schema)
        strictEqual(serializer.ast, schema.ast)
      })

      it("Struct({ a: String })", async () => {
        const schema = Schema.Struct({
          a: Schema.String
        })
        const serializer = Schema.makeSerializerStringPojo(schema)
        strictEqual(serializer.ast, schema.ast)
      })
    })

    describe("should memoize the result", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.Finite
        })
        const serializer = Schema.makeSerializerStringPojo(schema)
        strictEqual(serializer.ast, Schema.makeSerializerStringPojo(serializer).ast)
      })

      it("Array", async () => {
        const schema = Schema.Array(Schema.Finite)
        const serializer = Schema.makeSerializerStringPojo(schema)
        strictEqual(serializer.ast, Schema.makeSerializerStringPojo(serializer).ast)
      })
    })

    describe("typeCodec", () => {
      describe("Unsupported schemas", () => {
        it("Declaration without annotation", async () => {
          class A {
            readonly _tag = "A"
          }
          const schema = Schema.declare((u): u is A => u instanceof A)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            new A(),
            "required `defaultJsonSerializer` or `serializer` annotation for Declaration"
          )
        })

        it("Unknown", async () => {
          const schema = Schema.Unknown
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            "a",
            "required `defaultJsonSerializer` or `serializer` annotation for UnknownKeyword"
          )
        })

        it("Object", async () => {
          const schema = Schema.Object
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            {},
            "required `defaultJsonSerializer` or `serializer` annotation for ObjectKeyword"
          )
        })

        it("Struct with Symbol property name", async () => {
          const a = Symbol.for("a")
          const schema = Schema.Struct({
            [a]: Schema.String
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.fail(
            { [a]: "b" },
            "TypeLiteral property names must be strings"
          )
        })
      })

      it("Any", async () => {
        const schema = Schema.Any
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(() => {})

        const decoding = asserts.decoding()
        await decoding.succeed(() => {})
      })

      it("Undefined", async () => {
        const schema = Schema.Undefined
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(undefined)

        const decoding = asserts.decoding()
        await decoding.succeed(undefined)
      })

      it("Void", async () => {
        const schema = Schema.Void
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(undefined)

        const decoding = asserts.decoding()
        await decoding.succeed(undefined)
      })

      it("Null", async () => {
        const schema = Schema.Null
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(null, undefined)

        const decoding = asserts.decoding()
        await decoding.succeed(undefined, null)
      })

      it("String", async () => {
        const schema = Schema.String
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed("a")

        const decoding = asserts.decoding()
        await decoding.succeed("a")
      })

      it("Number", async () => {
        const schema = Schema.Number
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(1, "1")
        await encoding.succeed(Infinity, "Infinity")
        await encoding.succeed(-Infinity, "-Infinity")
        await encoding.succeed(NaN, "NaN")

        const decoding = asserts.decoding()
        await decoding.succeed("1", 1)
        await decoding.succeed("Infinity", Infinity)
        await decoding.succeed("-Infinity", -Infinity)
        await decoding.succeed("NaN", NaN)
      })

      it("Boolean", async () => {
        const schema = Schema.Boolean
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(true, "true")
        await encoding.succeed(false, "false")

        const decoding = asserts.decoding()
        await decoding.succeed("true", true)
        await decoding.succeed("false", false)
      })

      it("Symbol", async () => {
        const schema = Schema.Symbol
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(Symbol.for("a"), "Symbol(a)")
        await encoding.fail(
          Symbol("a"),
          "cannot serialize to string, Symbol is not registered"
        )
        await encoding.fail(
          Symbol(),
          "cannot serialize to string, Symbol has no description"
        )

        const decoding = asserts.decoding()
        await decoding.succeed("Symbol(a)", Symbol.for("a"))
      })

      it("UniqueSymbol", async () => {
        const schema = Schema.UniqueSymbol(Symbol.for("a"))
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(Symbol.for("a"), "Symbol(a)")

        const decoding = asserts.decoding()
        await decoding.succeed("Symbol(a)", Symbol.for("a"))
      })

      it("BigInt", async () => {
        const schema = Schema.BigInt
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(1n, "1")

        const decoding = asserts.decoding()
        await decoding.succeed("1", 1n)
      })

      it("PropertyKey", async () => {
        const schema = Schema.PropertyKey
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed("a", "a")
        await encoding.succeed(1, "1")
        await encoding.succeed(Symbol.for("a"), "Symbol(a)")

        const decoding = asserts.decoding()
        await decoding.succeed("a", "a")
        await decoding.succeed("1", 1)
        await decoding.succeed("Symbol(a)", Symbol.for("a"))
      })

      describe("Literal", () => {
        it("string", async () => {
          const schema = Schema.Literal("a")
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed("a", "a")

          const decoding = asserts.decoding()
          await decoding.succeed("a", "a")
        })

        it("number", async () => {
          const schema = Schema.Literal(1)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(1, "1")

          const decoding = asserts.decoding()
          await decoding.succeed("1", 1)
        })

        it("boolean", async () => {
          const schema = Schema.Literal(true)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(true, "true")

          const decoding = asserts.decoding()
          await decoding.succeed("true", true)
        })

        it("bigint", async () => {
          const schema = Schema.Literal(1n)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(1n, "1")

          const decoding = asserts.decoding()
          await decoding.succeed("1", 1n)
        })
      })

      it("Literals", async () => {
        const schema = Schema.Literals(["a", 1, 2n, true])
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const decoding = asserts.decoding()
        await decoding.fail(
          "-",
          `Expected "a" | 1 | 2 | true, got "-"`
        )
      })

      describe("TemplateLiteral", () => {
        it("1n + string", async () => {
          const schema = Schema.TemplateLiteral([1n, Schema.String])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed("1a")

          const decoding = asserts.decoding()
          await decoding.succeed("1a")
        })

        it(`"a" + bigint`, async () => {
          const schema = Schema.TemplateLiteral(["a", Schema.BigInt])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed("a1")

          const decoding = asserts.decoding()
          await decoding.succeed("a1")
        })
      })

      it("Enums", async () => {
        enum Fruits {
          Apple,
          Banana
        }
        const schema = Schema.Enums(Fruits)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(Fruits.Apple, "0")
        await encoding.succeed(Fruits.Banana, "1")

        const decoding = asserts.decoding()
        await decoding.succeed("0", Fruits.Apple)
        await decoding.succeed("1", Fruits.Banana)
      })

      describe("Struct", () => {
        it("Date", async () => {
          const schema = Schema.Struct({
            a: Schema.Date
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed({ a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })

          const decoding = asserts.decoding()
          await decoding.succeed({ a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
        })

        it("UndefinedOr(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.UndefinedOr(Schema.Date)
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed({ a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await encoding.succeed({ a: undefined }, { a: undefined })

          const decoding = asserts.decoding()
          await decoding.succeed({ a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await decoding.succeed({ a: undefined }, { a: undefined })
        })

        it("NullOr(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.NullOr(Schema.Date)
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed({ a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await encoding.succeed({ a: null }, { a: undefined })

          const decoding = asserts.decoding()
          await decoding.succeed({ a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await decoding.succeed({ a: undefined }, { a: null })
        })

        it("optionalKey(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.optionalKey(Schema.Date)
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed({ a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await encoding.succeed({}, {})

          const decoding = asserts.decoding()
          await decoding.succeed({ a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await decoding.succeed({}, {})
        })

        it("optional(Date)", async () => {
          const schema = Schema.Struct({
            a: Schema.optional(Schema.Date)
          })
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed({ a: new Date("2021-01-01") }, {
            a: "2021-01-01T00:00:00.000Z"
          })
          await encoding.succeed({}, {})
          await encoding.succeed({ a: undefined }, { a: undefined })

          const decoding = asserts.decoding()
          await decoding.succeed({ a: "2021-01-01T00:00:00.000Z" }, {
            a: new Date("2021-01-01")
          })
          await decoding.succeed({}, {})
          await decoding.succeed({ a: undefined }, { a: undefined })
        })
      })

      it("Record(Symbol, Date)", async () => {
        const schema = Schema.Record(Schema.Symbol, Schema.Date)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") },
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" }
        )

        const decoding = asserts.decoding()
        await decoding.succeed(
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" },
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") }
        )
      })

      describe("Tuple", () => {
        it("Date", async () => {
          const schema = Schema.Tuple([Schema.Date])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(
            [new Date("2021-01-01")],
            ["2021-01-01T00:00:00.000Z"]
          )

          const decoding = asserts.decoding()
          await decoding.succeed(
            ["2021-01-01T00:00:00.000Z"],
            [new Date("2021-01-01")]
          )
        })

        it("UndefinedOr(Date)", async () => {
          const schema = Schema.Tuple([Schema.UndefinedOr(Schema.Date)])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(
            [new Date("2021-01-01")],
            ["2021-01-01T00:00:00.000Z"]
          )
          await encoding.succeed([undefined])

          const decoding = asserts.decoding()
          await decoding.succeed(["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await decoding.succeed([undefined])
        })

        it("NullOr(Date)", async () => {
          const schema = Schema.Tuple([Schema.NullOr(Schema.Date)])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed([new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await encoding.succeed([null], [undefined])

          const decoding = asserts.decoding()
          await decoding.succeed(["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await decoding.succeed([undefined], [null])
        })

        it("optionalKey(Date)", async () => {
          const schema = Schema.Tuple([Schema.optionalKey(Schema.Date)])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed([new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await encoding.succeed([], [])

          const decoding = asserts.decoding()
          await decoding.succeed(["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await decoding.succeed([], [])
        })

        it("optional(Date)", async () => {
          const schema = Schema.Tuple([Schema.optional(Schema.Date)])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed([new Date("2021-01-01")], [
            "2021-01-01T00:00:00.000Z"
          ])
          await encoding.succeed([], [])
          await encoding.succeed([undefined])

          const decoding = asserts.decoding()
          await decoding.succeed(["2021-01-01T00:00:00.000Z"], [
            new Date("2021-01-01")
          ])
          await decoding.succeed([], [])
          await decoding.succeed([undefined])
        })
      })

      it("Array(Date)", async () => {
        const schema = Schema.Array(Schema.Date)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          [new Date("2021-01-01"), new Date("2021-01-02")],
          ["2021-01-01T00:00:00.000Z", "2021-01-02T00:00:00.000Z"]
        )
      })

      describe("Union", () => {
        it("NullOr(Date)", async () => {
          const schema = Schema.NullOr(Schema.String)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed("a", "a")
          await encoding.succeed(null, undefined)

          const decoding = asserts.decoding()
          await decoding.succeed(undefined, null)
          await decoding.succeed("a", "a")
        })

        it("NullOr(Number)", async () => {
          const schema = Schema.NullOr(Schema.Number)
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(1, "1")
          await encoding.succeed(null, undefined)

          const decoding = asserts.decoding()
          await decoding.succeed(undefined, null)
          await decoding.succeed("1", 1)
        })

        it("Array(NullOr(Number))", async () => {
          const schema = Schema.Array(Schema.NullOr(Schema.Number))
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed([1, null], ["1", undefined])

          const decoding = asserts.decoding()
          await decoding.succeed(["1", undefined], [1, null])
        })

        it("Union(Schema.Date, FiniteFromDate)", async () => {
          const schema = Schema.Union([Schema.Date, FiniteFromDate])
          const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

          const encoding = asserts.encoding()
          await encoding.succeed(
            new Date("2021-01-01"),
            "2021-01-01T00:00:00.000Z"
          )
          await encoding.succeed(0, "0")
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
          a: Schema.FiniteFromString.check(Schema.isGreaterThan(0)),
          categories: Schema.Array(Schema.suspend((): Schema.Codec<CategoryType, CategoryEncoded> => schema))
        })
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed({ a: 1, categories: [] }, {
          a: "1",
          categories: []
        })
        await encoding.succeed({
          a: 1,
          categories: [{ a: 2, categories: [] }]
        }, {
          a: "1",
          categories: [
            { a: "2", categories: [] }
          ]
        })

        const decoding = asserts.decoding()
        await decoding.succeed({
          a: "1",
          categories: []
        }, { a: 1, categories: [] })
        await decoding.succeed({
          a: "1",
          categories: [
            { a: "2", categories: [] }
          ]
        }, { a: 1, categories: [{ a: 2, categories: [] }] })
      })

      it("FiniteFromDate", async () => {
        const schema = FiniteFromDate
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(0, "0")
      })

      it("Class", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({
          a: FiniteFromDate
        })) {}
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(A)))

        const encoding = asserts.encoding()
        await encoding.succeed(new A({ a: 0 }), { a: "0" })

        const decoding = asserts.decoding()
        await decoding.succeed({ a: "0" }, new A({ a: 0 }))
      })

      it("ErrorClass", async () => {
        class E extends Schema.ErrorClass<E>("E")({
          a: FiniteFromDate
        }) {}
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(E)))

        const encoding = asserts.encoding()
        await encoding.succeed(new E({ a: 0 }), { a: "0" })

        const decoding = asserts.decoding()
        await decoding.succeed({ a: "0" }, new E({ a: 0 }))
      })

      it("Date", async () => {
        const schema = Schema.Date
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          new Date("2021-01-01"),
          "2021-01-01T00:00:00.000Z"
        )
      })

      it("Error", async () => {
        const schema = Schema.Error
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          new Error("a"),
          { name: "Error", message: "a" }
        )

        const decoding = asserts.decoding()
        // Error: message only
        await decoding.succeed(
          { message: "a" },
          new Error("a")
        )
        // Error: message and name
        await decoding.succeed(
          { name: "b", message: "a" },
          (() => {
            const err = new Error("a")
            err.name = "b"
            return err
          })()
        )
        // Error: message, name, and stack
        await decoding.succeed(
          { name: "b", message: "a", stack: "c" },
          (() => {
            const err = new Error("a")
            err.name = "b"
            err.stack = "c"
            return err
          })()
        )
      })

      it("URL", async () => {
        const schema = Schema.URL
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          new URL("https://example.com"),
          "https://example.com/"
        )

        const decoding = asserts.decoding()
        await decoding.succeed(
          "https://example.com",
          new URL("https://example.com")
        )
        await decoding.succeed(
          "https://example.com/",
          new URL("https://example.com")
        )
        await decoding.fail(
          "not a url",
          isDeno ? `TypeError: Invalid URL: 'not a url'` : `TypeError: Invalid URL`
        )
      })

      it("Option(Date)", async () => {
        const schema = Schema.Option(Schema.Date)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(Option.some(new Date("2021-01-01")), {
          _tag: "Some",
          value: "2021-01-01T00:00:00.000Z"
        })
        await encoding.succeed(Option.none(), { _tag: "None" })
      })

      it("Redacted(Option(String))", async () => {
        const schema = Schema.Redacted(Schema.Option(Schema.String))
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.fail(
          Redacted.make(Option.none()),
          `Cannot serialize Redacted`
        )
        await encoding.fail(
          Redacted.make(Option.some("a")),
          `Cannot serialize Redacted`
        )

        const decoding = asserts.decoding()
        await decoding.succeed(
          { _tag: "None" },
          Redacted.make(Option.none())
        )
        await decoding.succeed(
          { _tag: "Some", value: "a" },
          Redacted.make(Option.some("a"))
        )
      })

      it("ReadonlySet", async () => {
        const schema = Schema.ReadonlySet(Schema.Option(Schema.Date))
        const asserts = new TestSchema.Asserts(Schema.makeSerializerJson(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(new Set([Option.some(new Date("2021-01-01"))]), [{
          _tag: "Some",
          value: "2021-01-01T00:00:00.000Z"
        }])

        const decoding = asserts.decoding()
        await decoding.succeed(
          [{ _tag: "Some", value: "2021-01-01T00:00:00.000Z" }],
          new Set([Option.some(new Date("2021-01-01"))])
        )
      })

      it("ReadonlyMap", async () => {
        const schema = Schema.ReadonlyMap(Schema.Option(Schema.Date), FiniteFromDate)
        const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(Schema.typeCodec(schema)))

        const encoding = asserts.encoding()
        await encoding.succeed(
          new Map([[Option.some(new Date("2021-01-01")), 0]]),
          [[
            { _tag: "Some", value: "2021-01-01T00:00:00.000Z" },
            "0"
          ]]
        )

        const decoding = asserts.decoding()
        await decoding.succeed(
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
        const serializer = Schema.makeSerializerEnsureArray(Schema.makeSerializerStringPojo(schema))
        strictEqual(serializer.ast, Schema.makeSerializerEnsureArray(Schema.makeSerializerStringPojo(serializer)).ast)
      })

      it("Array", async () => {
        const schema = Schema.Array(Schema.Finite)
        const serializer = Schema.makeSerializerEnsureArray(Schema.makeSerializerStringPojo(schema))
        strictEqual(serializer.ast, Schema.makeSerializerEnsureArray(Schema.makeSerializerStringPojo(serializer)).ast)
      })
    })

    it("should handle optional keys", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.NonEmptyArray(Schema.String))
      })
      const serializer = Schema.makeSerializerEnsureArray(Schema.makeSerializerStringPojo(schema))
      const asserts = new TestSchema.Asserts(Schema.makeSerializerStringPojo(serializer))

      const decoding = asserts.decoding()
      await decoding.succeed({})
      await decoding.succeed({ a: ["a"] })
      await decoding.succeed({ a: "a" }, { a: ["a"] })
    })
  })

  describe("xmlEncoder", () => {
    async function assertXml<T, E, RD>(schema: Schema.Codec<T, E, RD>, value: T, expected: string) {
      const serializer = Schema.xmlEncoder(Schema.makeSerializerStringPojo(schema))
      strictEqual(await Effect.runPromise(serializer(value)), expected)
    }

    async function assertXmlFailure<T, E, RD>(schema: Schema.Codec<T, E, RD>, value: T, message: string) {
      const serializer = Schema.xmlEncoder(Schema.makeSerializerStringPojo(schema))
      const r = await serializer(value).pipe(
        Effect.mapError((err) => err.issue.toString()),
        Effect.result,
        Effect.runPromise
      )
      deepStrictEqual(r, Result.fail(message))
    }

    describe("Unsupported schemas", () => {
      it("Unknown", async () => {
        await assertXmlFailure(
          Schema.Unknown,
          "test",
          "required `defaultJsonSerializer` or `serializer` annotation for UnknownKeyword"
        )
      })

      it("Never", async () => {
        await assertXmlFailure(Schema.Never, "test", `Expected never, got "test"`)
      })

      it("Object", async () => {
        await assertXmlFailure(
          Schema.Object,
          {},
          "required `defaultJsonSerializer` or `serializer` annotation for ObjectKeyword"
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
      const serializer = Schema.xmlEncoder(Schema.makeSerializerStringPojo(Schema.Array(Schema.Number)), {
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
      const serializer = Schema.xmlEncoder(Schema.makeSerializerStringPojo(Schema.String), {
        rootName: "custom"
      })
      strictEqual(await Effect.runPromise(serializer("test")), "<custom>test</custom>")
    })

    it("XML Encoder Options - pretty: false", async () => {
      const serializer = Schema.xmlEncoder(
        Schema.makeSerializerStringPojo(Schema.Struct({
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
      const serializer = Schema.xmlEncoder(
        Schema.makeSerializerStringPojo(Schema.Struct({
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
      const serializer = Schema.xmlEncoder(
        Schema.makeSerializerStringPojo(Schema.Struct({
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

      const serializer = Schema.xmlEncoder(Schema.makeSerializerStringPojo(Schema.Any))
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
  })
})
