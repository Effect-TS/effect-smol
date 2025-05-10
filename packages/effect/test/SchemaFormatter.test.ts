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
        actual: Option.some(null),
        meta: undefined,
        ast: schema.fields.a.ast
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
        actual: Option.some(null),
        meta: undefined,
        ast: schema.fields.a.ast
      },
      {
        _tag: "InvalidType",
        path: ["b"],
        actual: Option.some(null),
        meta: undefined,
        ast: schema.fields.b.ast
      }
    ])
  })

  it("InvalidData", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.check(SchemaCheck.nonEmpty))
    })

    await assertStructuredIssue(schema, { a: "" }, [
      {
        _tag: "InvalidData",
        path: ["a"],
        actual: Option.some(""),
        abort: false,
        meta: {
          id: "minLength",
          minLength: 1
        },
        ast: schema.fields.a.ast
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
        actual: Option.none(),
        ast: schema.ast
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
        actual: Option.none(),
        ast: schema.ast
      },
      {
        _tag: "MissingKey",
        path: ["b"],
        actual: Option.none(),
        ast: schema.ast
      }
    ])
  })

  it("Forbidden", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.fail("my message")))
    })

    await assertStructuredIssue(schema, { a: "a" }, [
      {
        _tag: "Forbidden",
        path: ["a"],
        actual: Option.some("a"),
        meta: {
          message: "my message"
        },
        ast: schema.ast
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
        actual: Option.some({ a: "a", b: 1 }),
        ast: schema.ast
      }
    ])
  })
})
