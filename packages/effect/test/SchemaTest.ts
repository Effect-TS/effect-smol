import type { Context, SchemaAST, SchemaIssue } from "effect"
import { Effect, Result, Schema, SchemaFormatter, SchemaResult, SchemaSerializer, SchemaToParser } from "effect"

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
      async succeed<S extends Schema.Top>(
        schema: S,
        input: S["~type.make.in"],
        expected?: S["Type"]
      ) {
        return out.effect.succeed(
          SchemaResult.asEffect(SchemaToParser.makeSchemaResult(schema)(input)),
          expected === undefined ? input : expected
        )
      },

      async fail<S extends Schema.Top>(
        schema: S,
        input: S["~type.make.in"],
        message: string,
        options?: Schema.MakeOptions
      ) {
        return out.effect.fail(SchemaResult.asEffect(SchemaToParser.makeSchemaResult(schema)(input, options)), message)
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
        input: S["~type.make.in"]
      ) {
        throws(() => schema.makeSync(input), (err) => {
          assertInstanceOf(err, Error)
          strictEqual(err.message, "makeSync failure")
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
          return out.effect.succeed(
            Schema.encodeEffect(SchemaSerializer.json(Schema.typeCodec(schema)))(input),
            arguments.length > 2 ? expected : input
          )
        },

        async fail<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: A,
          message: string
        ) {
          return out.effect.fail(
            Schema.encodeEffect(SchemaSerializer.json(Schema.typeCodec(schema)))(input).pipe(
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
            SchemaSerializer.json(schema),
            input,
            { expected: arguments.length > 2 ? expected : input }
          )
        },

        async fail<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: A,
          message: string
        ) {
          return out.encoding.fail(SchemaSerializer.json(schema), input, message)
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
          return out.effect.succeed(
            Schema.decodeEffect(SchemaSerializer.json(Schema.typeCodec(schema)))(input),
            arguments.length > 2 ? expected : input
          )
        },

        async fail<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: unknown,
          message: string
        ) {
          return out.effect.fail(
            Schema.decodeEffect(SchemaSerializer.json(Schema.typeCodec(schema)))(input).pipe(
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
            SchemaSerializer.json(schema),
            input,
            { expected: arguments.length > 2 ? expected : input }
          )
        },

        async fail<const A, const I, RD, RE>(
          schema: Schema.Codec<A, I, RD, RE>,
          input: unknown,
          message: string
        ) {
          return out.decoding.fail(SchemaSerializer.json(schema), input, message)
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
        const decoded = SchemaToParser.decodeUnknownSchemaResult(schema)(input, options?.parseOptions)
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
        const decoded = SchemaToParser.decodeUnknownSchemaResult(schema)(input, options?.parseOptions)
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
        const encoded = SchemaToParser.encodeUnknownSchemaResult(schema)(input, options?.parseOptions)
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
        const encoded = SchemaToParser.encodeUnknownSchemaResult(schema)(input, options?.parseOptions)
        return out.effect.fail(SchemaResult.asEffect(encoded), message)
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
       * Verifies that the Result is an `Ok` with the expected value.
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
       * Verifies that the Result is an `Err` with the expected value.
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
       * Verifies that the Result is an `Err` with the expected value.
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
