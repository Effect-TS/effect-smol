/**
 * @since 4.0.0
 */

import { afterAll, beforeAll, describe, test } from "bun:test"
import * as Cause from "effect/Cause"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { flow, pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import { isObject } from "effect/Predicate"
import * as Schedule from "effect/Schedule"
import * as Schema from "effect/Schema"
import * as Scope from "effect/Scope"
import * as fc from "effect/testing/FastCheck"
import * as TestClock from "effect/testing/TestClock"
import * as TestConsole from "effect/testing/TestConsole"
import type * as BunTest from "../index.ts"

// ----------------------------------------------------------------------------
// `bun:test` shape helpers
// ----------------------------------------------------------------------------

type BunTestFn = (ctx?: never) => void | Promise<void>

interface BunRegistrar {
  (name: string, fn: BunTestFn, options?: number | { timeout?: number; retry?: number }): void
}

interface BunTestApi extends BunRegistrar {
  skip: BunRegistrar
  only: BunRegistrar
  todo: BunRegistrar
  failing: BunRegistrar
  if: (condition: unknown) => BunRegistrar
  skipIf: (condition: unknown) => BunRegistrar
  todoIf: (condition: unknown) => BunRegistrar
  each: <T>(cases: ReadonlyArray<T>) => (
    name: string,
    fn: (value: T) => void | Promise<void>,
    options?: number | { timeout?: number; retry?: number }
  ) => void
}

const bunTest = test as unknown as BunTestApi

/** @internal */
const makeContext = (): BunTest.TestContext => {
  const onFinished: Array<() => void | Promise<void>> = []
  const onFailed: Array<() => void | Promise<void>> = []
  return {
    signal: new AbortController().signal,
    onTestFinished(fn) {
      onFinished.push(fn)
    },
    onTestFailed(fn) {
      onFailed.push(fn)
    },
    ...({ __finished: onFinished, __failed: onFailed } as any)
  }
}

const flush = async (ctx: BunTest.TestContext, failed: boolean): Promise<void> => {
  const finished = (ctx as unknown as { __finished: Array<() => void | Promise<void>> }).__finished
  const failedCbs = (ctx as unknown as { __failed: Array<() => void | Promise<void>> }).__failed
  if (failed) {
    for (const cb of failedCbs) {
      try {
        await cb()
      } catch {
        // ignore
      }
    }
  }
  for (const cb of finished) {
    try {
      await cb()
    } catch {
      // ignore
    }
  }
}

// ----------------------------------------------------------------------------
// Default API
// ----------------------------------------------------------------------------

const toBunOptions = (opts?: number | BunTest.TestOptions) => {
  if (opts === undefined) return undefined
  if (typeof opts === "number") return opts
  const out: { timeout?: number; retry?: number } = {}
  if (opts.timeout !== undefined) out.timeout = opts.timeout
  if (opts.retry !== undefined) out.retry = opts.retry
  return out
}

const baseCollector = ((
  name: string,
  second: BunTest.TestOptions | BunTestFn,
  third?: BunTestFn | number | BunTest.TestOptions
): void => {
  const [opts, fn] = typeof second === "function"
    ? [third as number | BunTest.TestOptions | undefined, second]
    : [second, third as BunTestFn]

  const o = isObject(opts) ? opts as BunTest.TestOptions : undefined
  if (o?.todo) {
    bunTest.todo(name, fn, toBunOptions(opts))
    return
  }
  if (o?.fails) {
    bunTest.failing(name, fn, toBunOptions(opts))
    return
  }
  if (o?.only) {
    bunTest.only(name, fn, toBunOptions(opts))
    return
  }
  if (o?.skip) {
    bunTest.skip(name, fn, toBunOptions(opts))
    return
  }
  bunTest(name, fn, toBunOptions(opts))
}) as BunTest.API

/** @internal */
export const defaultApi: BunTest.API & {
  skip: BunTest.API
  only: BunTest.API
  skipIf: (condition: unknown) => BunTest.API
  runIf: (condition: unknown) => BunTest.API
  fails: BunTest.API
  for: <T>(cases: ReadonlyArray<T>) => (
    name: string,
    optsOrFn: BunTest.TestOptions | ((arg: T, ctx: BunTest.TestContext) => unknown | Promise<unknown>),
    maybeFn?: (arg: T, ctx: BunTest.TestContext) => unknown | Promise<unknown>
  ) => void
} = Object.assign(baseCollector, {
  skip: ((name: string, second: any, third?: any) => {
    const [opts, fn] = typeof second === "function" ? [third, second] : [second, third]
    bunTest.skip(name, fn, toBunOptions(opts))
  }) as BunTest.API,
  only: ((name: string, second: any, third?: any) => {
    const [opts, fn] = typeof second === "function" ? [third, second] : [second, third]
    bunTest.only(name, fn, toBunOptions(opts))
  }) as BunTest.API,
  skipIf: (condition: unknown) =>
    ((name: string, second: any, third?: any) => {
      const [opts, fn] = typeof second === "function" ? [third, second] : [second, third]
      bunTest.skipIf(condition)(name, fn, toBunOptions(opts))
    }) as BunTest.API,
  runIf: (condition: unknown) =>
    ((name: string, second: any, third?: any) => {
      const [opts, fn] = typeof second === "function" ? [third, second] : [second, third]
      bunTest.if(condition)(name, fn, toBunOptions(opts))
    }) as BunTest.API,
  fails: ((name: string, second: any, third?: any) => {
    const [opts, fn] = typeof second === "function" ? [third, second] : [second, third]
    bunTest.failing(name, fn, toBunOptions(opts))
  }) as BunTest.API,
  for: <T>(cases: ReadonlyArray<T>) =>
  (
    name: string,
    optsOrFn: any,
    maybeFn?: any
  ) => {
    const [opts, fn] = typeof optsOrFn === "function" ? [maybeFn, optsOrFn] : [optsOrFn, maybeFn]
    bunTest.each(cases as Array<T>)(name, (value) => fn(value, makeContext()), toBunOptions(opts))
  }
})

// ----------------------------------------------------------------------------
// Effect runner
// ----------------------------------------------------------------------------

const runPromise: <E, A>(
  _: Effect.Effect<A, E, never>,
  ctx?: BunTest.TestContext | undefined
) => Promise<A> = Effect.fnUntraced(
  function*<E, A>(effect: Effect.Effect<A, E>, _ctx?: BunTest.TestContext) {
    const exit = yield* Effect.exit(effect)
    if (Exit.isFailure(exit)) {
      const errors = Cause.prettyErrors(exit.cause)
      for (let i = 0; i < errors.length; i++) {
        yield* Effect.logError(errors[i])
      }
    }
    return yield* exit
  },
  (effect, _, ctx) =>
    Effect.runPromise(effect, { signal: ctx?.signal }).then(
      async (value) => {
        if (ctx) await flush(ctx, false)
        return value
      },
      async (err) => {
        if (ctx) await flush(ctx, true)
        throw err
      }
    )
)

/** @internal */
const runTest = (ctx?: BunTest.TestContext) => <E, A>(effect: Effect.Effect<A, E>) => runPromise(effect, ctx)

/** @internal */
export type TestContext = TestConsole.TestConsole | TestClock.TestClock

const TestEnv = Layer.mergeAll(TestConsole.layer, TestClock.layer())

/** @internal */
export const addEqualityTesters = () => {
  // No-op: `bun:test`'s `expect` does not currently expose
  // `addEqualityTesters`. Use `Equal.equals` directly to compare values that
  // implement the `Equal` trait.
}

/** @internal */
const makeTester = <R>(
  mapEffect: <A, E>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, never>,
  it: BunTest.API = defaultApi
): BunTest.BunTest.Tester<R> => {
  const run = <A, E, TestArgs extends Array<unknown>>(
    ctx: BunTest.TestContext,
    args: TestArgs,
    self: BunTest.BunTest.TestFunction<A, E, R, TestArgs>
  ) => pipe(Effect.suspend(() => self(...args)), mapEffect, runTest(ctx))

  const f: BunTest.BunTest.Test<R> = (name, self, timeout) =>
    it(name, () => {
      const c = makeContext()
      return run(c, [c], self)
    }, timeout)

  const skip: BunTest.BunTest.Tester<R>["skip"] = (name, self, timeout) =>
    (defaultApi.skip as BunTest.API)(name, () => {
      const c = makeContext()
      return run(c, [c], self)
    }, timeout)

  const skipIf: BunTest.BunTest.Tester<R>["skipIf"] = (condition) => (name, self, timeout) =>
    defaultApi.skipIf(condition)(name, () => {
      const c = makeContext()
      return run(c, [c], self)
    }, timeout)

  const runIf: BunTest.BunTest.Tester<R>["runIf"] = (condition) => (name, self, timeout) =>
    defaultApi.runIf(condition)(name, () => {
      const c = makeContext()
      return run(c, [c], self)
    }, timeout)

  const only: BunTest.BunTest.Tester<R>["only"] = (name, self, timeout) =>
    (defaultApi.only as BunTest.API)(name, () => {
      const c = makeContext()
      return run(c, [c], self)
    }, timeout)

  const each: BunTest.BunTest.Tester<R>["each"] = (cases) => (name, self, _timeout) =>
    defaultApi.for(cases as ReadonlyArray<unknown>)(
      name,
      (arg, ctx) => run(ctx, [arg as any], self as any)
    )

  const fails: BunTest.BunTest.Tester<R>["fails"] = (name, self, timeout) =>
    (defaultApi.fails as BunTest.API)(name, () => {
      const c = makeContext()
      return run(c, [c], self)
    }, timeout)

  const prop: BunTest.BunTest.Tester<R>["prop"] = (name, arbitraries, self, timeout) => {
    if (Array.isArray(arbitraries)) {
      const arbs = arbitraries.map((arbitrary) => {
        if (Schema.isSchema(arbitrary)) {
          return Schema.toArbitrary(arbitrary)
        }
        return arbitrary as fc.Arbitrary<any>
      })
      return it(
        name,
        () => {
          const c = makeContext()
          // @ts-ignore
          return fc.assert(
            // @ts-ignore
            fc.asyncProperty(...arbs, (...as: Array<unknown>) => run(c, [as as any, c], self as any)),
            // @ts-ignore
            isObject(timeout) ? timeout?.fastCheck : {}
          )
        },
        typeof timeout === "number" ? timeout : (timeout as BunTest.TestOptions | undefined)
      )
    }

    const arbs = fc.record(
      Object.keys(arbitraries).reduce(function(result, key) {
        const arb: any = (arbitraries as Record<string, any>)[key]
        if (Schema.isSchema(arb)) {
          result[key] = Schema.toArbitrary(arb)
        } else {
          result[key] = arb
        }
        return result
      }, {} as Record<string, fc.Arbitrary<any>>)
    )

    return it(
      name,
      () => {
        const c = makeContext()
        return (fc.assert as any)(
          fc.asyncProperty(arbs, (as: Record<string, unknown>) => run(c, [as as any, c], self as any)),
          isObject(timeout) ? (timeout as any).fastCheck : {}
        )
      },
      typeof timeout === "number" ? timeout : (timeout as BunTest.TestOptions | undefined)
    )
  }

  return Object.assign(f, { skip, skipIf, runIf, only, each, fails, prop })
}

/** @internal */
export const prop: BunTest.BunTest.Methods["prop"] = (name, arbitraries, self, timeout) => {
  if (Array.isArray(arbitraries)) {
    const arbs = arbitraries.map((arbitrary) => {
      if (Schema.isSchema(arbitrary)) {
        throw new Error("Schemas are not supported yet")
      }
      return arbitrary
    })
    return defaultApi(
      name,
      () => {
        const c = makeContext()
        return (fc.assert as any)(
          // @ts-ignore
          fc.property(...arbs, (...as: Array<unknown>) => (self as any)(as, c)),
          isObject(timeout) ? (timeout as any).fastCheck : {}
        )
      },
      typeof timeout === "number" ? timeout : (timeout as BunTest.TestOptions | undefined)
    )
  }

  const arbs = fc.record(
    Object.keys(arbitraries).reduce(function(result, key) {
      const arb: any = (arbitraries as Record<string, any>)[key]
      if (Schema.isSchema(arb)) {
        throw new Error("Schemas are not supported yet")
      }
      result[key] = arb
      return result
    }, {} as Record<string, fc.Arbitrary<any>>)
  )

  return defaultApi(
    name,
    () => {
      const c = makeContext()
      return fc.assert(
        fc.property(arbs, (as: Record<string, unknown>) => (self as any)(as, c)),
        isObject(timeout) ? (timeout as any).fastCheck : {}
      )
    },
    typeof timeout === "number" ? timeout : (timeout as BunTest.TestOptions | undefined)
  )
}

/** @internal */
export const layer = <R, E>(
  layer_: Layer.Layer<R, E>,
  options?: {
    readonly memoMap?: Layer.MemoMap
    readonly timeout?: Duration.Input
    readonly excludeTestServices?: boolean
  }
): {
  (f: (it: BunTest.BunTest.MethodsNonLive<R>) => void): void
  (
    name: string,
    f: (it: BunTest.BunTest.MethodsNonLive<R>) => void
  ): void
} =>
(
  ...args:
    | [name: string, f: (it: BunTest.BunTest.MethodsNonLive<R>) => void]
    | [f: (it: BunTest.BunTest.MethodsNonLive<R>) => void]
) => {
  const excludeTestServices = options?.excludeTestServices ?? false
  const withTestEnv = excludeTestServices
    ? layer_ as Layer.Layer<R, E>
    : Layer.provideMerge(layer_, TestEnv)
  const memoMap = options?.memoMap ?? Effect.runSync(Layer.makeMemoMap)
  const scope = Effect.runSync(Scope.make())
  const contextEffect = Layer.buildWithMemoMap(withTestEnv, memoMap, scope).pipe(
    Effect.orDie,
    Effect.cached,
    Effect.runSync
  )

  const makeIt = (it: BunTest.API): BunTest.BunTest.MethodsNonLive<R> =>
    Object.assign(it, {
      effect: makeTester<R | Scope.Scope>(
        (effect) =>
          Effect.flatMap(contextEffect, (context) =>
            effect.pipe(
              Effect.scoped,
              Effect.provide(context)
            )),
        it
      ),
      prop,
      flakyTest,
      layer<R2, E2>(nestedLayer: Layer.Layer<R2, E2, R>, options?: {
        readonly timeout?: Duration.Input
      }) {
        return layer(Layer.provideMerge(nestedLayer, withTestEnv), { ...options, memoMap, excludeTestServices })
      }
    }) as BunTest.BunTest.MethodsNonLive<R>

  const timeoutMs = options?.timeout
    ? Duration.toMillis(Duration.fromInputUnsafe(options.timeout))
    : undefined

  if (args.length === 1) {
    beforeAll(
      () => runPromise(Effect.asVoid(contextEffect)) as Promise<void>,
      timeoutMs
    )
    afterAll(
      () => runPromise(Scope.close(scope, Exit.void)) as Promise<void>,
      timeoutMs
    )
    return args[0](makeIt(defaultApi))
  }

  return describe(args[0], () => {
    beforeAll(
      () => runPromise(Effect.asVoid(contextEffect)) as Promise<void>,
      timeoutMs
    )
    afterAll(
      () => runPromise(Scope.close(scope, Exit.void)) as Promise<void>,
      timeoutMs
    )
    return args[1](makeIt(defaultApi))
  })
}

/** @internal */
export const flakyTest = <A, E, R>(
  self: Effect.Effect<A, E, R | Scope.Scope>,
  timeout: Duration.Input = Duration.seconds(30)
) =>
  pipe(
    self,
    Effect.scoped,
    Effect.sandbox,
    Effect.retry(
      pipe(
        Schedule.recurs(10),
        Schedule.while((_) =>
          Effect.succeed(Duration.isLessThanOrEqualTo(
            Duration.fromInputUnsafe(_.elapsed),
            Duration.fromInputUnsafe(timeout)
          ))
        )
      )
    ),
    Effect.orDie
  )

/** @internal */
export const makeMethods = (it: BunTest.API): BunTest.BunTest.Methods =>
  Object.assign(it, {
    effect: makeTester<Scope.Scope>(flow(Effect.scoped, Effect.provide(TestEnv)), it),
    live: makeTester<Scope.Scope>(Effect.scoped, it),
    flakyTest,
    layer,
    prop
  }) as BunTest.BunTest.Methods

/** @internal */
export const {
  /** @internal */
  effect,
  /** @internal */
  live
} = makeMethods(defaultApi)

/** @internal */
export const describeWrapped = (name: string, f: (it: BunTest.BunTest.Methods) => void): void => {
  describe(name, () => {
    f(makeMethods(defaultApi))
  })
}
