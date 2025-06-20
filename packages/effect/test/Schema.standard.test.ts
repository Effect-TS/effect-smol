import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Context, Effect, Option, Schema, SchemaCheck, SchemaGetter } from "effect"
import { describe, it } from "vitest"
import { standard } from "./utils/schema.js"

const AsyncString = Schema.String.pipe(Schema.decode({
  decode: new SchemaGetter.SchemaGetter((os: Option.Option<string>) =>
    Effect.gen(function*() {
      yield* Effect.sleep("10 millis")
      return os
    })
  ),
  encode: SchemaGetter.passthrough()
}))

const AsyncNonEmptyString = AsyncString.check(SchemaCheck.nonEmpty())

describe("standardSchemaV1", () => {
  it("should return a schema", () => {
    const schema = Schema.FiniteFromString
    const standardSchema = Schema.standardSchemaV1(schema)
    assertTrue(Schema.isSchema(standardSchema))
  })

  it("sync decoding + sync issue formatting", () => {
    const schema = Schema.NonEmptyString
    const standardSchema = Schema.standardSchemaV1(schema)
    standard.expectSyncSuccess(standardSchema, "a", "a")
    standard.expectSyncFailure(standardSchema, null, [
      {
        message: "Expected string & minLength(1), actual null",
        path: []
      }
    ])
    standard.expectSyncFailure(standardSchema, "", [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: []
      }
    ])
  })

  it("async decoding + sync issue formatting", async () => {
    const schema = AsyncNonEmptyString
    const standardSchema = Schema.standardSchemaV1(schema)
    await standard.expectAsyncSuccess(standardSchema, "a", "a")
    standard.expectSyncFailure(standardSchema, null, [
      {
        message: "Expected string, actual null",
        path: []
      }
    ])
    await standard.expectAsyncFailure(standardSchema, "", [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: []
      }
    ])
  })

  describe("missing dependencies", () => {
    class MagicNumber extends Context.Tag<MagicNumber, number>()("MagicNumber") {}

    it("sync decoding should throw", () => {
      const DepString = Schema.Number.pipe(Schema.decode({
        decode: SchemaGetter.onSome((n) =>
          Effect.gen(function*() {
            const magicNumber = yield* MagicNumber
            return Option.some(n * magicNumber)
          })
        ),
        encode: SchemaGetter.passthrough()
      }))

      const schema = DepString
      const standardSchema = Schema.standardSchemaV1(schema as any)
      standard.expectSyncFailure(standardSchema, 1, (issues) => {
        strictEqual(issues.length, 1)
        deepStrictEqual(issues[0].path, undefined)
        assertTrue(issues[0].message.includes("Service not found: MagicNumber"))
      })
    })

    it("async decoding should throw", () => {
      const DepString = Schema.Number.pipe(Schema.decode({
        decode: SchemaGetter.onSome((n) =>
          Effect.gen(function*() {
            const magicNumber = yield* MagicNumber
            yield* Effect.sleep("10 millis")
            return Option.some(n * magicNumber)
          })
        ),
        encode: SchemaGetter.passthrough()
      }))

      const schema = DepString
      const standardSchema = Schema.standardSchemaV1(schema as any)
      standard.expectSyncFailure(standardSchema, 1, (issues) => {
        strictEqual(issues.length, 1)
        deepStrictEqual(issues[0].path, undefined)
        assertTrue(issues[0].message.includes("Service not found: MagicNumber"))
      })
    })
  })

  it("sync decoding + sync all issues formatting", () => {
    const schema = Schema.Struct({
      a: Schema.NonEmptyString,
      b: Schema.NonEmptyString
    })
    const standardSchema = Schema.standardSchemaV1(schema)
    standard.expectSyncSuccess(standardSchema, { a: "a", b: "b" }, { a: "a", b: "b" })
    standard.expectSyncFailure(standardSchema, null, [
      {
        message: `Expected { readonly "a": string & minLength(1); readonly "b": string & minLength(1) }, actual null`,
        path: []
      }
    ])
    standard.expectSyncFailure(standardSchema, "", [
      {
        message: `Expected { readonly "a": string & minLength(1); readonly "b": string & minLength(1) }, actual ""`,
        path: []
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "", b: "" }, [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["a"]
      },
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["b"]
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "a", b: "" }, [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["b"]
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "", b: "b" }, [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["a"]
      }
    ])
  })

  it("sync decoding + sync first issue formatting", () => {
    const schema = Schema.Struct({
      a: Schema.NonEmptyString,
      b: Schema.NonEmptyString
    })
    const standardSchema = Schema.standardSchemaV1(schema, { parseOptions: { errors: "first" } })
    standard.expectSyncSuccess(standardSchema, { a: "a", b: "b" }, { a: "a", b: "b" })
    standard.expectSyncFailure(standardSchema, null, [
      {
        message: `Expected { readonly "a": string & minLength(1); readonly "b": string & minLength(1) }, actual null`,
        path: []
      }
    ])
    standard.expectSyncFailure(standardSchema, "", [
      {
        message: `Expected { readonly "a": string & minLength(1); readonly "b": string & minLength(1) }, actual ""`,
        path: []
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "", b: "" }, [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["a"]
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "a", b: "" }, [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["b"]
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "", b: "b" }, [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["a"]
      }
    ])
  })

  describe("Structural checks", () => {
    it("Array + minLength", () => {
      const schema = Schema.Struct({
        tags: Schema.Array(Schema.NonEmptyString).check(SchemaCheck.minLength(3))
      })

      const standardSchema = Schema.standardSchemaV1(schema, { parseOptions: { errors: "all" } })
      standard.expectSyncFailure(standardSchema, { tags: ["a", ""] }, [
        {
          "message": `Expected a value with a length of at least 1, actual ""`,
          "path": ["tags", 1]
        },
        {
          "message": `Expected a value with a length of at least 3, actual ["a",""]`,
          "path": ["tags"]
        }
      ])
    })
  })
})
