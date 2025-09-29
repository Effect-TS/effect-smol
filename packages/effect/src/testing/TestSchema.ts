/**
 * Testing utilities for Schema validation and assertions.
 *
 * @since 4.0.0
 */
import * as assert from "node:assert"
import * as Record from "../data/Record.ts"
import * as Result from "../data/Result.ts"
import * as Effect from "../Effect.ts"
import * as AST from "../schema/AST.ts"
import type * as Issue from "../schema/Issue.ts"
import * as Schema from "../schema/Schema.ts"
import * as ToArbitrary from "../schema/ToArbitrary.ts"
import * as ToParser from "../schema/ToParser.ts"
import type * as ServiceMap from "../ServiceMap.ts"
import * as FastCheck from "../testing/FastCheck.ts"

/**
 * The `Asserts` class provides a comprehensive testing framework for schema validation,
 * encoding/decoding operations, and property-based testing.
 *
 * @since 4.0.0
 */
export class Asserts<S extends Schema.Top> {
  static ast = {
    /** Asserts that two struct field definitions are equal by comparing their AST representations. */
    fields: {
      equals: (a: Schema.Struct.Fields, b: Schema.Struct.Fields) => {
        assert.deepStrictEqual(Record.map(a, AST.getAST), Record.map(b, AST.getAST))
      }
    },
    /** Asserts that two tuple element definitions are equal by comparing their AST representations. */
    elements: {
      equals: (a: Schema.Tuple.Elements, b: Schema.Tuple.Elements) => {
        assert.deepStrictEqual(a.map(AST.getAST), b.map(AST.getAST))
      }
    }
  } as const

  readonly schema: S
  constructor(schema: S) {
    this.schema = schema
  }
  /**
   * Provides make operation testing utilities.
   */
  make(options?: Schema.MakeOptions) {
    const makeEffect = ToParser.makeEffect(this.schema)
    async function succeed(input: S["Type"]): Promise<void>
    async function succeed(input: S["~type.make.in"], expected: S["Type"]): Promise<void>
    async function succeed(input: S["~type.make.in"], expected?: S["Type"]) {
      const r = await Effect.runPromise(
        makeEffect(input, options).pipe(
          Effect.mapError((issue) => issue.toString()),
          Effect.result
        )
      )
      expected = arguments.length === 1 ? input : expected
      assert.deepStrictEqual(r, Result.succeed(expected))
    }
    return {
      succeed,
      /**
       * Asserts that make operation fails with the expected error message.
       */
      async fail(input: unknown, message: string) {
        const r = await Effect.runPromise(
          makeEffect(input, options).pipe(
            Effect.mapError((issue) => issue.toString()),
            Effect.result
          )
        )
        assert.deepStrictEqual(r, Result.fail(message))
      }
    }
  }
  /**
   * Verifies that encoding values produces the same type after decoding (round-trip).
   */
  verifyLosslessTransformation<S extends Schema.Codec<unknown, unknown>>(this: Asserts<S>, options?: {
    readonly params?: FastCheck.Parameters<[S["Type"]]>
  }) {
    const decodeUnknownEffect = ToParser.decodeUnknownEffect(this.schema)
    const encodeEffect = ToParser.encodeEffect(this.schema)
    const arbitrary = ToArbitrary.make(this.schema)
    return FastCheck.assert(
      FastCheck.asyncProperty(arbitrary, async (t) => {
        const r = await Effect.runPromise(
          encodeEffect(t).pipe(
            Effect.flatMap((e) => decodeUnknownEffect(e)),
            Effect.mapError((issue) => issue.toString()),
            Effect.result
          )
        )
        assert.deepStrictEqual(r, Result.succeed(t))
      }),
      options?.params
    )
  }
  /**
   * Provides decoding testing utilities.
   */
  decoding(options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  }) {
    return new Decoding(this.schema, options)
  }
  /**
   * Provides encoding testing utilities.
   */
  encoding(options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  }) {
    return new Encoding(this.schema, options)
  }
  /**
   * Provides property-based testing utilities for schema validation.
   */
  arbitrary<S extends Schema.Codec<unknown, unknown, never, unknown>>(this: Asserts<S>) {
    const schema = this.schema
    return {
      /**
       * Verifies that the schema generates valid arbitrary values that satisfy
       * the schema constraints.
       */
      verifyGeneration(options?: {
        readonly params?: FastCheck.Parameters<[S["Type"]]> | undefined
      }) {
        const params = options?.params
        const is = Schema.is(schema)
        const arb = ToArbitrary.make(schema)
        FastCheck.assert(FastCheck.property(arb, (a) => is(a)), { numRuns: 20, ...params })
      }
    }
  }
}

/**
 * @since 4.0.0
 */
export class Decoding<S extends Schema.Top> {
  readonly schema: S
  readonly decodeUnknownEffect: (
    input: unknown,
    options?: AST.ParseOptions
  ) => Effect.Effect<S["Type"], Issue.Issue, S["DecodingServices"]>
  readonly options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  } | undefined
  constructor(schema: S, options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  }) {
    this.schema = schema
    this.decodeUnknownEffect = ToParser.decodeUnknownEffect(schema)
    this.options = options
  }
  /**
   * Asserts that decoding succeeds with the expected value.
   */
  async succeed<S extends Schema.Codec<unknown, unknown, never, unknown>>(
    this: Decoding<S>,
    input: unknown
  ): Promise<void>
  async succeed<S extends Schema.Codec<unknown, unknown, never, unknown>>(
    this: Decoding<S>,
    input: unknown,
    expected: S["Type"]
  ): Promise<void>
  async succeed<S extends Schema.Codec<unknown, unknown, never, unknown>>(
    this: Decoding<S>,
    input: unknown,
    expected?: S["Type"]
  ) {
    const r = await Effect.runPromise(
      this.decodeUnknownEffect(input, this.options?.parseOptions).pipe(
        Effect.mapError((issue) => issue.toString()),
        Effect.result
      )
    )
    expected = arguments.length === 1 ? input : expected
    assert.deepStrictEqual(r, Result.succeed(expected))
  }
  /**
   * Asserts that decoding fails with the expected error message.
   */
  async fail<S extends Schema.Codec<unknown, unknown, never, unknown>>(
    this: Decoding<S>,
    input: unknown,
    message: string
  ) {
    const r = await Effect.runPromise(
      this.decodeUnknownEffect(input, this.options?.parseOptions).pipe(
        Effect.mapError((issue) => issue.toString()),
        Effect.result
      )
    )
    assert.deepStrictEqual(r, Result.fail(message))
  }
  /**
   * Creates a new Decoding instance with the provided service available in the
   * decoding context.
   */
  provide<Id, Service>(
    key: ServiceMap.Key<Id, Service>,
    service: Service
  ): Decoding<Schema.decodingMiddleware<S, Exclude<S["DecodingServices"], Id>>> {
    return new Decoding(
      this.schema.pipe(Schema.decodingMiddleware(Effect.provideService(key, service))),
      this.options
    )
  }
}

/**
 * @since 4.0.0
 */
class Encoding<S extends Schema.Top> {
  readonly schema: S
  readonly encodeUnknownEffect: (
    input: unknown,
    options?: AST.ParseOptions
  ) => Effect.Effect<S["Type"], Issue.Issue, S["EncodingServices"]>
  readonly options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  } | undefined
  constructor(schema: S, options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  }) {
    this.schema = schema
    this.encodeUnknownEffect = ToParser.encodeUnknownEffect(schema)
    this.options = options
  }
  /**
   * Asserts that encoding succeeds with the expected value.
   */
  async succeed<S extends Schema.Codec<unknown, unknown, unknown, never>>(
    this: Encoding<S>,
    input: unknown
  ): Promise<void>
  async succeed<S extends Schema.Codec<unknown, unknown, unknown, never>>(
    this: Encoding<S>,
    input: unknown,
    expected: S["Encoded"]
  ): Promise<void>
  async succeed<S extends Schema.Codec<unknown, unknown, unknown, never>>(
    this: Encoding<S>,
    input: unknown,
    expected?: S["Encoded"]
  ) {
    const r = await Effect.runPromise(
      this.encodeUnknownEffect(input, this.options?.parseOptions).pipe(
        Effect.mapError((issue) => issue.toString()),
        Effect.result
      )
    )
    expected = arguments.length === 1 ? input : expected
    assert.deepStrictEqual(r, Result.succeed(expected))
  }
  /**
   * Asserts that encoding fails with the expected error message.
   */
  async fail<S extends Schema.Codec<unknown, unknown, unknown, never>>(
    this: Encoding<S>,
    input: unknown,
    message: string
  ) {
    const r = await Effect.runPromise(
      this.encodeUnknownEffect(input, this.options?.parseOptions).pipe(
        Effect.mapError((issue) => issue.toString()),
        Effect.result
      )
    )
    assert.deepStrictEqual(r, Result.fail(message))
  }
  /**
   * Creates a new Encoding instance with the provided service available in the
   * encoding context.
   */
  provide<Id, Service>(
    key: ServiceMap.Key<Id, Service>,
    service: Service
  ): Encoding<Schema.encodingMiddleware<S, Exclude<S["EncodingServices"], Id>>> {
    return new Encoding(
      this.schema.pipe(Schema.encodingMiddleware(Effect.provideService(key, service))),
      this.options
    )
  }
}
