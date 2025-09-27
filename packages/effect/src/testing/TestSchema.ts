/**
 * @since 4.0.0
 */
import * as assert from "node:assert"
import * as Result from "../data/Result.ts"
import * as Effect from "../Effect.ts"
import type * as AST from "../schema/AST.ts"
import * as Schema from "../schema/Schema.ts"
import * as ToArbitrary from "../schema/ToArbitrary.ts"
import * as ToParser from "../schema/ToParser.ts"
import type * as ServiceMap from "../ServiceMap.ts"
import * as FastCheck from "../testing/FastCheck.ts"

/**
 * @since 4.0.0
 */
export class Asserts<S extends Schema.Top> {
  readonly schema: S
  constructor(schema: S) {
    this.schema = schema
  }
  provide<Id, Service>(
    key: ServiceMap.Key<Id, Service>,
    service: Service
  ): Asserts<Schema.decodingMiddleware<S, Exclude<S["DecodingServices"], Id>>> {
    return new Asserts(this.schema.pipe(
      Schema.decodingMiddleware(Effect.provideService(key, service))
    ))
  }
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
  roundtrip<S extends Schema.Codec<unknown, unknown, never, never>>(this: Asserts<S>, options?: {
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
  decoding<S extends Schema.Codec<unknown, unknown, never, unknown>>(this: Asserts<S>, options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  }) {
    const decodeUnknownEffect = ToParser.decodeUnknownEffect(this.schema)
    async function succeed(input: unknown): Promise<void>
    async function succeed(input: unknown, expected: S["Type"]): Promise<void>
    async function succeed(input: unknown, expected?: S["Type"]) {
      const r = await Effect.runPromise(
        decodeUnknownEffect(input, options?.parseOptions).pipe(
          Effect.mapError((issue) => issue.toString()),
          Effect.result
        )
      )
      expected = arguments.length === 1 ? input : expected
      assert.deepStrictEqual(r, Result.succeed(expected))
    }
    return {
      succeed,
      async fail(input: unknown, message: string) {
        const r = await Effect.runPromise(
          decodeUnknownEffect(input, options?.parseOptions).pipe(
            Effect.mapError((issue) => issue.toString()),
            Effect.result
          )
        )
        assert.deepStrictEqual(r, Result.fail(message))
      }
    }
  }
  encoding<S extends Schema.Codec<unknown, unknown, unknown, never>>(this: Asserts<S>, options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  }) {
    const encodeUnknownEffect = ToParser.encodeUnknownEffect(this.schema)
    async function succeed(input: unknown): Promise<void>
    async function succeed(input: unknown, expected: S["Encoded"]): Promise<void>
    async function succeed(input: unknown, expected?: S["Encoded"]) {
      const r = await Effect.runPromise(
        encodeUnknownEffect(input, options?.parseOptions).pipe(
          Effect.mapError((issue) => issue.toString()),
          Effect.result
        )
      )
      expected = arguments.length === 1 ? input : expected
      assert.deepStrictEqual(r, Result.succeed(expected))
    }
    return {
      succeed,
      async fail(input: unknown, message: string) {
        const r = await Effect.runPromise(
          encodeUnknownEffect(input, options?.parseOptions).pipe(
            Effect.mapError((issue) => issue.toString()),
            Effect.result
          )
        )
        assert.deepStrictEqual(r, Result.fail(message))
      }
    }
  }
}
