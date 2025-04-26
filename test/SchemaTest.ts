import type { SchemaAST } from "effect"
import { Effect, Result, Schema, SchemaFormatter, SchemaResult, SchemaToJson, SchemaValidator } from "effect"

export const assertions = (asserts: {
  readonly deepStrictEqual: (actual: unknown, expected: unknown) => void
  readonly strictEqual: (actual: unknown, expected: unknown, message?: string) => void
  readonly throws: (thunk: () => void, error?: Error | ((u: unknown) => undefined)) => void
  readonly fail: (message: string) => void
}) => {
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
    ast: {
      equals: <A, I, RD, RE, RI>(a: Schema.Codec<A, I, RD, RE, RI>, b: Schema.Codec<A, I, RD, RE, RI>) => {
        deepStrictEqual(a.ast, b.ast)
      }
    },

    make: {
      async succeed<const A>(
        // Destructure to verify that "this" type is bound
        { make }: { readonly make: (a: A) => SchemaResult.SchemaResult<A, never> },
        input: A,
        expected?: A
      ) {
        return out.effect.succeed(SchemaResult.asEffect(make(input)), expected === undefined ? input : expected)
      },

      async fail<const A>(
        // Destructure to verify that "this" type is bound
        { make }: {
          readonly make: (a: A, options?: Schema.MakeOptions) => SchemaResult.SchemaResult<A, never>
        },
        input: A,
        message: string,
        options?: Schema.MakeOptions
      ) {
        return out.effect.fail(SchemaResult.asEffect(make(input, options)), message)
      }
    },

    makeUnsafe: {
      /**
       * Ensures that the given constructor produces the expected value.
       */
      succeed<const A>(
        // Destructure to verify that "this" type is bound
        { makeUnsafe }: { readonly makeUnsafe: (a: A) => A },
        input: A,
        expected?: A
      ) {
        deepStrictEqual(makeUnsafe(input), expected === undefined ? input : expected)
      },

      /**
       * Ensures that the given constructor throws the expected error.
       */
      fail<const A>(
        // Destructure to verify that "this" type is bound
        { makeUnsafe }: { readonly makeUnsafe: (a: A, options?: Schema.MakeOptions) => A },
        input: A
      ) {
        throws(() => makeUnsafe(input), (err) => {
          assertInstanceOf(err, Error)
          strictEqual(err.message, "makeUnsafe failure") // TODO: assert that cause is issue
        })
      }
    },

    serialization: {
      schema: {
        async succeed<const A, const I, RD, RE, RI>(
          schema: Schema.Codec<A, I, RD, RE, RI>,
          input: A,
          expected?: SchemaToJson.Json
        ) {
          return out.encoding.succeed(
            SchemaToJson.serializer(Schema.typeCodec(schema)),
            input,
            expected === undefined ? input : expected
          )
        },

        async fail<const A, const I, RD, RE, RI>(
          schema: Schema.Codec<A, I, RD, RE, RI>,
          input: A,
          message: string
        ) {
          return out.encoding.fail(SchemaToJson.serializer(Schema.typeCodec(schema)), input, message)
        }
      },

      codec: {
        async succeed<const A, const I, RD, RE, RI>(
          schema: Schema.Codec<A, I, RD, RE, RI>,
          input: A,
          expected?: SchemaToJson.Json
        ) {
          return out.encoding.succeed(
            SchemaToJson.serializer(schema),
            input,
            expected === undefined ? input : expected
          )
        },

        async fail<const A, const I, RD, RE, RI>(
          schema: Schema.Codec<A, I, RD, RE, RI>,
          input: A,
          message: string
        ) {
          return out.encoding.fail(SchemaToJson.serializer(schema), input, message)
        }
      }
    },

    deserialization: {
      schema: {
        async succeed<const A, const I, RD, RE, RI>(
          schema: Schema.Codec<A, I, RD, RE, RI>,
          input: SchemaToJson.Json,
          expected?: A
        ) {
          return out.decoding.succeed(
            SchemaToJson.serializer(Schema.typeCodec(schema)),
            input,
            expected === undefined ? input : expected
          )
        },

        async fail<const A, const I, RD, RE, RI>(
          schema: Schema.Codec<A, I, RD, RE, RI>,
          input: SchemaToJson.Json,
          message: string
        ) {
          return out.decoding.fail(SchemaToJson.serializer(Schema.typeCodec(schema)), input, message)
        }
      },

      codec: {
        async succeed<const A, const I, RD, RE, RI>(
          schema: Schema.Codec<A, I, RD, RE, RI>,
          input: SchemaToJson.Json,
          expected?: A
        ) {
          return out.decoding.succeed(
            SchemaToJson.serializer(schema),
            input,
            expected === undefined ? input : expected
          )
        },

        async fail<const A, const I, RD, RE, RI>(
          schema: Schema.Codec<A, I, RD, RE, RI>,
          input: SchemaToJson.Json,
          message: string
        ) {
          return out.decoding.fail(SchemaToJson.serializer(schema), input, message)
        }
      }
    },

    decoding: {
      async succeed<const A, const I, RD, RE, RI>(
        schema: Schema.Codec<A, I, RD, RE, RI>,
        input: unknown,
        expected?: A,
        options?: {
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
        } | undefined
      ) {
        const decoded = SchemaValidator.decodeUnknownSchemaResult(schema)(input, options?.parseOptions)
        const eff = Result.isResult(decoded) ? Effect.fromResult(decoded) : decoded
        return out.effect.succeed(
          Effect.catch(eff, (issue) => Effect.fail(SchemaFormatter.TreeFormatter.format(issue))),
          arguments.length >= 3 ? expected : expected === undefined ? input : expected
        )
      },

      /**
       * Attempts to decode the given input using the provided schema. If the
       * decoding fails, the error message is compared to the expected message.
       * Otherwise the test fails.
       */
      async fail<const A, const I, RD, RE, RI>(
        schema: Schema.Codec<A, I, RD, RE, RI>,
        input: unknown,
        message: string,
        options?: {
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
        } | undefined
      ) {
        const decoded = SchemaValidator.decodeUnknownSchemaResult(schema)(input, options?.parseOptions)
        const eff = Result.isResult(decoded) ? Effect.fromResult(decoded) : decoded
        return out.effect.fail(eff, message)
      }
    },

    encoding: {
      /**
       * Attempts to encode the given input using the provided schema. If the
       * decoding is successful, the decoded value is compared to the expected
       * value. Otherwise the test fails.
       */
      async succeed<const A, const I, RD, RE, RI>(
        schema: Schema.Codec<A, I, RD, RE, RI>,
        input: A,
        expected?: I,
        options?: {
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
        } | undefined
      ) {
        // Account for `expected` being `undefined`
        const ex = arguments.length >= 3 ? expected : expected === undefined ? input : expected
        const encoded = SchemaValidator.encodeUnknownSchemaResult(schema)(input, options?.parseOptions)
        const eff = Result.isResult(encoded) ? Effect.fromResult(encoded) : encoded
        return out.effect.succeed(
          Effect.catch(eff, (issue) => Effect.fail(SchemaFormatter.TreeFormatter.format(issue))),
          ex
        )
      },

      /**
       * Attempts to encode the given input using the provided schema. If the
       * decoding fails, the error message is compared to the expected message.
       * Otherwise the test fails.
       */
      async fail<const A, const I, RD, RE, RI>(
        schema: Schema.Codec<A, I, RD, RE, RI>,
        input: A,
        message: string,
        options?: {
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
        } | undefined
      ) {
        const encoded = SchemaValidator.encodeUnknownSchemaResult(schema)(input, options?.parseOptions)
        const eff = Result.isResult(encoded) ? Effect.fromResult(encoded) : encoded
        return out.effect.fail(eff, message)
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
        deepStrictEqual(await Effect.runPromise(r), Result.ok(a))
      },

      /**
       * Verifies that the effect fails with the expected message.
       */
      async fail<A, R>(
        effect: Effect.Effect<A, SchemaAST.Issue, R>,
        message: string
      ) {
        const effectWithMessage = Effect.catch(
          effect,
          (issue) => Effect.fail(SchemaFormatter.TreeFormatter.format(issue))
        )
        const r = Effect.result(effectWithMessage) as Effect.Effect<Result.Result<A, string>>
        return out.result.err(await Effect.runPromise(r), message)
      }
    },

    result: {
      /**
       * Verifies that the either is a `Right` with the expected value.
       */
      ok<const R, L>(result: Result.Result<R, L>, right: R) {
        if (Result.isOk(result)) {
          deepStrictEqual(result.ok, right)
        } else {
          // eslint-disable-next-line no-console
          console.log(result.err)
          fail(`expected an Ok, got an Err: ${result.err}`)
        }
      },

      /**
       * Verifies that the either is a `Left` with the expected value.
       */
      err<R, const L>(result: Result.Result<R, L>, left: L) {
        if (Result.isErr(result)) {
          deepStrictEqual(result.err, left)
        } else {
          // eslint-disable-next-line no-console
          console.log(result.ok)
          fail(`expected an Err, got an Ok: ${result.ok}`)
        }
      },

      /**
       * Verifies that the either is a left with the expected value.
       */
      async fail<R>(encoded: Result.Result<R, SchemaAST.Issue>, message: string) {
        const encodedWithMessage = Effect.gen(function*() {
          if (Result.isErr(encoded)) {
            const message = SchemaFormatter.TreeFormatter.format(encoded.err)
            return yield* Effect.fail(message)
          }
          return encoded.ok
        })
        const result = await Effect.runPromise(Effect.result(encodedWithMessage))
        return out.result.err(result, message)
      }
    }
  }

  return out
}
