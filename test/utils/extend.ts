import type { Tester, TesterContext } from "@vitest/expect"
import * as Cause from "effect/Cause"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import { identity, pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as TestClock from "effect/TestClock"
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
    readonly effect: Vitest.Tester</* TestServices.TestServices | */ R>
    readonly live: Vitest.Tester<R>
    readonly flakyTest: <A, E, R2>(
      self: Effect.Effect<A, E, R2>,
      timeout?: Duration.DurationInput
    ) => Effect.Effect<A, never, R2>
    readonly scoped: Vitest.Tester</* TestServices.TestServices | */ Scope.Scope | R>
    readonly scopedLive: Vitest.Tester<Scope.Scope | R>
    // readonly layer: <R2, E>(layer: Layer.Layer<R2, E, R>, options?: {
    //   readonly timeout?: Duration.DurationInput
    // }) => {
    //   (f: (it: Vitest.Methods<R | R2>) => void): void
    //   (name: string, f: (it: Vitest.Methods<R | R2>) => void): void
    // }

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

// /** @internal */
// const TestEnv = TestEnvironment.TestContext.pipe(
//   Layer.provide(Logger.remove(Logger.defaultLogger))
// )

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
  mapEffect: <A, E>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, never>
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

// /** @internal */
// export const layer = <R, E>(layer_: Layer.Layer<R, E>, options?: {
//   readonly memoMap?: Layer.MemoMap
//   readonly timeout?: Duration.DurationInput
// }): {
//   (f: (it: Vitest.Vitest.Methods<R>) => void): void
//   (name: string, f: (it: Vitest.Vitest.Methods<R>) => void): void
// } =>
// (
//   ...args: [name: string, f: (it: Vitest.Vitest.Methods<R>) => void] | [f: (it: Vitest.Vitest.Methods<R>) => void]
// ) => {
//   const memoMap = options?.memoMap ?? Effect.runSync(Layer.makeMemoMap)
//   const scope = Effect.runSync(Scope.make())
//   const runtimeEffect = Layer.toRuntimeWithMemoMap(layer_, memoMap).pipe(
//     Scope.extend(scope),
//     Effect.orDie,
//     Effect.cached,
//     Effect.runSync
//   )
//
//   const it: Vitest.Vitest.Methods<R> = Object.assign(V.it, {
//     effect: makeTester<TestServices.TestServices | R>((effect) =>
//       Effect.flatMap(runtimeEffect, (runtime) =>
//         effect.pipe(
//           Effect.provide(runtime),
//           Effect.provide(TestEnv)
//         ))
//     ),
//
//     prop,
//
//     scoped: makeTester<TestServices.TestServices | Scope.Scope | R>((effect) =>
//       Effect.flatMap(runtimeEffect, (runtime) =>
//         effect.pipe(
//           Effect.scoped,
//           Effect.provide(runtime),
//           Effect.provide(TestEnv)
//         ))
//     ),
//     live: makeTester<R>((effect) =>
//       Effect.flatMap(
//         runtimeEffect,
//         (runtime) => Effect.provide(effect, runtime)
//       )
//     ),
//     scopedLive: makeTester<Scope.Scope | R>((effect) =>
//       Effect.flatMap(runtimeEffect, (runtime) =>
//         effect.pipe(
//           Effect.scoped,
//           Effect.provide(runtime)
//         ))
//     ),
//     flakyTest,
//     layer<R2, E2>(nestedLayer: Layer.Layer<R2, E2, R>, options?: {
//       readonly timeout?: Duration.DurationInput
//     }) {
//       return layer(Layer.provideMerge(nestedLayer, layer_), { ...options, memoMap })
//     }
//   })
//
//   if (args.length === 1) {
//     V.beforeAll(
//       () => runPromise()(Effect.asVoid(runtimeEffect)),
//       options?.timeout ? Duration.toMillis(options.timeout) : undefined
//     )
//     V.afterAll(
//       () => runPromise()(Scope.close(scope, Exit.void)),
//       options?.timeout ? Duration.toMillis(options.timeout) : undefined
//     )
//     return args[0](it)
//   }
//
//   return V.describe(args[0], () => {
//     V.beforeAll(
//       () => runPromise()(Effect.asVoid(runtimeEffect)),
//       options?.timeout ? Duration.toMillis(options.timeout) : undefined
//     )
//     V.afterAll(
//       () => runPromise()(Scope.close(scope, Exit.void)),
//       options?.timeout ? Duration.toMillis(options.timeout) : undefined
//     )
//     return args[1](it)
//   })
// }

/** @internal */
export type TestContext = TestClock.TestClock
const TestLive = TestClock.layer()

/** @internal */
export const effect = makeTester<TestContext>((effect) =>
  Scope.make.pipe(
    Effect.flatMap((scope) => Layer.buildWithScope(TestLive, scope)),
    Effect.flatMap((context) => Effect.provideContext(effect, context))
  )
)
// export const effect = makeTester<TestServices.TestServices>(Effect.provide(TestEnv))

/** @internal */
export const scoped = makeTester<Scope.Scope>((effect) =>
  Scope.make.pipe(
    Effect.flatMap((scope) => Layer.buildWithScope(TestLive, scope)),
    Effect.flatMap((context) => Effect.provideContext(effect, context)),
    Effect.scoped
  )
)
// export const scoped = makeTester<TestServices.TestServices | Scope.Scope>(flow(Effect.scoped, Effect.provide(TestEnv)))

/** @internal */
export const live = makeTester<never>(identity)

/** @internal */
export const scopedLive = makeTester<Scope.Scope>(Effect.scoped)

/** @internal */
export const flakyTest = <A, E, R>(
  self: Effect.Effect<A, E, R>,
  timeout: Duration.DurationInput = Duration.seconds(30)
) =>
  pipe(
    Effect.catchDefect(self, Effect.fail),
    Effect.retry(),
    Effect.timeout(Duration.toMillis(timeout)),
    // Effect.retry(
    //   pipe(
    //     Schedule.recurs(10),
    //     Schedule.compose(Schedule.elapsed),
    //     Schedule.whileOutput(Duration.lessThanOrEqualTo(timeout))
    //   )
    // ),
    Effect.orDie
  )

/** @ignored */
const methods = { effect, live, flakyTest, scoped, scopedLive /* , layer, prop */ } as const

/**
 * @since 1.0.0
 */
export const it: Vitest.Methods = Object.assign(V.it, methods)
