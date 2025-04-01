import type { SchemaAST } from "effect"
import { Effect, Result, Schema, SchemaFormatter, SchemaParser } from "effect"
import { describe, it } from "vitest"
import { assertSuccess, assertTrue, strictEqual } from "./utils/assert.js"

function fromResult<A, E>(self: Result.Result<A, E>): Effect.Effect<A, E, never> {
  return Result.isOk(self) ? Effect.succeed(self.ok) : Effect.fail(self.err)
}

function lift<A, E, R>(self: Result.Result<A, E> | Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
  return Result.isResult(self) ? fromResult(self) : self
}

const defaultParseOptions: SchemaAST.ParseOptions = {}

async function expectSuccess<A>(schema: Schema.Schema<A>, input: A): Promise<void>
async function expectSuccess<A, I>(schema: Schema.Schema<A, I, never>, input: I, value: A): Promise<void>
async function expectSuccess<A, I>(schema: Schema.Schema<A, I, never>, input: I): Promise<void> {
  const res = SchemaParser.decodeUnknownParserResult(schema)(input, defaultParseOptions)
  const exit = await Effect.runPromiseExit(lift(res))
  const v = arguments.length === 3 ? arguments[2] : arguments[1]
  assertSuccess(exit, v)
}

async function expectFailure<A, I>(
  schema: Schema.Schema<A, I, never>,
  input: unknown,
  message: string,
  options: SchemaAST.ParseOptions = defaultParseOptions
) {
  const res = SchemaParser.decodeUnknownParserResult(schema)(input, options)
  const exit = await lift(res).pipe(
    Effect.flip,
    Effect.flatMap((issue) => lift(SchemaFormatter.TreeFormatter.format(issue))),
    Effect.runPromiseExit
  )
  assertSuccess(exit, message)
}

describe("Schema", () => {
  it("Literal", async () => {
    const schema = Schema.Literal("a")
    await expectSuccess(schema, "a")
    await expectFailure(schema, 1, `Expected "a", actual 1`)
  })

  it("String", async () => {
    const schema = Schema.String
    await expectSuccess(schema, "a")
    await expectFailure(schema, 1, "Expected StringKeyword, actual 1")
  })

  it("Number", async () => {
    const schema = Schema.Number
    await expectSuccess(schema, 1)
    await expectFailure(schema, "a", `Expected NumberKeyword, actual "a"`)
  })

  describe("Struct", () => {
    it("success", async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      await expectSuccess(schema, { a: "a" })
    })

    it("missing key", async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      await expectFailure(
        schema,
        {},
        `TypeLiteral
└─ ["a"]
   └─ Expected StringKeyword, actual undefined`
      )
    })

    it("first error", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })
      await expectFailure(
        schema,
        { a: 1, b: "b" },
        `TypeLiteral
└─ ["a"]
   └─ Expected StringKeyword, actual 1`
      )
    })

    it("all errors", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })
      await expectFailure(
        schema,
        { a: 1, b: "b" },
        `TypeLiteral
├─ ["a"]
│  └─ Expected StringKeyword, actual 1
└─ ["b"]
   └─ Expected NumberKeyword, actual "b"`,
        { errors: "all" }
      )
    })

    it.todo(`onExcessProperty: "error"`, async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      await expectFailure(
        schema,
        { a: "a", b: "b" },
        `TypeLiteral
└─ ["b"]
   └─ Unexpected property key`,
        { onExcessProperty: "error" }
      )
    })
  })

  describe("Tuple", () => {
    it("success", async () => {
      const schema = Schema.Tuple(Schema.String)
      await expectSuccess(schema, ["a"])
      await expectFailure(
        schema,
        [],
        `TupleType
└─ [0]
   └─ Expected StringKeyword, actual undefined`
      )
    })
  })

  describe("Array", () => {
    it("success", async () => {
      const schema = Schema.Array(Schema.String)
      await expectSuccess(schema, ["a", "b"])
      await expectFailure(
        schema,
        ["a", 1],
        `TupleType
└─ [1]
   └─ Expected StringKeyword, actual 1`
      )
    })
  })

  describe("Filters", () => {
    describe("String filters", () => {
      it("minLength", async () => {
        const schema = Schema.String.pipe(Schema.minLength(1))
        await expectSuccess(schema, "a")
        await expectFailure(
          schema,
          "",
          `StringKeyword & minLength(1)
└─ minLength(1)
   └─ Invalid value ""`
        )
      })
    })

    describe("Number filters", () => {
      it("greaterThan", async () => {
        const schema = Schema.Number.pipe(Schema.greaterThan(1))
        await expectSuccess(schema, 2)
        await expectFailure(
          schema,
          1,
          `NumberKeyword & greaterThan(1)
└─ greaterThan(1)
   └─ Invalid value 1`
        )
      })
    })
  })

  describe("Transformations", () => {
    describe("String transformations", () => {
      it("Trim", async () => {
        const schema = Schema.Trim
        await expectSuccess(schema, "a")
        await expectSuccess(schema, " a", "a")
        await expectSuccess(schema, "a ", "a")
        await expectSuccess(schema, " a ", "a")
      })
    })

    it("NumberToString", async () => {
      const schema = Schema.NumberToString
      await expectSuccess(schema, "1", 1)
      await expectFailure(
        schema,
        "a",
        `(NumberKeyword <-> StringKeyword)
└─ decoding
   └─ parseNumber
      └─ Cannot convert "a" to a number`
      )
    })

    it("NumberToString + greaterThan", async () => {
      const schema = Schema.NumberToString.pipe(Schema.greaterThan(2))
      await expectSuccess(schema, "3", 3)
      await expectFailure(
        schema,
        "1",
        `(NumberKeyword & greaterThan(2) <-> StringKeyword)
└─ greaterThan(2)
   └─ Invalid value 1`
      )
    })
  })

  describe("decodeFrom", () => {
    it("double transformation", async () => {
      const schema = Schema.decodeFrom(Schema.Trim, Schema.NumberToString, {
        decode: (s) => s,
        encode: (s) => s
      })
      await expectSuccess(schema, " 2 ", 2)
      await expectFailure(
        schema,
        " a2 ",
        `((NumberKeyword <-> StringKeyword) <-> (StringKeyword <-> StringKeyword))
└─ decoding
   └─ parseNumber
      └─ Cannot convert "a2" to a number`
      )
    })
  })

  describe("encodeTo", () => {
    it("double transformation", async () => {
      const schema = Schema.encodeTo(Schema.NumberToString, Schema.Trim, {
        decode: (s) => s,
        encode: (s) => s
      })
      await expectSuccess(schema, " 2 ", 2)
      await expectFailure(
        schema,
        " a2 ",
        `((NumberKeyword <-> StringKeyword) <-> (StringKeyword <-> StringKeyword))
└─ decoding
   └─ parseNumber
      └─ Cannot convert "a2" to a number`
      )
    })
  })

  it("optional", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.optional)
    })
    await expectSuccess(schema, { a: "a" })
    await expectSuccess(schema, {})
  })

  describe("Class", () => {
    it("decoding", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      strictEqual(A.toString(), "A(TypeLiteral)")

      await expectSuccess(A, { a: "a" }, new A({ a: "a" }))
      await expectFailure(
        A,
        { a: 1 },
        `A(TypeLiteral)
└─ ["a"]
   └─ Expected StringKeyword, actual 1`
      )
    })

    it("constructors", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      strictEqual(A.toString(), "A(TypeLiteral)")

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.make({ a: "a" }) instanceof A)
    })

    it("extends (abstract A)", async () => {
      abstract class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        abstract foo(): string
        bar() {
          return this.a + "-bar-" + this.foo()
        }
      }
      class B extends Schema.Class<B>("B")(A) {
        foo() {
          return this.a + "-foo-"
        }
      }

      strictEqual(A.toString(), "A(TypeLiteral)")
      strictEqual(B.toString(), "B(A(TypeLiteral))")

      assertTrue(new B({ a: "a" }) instanceof B)
      assertTrue(new B({ a: "a" }) instanceof A)
      assertTrue(B.make({ a: "a" }) instanceof B)
      assertTrue(B.make({ a: "a" }) instanceof A)

      strictEqual(new B({ a: "a" }).foo(), "a-foo-")
      strictEqual(new B({ a: "a" }).bar(), "a-bar-a-foo-")
      strictEqual(B.make({ a: "a" }).foo(), "a-foo-")
      strictEqual(B.make({ a: "a" }).bar(), "a-bar-a-foo-")

      await expectSuccess(B, { a: "a" }, new B({ a: "a" }))
      await expectFailure(
        B,
        { a: 1 },
        `B(A(TypeLiteral))
└─ ["a"]
   └─ Expected StringKeyword, actual 1`
      )
    })

    it("extends custom constructor", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly b: string
        constructor(props: (typeof A)["Encoded"]) {
          super(props)
          this.b = props.a + "-b"
        }
      }
      class B extends Schema.Class<B>("B")(A) {}

      strictEqual(new A({ a: "a" }).b, "a-b")
      strictEqual(A.make({ a: "a" }).b, "a-b")
      strictEqual(new B({ a: "a" }).b, "a-b")
      strictEqual(B.make({ a: "a" }).b, "a-b")
    })

    it("extends (A & <filter>)", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}
      class B extends Schema.Class<B>("B")(A.pipe(Schema.filter(({ a }) => a.length > 0))) {}

      strictEqual(A.toString(), "A(TypeLiteral)")
      strictEqual(B.toString(), "B(A(TypeLiteral) & <filter>)")

      await expectSuccess(B, { a: "a" }, new B({ a: "a" }))
      await expectFailure(
        B,
        { a: 1 },
        `B(A(TypeLiteral) & <filter>)
└─ ["a"]
   └─ Expected StringKeyword, actual 1`
      )
      await expectFailure(
        B,
        { a: "" },
        `B(A(TypeLiteral) & <filter>)
└─ <filter>
   └─ Invalid value A({"a":""})`
      )
    })
  })
})
