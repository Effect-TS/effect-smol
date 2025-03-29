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
  it("String", async () => {
    const schema = Schema.String
    await expectSuccess(schema, "a")
    await expectFailure(schema, 1, "Expected StringKeyword, actual 1")
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
          `StringKeyword
└─ Expected StringKeyword, actual ""`
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
          `NumberKeyword
└─ Expected NumberKeyword, actual 1`
        )
      })
    })
  })
})
