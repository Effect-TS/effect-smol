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

async function expectSuccess<A, I>(schema: Schema.Schema<A, I, never>, input: I, value: A) {
  const res = SchemaParser.decodeUnknownParserResult(schema)(input, defaultParseOptions)
  const exit = await Effect.runPromiseExit(lift(res))
  assertSuccess(exit, value)
}

async function expectFailure<A, I>(schema: Schema.Schema<A, I, never>, input: unknown, message: string) {
  const res = SchemaParser.decodeUnknownParserResult(schema)(input, {})
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
    await expectSuccess(schema, "a", "a")
    await expectFailure(schema, 1, "Expected StringKeyword, actual 1")
  })

  it("Struct", async () => {
    const schema = Schema.Struct({
      name: Schema.String
    })
    await expectSuccess(schema, { name: "a" }, { name: "a" })
    await expectFailure(
      schema,
      { name: 1 },
      `TypeLiteral
└─ ["name"]
   └─ Expected StringKeyword, actual 1`
    )
  })
})
