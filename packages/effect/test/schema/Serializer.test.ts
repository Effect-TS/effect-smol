import { Option } from "effect/data"
import { Check, Formatter, Schema, Serializer, ToParser, Transformation } from "effect/schema"
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
        await assertions.serialization.json.schema.succeed(schema, { a: new Date("2021-01-01"), b: 1 }, {
          a: "2021-01-01T00:00:00.000Z",
          b: 1
        })
      })

      it("Undefined", async () => {
        const schema = Schema.Undefined

        await assertions.serialization.json.schema.succeed(schema, undefined)
      })

      it("Null", async () => {
        const schema = Schema.Null

        await assertions.serialization.json.schema.succeed(schema, null)
      })

      it("String", async () => {
        const schema = Schema.String

        await assertions.serialization.json.schema.succeed(schema, "a")
      })

      it("Symbol", async () => {
        const schema = Schema.Symbol

        await assertions.serialization.json.schema.succeed(schema, Symbol.for("a"), "Symbol(a)")
        await assertions.serialization.json.schema.fail(
          schema,
          Symbol("a"),
          "cannot serialize to string, Symbol is not registered"
        )
        await assertions.serialization.json.schema.fail(
          schema,
          Symbol(),
          "cannot serialize to string, Symbol has no description"
        )

        await assertions.deserialization.json.schema.succeed(schema, "Symbol(a)", Symbol.for("a"))
      })

      it("BigInt", async () => {
        const schema = Schema.BigInt

        await assertions.serialization.json.schema.succeed(schema, 1n, "1")
        await assertions.deserialization.json.schema.succeed(schema, "1", 1n)
      })

      it("PropertyKey", async () => {
        const schema = Schema.PropertyKey
        await assertions.serialization.json.schema.succeed(schema, "a", "a")
        await assertions.serialization.json.schema.succeed(schema, 1, 1)
        await assertions.serialization.json.schema.succeed(schema, Symbol.for("a"), "Symbol(a)")

        await assertions.deserialization.json.schema.succeed(schema, "a", "a")
        await assertions.deserialization.json.schema.succeed(schema, 1, 1)
        await assertions.deserialization.json.schema.succeed(schema, "Symbol(a)", Symbol.for("a"))
      })

      describe("Literal", () => {
        it("string", async () => {
          const schema = Schema.Literal("a")

          await assertions.serialization.json.schema.succeed(schema, "a", "a")
          await assertions.deserialization.json.schema.succeed(schema, "a", "a")
        })

        it("number", async () => {
          const schema = Schema.Literal(1)

          await assertions.serialization.json.schema.succeed(schema, 1, 1)
          await assertions.deserialization.json.schema.succeed(schema, 1, 1)
        })

        it("boolean", async () => {
          const schema = Schema.Literal(true)

          await assertions.serialization.json.schema.succeed(schema, true)
          await assertions.deserialization.json.schema.succeed(schema, true)
        })

        it("bigint", async () => {
          const schema = Schema.Literal(1n)

          await assertions.serialization.json.schema.succeed(schema, 1n, "1")
          await assertions.deserialization.json.schema.succeed(schema, "1", 1n)
        })
      })

      describe("TemplateLiteral", () => {
        it("1n + string", async () => {
          const schema = Schema.TemplateLiteral([1n, Schema.String])

          await assertions.serialization.json.schema.succeed(schema, "1a")
          await assertions.deserialization.json.schema.succeed(schema, "1a")
        })

        it(`"a" + bigint`, async () => {
          const schema = Schema.TemplateLiteral(["a", Schema.BigInt])

          await assertions.serialization.json.schema.succeed(schema, "a1")
          await assertions.deserialization.json.schema.succeed(schema, "a1")
        })
      })

      it("URL", async () => {
        const schema = Schema.URL

        await assertions.serialization.json.schema.succeed(
          schema,
          new URL("https://example.com"),
          "https://example.com/"
        )
        await assertions.deserialization.json.schema.succeed(
          schema,
          "https://example.com",
          new URL("https://example.com")
        )
        await assertions.deserialization.json.schema.succeed(
          schema,
          "https://example.com/",
          new URL("https://example.com")
        )
        await assertions.deserialization.json.schema.fail(
          schema,
          "not a url",
          isDeno ? `TypeError: Invalid URL: 'not a url'` : `TypeError: Invalid URL`
        )
      })

      it("declareRefinement without annotation", async () => {
        class A {
          readonly _tag = "A"
        }
        const schema = Schema.declare((u): u is A => u instanceof A)
        await assertions.serialization.json.schema.fail(
          schema,
          new A(),
          "cannot serialize to JSON, required `defaultJsonSerializer` annotation"
        )
      })

      it("Date", async () => {
        const schema = Schema.Date

        await assertions.serialization.json.schema.succeed(schema, new Date("2021-01-01"), "2021-01-01T00:00:00.000Z")
      })

      it("Option(Date)", async () => {
        const schema = Schema.Option(Schema.Date)

        await assertions.serialization.json.schema.succeed(schema, Option.some(new Date("2021-01-01")), [
          "2021-01-01T00:00:00.000Z"
        ])
        await assertions.serialization.json.schema.succeed(schema, Option.none(), [])
      })

      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.Date,
          b: Schema.Date
        })

        await assertions.serialization.json.schema.succeed(
          schema,
          { a: new Date("2021-01-01"), b: new Date("2021-01-01") },
          { a: "2021-01-01T00:00:00.000Z", b: "2021-01-01T00:00:00.000Z" }
        )
      })

      it("Record(Symbol, Date)", async () => {
        const schema = Schema.Record(Schema.Symbol, Schema.Date)

        await assertions.serialization.json.schema.succeed(
          schema,
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") },
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" }
        )

        await assertions.deserialization.json.schema.succeed(
          schema,
          { "Symbol(a)": "2021-01-01T00:00:00.000Z", "Symbol(b)": "2021-01-01T00:00:00.000Z" },
          { [Symbol.for("a")]: new Date("2021-01-01"), [Symbol.for("b")]: new Date("2021-01-01") }
        )
      })

      it("Tuple(Date, Date)", async () => {
        const schema = Schema.Tuple([Schema.Date, Schema.Date])

        await assertions.serialization.json.schema.succeed(
          schema,
          [new Date("2021-01-01"), new Date("2021-01-01")],
          ["2021-01-01T00:00:00.000Z", "2021-01-01T00:00:00.000Z"]
        )
      })

      it("FiniteFromDate", async () => {
        const schema = FiniteFromDate

        await assertions.serialization.json.schema.succeed(schema, 0, 0)
      })

      it("Union(Schema.Date, Schema.Date)", async () => {
        const schema = Schema.Union([Schema.Date, FiniteFromDate])

        await assertions.serialization.json.schema.succeed(schema, new Date("2021-01-01"), "2021-01-01T00:00:00.000Z")
        await assertions.serialization.json.schema.succeed(schema, 0, 0)
      })

      it("Map", async () => {
        const schema = Schema.Map(Schema.Option(Schema.Date), FiniteFromDate)

        await assertions.serialization.json.schema.succeed(
          schema,
          new Map([[Option.some(new Date("2021-01-01")), 0]]),
          [[
            ["2021-01-01T00:00:00.000Z"],
            0
          ]]
        )
        await assertions.deserialization.json.schema.succeed(
          schema,
          [[["2021-01-01T00:00:00.000Z"], 0]],
          new Map([[Option.some(new Date("2021-01-01")), 0]])
        )
      })

      it("Class", async () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({
          a: FiniteFromDate
        })) {}

        await assertions.serialization.json.schema.succeed(A, new A({ a: 0 }), { a: 0 })
        await assertions.deserialization.json.schema.succeed(A, { a: 0 }, new A({ a: 0 }))
      })

      it("ErrorClass", async () => {
        class E extends Schema.ErrorClass<E>("E")({
          a: FiniteFromDate
        }) {}

        await assertions.serialization.json.schema.succeed(E, new E({ a: 0 }), { a: 0 })
        await assertions.deserialization.json.schema.succeed(E, { a: 0 }, new E({ a: 0 }))
      })

      it("Enums", async () => {
        enum Fruits {
          Apple,
          Banana
        }
        const schema = Schema.Enums(Fruits)

        await assertions.serialization.json.schema.succeed(schema, Fruits.Apple, 0)
        await assertions.serialization.json.schema.succeed(schema, Fruits.Banana, 1)
        await assertions.deserialization.json.schema.succeed(schema, 0, Fruits.Apple)
        await assertions.deserialization.json.schema.succeed(schema, 1, Fruits.Banana)
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

        await assertions.serialization.json.schema.succeed(schema, new MyError("a"), "a")
        await assertions.deserialization.json.schema.succeed(schema, "a", new MyError("a"))
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

        await assertions.serialization.json.schema.succeed(schema, new MyError({ message: "a", cause: "b" }), {
          message: "a",
          cause: "b"
        })
        await assertions.deserialization.json.schema.succeed(
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

      it("Undefined", async () => {
        const schema = Schema.Undefined
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
      it("Symbol", async () => {
        const schema = Schema.Symbol

        await assertions.serialization.stringLeafJson.schema.succeed(schema, Symbol.for("a"), "Symbol(a)")
        await assertions.serialization.stringLeafJson.schema.fail(
          schema,
          Symbol("a"),
          "cannot serialize to string, Symbol is not registered"
        )
        await assertions.serialization.stringLeafJson.schema.fail(
          schema,
          Symbol(),
          "cannot serialize to string, Symbol has no description"
        )

        await assertions.deserialization.stringLeafJson.schema.succeed(schema, "Symbol(a)", Symbol.for("a"))
      })

      it("Number", async () => {
        const schema = Schema.Number

        await assertions.serialization.stringLeafJson.schema.succeed(schema, 1, "1")
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, "1", 1)
      })

      it("Boolean", async () => {
        const schema = Schema.Boolean

        await assertions.serialization.stringLeafJson.schema.succeed(schema, true, "true")
        await assertions.serialization.stringLeafJson.schema.succeed(schema, false, "false")
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, "true", true)
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, "false", false)
      })

      it("Null", async () => {
        const schema = Schema.Null

        await assertions.serialization.stringLeafJson.schema.succeed(schema, null, "")
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, "", null)
      })

      describe("Literal", () => {
        it("string", async () => {
          const schema = Schema.Literal("a")

          await assertions.serialization.stringLeafJson.schema.succeed(schema, "a", "a")
          await assertions.deserialization.stringLeafJson.schema.succeed(schema, "a", "a")
        })

        it("number", async () => {
          const schema = Schema.Literal(1)

          await assertions.serialization.stringLeafJson.schema.succeed(schema, 1, "1")
          await assertions.deserialization.stringLeafJson.schema.succeed(schema, "1", 1)
        })

        it("boolean", async () => {
          const schema = Schema.Literal(true)

          await assertions.serialization.stringLeafJson.schema.succeed(schema, true, "true")
          await assertions.deserialization.stringLeafJson.schema.succeed(schema, "true", true)
        })

        it("bigint", async () => {
          const schema = Schema.Literal(1n)

          await assertions.serialization.stringLeafJson.schema.succeed(schema, 1n, "1")
          await assertions.deserialization.stringLeafJson.schema.succeed(schema, "1", 1n)
        })
      })

      it("Literals", async () => {
        const schema = Schema.Literals(["a", 1, 2n, true])
        await assertions.deserialization.stringLeafJson.schema.fail(
          schema,
          "-",
          `Expected "a" | "1" | "2" | "true", got "-"`
        )
      })

      describe("Enums", () => {
        it("should serialize the enum value", async () => {
          enum Fruits {
            Apple,
            Banana = "banana"
          }
          const schema = Schema.Enums(Fruits)

          await assertions.serialization.stringLeafJson.schema.succeed(schema, Fruits.Apple, "0")
          await assertions.serialization.stringLeafJson.schema.succeed(schema, Fruits.Banana, "banana")
          await assertions.deserialization.stringLeafJson.schema.succeed(schema, "0", Fruits.Apple)
          await assertions.deserialization.stringLeafJson.schema.succeed(schema, "banana", Fruits.Banana)
        })
      })

      it("TemplateLiteral", async () => {
        const schema = Schema.TemplateLiteral(["a", Schema.Literal(1), "b"])
        await assertions.serialization.stringLeafJson.schema.succeed(schema, "a1b")
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, "a1b")
      })

      it("NullOr(String)", async () => {
        const schema = Schema.NullOr(Schema.String)

        await assertions.serialization.stringLeafJson.schema.succeed(schema, "a", "a")
        await assertions.serialization.stringLeafJson.schema.succeed(schema, null, "")
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, "", "")
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, "a", "a")
      })

      it("NullOr(Number)", async () => {
        const schema = Schema.NullOr(Schema.Number)

        await assertions.serialization.stringLeafJson.schema.succeed(schema, 1, "1")
        await assertions.serialization.stringLeafJson.schema.succeed(schema, null, "")
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, "", null)
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, "1", 1)
      })

      it("Array(NullOr(Number))", async () => {
        const schema = Schema.Array(Schema.NullOr(Schema.Number))

        await assertions.serialization.stringLeafJson.schema.succeed(schema, [1, null], ["1", ""])
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, ["1", ""], [1, null])
      })

      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.NullOr(Schema.Number),
          b: Schema.NullOr(Schema.Number)
        })

        await assertions.serialization.stringLeafJson.schema.succeed(schema, { a: 1, b: null }, {
          a: "1",
          b: ""
        })
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, {
          a: "1",
          b: ""
        }, { a: 1, b: null })
      })

      it("Struct with Symbol property name", async () => {
        const a = Symbol.for("a")
        const schema = Schema.Struct({
          [a]: Schema.String
        })

        await assertions.serialization.stringLeafJson.schema.fail(
          schema,
          { [a]: "b" },
          "cannot serialize to JSON, property names must be strings"
        )
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

        await assertions.serialization.stringLeafJson.schema.succeed(schema, { a: 1, categories: [] }, {
          a: "1",
          categories: []
        })
        await assertions.serialization.stringLeafJson.schema.succeed(schema, {
          a: 1,
          categories: [{ a: 2, categories: [] }]
        }, {
          a: "1",
          categories: [
            { a: "2", categories: [] }
          ]
        })
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, {
          a: "1",
          categories: []
        }, { a: 1, categories: [] })
        await assertions.deserialization.stringLeafJson.schema.succeed(schema, {
          a: "1",
          categories: [
            { a: "2", categories: [] }
          ]
        }, { a: 1, categories: [{ a: 2, categories: [] }] })
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
  })
})
