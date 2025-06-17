import type { Context } from "effect"
import {
  Effect,
  FastCheck,
  Predicate,
  Record,
  Result,
  Schema,
  SchemaAST,
  SchemaFormatter,
  SchemaIssue,
  SchemaResult,
  SchemaSerializer,
  SchemaToArbitrary,
  SchemaToParser
} from "effect"
import { deepStrictEqual, fail, strictEqual, throws } from "./assert.js"

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
      format: (schema: Schema.Top, expected: string) => {
        strictEqual(SchemaAST.format(schema.ast), expected)
      },

      fields: {
        equals: (a: Schema.Struct.Fields, b: Schema.Struct.Fields) => {
          deepStrictEqual(Record.map(a, SchemaAST.getAST), Record.map(b, SchemaAST.getAST))
        }
      },

      elements: {
        equals: (a: Schema.Tuple.Elements, b: Schema.Tuple.Elements) => {
          deepStrictEqual(a.map(SchemaAST.getAST), b.map(SchemaAST.getAST))
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
        const arb = SchemaToArbitrary.make(schema)
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
          if (SchemaIssue.isIssue(e)) {
            strictEqual(SchemaFormatter.TreeFormatter.format(e), message)
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
      ok<const A, E>(result: Result.Result<A, E>, right: A) {
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
      err<A, const E>(result: Result.Result<A, E>, err: E | ((err: E) => void)) {
        if (Result.isErr(result)) {
          if (Predicate.isFunction(err)) {
            err(result.err)
          } else {
            deepStrictEqual(result.err, err)
          }
        } else {
          // eslint-disable-next-line no-console
          console.log(result.ok)
          fail(`expected an Err, got an Ok: ${result.ok}`)
        }
      },

      /**
       * Verifies that the Result is an `Err` with the expected value.
       */
      async fail<A>(encoded: Result.Result<A, SchemaIssue.Issue>, message: string | ((message: string) => void)) {
        const encodedWithMessage = Effect.gen(function*() {
          if (Result.isErr(encoded)) {
            const message = SchemaFormatter.TreeFormatter.format(encoded.err)
            return yield* Effect.fail(message)
          }
          return encoded.ok
        })
        const result = await Effect.runPromise(Effect.result(encodedWithMessage))
        out.result.err(result, message)
      }
    },

    asserts: {
      succeed<T, E, RE>(schema: Schema.Codec<T, E, never, RE>, input: unknown) {
        deepStrictEqual(Schema.asserts(schema)(input), undefined)
      },

      fail<T, E, RE>(schema: Schema.Codec<T, E, never, RE>, input: unknown) {
        throws(() => Schema.asserts(schema)(input), (err) => {
          assertInstanceOf(err, Error)
          strictEqual(err.message, "asserts failure")
        })
      }
    }
  }

  return out
}
