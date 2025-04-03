import { Effect, Option, Result, Schema, SchemaAST, SchemaFormatter, SchemaParser } from "effect"
import { describe, it } from "vitest"
import { assertSuccess, assertTrue, strictEqual } from "./utils/assert.js"

function fromResult<A, E>(self: Result.Result<A, E>): Effect.Effect<A, E, never> {
  return Result.isOk(self) ? Effect.succeed(self.ok) : Effect.fail(self.err)
}

function lift<A, E, R>(self: Result.Result<A, E> | Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
  return Result.isResult(self) ? fromResult(self) : self
}

const defaultParseOptions: SchemaAST.ParseOptions = {}

async function expectDecodingSuccess<A>(schema: Schema.Schema<A>, input: A): Promise<void>
async function expectDecodingSuccess<A, I>(schema: Schema.Schema<A, I, never>, input: I, value: A): Promise<void>
async function expectDecodingSuccess<A, I>(schema: Schema.Schema<A, I, never>, input: I): Promise<void> {
  const res = SchemaParser.decodeUnknownParserResult(schema)(input, defaultParseOptions)
  const exit = await Effect.runPromiseExit(
    lift(res).pipe(
      Effect.flip,
      Effect.flatMap((issue) => lift(SchemaFormatter.TreeFormatter.format(issue))),
      Effect.flip
    )
  )
  const v = arguments.length === 3 ? arguments[2] : arguments[1]
  assertSuccess(exit, v)
}

async function expectEncodingSuccess<A>(schema: Schema.Schema<A>, input: A): Promise<void>
async function expectEncodingSuccess<A, I>(schema: Schema.Schema<A, I, never>, input: A, value: I): Promise<void>
async function expectEncodingSuccess<A, I>(schema: Schema.Schema<A, I, never>, input: A): Promise<void> {
  const res = SchemaParser.encodeUnknownParserResult(schema)(input, defaultParseOptions)
  const exit = await Effect.runPromiseExit(
    lift(res).pipe(
      Effect.flip,
      Effect.flatMap((issue) => lift(SchemaFormatter.TreeFormatter.format(issue))),
      Effect.flip
    )
  )
  const v = arguments.length === 3 ? arguments[2] : arguments[1]
  assertSuccess(exit, v)
}

async function expectDecodingFailure<A, I>(
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

async function expectEncodingFailure<A, I>(
  schema: Schema.Schema<A, I, never>,
  input: A,
  message: string,
  options: SchemaAST.ParseOptions = defaultParseOptions
) {
  const res = SchemaParser.encodeUnknownParserResult(schema)(input, options)
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
    await expectDecodingSuccess(schema, "a")
    await expectDecodingFailure(schema, 1, `Expected "a", actual 1`)
  })

  it("String", async () => {
    const schema = Schema.String
    await expectDecodingSuccess(schema, "a")
    await expectDecodingFailure(schema, 1, "Expected string, actual 1")
  })

  it("Number", async () => {
    const schema = Schema.Number
    await expectDecodingSuccess(schema, 1)
    await expectDecodingFailure(schema, "a", `Expected number, actual "a"`)
  })

  describe("Struct", () => {
    it("success", async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      await expectDecodingSuccess(schema, { a: "a" })
    })

    it("missing key", async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      await expectDecodingFailure(
        schema,
        {},
        `{ readonly a: string }
└─ ["a"]
   └─ Missing key / index`
      )
    })

    it("first error", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })
      await expectDecodingFailure(
        schema,
        { a: 1, b: "b" },
        `{ readonly a: string; readonly b: number }
└─ ["a"]
   └─ Expected string, actual 1`
      )
    })

    it("all errors", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })
      await expectDecodingFailure(
        schema,
        { a: 1, b: "b" },
        `{ readonly a: string; readonly b: number }
├─ ["a"]
│  └─ Expected string, actual 1
└─ ["b"]
   └─ Expected number, actual "b"`,
        { errors: "all" }
      )
    })

    it.todo(`onExcessProperty: "error"`, async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      await expectDecodingFailure(
        schema,
        { a: "a", b: "b" },
        `{ readonly a: string; readonly b: number }
└─ ["b"]
   └─ Unexpected property key`,
        { onExcessProperty: "error" }
      )
    })
  })

  describe("Tuple", () => {
    it("success", async () => {
      const schema = Schema.Tuple(Schema.String)
      await expectDecodingSuccess(schema, ["a"])
      await expectDecodingFailure(
        schema,
        [],
        `readonly [string]
└─ [0]
   └─ Missing key / index`
      )
    })
  })

  describe("Array", () => {
    it("success", async () => {
      const schema = Schema.Array(Schema.String)
      await expectDecodingSuccess(schema, ["a", "b"])
      await expectDecodingFailure(
        schema,
        ["a", 1],
        `ReadonlyArray<string>
└─ [1]
   └─ Expected string, actual 1`
      )
    })
  })

  describe("Filters", () => {
    it("filterEncoded", async () => {
      const schema = Schema.NumberToString.pipe(Schema.filterEncoded((s) => s.length > 2, {
        title: "my-filter"
      }))
      await expectEncodingSuccess(schema, 123, "123")
      await expectEncodingFailure(
        schema,
        12,
        `string & my-filter
└─ my-filter
   └─ Invalid value "12"`
      )
    })

    describe("String filters", () => {
      it("minLength", async () => {
        const schema = Schema.String.pipe(Schema.minLength(1))
        await expectDecodingSuccess(schema, "a")
        await expectDecodingFailure(
          schema,
          "",
          `string & minLength(1)
└─ minLength(1)
   └─ Invalid value ""`
        )
      })
    })

    describe("Number filters", () => {
      it("greaterThan", async () => {
        const schema = Schema.Number.pipe(Schema.greaterThan(1))
        await expectDecodingSuccess(schema, 2)
        await expectDecodingFailure(
          schema,
          1,
          `number & greaterThan(1)
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
        await expectDecodingSuccess(schema, "a")
        await expectDecodingSuccess(schema, " a", "a")
        await expectDecodingSuccess(schema, "a ", "a")
        await expectDecodingSuccess(schema, " a ", "a")
      })
    })

    it("NumberToString", async () => {
      const schema = Schema.NumberToString
      await expectDecodingSuccess(schema, "1", 1)
      await expectDecodingFailure(
        schema,
        "a",
        `(number <-> string)
└─ decoding
   └─ parseNumber
      └─ Cannot convert "a" to a number`
      )
    })

    it("NumberToString + greaterThan", async () => {
      const schema = Schema.NumberToString.pipe(Schema.greaterThan(2))
      await expectDecodingSuccess(schema, "3", 3)
      await expectDecodingFailure(
        schema,
        "1",
        `(number & greaterThan(2) <-> string)
└─ greaterThan(2)
   └─ Invalid value 1`
      )
    })
  })

  describe("decodeFrom", () => {
    it("double transformation", async () => {
      const schema = Schema.Trim.pipe(Schema.decodeTo(Schema.NumberToString, {
        decode: (s) => s,
        encode: (s) => s
      }))
      await expectDecodingSuccess(schema, " 2 ", 2)
      await expectDecodingFailure(
        schema,
        " a2 ",
        `((number <-> string) <-> (string <-> string))
└─ decoding
   └─ parseNumber
      └─ Cannot convert "a2" to a number`
      )
    })
  })

  describe("encodeTo", () => {
    it("double transformation", async () => {
      const schema = Schema.NumberToString.pipe(Schema.encodeTo(Schema.Trim, {
        encode: (s) => s,
        decode: (s) => s
      }))
      await expectDecodingSuccess(schema, " 2 ", 2)
      await expectDecodingFailure(
        schema,
        " a2 ",
        `((number <-> string) <-> (string <-> string))
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
    await expectDecodingSuccess(schema, { a: "a" })
    await expectDecodingSuccess(schema, {})
  })

  describe("Class", () => {
    it("decoding", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      strictEqual(A.toString(), "A({ readonly a: string })")

      await expectDecodingSuccess(A, { a: "a" }, new A({ a: "a" }))
      await expectDecodingFailure(
        A,
        { a: 1 },
        `A({ readonly a: string })
└─ ["a"]
   └─ Expected string, actual 1`
      )
    })

    it("constructors", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      strictEqual(A.toString(), "A({ readonly a: string })")

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

      strictEqual(A.toString(), "A({ readonly a: string })")
      strictEqual(B.toString(), "B(A({ readonly a: string }))")

      assertTrue(new B({ a: "a" }) instanceof B)
      assertTrue(new B({ a: "a" }) instanceof A)
      assertTrue(B.make({ a: "a" }) instanceof B)
      assertTrue(B.make({ a: "a" }) instanceof A)

      strictEqual(new B({ a: "a" }).foo(), "a-foo-")
      strictEqual(new B({ a: "a" }).bar(), "a-bar-a-foo-")
      strictEqual(B.make({ a: "a" }).foo(), "a-foo-")
      strictEqual(B.make({ a: "a" }).bar(), "a-bar-a-foo-")

      await expectDecodingSuccess(B, { a: "a" }, new B({ a: "a" }))
      await expectDecodingFailure(
        B,
        { a: 1 },
        `B(A({ readonly a: string }))
└─ ["a"]
   └─ Expected string, actual 1`
      )
    })

    it("extends custom constructor", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly b: string
        constructor(props: (typeof A)["~make.in"]) {
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

      strictEqual(A.toString(), "A({ readonly a: string })")
      strictEqual(B.toString(), "B(A({ readonly a: string }) & <filter>)")

      await expectDecodingSuccess(B, { a: "a" }, new B({ a: "a" }))
      await expectDecodingFailure(
        B,
        { a: 1 },
        `B(A({ readonly a: string }) & <filter>)
└─ ["a"]
   └─ Expected string, actual 1`
      )
      await expectDecodingFailure(
        B,
        { a: "" },
        `B(A({ readonly a: string }) & <filter>)
└─ <filter>
   └─ Invalid value A({"a":""})`
      )
    })
  })

  describe("PropertySignature", () => {
    it("encoding", async () => {
      const t = new SchemaAST.TransformationWithContext(
        new SchemaAST.FinalTransformation(
          (o) => o,
          (o) => Option.orElse(o, () => Option.some("default"))
        ),
        undefined,
        true,
        true
      )
      const ast = new SchemaAST.TypeLiteral(
        [
          new SchemaAST.PropertySignature(
            "a",
            SchemaAST.appendEncoding(SchemaAST.stringKeyword, new SchemaAST.Encoding(t, SchemaAST.stringKeyword, {})),
            false,
            true,
            {}
          )
        ],
        [],
        {},
        [],
        []
      )
      const schema = Schema.make<
        SchemaAST.TypeLiteral,
        { a: string },
        { a?: string },
        never,
        { a: string }
      >(
        ast
      )
      await expectDecodingSuccess(schema, { a: "c" }, { a: "c" })
      await expectDecodingSuccess(schema, {}, { a: "default" })
    })
  })

  describe("encodeRequiredToOptional", () => {
    const ps = Schema.String.pipe(Schema.encodeRequiredToOptional(Schema.String, {
      encode: (s) => Option.some(s),
      decode: (o) => Option.getOrElse(o, () => "default")
    }))
    const schema = Schema.Struct({
      a: ps
    })

    it("decoding", async () => {
      await expectDecodingSuccess(schema, { a: "a" })
      await expectDecodingSuccess(schema, {}, { a: "default" })
    })

    it("encoding", async () => {
      await expectEncodingSuccess(schema, { a: "a" }, { a: "a" })
    })
  })

  describe("encodeOptionalToRequired", () => {
    const ps = Schema.String.pipe(Schema.encodeOptionalToRequired(Schema.String, {
      encode: (o) => Option.getOrElse(o, () => "default"),
      decode: (s) => Option.some(s)
    }))
    const schema = Schema.Struct({
      a: ps
    })

    it("decoding", async () => {
      await expectDecodingSuccess(schema, { a: "a" }, { a: "a" })
    })

    it("encoding", async () => {
      await expectEncodingSuccess(schema, { a: "a" })
      await expectEncodingSuccess(schema, {}, { a: "default" })
    })
  })
})
