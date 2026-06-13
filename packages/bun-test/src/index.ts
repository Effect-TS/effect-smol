/**
 * @since 4.0.0
 */
import type * as Duration from "effect/Duration"
import type * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import type * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import type * as FC from "effect/testing/FastCheck"
import * as internal from "./internal/internal.ts"

import * as bt from "bun:test"

/**
 * Re-exported primitives from Bun's built-in test runner.
 *
 * Bun (1.2.x) does not currently support `export ... from "bun:test"`, so we
 * re-export each symbol via a const binding.
 *
 * @since 4.0.0
 */
export const afterAll = bt.afterAll
/** @since 4.0.0 */
export const afterEach = bt.afterEach
/** @since 4.0.0 */
export const beforeAll = bt.beforeAll
/** @since 4.0.0 */
export const beforeEach = bt.beforeEach
/** @since 4.0.0 */
export const describe = bt.describe
/** @since 4.0.0 */
export const expect = bt.expect
/** @since 4.0.0 */
export const jest = bt.jest
/** @since 4.0.0 */
export const mock = bt.mock
/** @since 4.0.0 */
export const setSystemTime = bt.setSystemTime
/** @since 4.0.0 */
export const spyOn = bt.spyOn
/** @since 4.0.0 */
export const test = bt.test

/**
 * A minimal stand-in for Vitest's `TestContext`. Bun's test runner doesn't pass
 * a context object to the test function, so this is synthesised by the test
 * wrapper.
 *
 * @since 4.0.0
 */
export interface TestContext {
  readonly signal: AbortSignal
  onTestFinished(fn: () => void | Promise<void>): void
  onTestFailed(fn: () => void | Promise<void>): void
}

/**
 * Options accepted by every test registrar in this package.
 *
 * @since 4.0.0
 */
export interface TestOptions {
  readonly timeout?: number
  readonly retry?: number
  readonly repeats?: number
  readonly skip?: boolean
  readonly only?: boolean
  readonly todo?: boolean
  readonly fails?: boolean
}

/**
 * @since 4.0.0
 */
export type API = TestCollectorCallable

interface TestCollectorCallable {
  (
    name: string,
    fn: (ctx: TestContext) => unknown | Promise<unknown>,
    options?: number | TestOptions
  ): void
  (
    name: string,
    options: TestOptions,
    fn: (ctx: TestContext) => unknown | Promise<unknown>
  ): void
}

/**
 * @since 4.0.0
 */
export namespace BunTest {
  /**
   * @since 4.0.0
   */
  export interface TestFunction<A, E, R, TestArgs extends Array<any>> {
    (...args: TestArgs): Effect.Effect<A, E, R>
  }

  /**
   * @since 4.0.0
   */
  export interface Test<R> {
    <A, E>(
      name: string,
      self: TestFunction<A, E, R, [TestContext]>,
      timeout?: number | TestOptions
    ): void
  }

  /**
   * @since 4.0.0
   */
  export type Arbitraries =
    | Array<Schema.Schema<any> | FC.Arbitrary<any>>
    | { [K in string]: Schema.Schema<any> | FC.Arbitrary<any> }

  /**
   * @since 4.0.0
   */
  export interface Tester<R> extends BunTest.Test<R> {
    skip: BunTest.Test<R>
    skipIf: (condition: unknown) => BunTest.Test<R>
    runIf: (condition: unknown) => BunTest.Test<R>
    only: BunTest.Test<R>
    each: <T>(
      cases: ReadonlyArray<T>
    ) => <A, E>(name: string, self: TestFunction<A, E, R, Array<T>>, timeout?: number | TestOptions) => void
    fails: BunTest.Test<R>

    /**
     * @since 4.0.0
     */
    prop: <const Arbs extends Arbitraries, A, E>(
      name: string,
      arbitraries: Arbs,
      self: TestFunction<
        A,
        E,
        R,
        [
          {
            [K in keyof Arbs]: Arbs[K] extends FC.Arbitrary<infer T> ? T
              : Arbs[K] extends Schema.Schema<infer T> ? T
              : never
          },
          TestContext
        ]
      >,
      timeout?:
        | number
        | TestOptions & {
          fastCheck?: FC.Parameters<
            {
              [K in keyof Arbs]: Arbs[K] extends FC.Arbitrary<infer T> ? T
                : Arbs[K] extends Schema.Schema<infer T> ? T
                : never
            }
          >
        }
    ) => void
  }

  /**
   * @since 4.0.0
   */
  export interface MethodsNonLive<R = never> extends API {
    readonly effect: BunTest.Tester<R | Scope.Scope>
    readonly flakyTest: <A, E, R2>(
      self: Effect.Effect<A, E, R2 | Scope.Scope>,
      timeout?: Duration.Input
    ) => Effect.Effect<A, never, R2>
    readonly layer: <R2, E>(layer: Layer.Layer<R2, E, R>, options?: {
      readonly timeout?: Duration.Input
    }) => {
      (f: (it: BunTest.MethodsNonLive<R | R2>) => void): void
      (
        name: string,
        f: (it: BunTest.MethodsNonLive<R | R2>) => void
      ): void
    }

    /**
     * @since 4.0.0
     */
    readonly prop: <const Arbs extends Arbitraries>(
      name: string,
      arbitraries: Arbs,
      self: (
        properties: {
          [K in keyof Arbs]: Arbs[K] extends FC.Arbitrary<infer T> ? T
            : Arbs[K] extends Schema.Schema<infer T> ? T
            : never
        },
        ctx: TestContext
      ) => void,
      timeout?:
        | number
        | TestOptions & {
          fastCheck?: FC.Parameters<
            {
              [K in keyof Arbs]: Arbs[K] extends FC.Arbitrary<infer T> ? T
                : Arbs[K] extends Schema.Schema<infer T> ? T
                : never
            }
          >
        }
    ) => void
  }

  /**
   * @since 4.0.0
   */
  export interface Methods<R = never> extends MethodsNonLive<R> {
    readonly live: BunTest.Tester<Scope.Scope | R>
    readonly layer: <R2, E>(layer: Layer.Layer<R2, E, R>, options?: {
      readonly memoMap?: Layer.MemoMap
      readonly timeout?: Duration.Input
      readonly excludeTestServices?: boolean
    }) => {
      (f: (it: BunTest.MethodsNonLive<R | R2>) => void): void
      (
        name: string,
        f: (it: BunTest.MethodsNonLive<R | R2>) => void
      ): void
    }
  }
}

/**
 * `bun:test`'s `expect` does not currently expose `addEqualityTesters`, so this
 * is a no-op kept for API parity with `@effect/vitest`. Compare values that
 * implement the `Equal` trait with `Equal.equals` (or the helpers in
 * `@effect/bun-test/utils`) instead.
 *
 * @since 4.0.0
 */
export const addEqualityTesters: () => void = internal.addEqualityTesters

/**
 * @since 4.0.0
 */
export const effect: BunTest.Tester<Scope.Scope> = internal.effect

/**
 * @since 4.0.0
 */
export const live: BunTest.Tester<Scope.Scope> = internal.live

/**
 * Share a `Layer` between multiple tests, optionally wrapping the tests in a
 * `describe` block if a name is provided.
 *
 * @since 4.0.0
 */
export const layer: <R, E>(
  layer_: Layer.Layer<R, E>,
  options?: {
    readonly memoMap?: Layer.MemoMap
    readonly timeout?: Duration.Input
    readonly excludeTestServices?: boolean
  }
) => {
  (f: (it: BunTest.MethodsNonLive<R>) => void): void
  (name: string, f: (it: BunTest.MethodsNonLive<R>) => void): void
} = internal.layer

/**
 * @since 4.0.0
 */
export const flakyTest: <A, E, R>(
  self: Effect.Effect<A, E, R | Scope.Scope>,
  timeout?: Duration.Input
) => Effect.Effect<A, never, R> = internal.flakyTest

/**
 * @since 4.0.0
 */
export const prop: BunTest.Methods["prop"] = internal.prop

/** @ignored */
const methods = { effect, live, flakyTest, layer, prop } as const

/**
 * @since 4.0.0
 */
export const it: BunTest.Methods = Object.assign(internal.defaultApi, methods)

/**
 * @since 4.0.0
 */
export const makeMethods: (it: API) => BunTest.Methods = internal.makeMethods

/**
 * @since 4.0.0
 */
export const describeWrapped: (name: string, f: (it: BunTest.Methods) => void) => void = internal.describeWrapped
