import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import type { StandardSchemaV1 } from "@standard-schema/spec"
import { Context, Effect, Option, Predicate, Schema, SchemaCheck, SchemaGetter } from "effect"
import { describe, it } from "vitest"

function validate<I, A>(
  schema: StandardSchemaV1<I, A>,
  input: unknown
): StandardSchemaV1.Result<A> | Promise<StandardSchemaV1.Result<A>> {
  return schema["~standard"].validate(input)
}

const isPromise = (value: unknown): value is Promise<unknown> => value instanceof Promise

const expectSuccess = async <A>(
  result: StandardSchemaV1.Result<A>,
  a: A
) => {
  deepStrictEqual(result, { value: a })
}

const expectFailure = async <A>(
  result: StandardSchemaV1.Result<A>,
  issues: ReadonlyArray<StandardSchemaV1.Issue> | ((issues: ReadonlyArray<StandardSchemaV1.Issue>) => void)
) => {
  if (result.issues !== undefined) {
    if (Predicate.isFunction(issues)) {
      issues(result.issues)
    } else {
      deepStrictEqual(
        result.issues.map((issue) => ({
          message: issue.message,
          path: issue.path
        })),
        issues
      )
    }
  } else {
    throw new Error("Expected issues, got undefined")
  }
}

const expectSyncSuccess = <I, A>(
  schema: StandardSchemaV1<I, A>,
  input: unknown,
  a: A
) => {
  const result = validate(schema, input)
  if (isPromise(result)) {
    throw new Error("Expected value, got promise")
  } else {
    expectSuccess(result, a)
  }
}

const expectAsyncSuccess = async <I, A>(
  schema: StandardSchemaV1<I, A>,
  input: unknown,
  a: A
) => {
  const result = validate(schema, input)
  if (isPromise(result)) {
    expectSuccess(await result, a)
  } else {
    throw new Error("Expected promise, got value")
  }
}

const expectSyncFailure = <I, A>(
  schema: StandardSchemaV1<I, A>,
  input: unknown,
  issues: ReadonlyArray<StandardSchemaV1.Issue> | ((issues: ReadonlyArray<StandardSchemaV1.Issue>) => void)
) => {
  const result = validate(schema, input)
  if (isPromise(result)) {
    throw new Error("Expected value, got promise")
  } else {
    expectFailure(result, issues)
  }
}

const expectAsyncFailure = async <I, A>(
  schema: StandardSchemaV1<I, A>,
  input: unknown,
  issues: ReadonlyArray<StandardSchemaV1.Issue> | ((issues: ReadonlyArray<StandardSchemaV1.Issue>) => void)
) => {
  const result = validate(schema, input)
  if (isPromise(result)) {
    expectFailure(await result, issues)
  } else {
    throw new Error("Expected promise, got value")
  }
}

const AsyncString = Schema.String.pipe(Schema.decode({
  decode: new SchemaGetter.SchemaGetter((os: Option.Option<string>) =>
    Effect.gen(function*() {
      yield* Effect.sleep("10 millis")
      return os
    })
  ),
  encode: SchemaGetter.passthrough()
}))

const AsyncNonEmptyString = AsyncString.check(SchemaCheck.nonEmpty)

describe("standardSchemaV1", () => {
  it("should return a schema", () => {
    const schema = Schema.FiniteFromString
    const standardSchema = Schema.standardSchemaV1(schema)
    assertTrue(Schema.isSchema(standardSchema))
  })

  it("sync decoding + sync issue formatting", () => {
    const schema = Schema.NonEmptyString
    const standardSchema = Schema.standardSchemaV1(schema)
    expectSyncSuccess(standardSchema, "a", "a")
    expectSyncFailure(standardSchema, null, [
      {
        message: "Expected string & minLength(1), actual null",
        path: []
      }
    ])
    expectSyncFailure(standardSchema, "", [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: []
      }
    ])
  })

  it("async decoding + sync issue formatting", async () => {
    const schema = AsyncNonEmptyString
    const standardSchema = Schema.standardSchemaV1(schema)
    await expectAsyncSuccess(standardSchema, "a", "a")
    expectSyncFailure(standardSchema, null, [
      {
        message: "Expected string, actual null",
        path: []
      }
    ])
    await expectAsyncFailure(standardSchema, "", [
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
      expectSyncFailure(standardSchema, 1, (issues) => {
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
      expectSyncFailure(standardSchema, 1, (issues) => {
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
    expectSyncSuccess(standardSchema, {
      a: "a",
      b: "b"
    }, {
      a: "a",
      b: "b"
    })
    expectSyncFailure(standardSchema, null, [
      {
        message: `Expected { readonly "a": string & minLength(1); readonly "b": string & minLength(1) }, actual null`,
        path: []
      }
    ])
    expectSyncFailure(standardSchema, "", [
      {
        message: `Expected { readonly "a": string & minLength(1); readonly "b": string & minLength(1) }, actual ""`,
        path: []
      }
    ])
    expectSyncFailure(standardSchema, {
      a: "",
      b: ""
    }, [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["a"]
      },
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["b"]
      }
    ])
    expectSyncFailure(standardSchema, {
      a: "a",
      b: ""
    }, [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["b"]
      }
    ])
    expectSyncFailure(standardSchema, {
      a: "",
      b: "b"
    }, [
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
    const standardSchema = Schema.standardSchemaV1(schema, { errors: "first" })
    expectSyncSuccess(standardSchema, {
      a: "a",
      b: "b"
    }, {
      a: "a",
      b: "b"
    })
    expectSyncFailure(standardSchema, null, [
      {
        message: `Expected { readonly "a": string & minLength(1); readonly "b": string & minLength(1) }, actual null`,
        path: []
      }
    ])
    expectSyncFailure(standardSchema, "", [
      {
        message: `Expected { readonly "a": string & minLength(1); readonly "b": string & minLength(1) }, actual ""`,
        path: []
      }
    ])
    expectSyncFailure(standardSchema, {
      a: "",
      b: ""
    }, [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["a"]
      }
    ])
    expectSyncFailure(standardSchema, {
      a: "a",
      b: ""
    }, [
      {
        message: `Expected a value with a length of at least 1, actual ""`,
        path: ["b"]
      }
    ])
    expectSyncFailure(standardSchema, {
      a: "",
      b: "b"
    }, [
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

      const standardSchema = Schema.standardSchemaV1(schema, { errors: "all" })
      expectSyncFailure(standardSchema, { tags: ["a", ""] }, [
        {
          "message": `Expected a value with a length of at least 1, actual ""`,
          "path": [
            "tags",
            1
          ]
        },
        {
          "message": `Expected a value with a length of at least 3, actual ["a",""]`,
          "path": [
            "tags"
          ]
        }
      ])
    })
  })
})
