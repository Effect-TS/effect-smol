import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, ServiceMap } from "effect"
import { Option } from "effect/data"
import { Check, Getter, Issue, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { standard } from "../utils/schema.ts"

const AsyncString = Schema.String.pipe(Schema.decode({
  decode: new Getter.Getter((os: Option.Option<string>) =>
    Effect.gen(function*() {
      yield* Effect.sleep("10 millis")
      return os
    })
  ),
  encode: Getter.passthrough()
}))

const AsyncNonEmptyString = AsyncString.check(Check.nonEmpty())

describe("asStandardSchemaV1", () => {
  it("should return a schema", () => {
    const schema = Schema.FiniteFromString
    const standardSchema = Schema.asStandardSchemaV1(schema)
    assertTrue(Schema.isSchema(standardSchema))
  })

  it("sync decoding", () => {
    const schema = Schema.NonEmptyString
    const standardSchema = Schema.asStandardSchemaV1(schema)
    standard.expectSyncSuccess(standardSchema, "a", "a")
    standard.expectSyncFailure(standardSchema, null, [
      {
        message: "Expected string, got null",
        path: []
      }
    ])
    standard.expectSyncFailure(standardSchema, "", [
      {
        message: `Expected a value with a length of at least 1, got ""`,
        path: []
      }
    ])
  })

  it("async decoding", async () => {
    const schema = AsyncNonEmptyString
    const standardSchema = Schema.asStandardSchemaV1(schema)
    await standard.expectAsyncSuccess(standardSchema, "a", "a")
    standard.expectSyncFailure(standardSchema, null, [
      {
        message: "Expected string, got null",
        path: []
      }
    ])
    await standard.expectAsyncFailure(standardSchema, "", [
      {
        message: `Expected a value with a length of at least 1, got ""`,
        path: []
      }
    ])
  })

  describe("missing dependencies", () => {
    class MagicNumber extends ServiceMap.Key<MagicNumber, number>()("MagicNumber") {}

    it("sync decoding should throw", () => {
      const DepString = Schema.Number.pipe(Schema.decode({
        decode: Getter.onSome((n) =>
          Effect.gen(function*() {
            const magicNumber = yield* MagicNumber
            return Option.some(n * magicNumber)
          })
        ),
        encode: Getter.passthrough()
      }))

      const schema = DepString
      const standardSchema = Schema.asStandardSchemaV1(schema as any)
      standard.expectSyncFailure(standardSchema, 1, (issues) => {
        strictEqual(issues.length, 1)
        deepStrictEqual(issues[0].path, undefined)
        assertTrue(issues[0].message.includes("Service not found: MagicNumber"))
      })
    })

    it("async decoding should throw", () => {
      const DepString = Schema.Number.pipe(Schema.decode({
        decode: Getter.onSome((n) =>
          Effect.gen(function*() {
            const magicNumber = yield* MagicNumber
            yield* Effect.sleep("10 millis")
            return Option.some(n * magicNumber)
          })
        ),
        encode: Getter.passthrough()
      }))

      const schema = DepString
      const standardSchema = Schema.asStandardSchemaV1(schema as any)
      standard.expectSyncFailure(standardSchema, 1, (issues) => {
        strictEqual(issues.length, 1)
        deepStrictEqual(issues[0].path, undefined)
        assertTrue(issues[0].message.includes("Service not found: MagicNumber"))
      })
    })
  })

  it("by default should return all issues", () => {
    const schema = Schema.Struct({
      a: Schema.NonEmptyString,
      b: Schema.NonEmptyString
    })
    const standardSchema = Schema.asStandardSchemaV1(schema)
    standard.expectSyncSuccess(standardSchema, { a: "a", b: "b" }, { a: "a", b: "b" })
    standard.expectSyncFailure(standardSchema, null, [
      {
        message: "Expected object, got null",
        path: []
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "a", b: "" }, [
      {
        message: `Expected a value with a length of at least 1, got ""`,
        path: ["b"]
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "", b: "b" }, [
      {
        message: `Expected a value with a length of at least 1, got ""`,
        path: ["a"]
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "", b: "" }, [
      {
        message: `Expected a value with a length of at least 1, got ""`,
        path: ["a"]
      },
      {
        message: `Expected a value with a length of at least 1, got ""`,
        path: ["b"]
      }
    ])
  })

  it("with parseOptions: { errors: 'first' } should return only the first issue", () => {
    const schema = Schema.Struct({
      a: Schema.NonEmptyString,
      b: Schema.NonEmptyString
    })
    const standardSchema = Schema.asStandardSchemaV1(schema, { parseOptions: { errors: "first" } })
    standard.expectSyncFailure(standardSchema, { a: "", b: "" }, [
      {
        message: `Expected a value with a length of at least 1, got ""`,
        path: ["a"]
      }
    ])
  })

  describe("Structural checks", () => {
    it("Array + minLength", () => {
      const schema = Schema.Struct({
        tags: Schema.Array(Schema.NonEmptyString).check(Check.minLength(3))
      })

      const standardSchema = Schema.asStandardSchemaV1(schema)
      standard.expectSyncFailure(standardSchema, { tags: ["a", ""] }, [
        {
          "message": `Expected a value with a length of at least 1, got ""`,
          "path": ["tags", 1]
        },
        {
          "message": `Expected a value with a length of at least 3, got ["a",""]`,
          "path": ["tags"]
        }
      ])
    })
  })

  describe("should respect the `message` annotation", () => {
    describe("String", () => {
      it("String & annotation", () => {
        const schema = Schema.String.annotate({ message: "Custom message" })
        const standardSchema = Schema.asStandardSchemaV1(schema)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Custom message",
            path: []
          }
        ])
      })

      it("String & annotation & minLength", () => {
        const schema = Schema.String.annotate({ message: "Custom message" }).check(Check.nonEmpty())
        const standardSchema = Schema.asStandardSchemaV1(schema)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Custom message",
            path: []
          }
        ])
      })

      it("String & minLength & annotation", () => {
        const schema = Schema.String.check(Check.nonEmpty()).annotate({ message: "Custom message" })
        const standardSchema = Schema.asStandardSchemaV1(schema)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Expected string, got null",
            path: []
          }
        ])
        standard.expectSyncFailure(standardSchema, "", [
          {
            message: "Custom message",
            path: []
          }
        ])
      })

      it("String & minLength(annotation)", () => {
        const schema = Schema.String.check(Check.nonEmpty({ message: "Custom message" }))
        const standardSchema = Schema.asStandardSchemaV1(schema)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Expected string, got null",
            path: []
          }
        ])
        standard.expectSyncFailure(standardSchema, "", [
          {
            message: "Custom message",
            path: []
          }
        ])
      })

      it("String & annotation & minLength & annotation", () => {
        const schema = Schema.String.annotate({ message: "Custom message" }).check(Check.nonEmpty()).annotate({
          message: "Custom message 2"
        })
        const standardSchema = Schema.asStandardSchemaV1(schema)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Custom message",
            path: []
          }
        ])
        standard.expectSyncFailure(standardSchema, "", [
          {
            message: "Custom message 2",
            path: []
          }
        ])
      })

      it("String & annotation & minLength(annotation)", () => {
        const schema = Schema.String.annotate({ message: "Custom message" }).check(Check.nonEmpty({
          message: "Custom message 2"
        }))
        const standardSchema = Schema.asStandardSchemaV1(schema)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Custom message",
            path: []
          }
        ])
        standard.expectSyncFailure(standardSchema, "", [
          {
            message: "Custom message 2",
            path: []
          }
        ])
      })

      it("String & annotation & minLength(annotation) & maxLength(annotation)", () => {
        const schema = Schema.String.annotate({ message: "Custom message" }).check(Check.nonEmpty({
          message: "Custom message 2"
        })).check(Check.maxLength(2, { message: "Custom message 3" }))
        const standardSchema = Schema.asStandardSchemaV1(schema)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Custom message",
            path: []
          }
        ])
        standard.expectSyncFailure(standardSchema, "", [
          {
            message: "Custom message 2",
            path: []
          }
        ])
        standard.expectSyncFailure(standardSchema, "abc", [
          {
            message: "Custom message 3",
            path: []
          }
        ])
      })
    })

    describe("Struct", () => {
      it("Struct & messageMissingKey", () => {
        const schema = Schema.Struct({
          a: Schema.String.annotateKey({ messageMissingKey: "Custom message" })
        })
        const standardSchema = Schema.asStandardSchemaV1(schema)
        standard.expectSyncFailure(standardSchema, {}, [
          {
            message: "Custom message",
            path: ["a"]
          }
        ])
      })

      it("Struct & messageUnexpectedKey", () => {
        const schema = Schema.Struct({
          a: Schema.String
        }).annotate({ messageUnexpectedKey: "Custom message" })
        const standardSchema = Schema.asStandardSchemaV1(schema, {
          parseOptions: { onExcessProperty: "error" }
        })
        standard.expectSyncFailure(standardSchema, { a: "a", b: "b" }, [
          {
            message: "Custom message",
            path: ["b"]
          }
        ])
      })
    })

    describe("Union", () => {
      it("Literals", () => {
        const schema = Schema.Literals(["a", "b"]).annotate({ message: "Custom message" })
        const standardSchema = Schema.asStandardSchemaV1(schema)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Custom message",
            path: []
          }
        ])
        standard.expectSyncFailure(standardSchema, "-", [
          {
            message: "Custom message",
            path: []
          }
        ])
      })
    })
  })

  describe("treeLeafHook & verboseCheckHook", () => {
    it("String", () => {
      const schema = Schema.String
      const standardSchema = Schema.asStandardSchemaV1(schema, {
        leafHook: Issue.defaultLeafHook
      })
      standard.expectSyncFailure(standardSchema, null, [
        {
          message: "Expected string, got null",
          path: []
        }
      ])
    })

    it("NonEmptyString", () => {
      const schema = Schema.NonEmptyString
      const standardSchema = Schema.asStandardSchemaV1(schema, {
        leafHook: Issue.defaultLeafHook
      })
      standard.expectSyncFailure(standardSchema, "", [
        {
          message: `Expected a value with a length of at least 1, got ""`,
          path: []
        }
      ])
    })
  })
})
