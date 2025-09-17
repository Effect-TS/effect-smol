import type { StandardSchemaV1 } from "@standard-schema/spec"
import { Effect } from "effect"
import type { ServiceMap } from "effect"
import { Predicate, Record, Result } from "effect/data"
import { AST, Issue, Schema, Serializer, ToArbitrary, ToParser } from "effect/schema"
import { FastCheck } from "effect/testing"
import { deepStrictEqual, fail, strictEqual, throws } from "./assert.ts"

export const assertions = make({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

function make(asserts: {
  readonly deepStrictEqual: (actual: unknown, expected: unknown) => void
  readonly strictEqual: (actual: unknown, expected: unknown, message?: string) => void
  readonly throws: (thunk: () => void, error?: Error | ((u: unknown) => undefined)) => void
  readonly fail: (message: string) => void
}) {
  const { deepStrictEqual, fail, strictEqual, throws } = asserts

  function assertInstanceOf<C extends abstract new(...args: any) => any>(
    value: unknown,
    constructor: C,
    message?: string,
    ..._: Array<never>
  ): asserts value is InstanceType<C> {
    if (!(value instanceof constructor)) {
      fail(message ?? `expected ${value} to be an instance of ${constructor}`)
    }
  }

  const out = {
    schema: {
      fields: {
        equals: (a: Schema.Struct.Fields, b: Schema.Struct.Fields) => {
          deepStrictEqual(Record.map(a, AST.getAST), Record.map(b, AST.getAST))
        }
      },

      elements: {
        equals: (a: Schema.Tuple.Elements, b: Schema.Tuple.Elements) => {
          deepStrictEqual(a.map(AST.getAST), b.map(AST.getAST))
        }
      }
    },

    arbitrary: {
      /**
       * Verifies that the schema generates valid arbitrary values that satisfy
       * the schema.
       */
      satisfy<T, E, RE>(schema: Schema.Codec<T, E, never, RE>, options?: {
        readonly params?: FastCheck.Parameters<[T]> | undefined
      }) {
        const params = options?.params
        const is = Schema.is(schema)
        const arb = ToArbitrary.make(schema)
        FastCheck.assert(FastCheck.property(arb, (a) => is(a)), { numRuns: 20, ...params })
      }
    },

    promise: {
      async succeed<A>(promise: Promise<A>, expected: A) {
        deepStrictEqual(await promise, expected)
      },

      async fail<A>(promise: Promise<A>, message: string) {
        try {
          const a = await promise
          throw new Error(`Promise didn't reject, got: ${a}`)
        } catch (e: unknown) {
          if (Issue.isIssue(e)) {
            strictEqual(e.toString(), message)
          } else {
            throw new Error(`Unknown promise rejection: ${e}`)
          }
        }
      }
    },

    ast: {
      equals: <A, I, RD, RE>(a: Schema.Codec<A, I, RD, RE>, b: Schema.Codec<A, I, RD, RE>) => {
        deepStrictEqual(a.ast, b.ast)
      }
    },

    make: {
      async succeed<S extends Schema.Top>(
        schema: S,
        input: S["~type.make.in"],
        expected?: S["Type"]
      ) {
        return out.effect.succeed(
          ToParser.makeEffect(schema)(input),
          expected === undefined ? input : expected
        )
      },

      async fail<S extends Schema.Top>(
        schema: S,
        input: unknown,
        message: string,
        options?: Schema.MakeOptions
      ) {
        return out.effect.fail(ToParser.makeEffect(schema)(input, options), message)
      }
    },

    makeSync: {
      /**
       * Ensures that the given constructor produces the expected value.
       */
      succeed<S extends Schema.Top>(
        schema: S,
        input: S["~type.make.in"],
        expected?: S["Type"]
      ) {
        deepStrictEqual(schema.makeSync(input), expected === undefined ? input : expected)
      },

      /**
       * Ensures that the given constructor throws the expected error.
       */
      fail<S extends Schema.Top>(
        schema: S,
        input: unknown,
        message: string
      ) {
        throws(() => schema.makeSync(input), (err) => {
          assertInstanceOf(err, Error)
          strictEqual(err.message, message)
        })
      }
    },

    serialization: {
      json: {
        typeCodec: {
          async succeed<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: A,
            expected?: unknown
          ) {
            return out.effect.succeed(
              Schema.encodeEffect(Serializer.json(Schema.typeCodec(schema)))(input),
              arguments.length > 2 ? expected : input
            )
          },

          async fail<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: A,
            message: string
          ) {
            return out.effect.fail(
              Schema.encodeEffect(Serializer.json(Schema.typeCodec(schema)))(input).pipe(
                Effect.mapError((err) => err.issue)
              ),
              message
            )
          }
        },

        codec: {
          async succeed<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: A,
            expected?: unknown
          ) {
            return out.encoding.succeed(
              Serializer.json(schema),
              input,
              { expected: arguments.length > 2 ? expected : input }
            )
          },

          async fail<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: A,
            message: string
          ) {
            return out.encoding.fail(Serializer.json(schema), input, message)
          }
        }
      },

      stringLeafJson: {
        typeCodec: {
          async succeed<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: A,
            expected?: Serializer.StringPojo
          ) {
            return out.effect.succeed(
              Schema.encodeEffect(Serializer.stringPojo(Schema.typeCodec(schema)))(input),
              arguments.length > 2 ? expected : input
            )
          },

          async fail<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: A,
            message: string
          ) {
            return out.effect.fail(
              Schema.encodeEffect(Serializer.stringPojo(Schema.typeCodec(schema)))(input).pipe(
                Effect.mapError((err) => err.issue)
              ),
              message
            )
          }
        }
      }
    },

    deserialization: {
      json: {
        typeCodec: {
          async succeed<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: unknown,
            expected?: A
          ) {
            return out.effect.succeed(
              Schema.decodeEffect(Serializer.json(Schema.typeCodec(schema)))(input),
              arguments.length > 2 ? expected : input
            )
          },

          async fail<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: unknown,
            message: string
          ) {
            return out.effect.fail(
              Schema.decodeEffect(Serializer.json(Schema.typeCodec(schema)))(input).pipe(
                Effect.mapError((err) => err.issue)
              ),
              message
            )
          }
        },

        codec: {
          async succeed<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: unknown,
            expected?: A
          ) {
            return out.decoding.succeed(
              Serializer.json(schema),
              input,
              { expected: arguments.length > 2 ? expected : input }
            )
          },

          async fail<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: unknown,
            message: string
          ) {
            return out.decoding.fail(Serializer.json(schema), input, message)
          }
        }
      },

      stringLeafJson: {
        typeCodec: {
          async succeed<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: Serializer.StringPojo,
            expected?: A
          ) {
            return out.effect.succeed(
              Schema.decodeEffect(Serializer.stringPojo(Schema.typeCodec(schema)))(input),
              arguments.length > 2 ? expected : input
            )
          },

          async fail<const A, const I, RD, RE>(
            schema: Schema.Codec<A, I, RD, RE>,
            input: Serializer.StringPojo,
            message: string
          ) {
            return out.effect.fail(
              Schema.decodeEffect(Serializer.stringPojo(Schema.typeCodec(schema)))(input).pipe(
                Effect.mapError((err) => err.issue)
              ),
              message
            )
          }
        }
      }
    },

    decoding: {
      async succeed<const A, const I, RD, RE>(
        schema: Schema.Codec<A, I, RD, RE>,
        input: unknown,
        options?: {
          readonly expected?: A
          readonly parseOptions?: AST.ParseOptions | undefined
          readonly provide?: ReadonlyArray<readonly [ServiceMap.Key<any, any>, any]> | undefined
        } | undefined
      ) {
        const decoded = ToParser.decodeUnknownEffect(schema)(input, options?.parseOptions)
        const effWithMessage = Effect.catch(decoded, (issue) => Effect.fail(issue.toString()))
        let provided = effWithMessage
        if (options?.provide) {
          for (const [tag, value] of options.provide) {
            provided = Effect.provideService(provided, tag, value)
          }
        }
        return out.effect.succeed(
          provided,
          options && Object.hasOwn(options, "expected") ? options.expected : input
        )
      },

      /**
       * Attempts to decode the given input using the provided schema. If the
       * decoding fails, the error message is compared to the expected message.
       * Otherwise the test fails.
       */
      async fail<const A, const I, RD, RE>(
        schema: Schema.Codec<A, I, RD, RE>,
        input: unknown,
        message: string,
        options?: {
          readonly parseOptions?: AST.ParseOptions | undefined
          readonly provide?: ReadonlyArray<readonly [ServiceMap.Key<any, any>, any]> | undefined
        } | undefined
      ) {
        const decoded = ToParser.decodeUnknownEffect(schema)(input, options?.parseOptions)
        let provided = decoded
        if (options?.provide) {
          for (const [tag, value] of options.provide) {
            provided = Effect.provideService(provided, tag, value)
          }
        }
        return out.effect.fail(provided, message)
      }
    },

    encoding: {
      /**
       * Attempts to encode the given input using the provided schema. If the
       * decoding is successful, the decoded value is compared to the expected
       * value. Otherwise the test fails.
       */
      async succeed<const A, const I, RD, RE>(
        schema: Schema.Codec<A, I, RD, RE>,
        input: A,
        options?: {
          expected?: I
          readonly parseOptions?: AST.ParseOptions | undefined
        } | undefined
      ) {
        // Account for `expected` being `undefined`
        const encoded = ToParser.encodeUnknownEffect(schema)(input, options?.parseOptions)
        return out.effect.succeed(
          Effect.catch(encoded, (issue) => Effect.fail(issue.toString())),
          options && Object.hasOwn(options, "expected") ? options.expected : input
        )
      },

      /**
       * Attempts to encode the given input using the provided schema. If the
       * decoding fails, the error message is compared to the expected message.
       * Otherwise the test fails.
       */
      async fail<const A, const I, RD, RE>(
        schema: Schema.Codec<A, I, RD, RE>,
        input: unknown,
        message: string,
        options?: {
          readonly parseOptions?: AST.ParseOptions | undefined
        } | undefined
      ) {
        const encoded = ToParser.encodeUnknownEffect(schema)(input, options?.parseOptions)
        return out.effect.fail(encoded, message)
      }
    },

    effect: {
      /**
       * Verifies that the effect succeeds with the expected value.
       */
      async succeed<const A, E, R>(
        effect: Effect.Effect<A, E, R>,
        a: A
      ) {
        const r = Effect.result(effect) as Effect.Effect<Result.Result<A, E>>
        deepStrictEqual(await Effect.runPromise(r), Result.succeed(a))
      },

      /**
       * Verifies that the effect fails with the expected message.
       */
      async fail<A, R>(
        effect: Effect.Effect<A, Issue.Issue, R>,
        message: string
      ) {
        const effectWithMessage = Effect.catch(
          effect,
          (issue) => Effect.fail(issue.toString())
        )
        const r = Effect.result(effectWithMessage) as Effect.Effect<Result.Result<A, string>>
        return out.result.fail(await Effect.runPromise(r), message)
      }
    },

    result: {
      /**
       * Verifies that the Result is an `Ok` with the expected value.
       */
      succeed<const A, E>(result: Result.Result<A, E>, right: A) {
        if (Result.isSuccess(result)) {
          deepStrictEqual(result.success, right)
        } else {
          // eslint-disable-next-line no-console
          console.log(result.failure)
          fail(`expected a Success, got a Failure: ${result.failure}`)
        }
      },

      /**
       * Verifies that the Result is an `Err` with the expected value.
       */
      fail<A, const E>(result: Result.Result<A, E>, err: E | ((err: E) => void)) {
        if (Result.isFailure(result)) {
          if (Predicate.isFunction(err)) {
            err(result.failure)
          } else {
            deepStrictEqual(result.failure, err)
          }
        } else {
          // eslint-disable-next-line no-console
          console.log(result.success)
          fail(`expected a Failure, got a Success: ${result.success}`)
        }
      },

      /**
       * Verifies that the Result is an `Err` with the expected message.
       */
      async failMessage<A>(encoded: Result.Result<A, Issue.Issue>, message: string | ((message: string) => void)) {
        const encodedWithMessage = Effect.gen(function*() {
          if (Result.isFailure(encoded)) {
            const message = encoded.failure.toString()
            return yield* Effect.fail(message)
          }
          return encoded.success
        })
        const result = await Effect.runPromise(Effect.result(encodedWithMessage))
        out.result.fail(result, message)
      }
    },

    asserts: {
      succeed<T, E, RE>(schema: Schema.Codec<T, E, never, RE>, input: unknown) {
        deepStrictEqual(Schema.asserts(schema)(input), undefined)
      },

      fail<T, E, RE>(schema: Schema.Codec<T, E, never, RE>, input: unknown, message: string) {
        throws(() => Schema.asserts(schema)(input), (err) => {
          assertInstanceOf(err, Error)
          strictEqual(err.message, message)
        })
      }
    }
  }

  return out
}

function validate<I, A>(
  schema: StandardSchemaV1<I, A>,
  input: unknown
): StandardSchemaV1.Result<A> | Promise<StandardSchemaV1.Result<A>> {
  return schema["~standard"].validate(input)
}

const isPromise = (value: unknown): value is Promise<unknown> => value instanceof Promise

const expectSuccess = <A>(
  result: StandardSchemaV1.Result<A>,
  a: A
) => {
  deepStrictEqual(result, { value: a })
}

const expectFailure = <A>(
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

export const standard = {
  expectSyncSuccess,
  expectSyncFailure,
  expectAsyncSuccess,
  expectAsyncFailure
}
