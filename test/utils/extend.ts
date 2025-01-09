import type { Tester, TesterContext } from "@vitest/expect"
import * as Cause from "effect/Cause"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import { pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as Scope from "effect/Scope"
import * as TestClock from "effect/TestClock"
import * as TestConsole from "effect/TestConsole"
import * as Utils from "effect/Utils"
import * as V from "vitest"

export * from "vitest"

/**
 * @since 1.0.0
 */
export type API = V.TestAPI<{}>

/**
 * @since 1.0.0
 */
export namespace Vitest {
  /**
   * @since 1.0.0
   */
  export interface TestFunction<A, E, R, TestArgs extends Array<any>> {
    (...args: TestArgs): Effect.Effect<A, E, R>
  }

  /**
   * @since 1.0.0
   */
  export interface Test<R> {
    <A, E>(
      name: string,
      self: TestFunction<A, E, R, [V.TaskContext<V.RunnerTestCase<{}>> & V.TestContext]>,
      timeout?: number | V.TestOptions
    ): void
  }

  // /**
  //  * @since 1.0.0
  //  */
  // export type Arbitraries =
  //   | Array<Schema.Schema.Any | FC.Arbitrary<any>>
  //   | { [K in string]: Schema.Schema.Any | FC.Arbitrary<any> }

  /**
   * @since 1.0.0
   */
  export interface Tester<R> extends Vitest.Test<R> {
    skip: Vitest.Test<R>
    skipIf: (condition: unknown) => Vitest.Test<R>
    runIf: (condition: unknown) => Vitest.Test<R>
    only: Vitest.Test<R>
    each: <T>(
      cases: ReadonlyArray<T>
    ) => <A, E>(name: string, self: TestFunction<A, E, R, Array<T>>, timeout?: number | V.TestOptions) => void

    // /**
    //  * @since 1.0.0
    //  */
    // prop: <const Arbs extends Arbitraries, A, E>(
    //   name: string,
    //   arbitraries: Arbs,
    //   self: TestFunction<
    //     A,
    //     E,
    //     R,
    //     [
    //       { [K in keyof Arbs]: Arbs[K] extends FC.Arbitrary<infer T> ? T : Schema.Schema.Type<Arbs[K]> },
    //       V.TaskContext<V.RunnerTestCase<{}>> & V.TestContext
    //     ]
    //   >,
    //   timeout?:
    //     | number
    //     | V.TestOptions & {
    //       fastCheck?: FC.Parameters<
    //         { [K in keyof Arbs]: Arbs[K] extends FC.Arbitrary<infer T> ? T : Schema.Schema.Type<Arbs[K]> }
    //       >
    //     }
    // ) => void
  }

  /**
   * @since 1.0.0
   */
  export interface Methods<R = never> extends API {
    readonly flakyTest: <A, E, R2>(
      self: Effect.Effect<A, E, R2 | Scope.Scope | TestContext>,
      timeout?: Duration.DurationInput
    ) => Effect.Effect<A, never, R2>
    readonly effect: Vitest.Tester<Scope.Scope | R | TestContext>
    readonly live: Vitest.Tester<Scope.Scope | R>
    readonly layer: <R2, E>(layer: Layer.Layer<R2, E, R>, options?: {
      readonly timeout?: Duration.DurationInput
    }) => {
      (f: (it: Vitest.Methods<R | R2>) => void): void
      (name: string, f: (it: Vitest.Methods<R | R2>) => void): void
    }

    // /**
    //  * @since 1.0.0
    //  */
    // readonly prop: <const Arbs extends Arbitraries>(
    //   name: string,
    //   arbitraries: Arbs,
    //   self: (
    //     properties: { [K in keyof Arbs]: K extends FC.Arbitrary<infer T> ? T : Schema.Schema.Type<Arbs[K]> },
    //     ctx: V.TaskContext<V.RunnerTestCase<{}>> & V.TestContext
    //   ) => void,
    //   timeout?:
    //     | number
    //     | V.TestOptions & {
    //       fastCheck?: FC.Parameters<
    //         { [K in keyof Arbs]: Arbs[K] extends FC.Arbitrary<infer T> ? T : Schema.Schema.Type<Arbs[K]> }
    //       >
    //     }
    // ) => void
  }
}

const runPromise = (ctx?: V.TaskContext) => <E, A>(effect: Effect.Effect<A, E>) =>
  Effect.gen(function*() {
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
      // const errors = Cause.prettyErrors(exit.cause)
      // for (let i = 1; i < errors.length; i++) {
      //   yield* Effect.logError(errors[i])
      // }
      return () => {
        // throw errors[0]
        throw Cause.squash(exit.cause)
      }
    }
  }).pipe(Effect.runPromise).then((f) => f())

/** @internal */
const runTest = (ctx?: V.TaskContext) => <E, A>(effect: Effect.Effect<A, E>) => runPromise(ctx)(effect)

/** @internal */
function customTester(this: TesterContext, a: unknown, b: unknown, customTesters: Array<Tester>) {
  if (!Equal.isEqual(a) || !Equal.isEqual(b)) {
    return undefined
  }
  return Utils.structuralRegion(
    () => Equal.equals(a, b),
    (x, y) => this.equals(x, y, customTesters.filter((t) => t !== customTester))
  )
}

/** @internal */
export const addEqualityTesters = () => {
  V.expect.addEqualityTesters([customTester])
}

/** @internal */
const makeTester = <R>(
  mapEffect: <A, E>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E>
): Vitest.Tester<R> => {
  const run = <A, E, TestArgs extends Array<unknown>>(
    ctx: V.TaskContext<V.RunnerTestCase<object>> & V.TestContext & object,
    args: TestArgs,
    self: Vitest.TestFunction<A, E, R, TestArgs>
  ) => pipe(Effect.suspend(() => self(...args)), mapEffect, runTest(ctx))

  const f: Vitest.Test<R> = (name, self, timeout) => V.it(name, (ctx) => run(ctx, [ctx], self), timeout)

  const skip: Vitest.Tester<R>["only"] = (name, self, timeout) =>
    V.it.skip(name, (ctx) => run(ctx, [ctx], self), timeout)
  const skipIf: Vitest.Tester<R>["skipIf"] = (condition) => (name, self, timeout) =>
    V.it.skipIf(condition)(name, (ctx) => run(ctx, [ctx], self), timeout)
  const runIf: Vitest.Tester<R>["runIf"] = (condition) => (name, self, timeout) =>
    V.it.runIf(condition)(name, (ctx) => run(ctx, [ctx], self), timeout)
  const only: Vitest.Tester<R>["only"] = (name, self, timeout) =>
    V.it.only(name, (ctx) => run(ctx, [ctx], self), timeout)
  const each: Vitest.Tester<R>["each"] = (cases) => (name, self, timeout) =>
    V.it.for(cases)(
      name,
      typeof timeout === "number" ? { timeout } : timeout ?? {},
      (args, ctx) => run(ctx, [args], self) as any
    )

  // const prop: Vitest.Tester<R>["prop"] = (name, arbitraries, self, timeout) => {
  //   if (Array.isArray(arbitraries)) {
  //     const arbs = arbitraries.map((arbitrary) => Schema.isSchema(arbitrary) ? Arbitrary.make(arbitrary) : arbitrary)
  //     return V.it(
  //       name,
  //       (ctx) =>
  //         // @ts-ignore
  //         fc.assert(
  //           // @ts-ignore
  //           fc.asyncProperty(...arbs, (...as) => run(ctx, [as as any, ctx], self)),
  //           isObject(timeout) ? timeout?.fastCheck : {}
  //         ),
  //       timeout
  //     )
  //   }
  //
  //   const arbs = fc.record(
  //     Object.keys(arbitraries).reduce(function(result, key) {
  //       result[key] = Schema.isSchema(arbitraries[key]) ? Arbitrary.make(arbitraries[key]) : arbitraries[key]
  //       return result
  //     }, {} as Record<string, fc.Arbitrary<any>>)
  //   )
  //
  //   return V.it(
  //     name,
  //     (ctx) =>
  //       // @ts-ignore
  //       fc.assert(
  //         fc.asyncProperty(arbs, (...as) =>
  //           // @ts-ignore
  //           run(ctx, [as[0] as any, ctx], self)),
  //         isObject(timeout) ? timeout?.fastCheck : {}
  //       ),
  //     timeout
  //   )
  // }

  return Object.assign(f, { skip, skipIf, runIf, only, each /* , prop */ })
}

// export const prop: Vitest.Vitest.Methods["prop"] = (name, arbitraries, self, timeout) => {
//   if (Array.isArray(arbitraries)) {
//     const arbs = arbitraries.map((arbitrary) => Schema.isSchema(arbitrary) ? Arbitrary.make(arbitrary) : arbitrary)
//     return V.it(
//       name,
//       // @ts-ignore
//       (ctx) => fc.assert(fc.property(...arbs, (...as) => self(as, ctx)), isObject(timeout) ? timeout?.fastCheck : {}),
//       timeout
//     )
//   }
//
//   const arbs = fc.record(
//     Object.keys(arbitraries).reduce(function(result, key) {
//       result[key] = Schema.isSchema(arbitraries[key]) ? Arbitrary.make(arbitraries[key]) : arbitraries[key]
//       return result
//     }, {} as Record<string, fc.Arbitrary<any>>)
//   )
//
//   return V.it(
//     name,
//     // @ts-ignore
//     (ctx) => fc.assert(fc.property(arbs, (as) => self(as, ctx)), isObject(timeout) ? timeout?.fastCheck : {}),
//     timeout
//   )
// }

/** @internal */
export const layer = <R, E>(layer_: Layer.Layer<R, E>, options?: {
  readonly memoMap?: Layer.MemoMap
  readonly timeout?: Duration.DurationInput
}): {
  (f: (it: Vitest.Methods<R>) => void): void
  (name: string, f: (it: Vitest.Methods<R>) => void): void
} =>
(
  ...args: [name: string, f: (it: Vitest.Methods<R>) => void] | [f: (it: Vitest.Methods<R>) => void]
) => {
  const memoMap = options?.memoMap ?? Layer.unsafeMakeMemoMap()
  const scope = Scope.unsafeMake()
  const contextEffect = Layer.buildWithMemoMap(layer_, memoMap, scope).pipe(
    Effect.orDie,
    Effect.cached,
    Effect.runSync
  )

  const it: Vitest.Methods<R> = Object.assign(V.it, {
    effect: makeTester<TestContext | Scope.Scope | R>((effect) =>
      Effect.flatMap(contextEffect, (context) =>
        effect.pipe(
          Effect.scoped,
          Effect.provideContext(context),
          Effect.provide(TestLive)
        ))
    ),
    // prop,
    live: makeTester<Scope.Scope | R>((effect) =>
      Effect.flatMap(contextEffect, (context) =>
        effect.pipe(
          Effect.scoped,
          Effect.provideContext(context)
        ))
    ),
    flakyTest,
    layer<R2, E2>(nestedLayer: Layer.Layer<R2, E2, R>, options?: {
      readonly timeout?: Duration.DurationInput
    }) {
      return layer(Layer.provideMerge(nestedLayer, layer_), { ...options, memoMap })
    }
  })

  if (args.length === 1) {
    V.beforeAll(
      () => runPromise()(Effect.asVoid(contextEffect)),
      options?.timeout ? Duration.toMillis(options.timeout) : undefined
    )
    V.afterAll(
      () => runPromise()(scope.close(Exit.void)),
      options?.timeout ? Duration.toMillis(options.timeout) : undefined
    )
    return args[0](it)
  }

  return V.describe(args[0], () => {
    V.beforeAll(
      () => runPromise()(Effect.asVoid(contextEffect)),
      options?.timeout ? Duration.toMillis(options.timeout) : undefined
    )
    V.afterAll(
      () => runPromise()(scope.close(Exit.void)),
      options?.timeout ? Duration.toMillis(options.timeout) : undefined
    )
    return args[1](it)
  })
}

/** @internal */
export type TestContext = TestConsole.TestConsole | TestClock.TestClock

const TestLive = Layer.mergeAll(TestConsole.layer, TestClock.layer())

/** @internal */
export const effect = makeTester<TestContext | Scope.Scope>((effect) => Effect.provide(Effect.scoped(effect), TestLive))

/** @internal */
export const live = makeTester<Scope.Scope>(Effect.scoped)

/** @internal */
export const flakyTest = <A, E, R>(
  self: Effect.Effect<A, E, R | Scope.Scope | TestContext>,
  timeout: Duration.DurationInput = Duration.seconds(30)
) =>
  pipe(
    Effect.catchDefect(self, Effect.fail),
    Effect.scoped,
    Effect.retry(
      Schedule.recurs(10).pipe(
        Schedule.both(Schedule.elapsed),
        Schedule.while(({ output }) => Duration.lessThanOrEqualTo(output[1], timeout))
      )
    ),
    Effect.provide(TestLive),
    Effect.orDie
  )

/** @ignored */
const methods = { effect, live, flakyTest, layer /* , prop */ } as const

/**
 * @since 1.0.0
 */
export const it: Vitest.Methods = Object.assign(V.it, methods)
