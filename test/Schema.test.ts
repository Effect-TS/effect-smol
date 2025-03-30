import type { SchemaAST } from "effect"
import { Effect, Result, Schema, SchemaFormatter, SchemaParser } from "effect"
import { describe, it } from "vitest"
import { assertSuccess } from "./utils/assert.js"

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

    it("NumberFromString", async () => {
      const schema = Schema.NumberFromString
      await expectSuccess(schema, "1", 1)
      await expectFailure(
        schema,
        "a",
        `(StringKeyword <-> NumberKeyword)
└─ decoding
   └─ parseNumber
      └─ Cannot convert "a" to a number`
      )
    })

    it("NumberFromString + greaterThan", async () => {
      const schema = Schema.NumberFromString.pipe(Schema.greaterThan(2))
      await expectSuccess(schema, "3", 3)
      await expectFailure(
        schema,
        "1",
        `(StringKeyword <-> NumberKeyword & greaterThan(2))
└─ greaterThan(2)
   └─ Invalid value 1`
      )
    })
  })

  describe("transform", () => {
    it("double transformation", async () => {
      const schema = Schema.transform(Schema.Trim, Schema.NumberFromString, {
        decode: (s) => s,
        encode: (s) => s
      })
      await expectSuccess(schema, " 2 ", 2)
      await expectFailure(
        schema,
        " a2 ",
        `(StringKeyword <-> (StringKeyword <-> StringKeyword) <-> NumberKeyword)
└─ decoding
   └─ parseNumber
      └─ Cannot convert "a2" to a number`
      )
    })
  })
})
