import type { Context, SchemaAST, SchemaIssue } from "effect"
import { Effect, Result, Schema, SchemaFormatter, SchemaResult, SchemaSerializerJson, SchemaValidator } from "effect"

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
      equals: <A, I, RD, RE>(a: Schema.Codec<A, I, RD, RE>, b: Schema.Codec<A, I, RD, RE>) => {
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
        input: A,
        message: string
      ) {
        throws(() => makeUnsafe(input), (err) => {
          assertInstanceOf(err, Error)
          strictEqual(err.message, message)
        })
      }
    },

    serialization: {
      schema: {
        async succeed<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: A,
          expected?: unknown
        ) {
          return out.encoding.succeed(
            SchemaSerializerJson.make(Schema.typeCodec(schema)),
            input,
            { expected: arguments.length > 2 ? expected : input }
          )
        },

        async fail<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: A,
          message: string
        ) {
          return out.encoding.fail(SchemaSerializerJson.make(Schema.typeCodec(schema)), input, message)
        }
      },

      codec: {
        async succeed<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: A,
          expected?: unknown
        ) {
          return out.encoding.succeed(
            SchemaSerializerJson.make(schema),
            input,
            { expected: arguments.length > 2 ? expected : input }
          )
        },

        async fail<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: A,
          message: string
        ) {
          return out.encoding.fail(SchemaSerializerJson.make(schema), input, message)
        }
      }
    },

    deserialization: {
      schema: {
        async succeed<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: unknown,
          expected?: A
        ) {
          return out.decoding.succeed(
            SchemaSerializerJson.make(Schema.typeCodec(schema)),
            input,
            { expected: arguments.length > 2 ? expected : input }
          )
        },

        async fail<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: unknown,
          message: string
        ) {
          return out.decoding.fail(SchemaSerializerJson.make(Schema.typeCodec(schema)), input, message)
        }
      },

      codec: {
        async succeed<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: unknown,
          expected?: A
        ) {
          return out.decoding.succeed(
            SchemaSerializerJson.make(schema),
            input,
            { expected: arguments.length > 2 ? expected : input }
          )
        },

        async fail<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: unknown,
          message: string
        ) {
          return out.decoding.fail(SchemaSerializerJson.make(schema), input, message)
        }
      }
    },

    decoding: {
      async succeed<const A, const I, RD, RE>(
        schema: Schema.Codec<A, I, RD, RE>,
        input: unknown,
        options?: {
          readonly expected?: A
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
          readonly provide?: ReadonlyArray<readonly [Context.Tag<any, any>, any]> | undefined
        } | undefined
      ) {
        const decoded = SchemaValidator.decodeUnknownSchemaResult(schema)(input, options?.parseOptions)
        const eff = Result.isResult(decoded) ? Effect.fromResult(decoded) : decoded
        const effWithMessage = Effect.catch(eff, (issue) => Effect.fail(SchemaFormatter.TreeFormatter.format(issue)))
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
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
          readonly provide?: ReadonlyArray<readonly [Context.Tag<any, any>, any]> | undefined
        } | undefined
      ) {
        const decoded = SchemaValidator.decodeUnknownSchemaResult(schema)(input, options?.parseOptions)
        const eff = Result.isResult(decoded) ? Effect.fromResult(decoded) : decoded
        let provided = eff
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
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
        } | undefined
      ) {
        // Account for `expected` being `undefined`
        const encoded = SchemaValidator.encodeUnknownSchemaResult(schema)(input, options?.parseOptions)
        const eff = Result.isResult(encoded) ? Effect.fromResult(encoded) : encoded
        return out.effect.succeed(
          Effect.catch(eff, (issue) => Effect.fail(SchemaFormatter.TreeFormatter.format(issue))),
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
        effect: Effect.Effect<A, SchemaIssue.Issue, R>,
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
      async fail<R>(encoded: Result.Result<R, SchemaIssue.Issue>, message: string) {
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
