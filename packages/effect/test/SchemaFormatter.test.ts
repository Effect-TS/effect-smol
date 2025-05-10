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
  it("single InvalidType", async () => {
    const schema = Schema.Struct({
      a: Schema.String
    })

    assertStructuredIssue(schema, { a: null }, [
      {
        _tag: "InvalidType",
        expected: `{ readonly "a": string }`,
        path: ["a"],
        actual: Option.some(null),
        message: "Expected string, actual null"
      }
    ])
  })

  it("multiple InvalidTypes", async () => {
    const schema = Schema.Struct({
      a: Schema.String,
      b: Schema.Number
    })

    assertStructuredIssue(schema, { a: null, b: null }, [
      {
        _tag: "InvalidType",
        expected: `{ readonly "a": string; readonly "b": number }`,
        path: ["a"],
        actual: Option.some(null),
        message: "Expected string, actual null"
      },
      {
        _tag: "InvalidType",
        expected: `{ readonly "a": string; readonly "b": number }`,
        path: ["b"],
        actual: Option.some(null),
        message: "Expected number, actual null"
      }
    ])
  })

  it("InvalidData", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.check(SchemaCheck.nonEmpty))
    })

    assertStructuredIssue(schema, { a: "" }, [
      {
        _tag: "InvalidData",
        expected: `{ readonly "a": string & minLength(1) }`,
        path: ["a"],
        actual: Option.some(""),
        message: `Invalid data ""`,
        abort: false,
        meta: {
          id: "minLength",
          minLength: 1
        }
      }
    ])
  })

  it("single MissingKey", async () => {
    const schema = Schema.Struct({
      a: Schema.String
    })

    assertStructuredIssue(schema, {}, [
      {
        _tag: "MissingKey",
        expected: `{ readonly "a": string }`,
        path: ["a"],
        message: "Missing value",
        actual: Option.none()
      }
    ])
  })

  it("multiple MissingKeys", async () => {
    const schema = Schema.Struct({
      a: Schema.String,
      b: Schema.Number
    })

    assertStructuredIssue(schema, {}, [
      {
        _tag: "MissingKey",
        expected: `{ readonly "a": string; readonly "b": number }`,
        path: ["a"],
        message: "Missing value",
        actual: Option.none()
      },
      {
        _tag: "MissingKey",
        expected: `{ readonly "a": string; readonly "b": number }`,
        path: ["b"],
        message: "Missing value",
        actual: Option.none()
      }
    ])
  })

  it("Forbidden", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.fail("my message")))
    })

    assertStructuredIssue(schema, { a: "a" }, [
      {
        _tag: "Forbidden",
        expected: `{ readonly "a": string <-> string }`,
        path: ["a"],
        message: "my message",
        actual: Option.some("a")
      }
    ])
  })

  it("Union", async () => {
    const schema = Schema.Union([
      Schema.Struct({
        a: Schema.String
      }),
      Schema.Struct({
        b: Schema.Number
      })
    ], { mode: "oneOf" })

    assertStructuredIssue(schema, { a: "a", b: 1 }, [
      {
        _tag: "OneOf",
        expected: `{ readonly "a": string } ⊻ { readonly "b": number }`,
        path: [],
        message:
          `Expected exactly one successful result for { readonly "a": string } ⊻ { readonly "b": number }, actual {"a":"a","b":1}`,
        actual: Option.some({ a: "a", b: 1 })
      }
    ])
  })
})
