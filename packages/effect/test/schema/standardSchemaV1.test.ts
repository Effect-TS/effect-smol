import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Context, Effect, Option, Predicate } from "effect"
import type { Formatter } from "effect/schema"
import { Check, Getter, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { standard } from "../utils/schema.js"

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

const leafHook: Formatter.LeafHook = (issue) => {
  switch (issue._tag) {
    case "InvalidType":
      return "Invalid type"
    case "OneOf":
      return "Too many possible values"
    case "InvalidValue":
      return "Invalid value"
    case "MissingKey":
      return "Missing key"
    case "UnexpectedKey":
      return "Unexpected key"
    case "Forbidden":
      return "Forbidden operation"
  }
}
const checkHook: Formatter.CheckHook = (issue) => {
  const meta = issue.filter.annotations?.meta
  if (Predicate.isObject(meta)) {
    const { id, ...rest } = meta
    if (Predicate.isString(id)) {
      return `${id}.${JSON.stringify(rest)}`
    }
  }
}
const options = { leafHook, checkHook } as const

describe("standardSchemaV1", () => {
  it("should return a schema", () => {
    const schema = Schema.FiniteFromString
    const standardSchema = Schema.standardSchemaV1(schema, options)
    assertTrue(Schema.isSchema(standardSchema))
  })

  it("sync decoding", () => {
    const schema = Schema.NonEmptyString
    const standardSchema = Schema.standardSchemaV1(schema, options)
    standard.expectSyncSuccess(standardSchema, "a", "a")
    standard.expectSyncFailure(standardSchema, null, [
      {
        message: "Invalid type",
        path: []
      }
    ])
    standard.expectSyncFailure(standardSchema, "", [
      {
        message: `minLength.{"minLength":1}`,
        path: []
      }
    ])
  })

  it("async decoding", async () => {
    const schema = AsyncNonEmptyString
    const standardSchema = Schema.standardSchemaV1(schema, options)
    await standard.expectAsyncSuccess(standardSchema, "a", "a")
    standard.expectSyncFailure(standardSchema, null, [
      {
        message: "Invalid type",
        path: []
      }
    ])
    await standard.expectAsyncFailure(standardSchema, "", [
      {
        message: `minLength.{"minLength":1}`,
        path: []
      }
    ])
  })

  describe("missing dependencies", () => {
    class MagicNumber extends Context.Tag<MagicNumber, number>()("MagicNumber") {}

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
      const standardSchema = Schema.standardSchemaV1(schema as any, options)
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
      const standardSchema = Schema.standardSchemaV1(schema as any, options)
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
    const standardSchema = Schema.standardSchemaV1(schema, options)
    standard.expectSyncSuccess(standardSchema, { a: "a", b: "b" }, { a: "a", b: "b" })
    standard.expectSyncFailure(standardSchema, null, [
      {
        message: "Invalid type",
        path: []
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "a", b: "" }, [
      {
        message: `minLength.{"minLength":1}`,
        path: ["b"]
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "", b: "b" }, [
      {
        message: `minLength.{"minLength":1}`,
        path: ["a"]
      }
    ])
    standard.expectSyncFailure(standardSchema, { a: "", b: "" }, [
      {
        message: `minLength.{"minLength":1}`,
        path: ["a"]
      },
      {
        message: `minLength.{"minLength":1}`,
        path: ["b"]
      }
    ])
  })

  it("with parseOptions: { errors: 'first' } should return only the first issue", () => {
    const schema = Schema.Struct({
      a: Schema.NonEmptyString,
      b: Schema.NonEmptyString
    })
    const standardSchema = Schema.standardSchemaV1(schema, { parseOptions: { errors: "first" }, ...options })
    standard.expectSyncFailure(standardSchema, { a: "", b: "" }, [
      {
        message: `minLength.{"minLength":1}`,
        path: ["a"]
      }
    ])
  })

  describe("Structural checks", () => {
    it("Array + minLength", () => {
      const schema = Schema.Struct({
        tags: Schema.Array(Schema.NonEmptyString).check(Check.minLength(3))
      })

      const standardSchema = Schema.standardSchemaV1(schema, options)
      standard.expectSyncFailure(standardSchema, { tags: ["a", ""] }, [
        {
          "message": `minLength.{"minLength":1}`,
          "path": ["tags", 1]
        },
        {
          "message": `minLength.{"minLength":3}`,
          "path": ["tags"]
        }
      ])
    })
  })

  describe("should respect the `message` annotation", () => {
    describe("String", () => {
      it("String & annotation", () => {
        const schema = Schema.String.annotate({ message: "Custom message" })
        const standardSchema = Schema.standardSchemaV1(schema, options)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Custom message",
            path: []
          }
        ])
      })

      it("String & annotation & minLength", () => {
        const schema = Schema.String.annotate({ message: "Custom message" }).check(Check.nonEmpty())
        const standardSchema = Schema.standardSchemaV1(schema, options)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Custom message",
            path: []
          }
        ])
      })

      it("String & minLength & annotation", () => {
        const schema = Schema.String.check(Check.nonEmpty()).annotate({ message: "Custom message" })
        const standardSchema = Schema.standardSchemaV1(schema, options)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Invalid type",
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
        const standardSchema = Schema.standardSchemaV1(schema, options)
        standard.expectSyncFailure(standardSchema, null, [
          {
            message: "Invalid type",
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
        const standardSchema = Schema.standardSchemaV1(schema, options)
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
        const standardSchema = Schema.standardSchemaV1(schema, options)
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
        const standardSchema = Schema.standardSchemaV1(schema, options)
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
      it("Struct & missingKeyMessage", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.annotateKey({ missingKeyMessage: "Custom message" }))
        })
        const standardSchema = Schema.standardSchemaV1(schema, options)
        standard.expectSyncFailure(standardSchema, {}, [
          {
            message: "Custom message",
            path: ["a"]
          }
        ])
      })

      it("Struct & missingKeyMessage", () => {
        const schema = Schema.Struct({
          a: Schema.String
        }).annotate({ unexpectedKeyMessage: "Custom message" })
        const standardSchema = Schema.standardSchemaV1(schema, {
          ...options,
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
        const standardSchema = Schema.standardSchemaV1(schema, options)
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
})
