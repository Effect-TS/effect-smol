import { Effect, Option, Schema, SchemaCheck, SchemaFormatter, SchemaGetter, SchemaIssue, SchemaToParser } from "effect"
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
  const r = await SchemaToParser.decodeUnknownEffect(schema)(input, { errors: "all" }).pipe(
    Effect.mapError((issue) => SchemaFormatter.StructuredFormatter.format(issue)),
    Effect.result,
    Effect.runPromise
  )

  return assertions.result.err(r, expected)
}

describe("StructuredFormatter", () => {
  it("single InvalidType", async () => {
    const schema = Schema.Struct({
      a: Schema.String
    })

    await assertStructuredIssue(schema, { a: null }, [
      {
        _tag: "InvalidType",
        path: ["a"],
        message: "Expected string, actual null",
        actual: Option.some(null),
        annotations: schema.fields.a.ast.annotations
      }
    ])
  })

  it("multiple InvalidTypes", async () => {
    const schema = Schema.Struct({
      a: Schema.String,
      b: Schema.Number
    })

    await assertStructuredIssue(schema, { a: null, b: null }, [
      {
        _tag: "InvalidType",
        path: ["a"],
        message: "Expected string, actual null",
        actual: Option.some(null),
        annotations: schema.fields.a.ast.annotations
      },
      {
        _tag: "InvalidType",
        path: ["b"],
        message: "Expected number, actual null",
        actual: Option.some(null),
        annotations: schema.fields.b.ast.annotations
      }
    ])
  })

  it("InvalidData", async () => {
    const schema = Schema.Struct({
      a: Schema.String.check(SchemaCheck.nonEmpty)
    })

    await assertStructuredIssue(schema, { a: "" }, [
      {
        _tag: "InvalidData",
        path: ["a"],
        message: `Expected a value with a length of at least 1, actual ""`,
        actual: Option.some(""),
        abort: false,
        annotations: schema.fields.a.ast.checks?.[0]?.annotations
      }
    ])
  })

  it("single MissingKey", async () => {
    const schema = Schema.Struct({
      a: Schema.String
    })

    await assertStructuredIssue(schema, {}, [
      {
        _tag: "MissingKey",
        path: ["a"],
        message: "Missing key",
        actual: Option.none(),
        annotations: schema.ast.annotations
      }
    ])
  })

  it("multiple MissingKeys", async () => {
    const schema = Schema.Struct({
      a: Schema.String,
      b: Schema.Number
    })

    await assertStructuredIssue(schema, {}, [
      {
        _tag: "MissingKey",
        path: ["a"],
        message: "Missing key",
        actual: Option.none(),
        annotations: schema.ast.annotations
      },
      {
        _tag: "MissingKey",
        path: ["b"],
        message: "Missing key",
        actual: Option.none(),
        annotations: schema.ast.annotations
      }
    ])
  })

  it("Forbidden", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.decodeTo(Schema.String, {
        decode: SchemaGetter.fail((os) => new SchemaIssue.Forbidden(os, { message: "my message" })),
        encode: SchemaGetter.passthrough()
      }))
    })

    await assertStructuredIssue(schema, { a: "a" }, [
      {
        _tag: "Forbidden",
        path: ["a"],
        message: "my message",
        actual: Option.some("a"),
        annotations: { message: "my message" }
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

    await assertStructuredIssue(schema, { a: "a", b: 1 }, [
      {
        _tag: "OneOf",
        path: [],
        message:
          `Expected exactly one successful result for { readonly "a": string } ⊻ { readonly "b": number }, actual {"a":"a","b":1}`,
        actual: Option.some({ a: "a", b: 1 }),
        annotations: schema.ast.annotations
      }
    ])
  })

  it("uuid", async () => {
    const schema = Schema.String.check(SchemaCheck.uuid())

    await assertStructuredIssue(schema, "", [
      {
        _tag: "InvalidData",
        path: [],
        message:
          "Expected a string matching the pattern ^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$, actual \"\"",
        actual: Option.some(""),
        abort: false,
        annotations: schema.ast.checks?.[0]?.annotations
      }
    ])
  })
})
