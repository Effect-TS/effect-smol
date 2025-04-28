import { Effect, Schema, SchemaFormatter, SchemaValidator } from "effect"
import { describe, it } from "vitest"
import * as Util from "./SchemaTest.js"
import { deepStrictEqual, fail, strictEqual, throws } from "./utils/assert.js"

const assertions = Util.assertions({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

const assertStructuredIssue = async <T, E>(
  schema: Schema.Codec<T, E>,
  input: unknown,
  expected: ReadonlyArray<SchemaFormatter.StructuredIssue>
) => {
  const r = await SchemaValidator.decodeUnknown(schema)(input, { errors: "all" }).pipe(
    Effect.mapError(SchemaFormatter.StructuredFormatter.format),
    Effect.result,
    Effect.runPromise
  )

  assertions.result.err(r, expected)
}

describe("SchemaStructuredFormatter", () => {
  it("MismatchIssue", async () => {
    const schema = Schema.String

    assertStructuredIssue(schema, null, [
      {
        code: "MismatchIssue",
        expected: "string",
        message: "Expected string, actual null",
        path: []
      }
    ])
  })

  it("MismatchIssues", async () => {
    const schema = Schema.Struct({
      a: Schema.String,
      b: Schema.Number
    })

    assertStructuredIssue(schema, { a: null, b: null }, [
      {
        code: "MismatchIssue",
        expected: "string",
        message: "Expected string, actual null",
        path: ["a"]
      },
      {
        code: "MismatchIssue",
        expected: "number",
        message: "Expected number, actual null",
        path: ["b"]
      }
    ])
  })
})
