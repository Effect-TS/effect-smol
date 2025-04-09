import type { Schema, SchemaAST } from "effect"
import { Effect, Result, SchemaFormatter, SchemaParser } from "effect"

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
    makeUnsafe: {
      /**
       * Ensures that the given constructor produces the expected value.
       */
      succeed<const A, const B>(
        // Destructure to verify that "this" type is bound
        { makeUnsafe }: { readonly makeUnsafe: (a: A) => B },
        input: A,
        expected?: B
      ) {
        deepStrictEqual(makeUnsafe(input), expected ?? input)
      },

      /**
       * Ensures that the given constructor throws the expected error.
       */
      fail<const A, const B>(
        // Destructure to verify that "this" type is bound
        { make }: { readonly make: (a: A) => B },
        input: A,
        message: string
      ) {
        throws(() => make(input), (err) => {
          assertInstanceOf(err, Error)
          strictEqual(err.message, message)
        })
      }
    },

    decoding: {
      /**
       * Attempts to decode the given input using the provided schema. If the
       * decoding is successful, the decoded value is compared to the expected
       * value. Otherwise the test fails.
       */
      async succeed<const A, I>(
        schema: Schema.Codec<A, I>,
        input: unknown,
        expected?: A,
        options?: {
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
        } | undefined
      ) {
        // Account for `expected` being `undefined`
        const ex = arguments.length >= 3 ? expected : expected ?? input
        const decoded = SchemaParser.decodeUnknownParserResult(schema)(input, options?.parseOptions)
        const eff = Result.isResult(decoded) ? Effect.fromResult(decoded) : decoded
        return out.effect.succeed(
          Effect.catch(eff, (issue) => Effect.fail(SchemaFormatter.TreeFormatter.format(issue))),
          ex
        )
      },

      /**
       * Attempts to decode the given input using the provided schema. If the
       * decoding fails, the error message is compared to the expected message.
       * Otherwise the test fails.
       */
      async fail<A, I>(
        schema: Schema.Codec<A, I>,
        input: unknown,
        message: string,
        options?: {
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
        } | undefined
      ) {
        const decoded = SchemaParser.decodeUnknownParserResult(schema)(input, options?.parseOptions)
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
      async succeed<const A, const I>(
        schema: Schema.Codec<A, I>,
        input: A,
        expected?: I,
        options?: {
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
        } | undefined
      ) {
        // Account for `expected` being `undefined`
        const ex = arguments.length >= 3 ? expected : expected ?? input
        const encoded = SchemaParser.encodeUnknownParserResult(schema)(input, options?.parseOptions)
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
      async fail<const A, I>(
        schema: Schema.Codec<A, I>,
        input: A,
        message: string,
        options?: {
          readonly parseOptions?: SchemaAST.ParseOptions | undefined
        } | undefined
      ) {
        const encoded = SchemaParser.encodeUnknownParserResult(schema)(input, options?.parseOptions)
        const eff = Result.isResult(encoded) ? Effect.fromResult(encoded) : encoded
        return out.effect.fail(eff, message)
      }
    },

    effect: {
      /**
       * Verifies that the effect succeeds with the expected value.
       */
      async succeed<const A, E>(
        effect: Effect.Effect<A, E>,
        a: A
      ) {
        deepStrictEqual(await Effect.runPromise(Effect.result(effect)), Result.ok(a))
      },

      /**
       * Verifies that the effect fails with the expected message.
       */
      async fail<A>(
        effect: Effect.Effect<A, SchemaAST.Issue>,
        message: string
      ) {
        const effectWithMessage = Effect.gen(function*() {
          const decoded = yield* Effect.result(effect)
          if (Result.isErr(decoded)) {
            const message = yield* SchemaFormatter.TreeFormatter.format(decoded.err)
            return yield* Effect.fail(message)
          }
          return decoded.ok
        })
        const result = await Effect.runPromise(Effect.result(effectWithMessage))
        return out.result.err(result, message)
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
            const message = yield* SchemaFormatter.TreeFormatter.format(encoded.err)
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
