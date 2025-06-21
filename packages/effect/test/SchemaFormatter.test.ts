import { Effect, Option, Schema, SchemaCheck, SchemaFormatter, SchemaGetter, SchemaIssue, SchemaToParser } from "effect"
import { describe, it } from "vitest"
import { assertions } from "./utils/schema.js"

const assertStructuredIssue = async <T, E>(
  schema: Schema.Codec<T, E>,
  input: unknown,
  expected: ReadonlyArray<SchemaFormatter.StructuredIssue>
) => {
  const r = await SchemaToParser.decodeUnknownEffect(schema)(input, { errors: "all" }).pipe(
    Effect.mapError((issue) => SchemaFormatter.getStructured().format(issue)),
    Effect.result,
    Effect.runPromise
  )

  return assertions.result.err(r, expected)
}

describe("Tree formatter", () => {
  it("should use the identifier annotation if present", async () => {
    await assertions.decoding.fail(
      Schema.String.annotate({ identifier: "id" }),
      null,
      `Expected id, actual null`
    )
    await assertions.decoding.fail(
      Schema.NonEmptyString.annotate({ identifier: "id" }),
      null,
      `Expected id, actual null`
    )
    await assertions.decoding.fail(
      Schema.String.check(SchemaCheck.nonEmpty({ identifier: "id" })),
      null,
      `Expected id, actual null`
    )
  })
})

describe("Structured formatter", () => {
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

  it("InvalidValue", async () => {
    const schema = Schema.Struct({
      a: Schema.NonEmptyString
    })

    await assertStructuredIssue(schema, { a: "" }, [
      {
        _tag: "InvalidValue",
        path: ["a"],
        message: `Invalid data ""`,
        actual: Option.some(""),
        abort: false,
        annotations: undefined,
        check: schema.fields.a.ast.checks?.[0]?.annotations
      }
    ])
  })

  describe("MissingKey", () => {
    it("single missing key", async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })

      await assertStructuredIssue(schema, {}, [
        {
          _tag: "MissingKey",
          path: ["a"],
          message: "Missing key",
          actual: Option.none(),
          annotations: undefined
        }
      ])
    })

    it("multiple missing keys", async () => {
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
          annotations: undefined
        },
        {
          _tag: "MissingKey",
          path: ["b"],
          message: "Missing key",
          actual: Option.none(),
          annotations: undefined
        }
      ])
    })

    it("annotated key", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.annotateKey({ missingMessage: "Missing key" }))
      })

      await assertStructuredIssue(schema, {}, [
        {
          _tag: "MissingKey",
          path: ["a"],
          message: "Missing key",
          actual: Option.none(),
          annotations: schema.fields.a.ast.context?.annotations
        }
      ])
    })
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
      Schema.Struct({ a: Schema.String }),
      Schema.Struct({ b: Schema.Number })
    ], { mode: "oneOf" })

    await assertStructuredIssue(schema, { a: "a", b: 1 }, [
      {
        _tag: "OneOf",
        path: [],
        message:
          `Expected exactly one successful schema for {"a":"a","b":1} in { readonly "a": string } ⊻ { readonly "b": number }`,
        actual: Option.some({ a: "a", b: 1 }),
        annotations: schema.ast.annotations
      }
    ])
  })

  it("uuid", async () => {
    const schema = Schema.String.check(SchemaCheck.uuid())

    await assertStructuredIssue(schema, "", [
      {
        _tag: "InvalidValue",
        path: [],
        message: `Invalid data ""`,
        actual: Option.some(""),
        abort: false,
        annotations: undefined,
        check: schema.ast.checks?.[0]?.annotations
      }
    ])
  })

  describe("Structural checks", () => {
    it("Array + minLength", async () => {
      const schema = Schema.Struct({
        tags: Schema.Array(Schema.NonEmptyString).check(SchemaCheck.minLength(3))
      })

      await assertStructuredIssue(schema, { tags: ["a", ""] }, [
        {
          _tag: "InvalidValue",
          path: ["tags", 1],
          message: `Invalid data ""`,
          actual: Option.some(""),
          abort: false,
          annotations: undefined,
          check: schema.fields.tags.ast.rest[0].checks?.[0]?.annotations
        },
        {
          _tag: "InvalidValue",
          path: ["tags"],
          message: `Invalid data ["a",""]`,
          actual: Option.some(["a", ""]),
          abort: false,
          annotations: undefined,
          check: schema.fields.tags.ast.checks?.[0]?.annotations
        }
      ])
    })
  })
})
