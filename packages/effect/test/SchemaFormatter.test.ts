import { Effect, Option, Schema, SchemaCheck, SchemaFormatter, SchemaTransformation, SchemaValidator } from "effect"
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

describe("StructuredFormatter", () => {
  it("MismatchIssue", async () => {
    const schema = Schema.Struct({
      a: Schema.String
    })

    assertStructuredIssue(schema, { a: null }, [
      {
        _tag: "MismatchIssue",
        expected: `{ readonly "a": string }`,
        path: ["a"],
        actual: Option.some(null),
        message: "Expected string, actual null"
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
        _tag: "MismatchIssue",
        expected: `{ readonly "a": string; readonly "b": number }`,
        path: ["a"],
        actual: Option.some(null),
        message: "Expected string, actual null"
      },
      {
        _tag: "MismatchIssue",
        expected: `{ readonly "a": string; readonly "b": number }`,
        path: ["b"],
        actual: Option.some(null),
        message: "Expected number, actual null"
      }
    ])
  })

  it("InvalidIssue", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.check(SchemaCheck.nonEmpty))
    })

    assertStructuredIssue(schema, { a: "" }, [
      {
        _tag: "InvalidIssue",
        expected: `{ readonly "a": string & minLength(1) }`,
        path: ["a"],
        actual: Option.some(""),
        message: `Invalid value ""`,
        bail: false,
        meta: {
          id: "minLength",
          minLength: 1
        }
      }
    ])
  })

  it("MissingIssue", async () => {
    const schema = Schema.Struct({
      a: Schema.String
    })

    assertStructuredIssue(schema, {}, [
      {
        _tag: "MissingIssue",
        expected: `{ readonly "a": string }`,
        path: ["a"],
        message: "Missing value",
        actual: Option.none()
      }
    ])
  })

  it("MissingIssues", async () => {
    const schema = Schema.Struct({
      a: Schema.String,
      b: Schema.Number
    })

    assertStructuredIssue(schema, {}, [
      {
        _tag: "MissingIssue",
        expected: `{ readonly "a": string; readonly "b": number }`,
        path: ["a"],
        message: "Missing value",
        actual: Option.none()
      },
      {
        _tag: "MissingIssue",
        expected: `{ readonly "a": string; readonly "b": number }`,
        path: ["b"],
        message: "Missing value",
        actual: Option.none()
      }
    ])
  })

  it("ForbiddenIssue", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.fail("my message")))
    })

    assertStructuredIssue(schema, { a: "a" }, [
      {
        _tag: "ForbiddenIssue",
        expected: `{ readonly "a": string <-> string }`,
        path: ["a"],
        message: "my message",
        actual: Option.some("a")
      }
    ])
  })
})
