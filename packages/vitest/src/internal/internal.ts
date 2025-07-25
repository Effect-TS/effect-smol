/**
 * @since 1.0.0
 */

import * as Cause from "effect/Cause"
import { isObject } from "effect/data/Predicate"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import { flow, pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as Schema from "effect/schema/Schema"
import * as Scope from "effect/Scope"
import * as fc from "effect/testing/FastCheck"
import * as TestClock from "effect/testing/TestClock"
import * as TestConsole from "effect/testing/TestConsole"
import * as Duration from "effect/time/Duration"
import * as V from "vitest"
import type * as Vitest from "../index.ts"

const runPromise = (ctx?: Vitest.TestContext) =>
  Effect.fnUntraced(function*<E, A>(effect: Effect.Effect<A, E>) {
    const exitFiber = yield* Effect.fork(Effect.exit(effect))

    ctx?.onTestFinished(() =>
      Fiber.interrupt(exitFiber).pipe(
        Effect.asVoid,
        Effect.runPromise
      )
    )

    const exit = yield* Fiber.join(exitFiber)
    if (Exit.isSuccess(exit)) {
      return () => exit.value
    } else {
      const errors = Cause.prettyErrors(exit.cause)
      for (let i = 1; i < errors.length; i++) {
        yield* Effect.logError(errors[i])
      }
      return () => {
        throw errors[0]
      }
    }
  }, (effect) => Effect.runPromise(effect, { signal: ctx?.signal }).then((f) => f()))

/** @internal */
const runTest = (ctx?: Vitest.TestContext) => <E, A>(effect: Effect.Effect<A, E>) => runPromise(ctx)(effect)

/** @internal */
export type TestContext = TestConsole.TestConsole | TestClock.TestClock

const TestEnv = Layer.mergeAll(TestConsole.layer, TestClock.layer())

/** @internal */
export const addEqualityTesters = () => {
  V.expect.addEqualityTesters([])
}

/** @internal */
const testOptions = (timeout?: number | V.TestOptions) => typeof timeout === "number" ? { timeout } : timeout ?? {}

/** @internal */
const makeTester = <R>(
  mapEffect: <A, E>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, never>,
  it: V.TestAPI = V.it
): Vitest.Vitest.Tester<R> => {
  const run = <A, E, TestArgs extends Array<unknown>>(
    ctx: V.TestContext & object,
    args: TestArgs,
    self: Vitest.Vitest.TestFunction<A, E, R, TestArgs>
  ) => pipe(Effect.suspend(() => self(...args)), mapEffect, runTest(ctx))

  const f: Vitest.Vitest.Test<R> = (name, self, timeout) =>
    it(name, testOptions(timeout), (ctx) => run(ctx, [ctx], self))

  const skip: Vitest.Vitest.Tester<R>["only"] = (name, self, timeout) =>
    it.skip(name, testOptions(timeout), (ctx) => run(ctx, [ctx], self))

  const skipIf: Vitest.Vitest.Tester<R>["skipIf"] = (condition) => (name, self, timeout) =>
    it.skipIf(condition)(name, testOptions(timeout), (ctx) => run(ctx, [ctx], self))

  const runIf: Vitest.Vitest.Tester<R>["runIf"] = (condition) => (name, self, timeout) =>
    it.runIf(condition)(name, testOptions(timeout), (ctx) => run(ctx, [ctx], self))

  const only: Vitest.Vitest.Tester<R>["only"] = (name, self, timeout) =>
    it.only(name, testOptions(timeout), (ctx) => run(ctx, [ctx], self))

  const each: Vitest.Vitest.Tester<R>["each"] = (cases) => (name, self, timeout) =>
    it.for(cases)(
      name,
      testOptions(timeout),
      (args, ctx) => run(ctx, [args], self) as any
    )

  const fails: Vitest.Vitest.Tester<R>["fails"] = (name, self, timeout) =>
    V.it.fails(name, testOptions(timeout), (ctx) => run(ctx, [ctx], self))

  const prop: Vitest.Vitest.Tester<R>["prop"] = (name, arbitraries, self, timeout) => {
    if (Array.isArray(arbitraries)) {
      const arbs = arbitraries.map((arbitrary) => {
        if (Schema.isSchema(arbitrary)) {
          throw new Error("Schemas are not supported yet")
        }
        return arbitrary
      })
      return it(
        name,
        testOptions(timeout),
        (ctx) =>
          // @ts-ignore
          fc.assert(
            // @ts-ignore
            fc.asyncProperty(...arbs, (...as) => run(ctx, [as as any, ctx], self)),
            isObject(timeout) ? timeout?.fastCheck : {}
          )
      )
    }

    const arbs = fc.record(
      Object.keys(arbitraries).reduce(function(result, key) {
        const arb: any = arbitraries[key]
        if (Schema.isSchema(arb)) {
          throw new Error("Schemas are not supported yet")
        }
        result[key] = arb
        return result
      }, {} as Record<string, fc.Arbitrary<any>>)
    )

    return it(
      name,
      testOptions(timeout),
      (ctx) =>
        // @ts-ignore
        fc.assert(
          fc.asyncProperty(arbs, (...as) =>
            // @ts-ignore
            run(ctx, [as[0] as any, ctx], self)),
          isObject(timeout) ? timeout?.fastCheck : {}
        )
    )
  }

  return Object.assign(f, { skip, skipIf, runIf, only, each, fails, prop })
}

/** @internal */
export const prop: Vitest.Vitest.Methods["prop"] = (name, arbitraries, self, timeout) => {
  if (Array.isArray(arbitraries)) {
    const arbs = arbitraries.map((arbitrary) => {
      if (Schema.isSchema(arbitrary)) {
        throw new Error("Schemas are not supported yet")
      }
      return arbitrary
    })
    return V.it(
      name,
      testOptions(timeout),
      // @ts-ignore
      (ctx) => fc.assert(fc.property(...arbs, (...as) => self(as, ctx)), isObject(timeout) ? timeout?.fastCheck : {})
    )
  }

  const arbs = fc.record(
    Object.keys(arbitraries).reduce(function(result, key) {
      const arb: any = arbitraries[key]
      if (Schema.isSchema(arb)) {
        throw new Error("Schemas are not supported yet")
      }
      result[key] = arb
      return result
    }, {} as Record<string, fc.Arbitrary<any>>)
  )

  return V.it(
    name,
    testOptions(timeout),
    // @ts-ignore
    (ctx) => fc.assert(fc.property(arbs, (as) => self(as, ctx)), isObject(timeout) ? timeout?.fastCheck : {})
  )
}

/** @internal */
export const layer = <R, E>(
  layer_: Layer.Layer<R, E>,
  options?: {
    readonly memoMap?: Layer.MemoMap
    readonly timeout?: Duration.DurationInput
    readonly excludeTestServices?: boolean
  }
): {
  (f: (it: Vitest.Vitest.MethodsNonLive<R>) => void): void
  (
    name: string,
    f: (it: Vitest.Vitest.MethodsNonLive<R>) => void
  ): void
} =>
(
  ...args: [
    name: string,
    f: (
      it: Vitest.Vitest.MethodsNonLive<R>
    ) => void
  ] | [
    f: (it: Vitest.Vitest.MethodsNonLive<R>) => void
  ]
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

  const makeIt = (it: V.TestAPI): Vitest.Vitest.MethodsNonLive<R> =>
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
        readonly timeout?: Duration.DurationInput
      }) {
        return layer(Layer.provideMerge(nestedLayer, withTestEnv), { ...options, memoMap, excludeTestServices })
      }
    })

  if (args.length === 1) {
    V.beforeAll(
      () => runPromise()(Effect.asVoid(contextEffect)),
      options?.timeout ? Duration.toMillis(options.timeout) : undefined
    )
    V.afterAll(
      () => runPromise()(Scope.close(scope, Exit.void)),
      options?.timeout ? Duration.toMillis(options.timeout) : undefined
    )
    return args[0](makeIt(V.it))
  }

  return V.describe(args[0], () => {
    V.beforeAll(
      () => runPromise()(Effect.asVoid(contextEffect)),
      options?.timeout ? Duration.toMillis(options.timeout) : undefined
    )
    V.afterAll(
      () => runPromise()(Scope.close(scope, Exit.void)),
      options?.timeout ? Duration.toMillis(options.timeout) : undefined
    )
    return args[1](makeIt(V.it))
  })
}

/** @internal */
export const flakyTest = <A, E, R>(
  self: Effect.Effect<A, E, R | Scope.Scope>,
  timeout: Duration.DurationInput = Duration.seconds(30)
) =>
  pipe(
    self,
    Effect.scoped,
    Effect.catchDefect(Effect.fail),
    Effect.retry(
      pipe(
        Schedule.recurs(10),
        Schedule.while((_) => Duration.lessThanOrEqualTo(_.elapsed, timeout))
      )
    ),
    Effect.orDie
  )

/** @internal */
export const makeMethods = (it: V.TestAPI): Vitest.Vitest.Methods =>
  Object.assign(it, {
    effect: makeTester<Scope.Scope>(flow(Effect.scoped, Effect.provide(TestEnv)), it),
    live: makeTester<Scope.Scope>(Effect.scoped, it),
    flakyTest,
    layer,
    prop
  })

/** @internal */
export const {
  /** @internal */
  effect,
  /** @internal */
  live
} = makeMethods(V.it)

/** @internal */
export const describeWrapped = (name: string, f: (it: Vitest.Vitest.Methods) => void): V.SuiteCollector =>
  V.describe(name, (it) => f(makeMethods(it)))
