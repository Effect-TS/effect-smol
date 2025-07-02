/**
 * @since 2.0.0
 */
import type * as Arr from "./Array.js"
import type * as Cause from "./Cause.js"
import type { Clock } from "./Clock.js"
import * as Context from "./Context.js"
import * as Duration from "./Duration.js"
import * as Exit from "./Exit.js"
import type { Fiber } from "./Fiber.js"
import { constant, dual, type LazyArg } from "./Function.js"
import type { TypeLambda } from "./HKT.js"
import type { Types } from "./index.js"
import * as core from "./internal/core.js"
import * as internal from "./internal/effect.js"
import * as internalLayer from "./internal/layer.js"
import * as internalRequest from "./internal/request.js"
import * as internalSchedule from "./internal/schedule.js"
import type { Layer } from "./Layer.js"
import type { Logger } from "./Logger.js"
import * as Metric from "./Metric.js"
import type { Option } from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import type * as Predicate from "./Predicate.js"
import { CurrentLogAnnotations, CurrentLogSpans } from "./References.js"
import type { Request } from "./Request.js"
import type { RequestResolver } from "./RequestResolver.js"
import type * as Result from "./Result.js"
import type { Schedule } from "./Schedule.js"
import type { Scheduler } from "./Scheduler.js"
import type { Scope } from "./Scope.js"
import type { AnySpan, ParentSpan, Span, SpanLink, SpanOptions, TraceOptions, Tracer } from "./Tracer.js"
import type { TxRef } from "./TxRef.js"
import type { Concurrency, Covariant, EqualsWith, NoInfer, NotFunction } from "./Types.js"
import type * as Unify from "./Unify.js"
import type { YieldWrap } from "./Utils.js"
import { SingleShotGen } from "./Utils.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/Effect")

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * The `Effect` interface defines a value that lazily describes a workflow or
 * job. The workflow requires some context `R`, and may fail with an error of
 * type `E`, or succeed with a value of type `A`.
 *
 * `Effect` values model resourceful interaction with the outside world,
 * including synchronous, asynchronous, concurrent, and parallel interaction.
 * They use a fiber-based concurrency model, with built-in support for
 * scheduling, fine-grained interruption, structured concurrency, and high
 * scalability.
 *
 * To run an `Effect` value, you need a `Runtime`, which is a type that is
 * capable of executing `Effect` values.
 *
 * @since 2.0.0
 * @category Models
 */
export interface Effect<out A, out E = never, out R = never> extends Pipeable, Yieldable<A, E, R> {
  readonly [TypeId]: Effect.Variance<A, E, R>
  [Symbol.iterator](): EffectIterator<Effect<A, E, R>>
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: EffectUnify<this>
  [Unify.ignoreSymbol]?: EffectUnifyIgnore
}

/**
 * @since 4.0.0
 * @category Yieldable
 */
export interface Yieldable<out A, out E = never, out R = never> {
  asEffect(): Effect<A, E, R>
}

/**
 * @since 4.0.0
 * @category Yieldable
 */
export abstract class YieldableClass<A, E = never, R = never> implements Yieldable<A, E, R> {
  [Symbol.iterator](): EffectIterator<this> {
    return new SingleShotGen(this) as any
  }
  abstract asEffect(): Effect<A, E, R>
}

/**
 * @category models
 * @since 2.0.0
 */
export interface EffectUnify<A extends { [Unify.typeSymbol]?: any }> {
  Effect?: () => A[Unify.typeSymbol] extends
    | Effect<infer A0, infer E0, infer R0>
    | infer _ ? Effect<A0, E0, R0>
    : never
}

/**
 * @category models
 * @since 2.0.0
 */
export interface EffectUnifyIgnore {
  Effect?: true
}
/**
 * @category type lambdas
 * @since 2.0.0
 */
export interface EffectTypeLambda extends TypeLambda {
  readonly type: Effect<this["Target"], this["Out1"], this["Out2"]>
}

/**
 * @since 2.0.0
 */
export declare namespace Effect {
  /**
   * @since 2.0.0
   */
  export interface Variance<A, E, R> {
    _A: Covariant<A>
    _E: Covariant<E>
    _R: Covariant<R>
  }

  /**
   * @since 2.0.0
   */
  export type Success<T> = T extends Effect<infer _A, infer _E, infer _R> ? _A
    : never

  /**
   * @since 2.0.0
   */
  export type Error<T> = T extends Effect<infer _A, infer _E, infer _R> ? _E
    : never

  /**
   * @since 2.0.0
   */
  export type Context<T> = T extends Effect<infer _A, infer _E, infer _R> ? _R
    : never
}

/**
 * @since 4.0.0
 */
export declare namespace Yieldable {
  /**
   * @since 4.0.0
   */
  export type Success<T> = T extends Yieldable<infer _A, infer _E, infer _R> ? _A
    : never
}

/**
 * @since 2.0.0
 * @category guards
 */
export const isEffect = (u: unknown): u is Effect<any, any, any> => typeof u === "object" && u !== null && TypeId in u

/**
 * @since 2.0.0
 * @category models
 */
export interface EffectIterator<T extends Yieldable<any, any, any>> {
  next(
    ...args: ReadonlyArray<any>
  ): IteratorResult<YieldWrap<T>, Yieldable.Success<T>>
}

// ========================================================================
// Collecting
// ========================================================================

/**
 * @since 2.0.0
 */
export declare namespace All {
  /**
   * @since 2.0.0
   */
  export type EffectAny = Effect<any, any, any>

  /**
   * @since 2.0.0
   */
  export type ReturnIterable<
    T extends Iterable<EffectAny>,
    Discard extends boolean
  > = [T] extends [Iterable<Effect<infer A, infer E, infer R>>] ? Effect<Discard extends true ? void : Array<A>, E, R>
    : never

  /**
   * @since 2.0.0
   */
  export type ReturnTuple<
    T extends ReadonlyArray<unknown>,
    Discard extends boolean
  > = Effect<
    Discard extends true ? void
      : T[number] extends never ? []
      : {
        -readonly [K in keyof T]: T[K] extends Effect<
          infer _A,
          infer _E,
          infer _R
        > ? _A
          : never
      },
    T[number] extends never ? never
      : T[number] extends Effect<infer _A, infer _E, infer _R> ? _E
      : never,
    T[number] extends never ? never
      : T[number] extends Effect<infer _A, infer _E, infer _R> ? _R
      : never
  > extends infer X ? X
    : never

  /**
   * @since 2.0.0
   */
  export type ReturnObject<T, Discard extends boolean> = [T] extends [
    Record<string, EffectAny>
  ] ? Effect<
      Discard extends true ? void
        : {
          -readonly [K in keyof T]: [T[K]] extends [
            Effect<infer _A, infer _E, infer _R>
          ] ? _A
            : never
        },
      keyof T extends never ? never
        : T[keyof T] extends Effect<infer _A, infer _E, infer _R> ? _E
        : never,
      keyof T extends never ? never
        : T[keyof T] extends Effect<infer _A, infer _E, infer _R> ? _R
        : never
    >
    : never

  /**
   * @since 2.0.0
   */
  export type IsDiscard<A> = [Extract<A, { readonly discard: true }>] extends [
    never
  ] ? false
    : true

  /**
   * @since 2.0.0
   */
  export type Return<
    Arg extends Iterable<EffectAny> | Record<string, EffectAny>,
    O extends {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: boolean | undefined
    }
  > = [Arg] extends [ReadonlyArray<EffectAny>] ? ReturnTuple<Arg, IsDiscard<O>>
    : [Arg] extends [Iterable<EffectAny>] ? ReturnIterable<Arg, IsDiscard<O>>
    : [Arg] extends [Record<string, EffectAny>] ? ReturnObject<Arg, IsDiscard<O>>
    : never
}

/**
 * Combines multiple effects into one, returning results based on the input
 * structure.
 *
 * **Details**
 *
 * Use this function when you need to run multiple effects and combine their
 * results into a single output. It supports tuples, iterables, structs, and
 * records, making it flexible for different input types.
 *
 * For instance, if the input is a tuple:
 *
 * ```ts skip-type-checking
 * //         ┌─── a tuple of effects
 * //         ▼
 * Effect.all([effect1, effect2, ...])
 * ```
 *
 * the effects are executed sequentially, and the result is a new effect
 * containing the results as a tuple. The results in the tuple match the order
 * of the effects passed to `Effect.all`.
 *
 * **Concurrency**
 *
 * You can control the execution order (e.g., sequential vs. concurrent) using
 * the `concurrency` option.
 *
 * **Short-Circuiting Behavior**
 *
 * This function stops execution on the first error it encounters, this is
 * called "short-circuiting". If any effect in the collection fails, the
 * remaining effects will not run, and the error will be propagated. To change
 * this behavior, you can use the `mode` option, which allows all effects to run
 * and collect results as `Result` or `Option`.
 *
 * **The `mode` option**
 *
 * The `{ mode: "result" }` option changes the behavior of `Effect.all` to
 * ensure all effects run, even if some fail. Instead of stopping on the first
 * failure, this mode collects both successes and failures, returning an array
 * of `Result` instances where each result is either an `Ok` (success) or a
 * `Err` (failure).
 *
 * Similarly, the `{ mode: "validate" }` option uses `Option` to indicate
 * success or failure. Each effect returns `None` for success and `Some` with
 * the error for failure.
 *
 * **Example** (Combining Effects in Tuples)
 *
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * const tupleOfEffects = [
 *   Effect.succeed(42).pipe(Effect.tap(Console.log)),
 *   Effect.succeed("Hello").pipe(Effect.tap(Console.log))
 * ] as const
 *
 * //      ┌─── Effect<[number, string], never, never>
 * //      ▼
 * const resultsAsTuple = Effect.all(tupleOfEffects)
 *
 * Effect.runPromise(resultsAsTuple).then(console.log)
 * // Output:
 * // 42
 * // Hello
 * // [ 42, 'Hello' ]
 * ```
 *
 * **Example** (Combining Effects in Iterables)
 *
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * const iterableOfEffects: Iterable<Effect.Effect<number>> = [1, 2, 3].map(
 *   (n) => Effect.succeed(n).pipe(Effect.tap(Console.log))
 * )
 *
 * //      ┌─── Effect<number[], never, never>
 * //      ▼
 * const resultsAsArray = Effect.all(iterableOfEffects)
 *
 * Effect.runPromise(resultsAsArray).then(console.log)
 * // Output:
 * // 1
 * // 2
 * // 3
 * // [ 1, 2, 3 ]
 * ```
 *
 * **Example** (Combining Effects in Structs)
 *
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * const structOfEffects = {
 *   a: Effect.succeed(42).pipe(Effect.tap(Console.log)),
 *   b: Effect.succeed("Hello").pipe(Effect.tap(Console.log))
 * }
 *
 * //      ┌─── Effect<{ a: number; b: string; }, never, never>
 * //      ▼
 * const resultsAsStruct = Effect.all(structOfEffects)
 *
 * Effect.runPromise(resultsAsStruct).then(console.log)
 * // Output:
 * // 42
 * // Hello
 * // { a: 42, b: 'Hello' }
 * ```
 *
 * **Example** (Combining Effects in Records)
 *
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * const recordOfEffects: Record<string, Effect.Effect<number>> = {
 *   key1: Effect.succeed(1).pipe(Effect.tap(Console.log)),
 *   key2: Effect.succeed(2).pipe(Effect.tap(Console.log))
 * }
 *
 * //      ┌─── Effect<{ [x: string]: number; }, never, never>
 * //      ▼
 * const resultsAsRecord = Effect.all(recordOfEffects)
 *
 * Effect.runPromise(resultsAsRecord).then(console.log)
 * // Output:
 * // 1
 * // 2
 * // { key1: 1, key2: 2 }
 * ```
 *
 * **Example** (Short-Circuiting Behavior)
 *
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * const program = Effect.all([
 *   Effect.succeed("Task1").pipe(Effect.tap(Console.log)),
 *   Effect.fail("Task2: Oh no!").pipe(Effect.tap(Console.log)),
 *   // Won't execute due to earlier failure
 *   Effect.succeed("Task3").pipe(Effect.tap(Console.log))
 * ])
 *
 * Effect.runPromiseExit(program).then(console.log)
 * // Output:
 * // Task1
 * // {
 * //   _id: 'Exit',
 * //   _tag: 'Failure',
 * //   cause: { _id: 'Cause', _tag: 'Fail', failure: 'Task2: Oh no!' }
 * // }
 * ```
 *
 * @see {@link forEach} for iterating over elements and applying an effect.
 * @see {@link allWith} for a data-last version of this function.
 *
 * @since 2.0.0
 * @category Collecting
 */
export const all: <
  const Arg extends
    | Iterable<Effect<any, any, any>>
    | Record<string, Effect<any, any, any>>,
  O extends {
    readonly concurrency?: Concurrency | undefined
    readonly discard?: boolean | undefined
  }
>(
  arg: Arg,
  options?: O
) => All.Return<Arg, O> = internal.all

/**
 * Executes an effectful operation for each element in an `Iterable`.
 *
 * **Details**
 *
 * The `forEach` function applies a provided operation to each element in the
 * iterable, producing a new effect that returns an array of results.
 *
 * If any effect fails, the iteration stops immediately (short-circuiting), and
 * the error is propagated.
 *
 * **Concurrency**
 *
 * The `concurrency` option controls how many operations are performed
 * concurrently. By default, the operations are performed sequentially.
 *
 * **Discarding Results**
 *
 * If the `discard` option is set to `true`, the intermediate results are not
 * collected, and the final result of the operation is `void`.
 *
 * @see {@link all} for combining multiple effects into one.
 *
 * @example
 * ```ts
 * // Title: Applying Effects to Iterable Elements
 * import { Effect, Console } from "effect"
 *
 * const result = Effect.forEach([1, 2, 3, 4, 5], (n, index) =>
 *   Console.log(`Currently at index ${index}`).pipe(Effect.as(n * 2))
 * )
 *
 * Effect.runPromise(result).then(console.log)
 * // Output:
 * // Currently at index 0
 * // Currently at index 1
 * // Currently at index 2
 * // Currently at index 3
 * // Currently at index 4
 * // [ 2, 4, 6, 8, 10 ]
 * ```
 *
 * @example
 * // Title: Using discard to Ignore Results
 * import { Effect, Console } from "effect"
 *
 * // Apply effects but discard the results
 * const result = Effect.forEach(
 *   [1, 2, 3, 4, 5],
 *   (n, index) =>
 *     Console.log(`Currently at index ${index}`).pipe(Effect.as(n * 2)),
 *   { discard: true }
 * )
 *
 * Effect.runPromise(result).then(console.log)
 * // Output:
 * // Currently at index 0
 * // Currently at index 1
 * // Currently at index 2
 * // Currently at index 3
 * // Currently at index 4
 * // undefined
 *
 * @since 2.0.0
 * @category Collecting
 */
export const forEach: {
  <B, E, R, S extends Iterable<any>>(
    f: (a: Arr.ReadonlyArray.Infer<S>, i: number) => Effect<B, E, R>,
    options?:
      | {
        readonly concurrency?: Concurrency | undefined
        readonly discard?: false | undefined
      }
      | undefined
  ): (self: S) => Effect<Arr.ReadonlyArray.With<S, B>, E, R>
  <A, B, E, R>(
    f: (a: A, i: number) => Effect<B, E, R>,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    }
  ): (self: Iterable<A>) => Effect<void, E, R>
  <B, E, R, S extends Iterable<any>>(
    self: S,
    f: (a: Arr.ReadonlyArray.Infer<S>, i: number) => Effect<B, E, R>,
    options?:
      | {
        readonly concurrency?: Concurrency | undefined
        readonly discard?: false | undefined
      }
      | undefined
  ): Effect<Arr.ReadonlyArray.With<S, B>, E, R>
  <A, B, E, R>(
    self: Iterable<A>,
    f: (a: A, i: number) => Effect<B, E, R>,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    }
  ): Effect<void, E, R>
} = internal.forEach as any

/**
 * @since 2.0.0
 * @category Collecting
 */
export const whileLoop: <A, E, R>(options: {
  readonly while: LazyArg<boolean>
  readonly body: LazyArg<Effect<A, E, R>>
  readonly step: (a: A) => void
}) => Effect<void, E, R> = internal.whileLoop

// -----------------------------------------------------------------------------
// Creating Effects
// -----------------------------------------------------------------------------

/**
 * Creates an `Effect` that represents an asynchronous computation guaranteed to
 * succeed.
 *
 * **When to Use**
 *
 * Use `promise` when you are sure the operation will not reject.
 *
 * **Details**
 *
 * The provided function (`thunk`) returns a `Promise` that should never reject; if it does, the error
 * will be treated as a "defect".
 *
 * This defect is not a standard error but indicates a flaw in the logic that
 * was expected to be error-free. You can think of it similar to an unexpected
 * crash in the program, which can be further managed or logged using tools like
 * {@link catchAllDefect}.
 *
 * **Interruptions**
 *
 * An optional `AbortSignal` can be provided to allow for interruption of the
 * wrapped `Promise` API.
 *
 * @see {@link tryPromise} for a version that can handle failures.
 *
 * @example
 * ```ts
 * // Title: Delayed Message
 * import { Effect } from "effect"
 *
 * const delay = (message: string) =>
 *   Effect.promise<string>(
 *     () =>
 *       new Promise((resolve) => {
 *         setTimeout(() => {
 *           resolve(message)
 *         }, 2000)
 *       })
 *   )
 *
 * //      ┌─── Effect<string, never, never>
 * //      ▼
 * const program = delay("Async operation completed successfully!")
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const promise: <A>(
  evaluate: (signal: AbortSignal) => PromiseLike<A>
) => Effect<A> = internal.promise

/**
 * Creates an `Effect` that represents an asynchronous computation that might
 * fail.
 *
 * **When to Use**
 *
 * In situations where you need to perform asynchronous operations that might
 * fail, such as fetching data from an API, you can use the `tryPromise`
 * constructor. This constructor is designed to handle operations that could
 * throw exceptions by capturing those exceptions and transforming them into
 * manageable errors.
 *
 * **Error Handling**
 *
 * There are two ways to handle errors with `tryPromise`:
 *
 * 1. If you don't provide a `catch` function, the error is caught and the
 *    effect fails with an `UnknownError`.
 * 2. If you provide a `catch` function, the error is caught and the `catch`
 *    function maps it to an error of type `E`.
 *
 * **Interruptions**
 *
 * An optional `AbortSignal` can be provided to allow for interruption of the
 * wrapped `Promise` API.
 *
 * **Example** (Fetching a TODO Item)
 *
 * ```ts
 * import { Effect } from "effect"
 *
 * const getTodo = (id: number) =>
 *   // Will catch any errors and propagate them as UnknownError
 *   Effect.tryPromise(() =>
 *     fetch(`https://jsonplaceholder.typicode.com/todos/${id}`)
 *   )
 *
 * //      ┌─── Effect<Response, UnknownError, never>
 * //      ▼
 * const program = getTodo(1)
 * ```
 *
 * **Example** (Custom Error Handling)
 *
 * ```ts
 * import { Effect } from "effect"
 *
 * const getTodo = (id: number) =>
 *   Effect.tryPromise({
 *     try: () => fetch(`https://jsonplaceholder.typicode.com/todos/${id}`),
 *     // remap the error
 *     catch: (unknown) => new Error(`something went wrong ${unknown}`)
 *   })
 *
 * //      ┌─── Effect<Response, Error, never>
 * //      ▼
 * const program = getTodo(1)
 * ```
 *
 * @see {@link promise} if the effectful computation is asynchronous and does not throw errors.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const tryPromise: <A, E = Cause.UnknownError>(
  options:
    | { readonly try: (signal: AbortSignal) => PromiseLike<A>; readonly catch: (error: unknown) => E }
    | ((signal: AbortSignal) => PromiseLike<A>)
) => Effect<A, E> = internal.tryPromise

/**
 * Creates an `Effect` that always succeeds with a given value.
 *
 * **When to Use**
 *
 * Use this function when you need an effect that completes successfully with a
 * specific value without any errors or external dependencies.
 *
 * @see {@link fail} to create an effect that represents a failure.
 *
 * @example
 * ```ts
 * // Title: Creating a Successful Effect
 * import { Effect } from "effect"
 *
 * // Creating an effect that represents a successful scenario
 * //
 * //      ┌─── Effect<number, never, never>
 * //      ▼
 * const success = Effect.succeed(42)
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const succeed: <A>(value: A) => Effect<A> = internal.succeed

/**
 * Returns an effect which succeeds with `None`.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const succeedNone: Effect<Option<never>> = internal.succeedNone

/**
 * Returns an effect which succeeds with the value wrapped in a `Some`.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const succeedSome: <A>(value: A) => Effect<Option<A>> = internal.succeedSome

/**
 * Delays the creation of an `Effect` until it is actually needed.
 *
 * **When to Use**
 *
 * Use `suspend` when you need to defer the evaluation of an effect until it is required. This is particularly useful for optimizing expensive computations, managing circular dependencies, or resolving type inference issues.
 *
 * **Details**
 *
 * `suspend` takes a thunk that represents the effect and wraps it in a suspended effect. This means the effect will not be created until it is explicitly needed, which is helpful in various scenarios:
 * - **Lazy Evaluation**: Helps optimize performance by deferring computations, especially when the effect might not be needed, or when its computation is expensive. This also ensures that any side effects or scoped captures are re-executed on each invocation.
 * - **Handling Circular Dependencies**: Useful in managing circular dependencies, such as recursive functions that need to avoid eager evaluation to prevent stack overflow.
 * - **Unifying Return Types**: Can help TypeScript unify return types in situations where multiple branches of logic return different effects, simplifying type inference.
 *
 * @example
 * ```ts
 * // Title: Lazy Evaluation with Side Effects
 * import { Effect } from "effect"
 *
 * let i = 0
 *
 * const bad = Effect.succeed(i++)
 *
 * const good = Effect.suspend(() => Effect.succeed(i++))
 *
 * console.log(Effect.runSync(bad)) // Output: 0
 * console.log(Effect.runSync(bad)) // Output: 0
 *
 * console.log(Effect.runSync(good)) // Output: 1
 * console.log(Effect.runSync(good)) // Output: 2
 * ```
 *
 * @example
 * // Title: Recursive Fibonacci
 * import { Effect } from "effect"
 *
 * const blowsUp = (n: number): Effect.Effect<number> =>
 *   n < 2
 *     ? Effect.succeed(1)
 *     : Effect.zipWith(blowsUp(n - 1), blowsUp(n - 2), (a, b) => a + b)
 *
 * // console.log(Effect.runSync(blowsUp(32)))
 * // crash: JavaScript heap out of memory
 *
 * const allGood = (n: number): Effect.Effect<number> =>
 *   n < 2
 *     ? Effect.succeed(1)
 *     : Effect.zipWith(
 *         Effect.suspend(() => allGood(n - 1)),
 *         Effect.suspend(() => allGood(n - 2)),
 *         (a, b) => a + b
 *       )
 *
 * console.log(Effect.runSync(allGood(32)))
 * // Output: 3524578
 *
 * @example
 * // Title: Using Effect.suspend to Help TypeScript Infer Types
 * import { Effect } from "effect"
 *
 * //   Without suspend, TypeScript may struggle with type inference.
 * //   Inferred type:
 * //     (a: number, b: number) =>
 * //       Effect<never, Error, never> | Effect<number, never, never>
 * const withoutSuspend = (a: number, b: number) =>
 *   b === 0
 *     ? Effect.fail(new Error("Cannot divide by zero"))
 *     : Effect.succeed(a / b)
 *
 * //   Using suspend to unify return types.
 * //   Inferred type:
 * //     (a: number, b: number) => Effect<number, Error, never>
 * const withSuspend = (a: number, b: number) =>
 *   Effect.suspend(() =>
 *     b === 0
 *       ? Effect.fail(new Error("Cannot divide by zero"))
 *       : Effect.succeed(a / b)
 *   )
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const suspend: <A, E, R>(
  effect: LazyArg<Effect<A, E, R>>
) => Effect<A, E, R> = internal.suspend

/**
 * Creates an `Effect` that represents a synchronous side-effectful computation.
 *
 * **When to Use**
 *
 * Use `sync` when you are sure the operation will not fail.
 *
 * **Details**
 *
 * The provided function (`thunk`) must not throw errors; if it does, the error
 * will be treated as a "defect".
 *
 * This defect is not a standard error but indicates a flaw in the logic that
 * was expected to be error-free. You can think of it similar to an unexpected
 * crash in the program, which can be further managed or logged using tools like
 * {@link catchAllDefect}.
 *
 * @see {@link try_ | try} for a version that can handle failures.
 *
 * @example
 * ```ts
 * // Title: Logging a Message
 * import { Effect } from "effect"
 *
 * const log = (message: string) =>
 *   Effect.sync(() => {
 *     console.log(message) // side effect
 *   })
 *
 * //      ┌─── Effect<void, never, never>
 * //      ▼
 * const program = log("Hello, World!")
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const sync: <A>(thunk: LazyArg<A>) => Effect<A> = internal.sync

const _void: Effect<void> = internal.void
export {
  /**
   * @since 2.0.0
   * @category Creating Effects
   */
  _void as void
}

/**
 * Creates an `Effect` from a callback-based asynchronous function.
 *
 * **Details**
 *
 * The `resume` function:
 * - Must be called exactly once. Any additional calls will be ignored.
 * - Can return an optional `Effect` that will be run if the `Fiber` executing
 *   this `Effect` is interrupted. This can be useful in scenarios where you
 *   need to handle resource cleanup if the operation is interrupted.
 * - Can receive an `AbortSignal` to handle interruption if needed.
 *
 * The `FiberId` of the fiber that may complete the async callback may also be
 * specified using the `blockingOn` argument. This is called the "blocking
 * fiber" because it suspends the fiber executing the `async` effect (i.e.
 * semantically blocks the fiber from making progress). Specifying this fiber id
 * in cases where it is known will improve diagnostics, but not affect the
 * behavior of the returned effect.
 *
 * **When to Use**
 *
 * Use `Effect.async` when dealing with APIs that use callback-style instead of
 * `async/await` or `Promise`.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const callback: <A, E = never, R = never>(
  register: (
    this: Scheduler,
    resume: (effect: Effect<A, E, R>) => void,
    signal: AbortSignal
  ) => void | Effect<void, never, R>
) => Effect<A, E, R> = internal.callback

/**
 * Returns an effect that will never produce anything. The moral equivalent of
 * `while(true) {}`, only without the wasted CPU cycles.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const never: Effect<never> = internal.never

/**
 * Provides a way to write effectful code using generator functions, simplifying
 * control flow and error handling.
 *
 * **When to Use**
 *
 * `gen` allows you to write code that looks and behaves like synchronous
 * code, but it can handle asynchronous tasks, errors, and complex control flow
 * (like loops and conditions). It helps make asynchronous code more readable
 * and easier to manage.
 *
 * The generator functions work similarly to `async/await` but with more
 * explicit control over the execution of effects. You can `yield*` values from
 * effects and return the final result at the end.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const addServiceCharge = (amount: number) => amount + 1
 *
 * const applyDiscount = (
 *   total: number,
 *   discountRate: number
 * ): Effect.Effect<number, Error> =>
 *   discountRate === 0
 *     ? Effect.fail(new Error("Discount rate cannot be zero"))
 *     : Effect.succeed(total - (total * discountRate) / 100)
 *
 * const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
 *
 * const fetchDiscountRate = Effect.promise(() => Promise.resolve(5))
 *
 * export const program = Effect.gen(function* () {
 *   const transactionAmount = yield* fetchTransactionAmount
 *   const discountRate = yield* fetchDiscountRate
 *   const discountedAmount = yield* applyDiscount(
 *     transactionAmount,
 *     discountRate
 *   )
 *   const finalAmount = addServiceCharge(discountedAmount)
 *   return `Final amount to charge: ${finalAmount}`
 * })
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const gen: {
  <Eff extends YieldWrap<Yieldable<any, any, any>>, AEff>(
    f: () => Generator<Eff, AEff, never>
  ): Effect<
    AEff,
    [Eff] extends [never] ? never
      : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E
      : never,
    [Eff] extends [never] ? never
      : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R
      : never
  >
  <Self, Eff extends YieldWrap<Yieldable<any, any, any>>, AEff>(
    self: Self,
    f: (this: Self) => Generator<Eff, AEff, never>
  ): Effect<
    AEff,
    [Eff] extends [never] ? never
      : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E
      : never,
    [Eff] extends [never] ? never
      : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R
      : never
  >
} = internal.gen

/**
 * Creates an `Effect` that represents a recoverable error.
 *
 * **When to Use**
 *
 * Use this function to explicitly signal an error in an `Effect`. The error
 * will keep propagating unless it is handled. You can handle the error with
 * functions like {@link catchAll} or {@link catchTag}.
 *
 * @see {@link succeed} to create an effect that represents a successful value.
 *
 * @example
 * ```ts
 * // Title: Creating a Failed Effect
 * import { Effect } from "effect"
 *
 * //      ┌─── Effect<never, Error, never>
 * //      ▼
 * const failure = Effect.fail(
 *   new Error("Operation failed due to network error")
 * )
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const fail: <E>(error: E) => Effect<never, E> = internal.fail

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const failSync: <E>(evaluate: LazyArg<E>) => Effect<never, E> = internal.failSync

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const failCause: <E>(cause: Cause.Cause<E>) => Effect<never, E> = internal.failCause

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const failCauseSync: <E>(
  evaluate: LazyArg<Cause.Cause<E>>
) => Effect<never, E> = internal.failCauseSync

/**
 * Creates an effect that terminates a fiber with a specified error.
 *
 * **When to Use**
 *
 * Use `die` when encountering unexpected conditions in your code that should
 * not be handled as regular errors but instead represent unrecoverable defects.
 *
 * **Details**
 *
 * The `die` function is used to signal a defect, which represents a critical
 * and unexpected error in the code. When invoked, it produces an effect that
 * does not handle the error and instead terminates the fiber.
 *
 * The error channel of the resulting effect is of type `never`, indicating that
 * it cannot recover from this failure.
 *
 * @see {@link dieSync} for a variant that throws a specified error, evaluated lazily.
 * @see {@link dieMessage} for a variant that throws a `RuntimeException` with a message.
 *
 * @example
 * ```ts
 * // Title: Terminating on Division by Zero with a Specified Error
 * import { Effect } from "effect"
 *
 * const divide = (a: number, b: number) =>
 *   b === 0
 *     ? Effect.die(new Error("Cannot divide by zero"))
 *     : Effect.succeed(a / b)
 *
 * //      ┌─── Effect<number, never, never>
 * //      ▼
 * const program = divide(1, 0)
 *
 * Effect.runPromise(program).catch(console.error)
 * // Output:
 * // (FiberFailure) Error: Cannot divide by zero
 * //   ...stack trace...
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const die: (defect: unknown) => Effect<never> = internal.die

const try_: <A, E>(options: {
  try: LazyArg<A>
  catch: (error: unknown) => E
}) => Effect<A, E> = internal.try

export {
  /**
   * Creates an `Effect` that represents a synchronous computation that might
   * fail.
   *
   * **When to Use**
   *
   * In situations where you need to perform synchronous operations that might
   * fail, such as parsing JSON, you can use the `try` constructor. This
   * constructor is designed to handle operations that could throw exceptions by
   * capturing those exceptions and transforming them into manageable errors.
   *
   * **Error Handling**
   *
   * There are two ways to handle errors with `try`:
   *
   * 1. If you don't provide a `catch` function, the error is caught and the
   *    effect fails with an `UnknownError`.
   * 2. If you provide a `catch` function, the error is caught and the `catch`
   *    function maps it to an error of type `E`.
   *
   * @see {@link sync} if the effectful computation is synchronous and does not
   * throw errors.
   *
   * @since 2.0.0
   * @category Creating Effects
   */
  try_ as try
}

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const yieldNow: Effect<void> = internal.yieldNow

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const yieldNowWith: (priority?: number) => Effect<void> = internal.yieldNowWith

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const withFiber: <A, E = never, R = never>(
  evaluate: (fiber: Fiber<unknown, unknown>) => Effect<A, E, R>
) => Effect<A, E, R> = core.withFiber

// -----------------------------------------------------------------------------
// Conversions
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 * @category Conversions
 */
export const fromResult: <A, E>(result: Result.Result<A, E>) => Effect<A, E> = internal.fromResult

/**
 * @since 4.0.0
 * @category Conversions
 */
export const fromOption: <A>(
  option: Option<A>
) => Effect<A, Cause.NoSuchElementError> = internal.fromOption

/**
 * @since 4.0.0
 * @category Conversions
 */
export const fromYieldable: <A, E, R>(
  yieldable: Yieldable<A, E, R>
) => Effect<A, E, R> = internal.fromYieldable

// -----------------------------------------------------------------------------
// Mapping
// -----------------------------------------------------------------------------

/**
 * Chains effects to produce new `Effect` instances, useful for combining
 * operations that depend on previous results.
 *
 * **Syntax**
 *
 * ```ts skip-type-checking
 * const flatMappedEffect = pipe(myEffect, Effect.flatMap(transformation))
 * // or
 * const flatMappedEffect = Effect.flatMap(myEffect, transformation)
 * // or
 * const flatMappedEffect = myEffect.pipe(Effect.flatMap(transformation))
 * ```
 *
 * **Details**
 *
 * `flatMap` lets you sequence effects so that the result of one effect can be
 * used in the next step. It is similar to `flatMap` used with arrays but works
 * specifically with `Effect` instances, allowing you to avoid deeply nested
 * effect structures.
 *
 * Since effects are immutable, `flatMap` always returns a new effect instead of
 * changing the original one.
 *
 * **When to Use**
 *
 * Use `flatMap` when you need to chain multiple effects, ensuring that each
 * step produces a new `Effect` while flattening any nested effects that may
 * occur.
 *
 * **Example**
 *
 * ```ts
 * import { pipe, Effect } from "effect"
 *
 * // Function to apply a discount safely to a transaction amount
 * const applyDiscount = (
 *   total: number,
 *   discountRate: number
 * ): Effect.Effect<number, Error> =>
 *   discountRate === 0
 *     ? Effect.fail(new Error("Discount rate cannot be zero"))
 *     : Effect.succeed(total - (total * discountRate) / 100)
 *
 * // Simulated asynchronous task to fetch a transaction amount from database
 * const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
 *
 * // Chaining the fetch and discount application using `flatMap`
 * const finalAmount = pipe(
 *   fetchTransactionAmount,
 *   Effect.flatMap((amount) => applyDiscount(amount, 5))
 * )
 *
 * Effect.runPromise(finalAmount).then(console.log)
 * // Output: 95
 * ```
 *
 * @see {@link tap} for a version that ignores the result of the effect.
 *
 * @since 2.0.0
 * @category Sequencing
 */
export const flatMap: {
  <A, B, E1, R1>(
    f: (a: A) => Effect<B, E1, R1>
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E1 | E, R1 | R>
  <A, E, R, B, E1, R1>(
    self: Effect<A, E, R>,
    f: (a: A) => Effect<B, E1, R1>
  ): Effect<B, E | E1, R | R1>
} = internal.flatMap

/**
 * Chains two actions, where the second action can depend on the result of the
 * first.
 *
 * **Syntax**
 *
 * ```ts skip-type-checking
 * const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))
 * // or
 * const transformedEffect = Effect.andThen(myEffect, anotherEffect)
 * // or
 * const transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))
 * ```
 *
 * **When to Use**
 *
 * Use `andThen` when you need to run multiple actions in sequence, with the
 * second action depending on the result of the first. This is useful for
 * combining effects or handling computations that must happen in order.
 *
 * **Details**
 *
 * The second action can be:
 *
 * - A constant value (similar to {@link as})
 * - A function returning a value (similar to {@link map})
 * - A `Promise`
 * - A function returning a `Promise`
 * - An `Effect`
 * - A function returning an `Effect` (similar to {@link flatMap})
 *
 * **Note:** `andThen` works well with both `Option` and `Result` types,
 * treating them as effects.
 *
 * **Example** (Applying a Discount Based on Fetched Amount)
 *
 * ```ts
 * import { pipe, Effect } from "effect"
 *
 * // Function to apply a discount safely to a transaction amount
 * const applyDiscount = (
 *   total: number,
 *   discountRate: number
 * ): Effect.Effect<number, Error> =>
 *   discountRate === 0
 *     ? Effect.fail(new Error("Discount rate cannot be zero"))
 *     : Effect.succeed(total - (total * discountRate) / 100)
 *
 * // Simulated asynchronous task to fetch a transaction amount from database
 * const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
 *
 * // Using Effect.map and Effect.flatMap
 * const result1 = pipe(
 *   fetchTransactionAmount,
 *   Effect.map((amount) => amount * 2),
 *   Effect.flatMap((amount) => applyDiscount(amount, 5))
 * )
 *
 * Effect.runPromise(result1).then(console.log)
 * // Output: 190
 *
 * // Using Effect.andThen
 * const result2 = pipe(
 *   fetchTransactionAmount,
 *   Effect.andThen((amount) => amount * 2),
 *   Effect.andThen((amount) => applyDiscount(amount, 5))
 * )
 *
 * Effect.runPromise(result2).then(console.log)
 * // Output: 190
 * ```
 *
 * @since 2.0.0
 * @category Sequencing
 */
export const andThen: {
  <A, X>(
    f: (a: A) => X
  ): <E, R>(
    self: Effect<A, E, R>
  ) => [X] extends [Effect<infer A1, infer E1, infer R1>] ? Effect<A1, E | E1, R | R1>
    : Effect<X, E, R>
  <X>(
    f: NotFunction<X>
  ): <A, E, R>(
    self: Effect<A, E, R>
  ) => [X] extends [Effect<infer A1, infer E1, infer R1>] ? Effect<A1, E | E1, R | R1>
    : Effect<X, E, R>
  <A, E, R, X>(
    self: Effect<A, E, R>,
    f: (a: A) => X
  ): [X] extends [Effect<infer A1, infer E1, infer R1>] ? Effect<A1, E | E1, R | R1>
    : Effect<X, E, R>
  <A, E, R, X>(
    self: Effect<A, E, R>,
    f: NotFunction<X>
  ): [X] extends [Effect<infer A1, infer E1, infer R1>] ? Effect<A1, E | E1, R | R1>
    : Effect<X, E, R>
} = internal.andThen

/**
 * Runs a side effect with the result of an effect without changing the original
 * value.
 *
 * **When to Use**
 *
 * Use `tap` when you want to perform a side effect, like logging or tracking,
 * without modifying the main value. This is useful when you need to observe or
 * record an action but want the original value to be passed to the next step.
 *
 * **Details**
 *
 * `tap` works similarly to `flatMap`, but it ignores the result of the function
 * passed to it. The value from the previous effect remains available for the
 * next part of the chain. Note that if the side effect fails, the entire chain
 * will fail too.
 *
 * @example
 * ```ts
 * // Title: Logging a step in a pipeline
 * import { Console, Effect, pipe } from "effect"
 *
 * // Function to apply a discount safely to a transaction amount
 * const applyDiscount = (
 *   total: number,
 *   discountRate: number
 * ): Effect.Effect<number, Error> =>
 *   discountRate === 0
 *     ? Effect.fail(new Error("Discount rate cannot be zero"))
 *     : Effect.succeed(total - (total * discountRate) / 100)
 *
 * // Simulated asynchronous task to fetch a transaction amount from database
 * const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
 *
 * const finalAmount = pipe(
 *   fetchTransactionAmount,
 *   // Log the fetched transaction amount
 *   Effect.tap((amount) => Console.log(`Apply a discount to: ${amount}`)),
 *   // `amount` is still available!
 *   Effect.flatMap((amount) => applyDiscount(amount, 5))
 * )
 *
 * Effect.runPromise(finalAmount).then(console.log)
 * // Output:
 * // Apply a discount to: 100
 * // 95
 * ```
 *
 * @since 2.0.0
 * @category sequencing
 */
export const tap: {
  <A, X>(
    f: (a: NoInfer<A>) => X
  ): <E, R>(
    self: Effect<A, E, R>
  ) => [X] extends [Effect<infer _A1, infer E1, infer R1>] ? Effect<A, E | E1, R | R1>
    : Effect<A, E, R>
  <A, X, E1, R1>(
    f: (a: NoInfer<A>) => Effect<X, E1, R1>,
    options: { onlyEffect: true }
  ): <E, R>(self: Effect<A, E, R>) => Effect<A, E | E1, R | R1>
  <X>(
    f: NotFunction<X>
  ): <A, E, R>(
    self: Effect<A, E, R>
  ) => [X] extends [Effect<infer _A1, infer E1, infer R1>] ? Effect<A, E | E1, R | R1>
    : Effect<A, E, R>
  <X, E1, R1>(
    f: Effect<X, E1, R1>,
    options: { onlyEffect: true }
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | E1, R | R1>
  <A, E, R, X>(
    self: Effect<A, E, R>,
    f: (a: NoInfer<A>) => X
  ): [X] extends [Effect<infer _A1, infer E1, infer R1>] ? Effect<A, E | E1, R | R1>
    : Effect<A, E, R>
  <A, E, R, X, E1, R1>(
    self: Effect<A, E, R>,
    f: (a: NoInfer<A>) => Effect<X, E1, R1>,
    options: { onlyEffect: true }
  ): Effect<A, E | E1, R | R1>
  <A, E, R, X>(
    self: Effect<A, E, R>,
    f: NotFunction<X>
  ): [X] extends [Effect<infer _A1, infer E1, infer R1>] ? Effect<A, E | E1, R | R1>
    : Effect<A, E, R>
  <A, E, R, X, E1, R1>(
    self: Effect<A, E, R>,
    f: Effect<X, E1, R1>,
    options: { onlyEffect: true }
  ): Effect<A, E | E1, R | R1>
} = internal.tap

/**
 * Encapsulates both success and failure of an `Effect` into a `Result` type.
 *
 * **Details**
 *
 * This function converts an effect that may fail into an effect that always
 * succeeds, wrapping the outcome in a `Result` type. The result will be
 * `Result.Err` if the effect fails, containing the recoverable error, or
 * `Result.Ok` if it succeeds, containing the result.
 *
 * Using this function, you can handle recoverable errors explicitly without
 * causing the effect to fail. This is particularly useful in scenarios where
 * you want to chain effects and manage both success and failure in the same
 * logical flow.
 *
 * It's important to note that unrecoverable errors, often referred to as
 * "defects," are still thrown and not captured within the `Result` type. Only
 * failures that are explicitly represented as recoverable errors in the effect
 * are encapsulated.
 *
 * The resulting effect cannot fail directly because all recoverable failures
 * are represented inside the `Result` type.
 *
 * @see {@link option} for a version that uses `Option` instead.
 * @see {@link exit} for a version that encapsulates both recoverable errors and defects in an `Exit`.
 *
 * @since 4.0.0
 * @category Outcome Encapsulation
 */
export const result: <A, E, R>(self: Effect<A, E, R>) => Effect<Result.Result<A, E>, never, R> = internal.result

/**
 * Transforms an effect to encapsulate both failure and success using the `Exit`
 * data type.
 *
 * **Details**
 *
 * `exit` wraps an effect's success or failure inside an `Exit` type, allowing
 * you to handle both cases explicitly.
 *
 * The resulting effect cannot fail because the failure is encapsulated within
 * the `Exit.Failure` type. The error type is set to `never`, indicating that
 * the effect is structured to never fail directly.
 *
 * @see {@link option} for a version that uses `Option` instead.
 * @see {@link result} for a version that uses `Result` instead.
 *
 * @since 2.0.0
 * @category Outcome Encapsulation
 */
export const exit: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<Exit.Exit<A, E>, never, R> = internal.exit

/**
 * Transforms the value inside an effect by applying a function to it.
 *
 * **Syntax**
 *
 * ```ts skip-type-checking
 * const mappedEffect = pipe(myEffect, Effect.map(transformation))
 * // or
 * const mappedEffect = Effect.map(myEffect, transformation)
 * // or
 * const mappedEffect = myEffect.pipe(Effect.map(transformation))
 * ```
 *
 * **Details**
 *
 * `map` takes a function and applies it to the value contained within an
 * effect, creating a new effect with the transformed value.
 *
 * It's important to note that effects are immutable, meaning that the original
 * effect is not modified. Instead, a new effect is returned with the updated
 * value.
 *
 * **Example** (Adding a Service Charge)
 *
 * ```ts
 * import { pipe, Effect } from "effect"
 *
 * const addServiceCharge = (amount: number) => amount + 1
 *
 * const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
 *
 * const finalAmount = pipe(
 *   fetchTransactionAmount,
 *   Effect.map(addServiceCharge)
 * )
 *
 * Effect.runPromise(finalAmount).then(console.log)
 * // Output: 101
 * ```
 *
 * @see {@link mapError} for a version that operates on the error channel.
 * @see {@link mapBoth} for a version that operates on both channels.
 * @see {@link flatMap} or {@link andThen} for a version that can return a new effect.
 *
 * @since 2.0.0
 * @category Mapping
 */
export const map: {
  <A, B>(f: (a: A) => B): <E, R>(self: Effect<A, E, R>) => Effect<B, E, R>
  <A, E, R, B>(self: Effect<A, E, R>, f: (a: A) => B): Effect<B, E, R>
} = internal.map

/**
 * Replaces the value inside an effect with a constant value.
 *
 * `as` allows you to ignore the original value inside an effect and
 * replace it with a new constant value.
 *
 * @example
 * ```ts
 * // Title: Replacing a Value
 * import { pipe, Effect } from "effect"
 *
 * // Replaces the value 5 with the constant "new value"
 * const program = pipe(Effect.succeed(5), Effect.as("new value"))
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: "new value"
 * ```
 *
 * @since 2.0.0
 * @category Mapping
 */
export const as: {
  <B>(value: B): <A, E, R>(self: Effect<A, E, R>) => Effect<B, E, R>
  <A, E, R, B>(self: Effect<A, E, R>, value: B): Effect<B, E, R>
} = internal.as

/**
 * This function maps the success value of an `Effect` value to a `Some` value
 * in an `Option` value. If the original `Effect` value fails, the returned
 * `Effect` value will also fail.
 *
 * @category Mapping
 * @since 2.0.0
 */
export const asSome: <A, E, R>(self: Effect<A, E, R>) => Effect<Option<A>, E, R> = internal.asSome

/**
 * This function maps the success value of an `Effect` value to `void`. If the
 * original `Effect` value succeeds, the returned `Effect` value will also
 * succeed. If the original `Effect` value fails, the returned `Effect` value
 * will fail with the same error.
 *
 * @since 2.0.0
 * @category Mapping
 */
export const asVoid: <A, E, R>(self: Effect<A, E, R>) => Effect<void, E, R> = internal.asVoid

/**
 * The `flip` function swaps the success and error channels of an effect,
 * so that the success becomes the error, and the error becomes the success.
 *
 * This function is useful when you need to reverse the flow of an effect,
 * treating the previously successful values as errors and vice versa. This can
 * be helpful in scenarios where you want to handle a success as a failure or
 * treat an error as a valid result.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * //      ┌─── Effect<number, string, never>
 * //      ▼
 * const program = Effect.fail("Oh uh!").pipe(Effect.as(2))
 *
 * //      ┌─── Effect<string, number, never>
 * //      ▼
 * const flipped = Effect.flip(program)
 * ```
 *
 * @since 2.0.0
 * @category Mapping
 */
export const flip: <A, E, R>(self: Effect<A, E, R>) => Effect<E, A, R> = internal.flip

// -----------------------------------------------------------------------------
// Zipping
// -----------------------------------------------------------------------------

/**
 * Combines two effects into a single effect, producing a tuple with the results of both effects.
 *
 * The `zip` function executes the first effect (left) and then the second effect (right).
 * Once both effects succeed, their results are combined into a tuple.
 *
 * **Concurrency**
 *
 * By default, `zip` processes the effects sequentially. To execute the effects concurrently,
 * use the `{ concurrent: true }` option.
 *
 * @see {@link zipWith} for a version that combines the results with a custom function.
 * @see {@link validate} for a version that accumulates errors.
 *
 * @example
 * ```ts
 * // Title: Combining Two Effects Sequentially
 * import { Effect } from "effect"
 *
 * const task1 = Effect.succeed(1).pipe(
 *   Effect.delay("200 millis"),
 *   Effect.tap(Effect.log("task1 done"))
 * )
 * const task2 = Effect.succeed("hello").pipe(
 *   Effect.delay("100 millis"),
 *   Effect.tap(Effect.log("task2 done"))
 * )
 *
 * // Combine the two effects together
 * //
 * //      ┌─── Effect<[number, string], never, never>
 * //      ▼
 * const program = Effect.zip(task1, task2)
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // timestamp=... level=INFO fiber=#0 message="task1 done"
 * // timestamp=... level=INFO fiber=#0 message="task2 done"
 * // [ 1, 'hello' ]
 * ```
 *
 * @example
 * // Title: Combining Two Effects Concurrently
 * import { Effect } from "effect"
 *
 * const task1 = Effect.succeed(1).pipe(
 *   Effect.delay("200 millis"),
 *   Effect.tap(Effect.log("task1 done"))
 * )
 * const task2 = Effect.succeed("hello").pipe(
 *   Effect.delay("100 millis"),
 *   Effect.tap(Effect.log("task2 done"))
 * )
 *
 * // Run both effects concurrently using the concurrent option
 * const program = Effect.zip(task1, task2, { concurrent: true })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // timestamp=... level=INFO fiber=#0 message="task2 done"
 * // timestamp=... level=INFO fiber=#0 message="task1 done"
 * // [ 1, 'hello' ]
 *
 * @since 2.0.0
 * @category Zipping
 */
export const zip: {
  <A2, E2, R2>(
    that: Effect<A2, E2, R2>,
    options?: { readonly concurrent?: boolean | undefined } | undefined
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<[A, A2], E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
    options?: { readonly concurrent?: boolean | undefined }
  ): Effect<[A, A2], E | E2, R | R2>
} = internal.zip

/**
 * Combines two effects sequentially and applies a function to their results to
 * produce a single value.
 *
 * **When to Use**
 *
 * The `zipWith` function is similar to {@link zip}, but instead of returning a
 * tuple of results, it applies a provided function to the results of the two
 * effects, combining them into a single value.
 *
 * **Concurrency**
 *
 * By default, the effects are run sequentially. To execute them concurrently,
 * use the `{ concurrent: true }` option.
 *
 * @example
 * ```ts
 * // Title: Combining Effects with a Custom Function
 * import { Effect } from "effect"
 *
 * const task1 = Effect.succeed(1).pipe(
 *   Effect.delay("200 millis"),
 *   Effect.tap(Effect.log("task1 done"))
 * )
 * const task2 = Effect.succeed("hello").pipe(
 *   Effect.delay("100 millis"),
 *   Effect.tap(Effect.log("task2 done"))
 * )
 *
 * const task3 = Effect.zipWith(
 *   task1,
 *   task2,
 *   // Combines results into a single value
 *   (number, string) => number + string.length
 * )
 *
 * Effect.runPromise(task3).then(console.log)
 * // Output:
 * // timestamp=... level=INFO fiber=#3 message="task1 done"
 * // timestamp=... level=INFO fiber=#2 message="task2 done"
 * // 6
 * ```
 *
 * @since 2.0.0
 * @category Zipping
 */
export const zipWith: {
  <A2, E2, R2, A, B>(
    that: Effect<A2, E2, R2>,
    f: (a: A, b: A2) => B,
    options?: { readonly concurrent?: boolean | undefined }
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2, B>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
    f: (a: A, b: A2) => B,
    options?: { readonly concurrent?: boolean | undefined }
  ): Effect<B, E2 | E, R2 | R>
} = internal.zipWith

// -----------------------------------------------------------------------------
// Error handling
// -----------------------------------------------------------------------------

const catch_: {
  <E, A2, E2, R2>(
    f: (e: E) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E2, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    f: (e: E) => Effect<A2, E2, R2>
  ): Effect<A2 | A, E2, R2 | R>
} = internal.catch_

export {
  /**
   * Handles all errors in an effect by providing a fallback effect.
   *
   * **Details**
   *
   * The `catchAll` function catches any errors that may occur during the
   * execution of an effect and allows you to handle them by specifying a fallback
   * effect. This ensures that the program continues without failing by recovering
   * from errors using the provided fallback logic.
   *
   * **Note**: `catchAll` only handles recoverable errors. It will not recover
   * from unrecoverable defects.
   *
   * @see {@link catchAllCause} for a version that can recover from both recoverable and unrecoverable errors.
   *
   * @since 4.0.0
   * @category Error handling
   */
  catch_ as catch
}

/**
 * Catches and handles specific errors by their `_tag` field, which is used as a
 * discriminator.
 *
 * **When to Use**
 *
 * `catchTag` is useful when your errors are tagged with a readonly `_tag` field
 * that identifies the error type. You can use this function to handle specific
 * error types by matching the `_tag` value. This allows for precise error
 * handling, ensuring that only specific errors are caught and handled.
 *
 * The error type must have a readonly `_tag` field to use `catchTag`. This
 * field is used to identify and match errors.
 *
 * @since 2.0.0
 * @category Error handling
 */
export const catchTag: {
  <K extends E extends { _tag: string } ? E["_tag"] : never, E, A1, E1, R1>(
    k: K,
    f: (e: NoInfer<Extract<E, { _tag: K }>>) => Effect<A1, E1, R1>
  ): <A, R>(
    self: Effect<A, E, R>
  ) => Effect<A1 | A, E1 | Exclude<E, { _tag: K }>, R1 | R>
  <
    A,
    E,
    R,
    K extends E extends { _tag: string } ? E["_tag"] : never,
    R1,
    E1,
    A1
  >(
    self: Effect<A, E, R>,
    k: K,
    f: (e: Extract<E, { _tag: K }>) => Effect<A1, E1, R1>
  ): Effect<A | A1, E1 | Exclude<E, { _tag: K }>, R | R1>
} = internal.catchTag

/**
 * Handles multiple errors in a single block of code using their `_tag` field.
 *
 * **When to Use**
 *
 * `catchTags` is a convenient way to handle multiple error types at
 * once. Instead of using {@link catchTag} multiple times, you can pass an
 * object where each key is an error type's `_tag`, and the value is the handler
 * for that specific error. This allows you to catch and recover from multiple
 * error types in a single call.
 *
 * The error type must have a readonly `_tag` field to use `catchTag`. This
 * field is used to identify and match errors.
 *
 * @since 2.0.0
 * @category Error handling
 */
export const catchTags: {
  <
    E,
    Cases extends
      & { [K in Extract<E, { _tag: string }>["_tag"]]+?: ((error: Extract<E, { _tag: K }>) => Effect<any, any, any>) }
      & (unknown extends E ? {} : { [K in Exclude<keyof Cases, Extract<E, { _tag: string }>["_tag"]>]: never })
  >(
    cases: Cases
  ): <A, R>(
    self: Effect<A, E, R>
  ) => Effect<
    | A
    | {
      [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Effect<infer A, any, any> ? A : never
    }[keyof Cases],
    | Exclude<E, { _tag: keyof Cases }>
    | {
      [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Effect<any, infer E, any> ? E : never
    }[keyof Cases],
    | R
    | {
      [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Effect<any, any, infer R> ? R : never
    }[keyof Cases]
  >
  <
    R,
    E,
    A,
    Cases extends
      & { [K in Extract<E, { _tag: string }>["_tag"]]+?: ((error: Extract<E, { _tag: K }>) => Effect<any, any, any>) }
      & (unknown extends E ? {} : { [K in Exclude<keyof Cases, Extract<E, { _tag: string }>["_tag"]>]: never })
  >(
    self: Effect<A, E, R>,
    cases: Cases
  ): Effect<
    | A
    | {
      [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Effect<infer A, any, any> ? A : never
    }[keyof Cases],
    | Exclude<E, { _tag: keyof Cases }>
    | {
      [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Effect<any, infer E, any> ? E : never
    }[keyof Cases],
    | R
    | {
      [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Effect<any, any, infer R> ? R : never
    }[keyof Cases]
  >
} = internal.catchTags

/**
 * Handles both recoverable and unrecoverable errors by providing a recovery
 * effect.
 *
 * **When to Use**
 *
 * The `catchAllCause` function allows you to handle all errors, including
 * unrecoverable defects, by providing a recovery effect. The recovery logic is
 * based on the `Cause` of the error, which provides detailed information about
 * the failure.
 *
 * **When to Recover from Defects**
 *
 * Defects are unexpected errors that typically shouldn't be recovered from, as
 * they often indicate serious issues. However, in some cases, such as
 * dynamically loaded plugins, controlled recovery might be needed.
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchCause: {
  <E, A2, E2, R2>(
    f: (cause: Cause.Cause<E>) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E2, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    f: (cause: Cause.Cause<E>) => Effect<A2, E2, R2>
  ): Effect<A | A2, E2, R | R2>
} = internal.catchCause

/**
 * Recovers from all defects using a provided recovery function.
 *
 * **When to Use**
 *
 * There is no sensible way to recover from defects. This method should be used
 * only at the boundary between Effect and an external system, to transmit
 * information on a defect for diagnostic or explanatory purposes.
 *
 * **Details**
 *
 * `catchAllDefect` allows you to handle defects, which are unexpected errors
 * that usually cause the program to terminate. This function lets you recover
 * from these defects by providing a function that handles the error. However,
 * it does not handle expected errors (like those from {@link fail}) or
 * execution interruptions (like those from {@link interrupt}).
 *
 * **When to Recover from Defects**
 *
 * Defects are unexpected errors that typically shouldn't be recovered from, as
 * they often indicate serious issues. However, in some cases, such as
 * dynamically loaded plugins, controlled recovery might be needed.
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchDefect: {
  <A2, E2, R2>(
    f: (defect: unknown) => Effect<A2, E2, R2>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A2 | A, E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    f: (defect: unknown) => Effect<A2, E2, R2>
  ): Effect<A | A2, E | E2, R | R2>
} = internal.catchDefect

/**
 * Recovers from specific errors based on a predicate.
 *
 * **When to Use**
 *
 * `catchIf` works similarly to {@link catchSome}, but it allows you to
 * recover from errors by providing a predicate function. If the predicate
 * matches the error, the recovery effect is applied. This function doesn't
 * alter the error type, so the resulting effect still carries the original
 * error type unless a user-defined type guard is used to narrow the type.
 *
 * @since 2.0.0
 * @category Error handling
 */
export const catchIf: {
  <E, EB extends E, A2, E2, R2>(
    refinement: Predicate.Refinement<NoInfer<E>, EB>,
    f: (e: EB) => Effect<A2, E2, R2>
  ): <A, R>(
    self: Effect<A, E, R>
  ) => Effect<A2 | A, E2 | Exclude<E, EB>, R2 | R>
  <E, A2, E2, R2>(
    predicate: Predicate.Predicate<NoInfer<E>>,
    f: (e: NoInfer<E>) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E | E2, R2 | R>
  <A, E, R, EB extends E, A2, E2, R2>(
    self: Effect<A, E, R>,
    refinement: Predicate.Refinement<E, EB>,
    f: (e: EB) => Effect<A2, E2, R2>
  ): Effect<A | A2, E2 | Exclude<E, EB>, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate.Predicate<E>,
    f: (e: E) => Effect<A2, E2, R2>
  ): Effect<A | A2, E | E2, R | R2>
} = internal.catchIf

/**
 * Recovers from specific failures based on a predicate.
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchFailure: {
  <E, B, E2, R2, EB extends Cause.Failure<E>>(
    refinement: Predicate.Refinement<Cause.Failure<E>, EB>,
    f: (failure: EB, cause: Cause.Cause<E>) => Effect<B, E2, R2>
  ): <A, R>(
    self: Effect<A, E, R>
  ) => Effect<A | B, Exclude<E, Cause.Failure.Error<EB>> | E2, R | R2>
  <E, B, E2, R2>(
    predicate: Predicate.Predicate<Cause.Failure<NoInfer<E>>>,
    f: (
      failure: NoInfer<Cause.Failure<E>>,
      cause: Cause.Cause<E>
    ) => Effect<B, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | B, E | E2, R | R2>
  <A, E, R, B, E2, R2, EB extends Cause.Failure<E>>(
    self: Effect<A, E, R>,
    refinement: Predicate.Refinement<Cause.Failure<E>, EB>,
    f: (failure: EB, cause: Cause.Cause<E>) => Effect<B, E2, R2>
  ): Effect<A | B, Exclude<E, Cause.Failure.Error<EB>> | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate.Predicate<Cause.Failure<NoInfer<E>>>,
    f: (
      failure: NoInfer<Cause.Failure<E>>,
      cause: Cause.Cause<E>
    ) => Effect<B, E2, R2>
  ): Effect<A | B, E | E2, R | R2>
} = internal.catchFailure

/**
 * The `mapError` function is used to transform or modify the error
 * produced by an effect, without affecting its success value.
 *
 * This function is helpful when you want to enhance the error with additional
 * information, change the error type, or apply custom error handling while
 * keeping the original behavior of the effect's success values intact. It only
 * operates on the error channel and leaves the success channel unchanged.
 *
 * @see {@link map} for a version that operates on the success channel.
 * @see {@link mapBoth} for a version that operates on both channels.
 * @see {@link orElseFail} if you want to replace the error with a new one.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * //      ┌─── Effect<number, string, never>
 * //      ▼
 * const simulatedTask = Effect.fail("Oh no!").pipe(Effect.as(1))
 *
 * //      ┌─── Effect<number, Error, never>
 * //      ▼
 * const mapped = Effect.mapError(
 *   simulatedTask,
 *   (message) => new Error(message)
 * )
 * ```
 *
 * @since 2.0.0
 * @category Error handling
 */
export const mapError: {
  <E, E2>(f: (e: E) => E2): <A, R>(self: Effect<A, E, R>) => Effect<A, E2, R>
  <A, E, R, E2>(self: Effect<A, E, R>, f: (e: E) => E2): Effect<A, E2, R>
} = internal.mapError

/**
 * Applies transformations to both the success and error channels of an effect.
 *
 * **Details**
 *
 * This function takes two map functions as arguments: one for the error channel
 * and one for the success channel. You can use it when you want to modify both
 * the error and the success values without altering the overall success or
 * failure status of the effect.
 *
 * **Example**
 *
 * ```ts
 * import { Effect } from "effect"
 *
 * //      ┌─── Effect<number, string, never>
 * //      ▼
 * const simulatedTask = Effect.fail("Oh no!").pipe(Effect.as(1))
 *
 * //      ┌─── Effect<boolean, Error, never>
 * //      ▼
 * const modified = Effect.mapBoth(simulatedTask, {
 *   onFailure: (message) => new Error(message),
 *   onSuccess: (n) => n > 0
 * })
 * ```
 *
 * @see {@link map} for a version that operates on the success channel.
 * @see {@link mapError} for a version that operates on the error channel.
 *
 * @since 2.0.0
 * @category Mapping
 */
export const mapBoth: {
  <E, E2, A, A2>(
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): <R>(self: Effect<A, E, R>) => Effect<A2, E2, R>
  <A, E, R, E2, A2>(
    self: Effect<A, E, R>,
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): Effect<A2, E2, R>
} = internal.mapBoth

/**
 * Converts an effect's failure into a fiber termination, removing the error from the effect's type.
 *
 * **When to Use*
 *
 * Use `orDie` when failures should be treated as unrecoverable defects and no error handling is required.
 *
 * **Details**
 *
 * The `orDie` function is used when you encounter errors that you do not want to handle or recover from.
 * It removes the error type from the effect and ensures that any failure will terminate the fiber.
 * This is useful for propagating failures as defects, signaling that they should not be handled within the effect.
 *
 * @see {@link orDieWith} if you need to customize the error.
 *
 * @example
 * ```ts
 * // Title: Propagating an Error as a Defect
 * import { Effect } from "effect"
 *
 * const divide = (a: number, b: number) =>
 *   b === 0
 *     ? Effect.fail(new Error("Cannot divide by zero"))
 *     : Effect.succeed(a / b)
 *
 * //      ┌─── Effect<number, never, never>
 * //      ▼
 * const program = Effect.orDie(divide(1, 0))
 *
 * Effect.runPromise(program).catch(console.error)
 * // Output:
 * // (FiberFailure) Error: Cannot divide by zero
 * //   ...stack trace...
 * ```
 *
 * @since 2.0.0
 * @category Converting Failures to Defects
 */
export const orDie: <A, E, R>(self: Effect<A, E, R>) => Effect<A, never, R> = internal.orDie

/**
 * The `tapError` function executes an effectful operation to inspect the
 * failure of an effect without modifying it.
 *
 * This function is useful when you want to perform some side effect (like
 * logging or tracking) on the failure of an effect, but without changing the
 * result of the effect itself. The error remains in the effect's error channel,
 * while the operation you provide can inspect or act on it.
 *
 * @example
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * // Simulate a task that fails with an error
 * const task: Effect.Effect<number, string> = Effect.fail("NetworkError")
 *
 * // Use tapError to log the error message when the task fails
 * const tapping = Effect.tapError(task, (error) =>
 *   Console.log(`expected error: ${error}`)
 * )
 *
 * Effect.runFork(tapping)
 * // Output:
 * // expected error: NetworkError
 * ```
 *
 * @since 2.0.0
 * @category sequencing
 */
export const tapError: {
  <E, X, E2, R2>(
    f: (e: NoInfer<E>) => Effect<X, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E2, R2 | R>
  <A, E, R, X, E2, R2>(
    self: Effect<A, E, R>,
    f: (e: E) => Effect<X, E2, R2>
  ): Effect<A, E | E2, R | R2>
} = internal.tapError

/**
 * The `tapErrorCause` function allows you to inspect the complete cause
 * of an error, including failures and defects.
 *
 * This function is helpful when you need to log, monitor, or handle specific
 * error causes in your effects. It gives you access to the full error cause,
 * whether it’s a failure, defect, or other exceptional conditions, without
 * altering the error or the overall result of the effect.
 *
 * @since 2.0.0
 * @category sequencing
 */
export const tapCause: {
  <E, X, E2, R2>(
    f: (cause: Cause.Cause<NoInfer<E>>) => Effect<X, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E2, R2 | R>
  <A, E, R, X, E2, R2>(
    self: Effect<A, E, R>,
    f: (cause: Cause.Cause<E>) => Effect<X, E2, R2>
  ): Effect<A, E | E2, R | R2>
} = internal.tapCause

/**
 * Inspect severe errors or defects (non-recoverable failures) in an effect.
 *
 * **Details**
 *
 * This function is specifically designed to handle and inspect defects, which
 * are critical failures in your program, such as unexpected runtime exceptions
 * or system-level errors. Unlike normal recoverable errors, defects typically
 * indicate serious issues that cannot be addressed through standard error
 * handling.
 *
 * When a defect occurs in an effect, the function you provide to this function
 * will be executed, allowing you to log, monitor, or handle the defect in some
 * way. Importantly, this does not alter the main result of the effect. If no
 * defect occurs, the effect behaves as if this function was not used.
 *
 * **Example**
 *
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * // Simulate a task that fails with a recoverable error
 * const task1: Effect.Effect<number, string> = Effect.fail("NetworkError")
 *
 * // tapDefect won't log anything because NetworkError is not a defect
 * const tapping1 = Effect.tapDefect(task1, (cause) =>
 *   Console.log(`defect: ${cause}`)
 * )
 *
 * Effect.runFork(tapping1)
 * // No Output
 *
 * // Simulate a severe failure in the system
 * const task2: Effect.Effect<number> = Effect.die(
 *   "Something went wrong"
 * )
 *
 * // Log the defect using tapDefect
 * const tapping2 = Effect.tapDefect(task2, (cause) =>
 *   Console.log(`defect: ${cause}`)
 * )
 *
 * Effect.runFork(tapping2)
 * // Output:
 * // defect: RuntimeException: Something went wrong
 * //   ... stack trace ...
 * ```
 *
 * @since 2.0.0
 * @category Sequencing
 */
export const tapDefect: {
  <E, B, E2, R2>(f: (defect: unknown) => Effect<B, E2, R2>): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2>(self: Effect<A, E, R>, f: (defect: unknown) => Effect<B, E2, R2>): Effect<A, E | E2, R | R2>
} = internal.tapDefect

// -----------------------------------------------------------------------------
// Error Handling
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category Error handling
 */
export declare namespace Retry {
  /**
   * @since 2.0.0
   * @category Error handling
   */
  export type Return<R, E, A, O extends Options<E>> = Effect<
    A,
    | (O extends { schedule: Schedule<infer _O, infer _I, infer _E1, infer _R> } ? E | _E1
      : O extends { until: Predicate.Refinement<E, infer E2> } ? E2
      : E)
    | (O extends { schedule: Schedule<infer _O, infer _I, infer E, infer _R> } ? E
      : never)
    | (O extends {
      while: (...args: Array<any>) => Effect<infer _A, infer E, infer _R>
    } ? E
      : never)
    | (O extends {
      until: (...args: Array<any>) => Effect<infer _A, infer E, infer _R>
    } ? E
      : never),
    | R
    | (O extends { schedule: Schedule<infer _O, infer _I, infer _E1, infer R> } ? R
      : never)
    | (O extends {
      while: (...args: Array<any>) => Effect<infer _A, infer _E, infer R>
    } ? R
      : never)
    | (O extends {
      until: (...args: Array<any>) => Effect<infer _A, infer _E, infer R>
    } ? R
      : never)
  > extends infer Z ? Z
    : never

  /**
   * @since 2.0.0
   * @category Error handling
   */
  export interface Options<E> {
    while?: ((error: E) => boolean | Effect<boolean, any, any>) | undefined
    until?: ((error: E) => boolean | Effect<boolean, any, any>) | undefined
    times?: number | undefined
    schedule?: Schedule<any, E, any, any> | undefined
  }
}

/**
 * Retries a failing effect based on a defined retry policy.
 *
 * **Details**
 *
 * The `Effect.retry` function takes an effect and a {@link Schedule} policy,
 * and will automatically retry the effect if it fails, following the rules of
 * the policy.
 *
 * If the effect ultimately succeeds, the result will be returned.
 *
 * If the maximum retries are exhausted and the effect still fails, the failure
 * is propagated.
 *
 * **When to Use**
 *
 * This can be useful when dealing with intermittent failures, such as network
 * issues or temporary resource unavailability. By defining a retry policy, you
 * can control the number of retries, the delay between them, and when to stop
 * retrying.
 *
 * @see {@link retryOrElse} for a version that allows you to run a fallback.
 * @see {@link repeat} if your retry condition is based on successful outcomes rather than errors.
 *
 * @since 2.0.0
 * @category Error handling
 */
export const retry: {
  <E, O extends Retry.Options<E>>(
    options: O
  ): <A, R>(self: Effect<A, E, R>) => Retry.Return<R, E, A, O>
  <B, E, Error, Env>(
    policy: Schedule<B, NoInfer<E>, Error, Env>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | Error, R | Env>
  <A, E, R, O extends Retry.Options<E>>(
    self: Effect<A, E, R>,
    options: O
  ): Retry.Return<R, E, A, O>
  <A, E, R, B, Error, Env>(
    self: Effect<A, E, R>,
    policy: Schedule<B, E, Error, Env>
  ): Effect<A, E | Error, R | Env>
} = internalSchedule.retry

/**
 * Retries a failing effect and runs a fallback effect if retries are exhausted.
 *
 * **Details**
 *
 * The `Effect.retryOrElse` function attempts to retry a failing effect multiple
 * times according to a defined {@link Schedule} policy.
 *
 * If the retries are exhausted and the effect still fails, it runs a fallback
 * effect instead.
 *
 * **When to Use**
 *
 * This function is useful when you want to handle failures gracefully by
 * specifying an alternative action after repeated failures.
 *
 * @see {@link retry} for a version that does not run a fallback effect.
 *
 * @since 2.0.0
 * @category Error handling
 */
export const retryOrElse: {
  <A1, E, E1, R1, A2, E2, R2>(
    policy: Schedule<A1, NoInfer<E>, E1, R1>,
    orElse: (e: NoInfer<E | E1>, out: A1) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | A2, E1 | E2, R | R1 | R2>
  <A, E, R, A1, E1, R1, A2, E2, R2>(
    self: Effect<A, E, R>,
    policy: Schedule<A1, NoInfer<E>, E1, R1>,
    orElse: (e: NoInfer<E | E1>, out: A1) => Effect<A2, E2, R2>
  ): Effect<A | A2, E1 | E2, R | R1 | R2>
} = internalSchedule.retryOrElse

/**
 * The `sandbox` function transforms an effect by exposing the full cause
 * of any error, defect, or fiber interruption that might occur during its
 * execution. It changes the error channel of the effect to include detailed
 * information about the cause, which is wrapped in a `Cause<E>` type.
 *
 * This function is useful when you need access to the complete underlying cause
 * of failures, defects, or interruptions, enabling more detailed error
 * handling. Once you apply `sandbox`, you can use operators like
 * {@link catchAll} and {@link catchTags} to handle specific error conditions.
 * If necessary, you can revert the sandboxing operation with {@link unsandbox}
 * to return to the original error handling behavior.
 *
 * @see {@link unsandbox} to restore the original error handling.
 *
 * @since 2.0.0
 * @category Error handling
 */
export const sandbox: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<A, Cause.Cause<E>, R> = internal.sandbox

/**
 * Discards both the success and failure values of an effect.
 *
 * **When to Use**
 *
 * `ignore` allows you to run an effect without caring about its result, whether
 * it succeeds or fails. This is useful when you only care about the side
 * effects of the effect and do not need to handle or process its outcome.
 *
 * @example
 * ```ts
 * // Title: Using Effect.ignore to Discard Values
 * import { Effect } from "effect"
 *
 * //      ┌─── Effect<number, string, never>
 * //      ▼
 * const task = Effect.fail("Uh oh!").pipe(Effect.as(5))
 *
 * //      ┌─── Effect<void, never, never>
 * //      ▼
 * const program = Effect.ignore(task)
 * ```
 *
 * @since 2.0.0
 * @category Error handling
 */
export const ignore: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<void, never, R> = internal.ignore

// -----------------------------------------------------------------------------
// Fallback
// -----------------------------------------------------------------------------

/**
 * Replaces the original failure with a success value, ensuring the effect
 * cannot fail.
 *
 * `orElseSucceed` allows you to replace the failure of an effect with a
 * success value. If the effect fails, it will instead succeed with the provided
 * value, ensuring the effect always completes successfully. This is useful when
 * you want to guarantee a successful result regardless of whether the original
 * effect failed.
 *
 * The function ensures that any failure is effectively "swallowed" and replaced
 * by a successful value, which can be helpful for providing default values in
 * case of failure.
 *
 * **Important**: This function only applies to failed effects. If the effect
 * already succeeds, it will remain unchanged.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const validate = (age: number): Effect.Effect<number, string> => {
 *   if (age < 0) {
 *     return Effect.fail("NegativeAgeError")
 *   } else if (age < 18) {
 *     return Effect.fail("IllegalAgeError")
 *   } else {
 *     return Effect.succeed(age)
 *   }
 * }
 *
 * const program = Effect.orElseSucceed(validate(-1), () => 18)
 *
 * console.log(Effect.runSyncExit(program))
 * // Output:
 * // { _id: 'Exit', _tag: 'Success', value: 18 }
 * ```
 *
 * @since 2.0.0
 * @category Fallback
 */
export const orElseSucceed: {
  <A2>(
    evaluate: LazyArg<A2>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A2 | A, never, R>
  <A, E, R, A2>(
    self: Effect<A, E, R>,
    evaluate: LazyArg<A2>
  ): Effect<A | A2, never, R>
} = internal.orElseSucceed

// -----------------------------------------------------------------------------
// Delays & timeouts
// -----------------------------------------------------------------------------

/**
 * Adds a time limit to an effect, triggering a timeout if the effect exceeds
 * the duration.
 *
 * The `timeout` function allows you to specify a time limit for an
 * effect's execution. If the effect does not complete within the given time, a
 * `TimeoutException` is raised. This can be useful for controlling how long
 * your program waits for a task to finish, ensuring that it doesn't hang
 * indefinitely if the task takes too long.
 *
 * @see {@link timeoutFail} for a version that raises a custom error.
 * @see {@link timeoutFailCause} for a version that raises a custom defect.
 * @see {@link timeoutTo} for a version that allows specifying both success and timeout handlers.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const task = Effect.gen(function* () {
 *   console.log("Start processing...")
 *   yield* Effect.sleep("2 seconds") // Simulates a delay in processing
 *   console.log("Processing complete.")
 *   return "Result"
 * })
 *
 * // Output will show a TimeoutException as the task takes longer
 * // than the specified timeout duration
 * const timedEffect = task.pipe(Effect.timeout("1 second"))
 *
 * Effect.runPromiseExit(timedEffect).then(console.log)
 * // Output:
 * // Start processing...
 * // {
 * //   _id: 'Exit',
 * //   _tag: 'Failure',
 * //   cause: {
 * //     _id: 'Cause',
 * //     _tag: 'Fail',
 * //     failure: { _tag: 'TimeoutException' }
 * //   }
 * // }
 * ```
 *
 * @since 2.0.0
 * @category delays & timeouts
 */
export const timeout: {
  (
    duration: Duration.DurationInput
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | Cause.TimeoutError, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    duration: Duration.DurationInput
  ): Effect<A, E | Cause.TimeoutError, R>
} = internal.timeout

/**
 * Handles timeouts by returning an `Option` that represents either the result
 * or a timeout.
 *
 * The `timeoutOption` function provides a way to gracefully handle
 * timeouts by wrapping the outcome of an effect in an `Option` type. If the
 * effect completes within the specified time, it returns a `Some` containing
 * the result. If the effect times out, it returns a `None`, allowing you to
 * treat the timeout as a regular result instead of throwing an error.
 *
 * This is useful when you want to handle timeouts without causing the program
 * to fail, making it easier to manage situations where you expect tasks might
 * take too long but want to continue executing other tasks.
 *
 * @see {@link timeout} for a version that raises a `TimeoutException`.
 * @see {@link timeoutFail} for a version that raises a custom error.
 * @see {@link timeoutFailCause} for a version that raises a custom defect.
 * @see {@link timeoutTo} for a version that allows specifying both success and timeout handlers.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const task = Effect.gen(function* () {
 *   console.log("Start processing...")
 *   yield* Effect.sleep("2 seconds") // Simulates a delay in processing
 *   console.log("Processing complete.")
 *   return "Result"
 * })
 *
 * const timedOutEffect = Effect.all([
 *   task.pipe(Effect.timeoutOption("3 seconds")),
 *   task.pipe(Effect.timeoutOption("1 second"))
 * ])
 *
 * Effect.runPromise(timedOutEffect).then(console.log)
 * // Output:
 * // Start processing...
 * // Processing complete.
 * // Start processing...
 * // [
 * //   { _id: 'Option', _tag: 'Some', value: 'Result' },
 * //   { _id: 'Option', _tag: 'None' }
 * // ]
 * ```
 *
 * @since 3.1.0
 * @category delays & timeouts
 */
export const timeoutOption: {
  (
    duration: Duration.DurationInput
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Option<A>, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    duration: Duration.DurationInput
  ): Effect<Option<A>, E, R>
} = internal.timeoutOption

/**
 * @since 3.1.0
 * @category delays & timeouts
 */
export const timeoutOrElse: {
  <A2, E2, R2>(options: {
    readonly duration: Duration.DurationInput
    readonly onTimeout: LazyArg<Effect<A2, E2, R2>>
  }): <A, E, R>(self: Effect<A, E, R>) => Effect<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    options: {
      readonly duration: Duration.DurationInput
      readonly onTimeout: LazyArg<Effect<A2, E2, R2>>
    }
  ): Effect<A | A2, E | E2, R | R2>
} = internal.timeoutOrElse

/**
 * Returns an effect that is delayed from this effect by the specified
 * `Duration`.
 *
 * @since 2.0.0
 * @category delays & timeouts
 */
export const delay: {
  (
    duration: Duration.DurationInput
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    duration: Duration.DurationInput
  ): Effect<A, E, R>
} = internal.delay

/**
 * Returns an effect that suspends for the specified duration. This method is
 * asynchronous, and does not actually block the fiber executing the effect.
 *
 * @since 2.0.0
 * @category delays & timeouts
 */
export const sleep: (duration: Duration.DurationInput) => Effect<void> = internal.sleep

// -----------------------------------------------------------------------------
// Racing
// -----------------------------------------------------------------------------

/**
 * Races multiple effects and returns the first successful result.
 *
 * **Details**
 *
 * This function runs multiple effects concurrently and returns the result of
 * the first one to succeed. If one effect succeeds, the others will be
 * interrupted.
 *
 * If none of the effects succeed, the function will fail with the last error
 * encountered.
 *
 * **When to Use**
 *
 * This is useful when you want to race multiple effects, but only care about
 * the first one to succeed. It is commonly used in cases like timeouts,
 * retries, or when you want to optimize for the faster response without
 * worrying about the other effects.
 *
 * @see {@link race} for a version that handles only two effects.
 *
 * @since 2.0.0
 * @category Racing
 */
export const raceAll: <Eff extends Effect<any, any, any>>(
  all: Iterable<Eff>,
  options?: {
    readonly onWinner?: (options: {
      readonly fiber: Fiber<any, any>
      readonly index: number
      readonly parentFiber: Fiber<any, any>
    }) => void
  }
) => Effect<Effect.Success<Eff>, Effect.Error<Eff>, Effect.Context<Eff>> = internal.raceAll

/**
 * @since 4.0.0
 * @category Racing
 */
export const raceAllFirst: <Eff extends Effect<any, any, any>>(
  all: Iterable<Eff>,
  options?: {
    readonly onWinner?: (options: {
      readonly fiber: Fiber<any, any>
      readonly index: number
      readonly parentFiber: Fiber<any, any>
    }) => void
  }
) => Effect<Effect.Success<Eff>, Effect.Error<Eff>, Effect.Context<Eff>> = internal.raceAllFirst

// -----------------------------------------------------------------------------
// Filtering
// -----------------------------------------------------------------------------

/**
 * Filters an iterable using the specified effectful predicate.
 *
 * **Details**
 *
 * This function filters a collection (an iterable) by applying an effectful
 * predicate.
 *
 * The predicate is a function that takes an element and its index, and it
 * returns an effect that evaluates to a boolean.
 *
 * The function processes each element in the collection and keeps only those
 * that satisfy the condition defined by the predicate.
 *
 * **Options**
 *
 * You can also adjust the behavior with options such as concurrency, batching,
 * or whether to negate the condition.
 *
 * **When to Use**
 *
 * This function allows you to selectively keep or remove elements based on a
 * condition that may involve asynchronous or side-effect-causing operations.
 *
 * @since 2.0.0
 * @category Filtering
 */
export const filter: <A, E, R>(
  iterable: Iterable<A>,
  f: (a: NoInfer<A>) => Effect<boolean, E, R>,
  options?: {
    readonly concurrency?: Concurrency | undefined
    readonly negate?: boolean | undefined
  }
) => Effect<Array<A>, E, R> = internal.filter

/**
 * Filters an effect, providing an alternative effect if the predicate fails.
 *
 * **Details**
 *
 * This function applies a predicate to the result of an effect. If the
 * predicate evaluates to `false`, it executes the `orElse` effect instead. The
 * `orElse` effect can produce an alternative value or perform additional
 * computations.
 *
 * @since 2.0.0
 * @category Filtering
 */
export const filterOrElse: {
  <A, C, E2, R2, B extends A = A>(
    predicate: Predicate.Predicate<NoInfer<A>> | Predicate.Refinement<NoInfer<A>, B>,
    orElse: (a: EqualsWith<A, B, NoInfer<A>, Exclude<NoInfer<A>, B>>) => Effect<C, E2, R2>
  ): <E, R>(self: Effect<A, E, R>) => Effect<B | C, E2 | E, R2 | R>
  <A, E, R, C, E2, R2, B extends A = A>(
    self: Effect<A, E, R>,
    predicate: Predicate.Predicate<A> | Predicate.Refinement<A, B>,
    orElse: (a: EqualsWith<A, B, A, Exclude<A, B>>) => Effect<C, E2, R2>
  ): Effect<B | C, E | E2, R | R2>
} = internal.filterOrElse

/**
 * Filters an effect, failing with a custom error if the predicate fails.
 *
 * **Details**
 *
 * This function applies a predicate to the result of an effect. If the
 * predicate evaluates to `false`, the effect fails with a custom error
 * generated by the `orFailWith` function.
 *
 * **When to Use**
 *
 * This is useful for enforcing constraints and treating violations as
 * recoverable errors.
 *
 * **Providing a Guard**
 *
 * In addition to the filtering capabilities discussed earlier, you have the
 * option to further refine and narrow down the type of the success channel by
 * providing a [user-defined type
 * guard](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates).
 * Let's explore this concept through an example:
 *
 * **Example**
 *
 * ```ts
 * import { Effect, pipe } from "effect"
 *
 * // Define a user interface
 * interface User {
 *   readonly name: string
 * }
 *
 * // Simulate an asynchronous authentication function
 * declare const auth: () => Promise<User | null>
 *
 * const program = pipe(
 *   Effect.promise(() => auth()),
 *   // Use filterOrFail with a custom type guard to ensure user is not null
 *   Effect.filterOrFail(
 *     (user): user is User => user !== null, // Type guard
 *     () => new Error("Unauthorized")
 *   ),
 *   // 'user' now has the type `User` (not `User | null`)
 *   Effect.andThen((user) => user.name)
 * )
 * ```
 *
 * @since 2.0.0
 * @category Filtering
 */
export const filterOrFail: {
  <A, E2, B extends A = A>(
    predicate: Predicate.Predicate<NoInfer<A>> | Predicate.Refinement<NoInfer<A>, B>,
    orFailWith: (a: EqualsWith<A, B, NoInfer<A>, Exclude<NoInfer<A>, B>>) => E2
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E2 | E, R>
  <A, E, R, E2, B extends A = A>(
    self: Effect<A, E, R>,
    predicate: Predicate.Predicate<A> | Predicate.Refinement<A, B>,
    orFailWith: (a: EqualsWith<A, B, A, Exclude<A, B>>) => E2
  ): Effect<B, E2 | E, R>
  <A, B extends A = A>(
    predicate: Predicate.Predicate<NoInfer<A>> | Predicate.Refinement<NoInfer<A>, B>
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, Cause.NoSuchElementError | E, R>
  <A, E, R, B extends A = A>(
    self: Effect<A, E, R>,
    predicate: Predicate.Predicate<A> | Predicate.Refinement<A, B>
  ): Effect<B, E | Cause.NoSuchElementError, R>
} = internal.filterOrFail

// -----------------------------------------------------------------------------
// Conditional Operators
// -----------------------------------------------------------------------------

/**
 * Conditionally executes an effect based on a boolean condition.
 *
 * **Details**
 *
 * This function allows you to run an effect only if a given condition evaluates
 * to `true`. If the condition is `true`, the effect is executed, and its result
 * is wrapped in an `Option.some`. If the condition is `false`, the effect is
 * skipped, and the result is `Option.none`.
 *
 * **When to Use**
 *
 * This function is useful for scenarios where you need to dynamically decide
 * whether to execute an effect based on runtime logic, while also representing
 * the skipped case explicitly.
 *
 * @see {@link whenEffect} for a version that allows the condition to be an effect.
 * @see {@link unless} for a version that executes the effect when the condition is `false`.
 *
 * @since 2.0.0
 * @category Conditional Operators
 */
export const when: {
  <E2 = never, R2 = never>(
    condition: LazyArg<boolean> | Effect<boolean, E2, R2>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Option<A>, E | E2, R | R2>
  <A, E, R, E2 = never, R2 = never>(
    self: Effect<A, E, R>,
    condition: LazyArg<boolean> | Effect<boolean, E2, R2>
  ): Effect<Option<A>, E | E2, R | R2>
} = internal.when

// -----------------------------------------------------------------------------
// Pattern matching
// -----------------------------------------------------------------------------

/**
 * Handles both success and failure cases of an effect without performing side
 * effects.
 *
 * **Details**
 *
 * `match` lets you define custom handlers for both success and failure
 * scenarios. You provide separate functions to handle each case, allowing you
 * to process the result if the effect succeeds, or handle the error if the
 * effect fails.
 *
 * **When to Use**
 *
 * This is useful for structuring your code to respond differently to success or
 * failure without triggering side effects.
 *
 * @see {@link matchEffect} if you need to perform side effects in the handlers.
 *
 * @example
 * ```ts
 * // Title: Handling Both Success and Failure Cases
 * import { Effect } from "effect"
 *
 * const success: Effect.Effect<number, Error> = Effect.succeed(42)
 *
 * const program1 = Effect.match(success, {
 *   onFailure: (error) => `failure: ${error.message}`,
 *   onSuccess: (value) => `success: ${value}`
 * })
 *
 * // Run and log the result of the successful effect
 * Effect.runPromise(program1).then(console.log)
 * // Output: "success: 42"
 *
 * const failure: Effect.Effect<number, Error> = Effect.fail(
 *   new Error("Uh oh!")
 * )
 *
 * const program2 = Effect.match(failure, {
 *   onFailure: (error) => `failure: ${error.message}`,
 *   onSuccess: (value) => `success: ${value}`
 * })
 *
 * // Run and log the result of the failed effect
 * Effect.runPromise(program2).then(console.log)
 * // Output: "failure: Uh oh!"
 * ```
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const match: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (error: E) => A2
    readonly onSuccess: (value: A) => A3
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): Effect<A2 | A3, never, R>
} = internal.match

/**
 * Handles failures by matching the cause of failure.
 *
 * **Details**
 *
 * The `matchCause` function allows you to handle failures with access to the
 * full cause of the failure within a fiber.
 *
 * **When to Use**
 *
 * This is useful for differentiating between different types of errors, such as
 * regular failures, defects, or interruptions. You can provide specific
 * handling logic for each failure type based on the cause.
 *
 * @see {@link matchCauseEffect} if you need to perform side effects in the
 * handlers.
 * @see {@link match} if you don't need to handle the cause of the failure.
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const matchCause: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (cause: Cause.Cause<E>) => A2
    readonly onSuccess: (a: A) => A3
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => A2
      readonly onSuccess: (a: A) => A3
    }
  ): Effect<A2 | A3, never, R>
} = internal.matchCause

/**
 * Handles failures with access to the cause and allows performing side effects.
 *
 * **Details**
 *
 * The `matchCauseEffect` function works similarly to {@link matchCause}, but it
 * also allows you to perform additional side effects based on the failure
 * cause. This function provides access to the complete cause of the failure,
 * making it possible to differentiate between various failure types, and allows
 * you to respond accordingly while performing side effects (like logging or
 * other operations).
 *
 * @see {@link matchCause} if you don't need side effects and only want to handle the result or failure.
 * @see {@link matchEffect} if you don't need to handle the cause of the failure.
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const matchCauseEffect: {
  <E, A2, E2, R2, A, A3, E3, R3>(options: {
    readonly onFailure: (cause: Cause.Cause<E>) => Effect<A2, E2, R2>
    readonly onSuccess: (a: A) => Effect<A3, E3, R3>
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    }
  ): Effect<A2 | A3, E2 | E3, R2 | R3 | R>
} = internal.matchCauseEffect

/**
 * Handles both success and failure cases of an effect, allowing for additional
 * side effects.
 *
 * **Details**
 *
 * The `matchEffect` function is similar to {@link match}, but it enables you to
 * perform side effects in the handlers for both success and failure outcomes.
 *
 * **When to Use**
 *
 * This is useful when you need to execute additional actions, like logging or
 * notifying users, based on whether an effect succeeds or fails.
 *
 * @see {@link match} if you don't need side effects and only want to handle the
 * result or failure.
 *
 * @example
 * ```ts
 * // Title: Handling Both Success and Failure Cases with Side Effects
 * import { Effect } from "effect"
 *
 * const success: Effect.Effect<number, Error> = Effect.succeed(42)
 * const failure: Effect.Effect<number, Error> = Effect.fail(
 *   new Error("Uh oh!")
 * )
 *
 * const program1 = Effect.matchEffect(success, {
 *   onFailure: (error) =>
 *     Effect.succeed(`failure: ${error.message}`).pipe(
 *       Effect.tap(Effect.log)
 *     ),
 *   onSuccess: (value) =>
 *     Effect.succeed(`success: ${value}`).pipe(Effect.tap(Effect.log))
 * })
 *
 * console.log(Effect.runSync(program1))
 * // Output:
 * // timestamp=... level=INFO fiber=#0 message="success: 42"
 * // success: 42
 *
 * const program2 = Effect.matchEffect(failure, {
 *   onFailure: (error) =>
 *     Effect.succeed(`failure: ${error.message}`).pipe(
 *       Effect.tap(Effect.log)
 *     ),
 *   onSuccess: (value) =>
 *     Effect.succeed(`success: ${value}`).pipe(Effect.tap(Effect.log))
 * })
 *
 * console.log(Effect.runSync(program2))
 * // Output:
 * // timestamp=... level=INFO fiber=#1 message="failure: Uh oh!"
 * // failure: Uh oh!
 * ```
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const matchEffect: {
  <E, A2, E2, R2, A, A3, E3, R3>(options: {
    readonly onFailure: (e: E) => Effect<A2, E2, R2>
    readonly onSuccess: (a: A) => Effect<A3, E3, R3>
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (e: E) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    }
  ): Effect<A2 | A3, E2 | E3, R2 | R3 | R>
} = internal.matchEffect

// -----------------------------------------------------------------------------
// Environment
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category Environment
 */
export const context: <R>() => Effect<Context.Context<R>, never, R> = internal.context

/**
 * @since 2.0.0
 * @category Environment
 */
export const provide: {
  <const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
    layers: Layers
  ): <A, E, R>(
    self: Effect<A, E, R>
  ) => Effect<
    A,
    E | Layer.Error<Layers[number]>,
    Layer.Context<Layers[number]> | Exclude<R, Layer.Success<Layers[number]>>
  >
  <ROut, E2, RIn>(
    layer: Layer<ROut, E2, RIn>
  ): <A, E, R>(
    self: Effect<A, E, R>
  ) => Effect<A, E | E2, RIn | Exclude<R, ROut>>
  <R2>(
    context: Context.Context<R2>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, R2>>
  <A, E, R, const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
    self: Effect<A, E, R>,
    layers: Layers
  ): Effect<
    A,
    E | Layer.Error<Layers[number]>,
    Layer.Context<Layers[number]> | Exclude<R, Layer.Success<Layers[number]>>
  >
  <A, E, R, ROut, E2, RIn>(
    self: Effect<A, E, R>,
    layer: Layer<ROut, E2, RIn>
  ): Effect<A, E | E2, RIn | Exclude<R, ROut>>
  <A, E, R, R2>(
    self: Effect<A, E, R>,
    context: Context.Context<R2>
  ): Effect<A, E, Exclude<R, R2>>
} = internalLayer.provide

/**
 * @since 2.0.0
 * @category Environment
 */
export const provideContext: {
  <XR>(
    context: Context.Context<XR>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, XR>>
  <A, E, R, XR>(
    self: Effect<A, E, R>,
    context: Context.Context<XR>
  ): Effect<A, E, Exclude<R, XR>>
} = internal.provideContext

/**
 * @since 4.0.0
 * @category Context
 */
export const service: <I, S>(tag: Context.Tag<I, S>) => Effect<S, never, I> = internal.service

/**
 * @since 2.0.0
 * @category Context
 */
export const serviceOption: <I, S>(
  tag: Context.Tag<I, S>
) => Effect<Option<S>> = internal.serviceOption

/**
 * Provides part of the required context while leaving the rest unchanged.
 *
 * **Details**
 *
 * This function allows you to transform the context required by an effect,
 * providing part of the context and leaving the rest to be fulfilled later.
 *
 * @since 4.0.0
 * @category Context
 */
export const updateContext: {
  <R2, R>(
    f: (context: Context.Context<R2>) => Context.Context<NoInfer<R>>
  ): <A, E>(self: Effect<A, E, R>) => Effect<A, E, R2>
  <A, E, R, R2>(
    self: Effect<A, E, R>,
    f: (context: Context.Context<R2>) => Context.Context<NoInfer<R>>
  ): Effect<A, E, R2>
} = internal.updateContext

/**
 * Updates the service with the required service entry.
 *
 * @since 2.0.0
 * @category Context
 */
export const updateService: {
  <I, A>(
    tag: Context.Tag<I, A>,
    f: (value: A) => A
  ): <XA, E, R>(self: Effect<XA, E, R>) => Effect<XA, E, R | I>
  <XA, E, R, I, A>(
    self: Effect<XA, E, R>,
    tag: Context.Tag<I, A>,
    f: (value: A) => A
  ): Effect<XA, E, R | I>
} = internal.updateService

/**
 * The `provideService` function is used to provide an actual
 * implementation for a service in the context of an effect.
 *
 * This function allows you to associate a service with its implementation so
 * that it can be used in your program. You define the service (e.g., a random
 * number generator), and then you use `provideService` to link that
 * service to its implementation. Once the implementation is provided, the
 * effect can be run successfully without further requirements.
 *
 * @see {@link provide} for providing multiple layers to an effect.
 *
 * @since 2.0.0
 * @category Context
 */
export const provideService: {
  <I, S>(
    tag: Context.Tag<I, S>,
    service: S
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, I>>
  <A, E, R, I, S>(
    self: Effect<A, E, R>,
    tag: Context.Tag<I, S>,
    service: S
  ): Effect<A, E, Exclude<R, I>>
} = internal.provideService

/**
 * Provides the effect with the single service it requires. If the effect
 * requires more than one service use `provide` instead.
 *
 * @since 2.0.0
 * @category Context
 */
export const provideServiceEffect: {
  <I, S, E2, R2>(
    tag: Context.Tag<I, S>,
    acquire: Effect<S, E2, R2>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | E2, Exclude<R, I> | R2>
  <A, E, R, I, S, E2, R2>(
    self: Effect<A, E, R>,
    tag: Context.Tag<I, S>,
    acquire: Effect<S, E2, R2>
  ): Effect<A, E | E2, Exclude<R, I> | R2>
} = internal.provideServiceEffect

// -----------------------------------------------------------------------------
// References
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category References
 */
export const withConcurrency: {
  (
    concurrency: number | "unbounded"
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    concurrency: number | "unbounded"
  ): Effect<A, E, R>
} = internal.withConcurrency

// -----------------------------------------------------------------------------
// Resource management & finalization
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const scope: Effect<Scope, never, Scope> = internal.scope

/**
 * Scopes all resources used in this workflow to the lifetime of the workflow,
 * ensuring that their finalizers are run as soon as this workflow completes
 * execution, whether by success, failure, or interruption.
 *
 * @since 2.0.0
 * @category scoping, resources & finalization
 */
export const scoped: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<A, E, Exclude<R, Scope>> = internal.scoped

/**
 * @since 2.0.0
 * @category scoping, resources & finalization
 */
export const scopedWith: <A, E, R>(
  f: (scope: Scope) => Effect<A, E, R>
) => Effect<A, E, R> = internal.scopedWith

/**
 * This function constructs a scoped resource from an `acquire` and `release`
 * `Effect` value.
 *
 * If the `acquire` `Effect` value successfully completes execution, then the
 * `release` `Effect` value will be added to the finalizers associated with the
 * scope of this `Effect` value, and it is guaranteed to be run when the scope
 * is closed.
 *
 * The `acquire` and `release` `Effect` values will be run uninterruptibly.
 * Additionally, the `release` `Effect` value may depend on the `Exit` value
 * specified when the scope is closed.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const acquireRelease: <A, E, R>(
  acquire: Effect<A, E, R>,
  release: (a: A, exit: Exit.Exit<unknown, unknown>) => Effect<unknown>
) => Effect<A, E, R | Scope> = internal.acquireRelease

/**
 * This function is used to ensure that an `Effect` value that represents the
 * acquisition of a resource (for example, opening a file, launching a thread,
 * etc.) will not be interrupted, and that the resource will always be released
 * when the `Effect` value completes execution.
 *
 * `acquireUseRelease` does the following:
 *
 *   1. Ensures that the `Effect` value that acquires the resource will not be
 *      interrupted. Note that acquisition may still fail due to internal
 *      reasons (such as an uncaught exception).
 *   2. Ensures that the `release` `Effect` value will not be interrupted,
 *      and will be executed as long as the acquisition `Effect` value
 *      successfully acquires the resource.
 *
 * During the time period between the acquisition and release of the resource,
 * the `use` `Effect` value will be executed.
 *
 * If the `release` `Effect` value fails, then the entire `Effect` value will
 * fail, even if the `use` `Effect` value succeeds. If this fail-fast behavior
 * is not desired, errors produced by the `release` `Effect` value can be caught
 * and ignored.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const acquireUseRelease: <Resource, E, R, A, E2, R2, E3, R3>(
  acquire: Effect<Resource, E, R>,
  use: (a: Resource) => Effect<A, E2, R2>,
  release: (a: Resource, exit: Exit.Exit<A, E2>) => Effect<void, E3, R3>
) => Effect<A, E | E2 | E3, R | R2 | R3> = internal.acquireUseRelease

/**
 * This function adds a finalizer to the scope of the calling `Effect` value.
 * The finalizer is guaranteed to be run when the scope is closed, and it may
 * depend on the `Exit` value that the scope is closed with.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const addFinalizer: (
  finalizer: (exit: Exit.Exit<unknown, unknown>) => Effect<void>
) => Effect<void, never, Scope> = internal.addFinalizer

/**
 * Returns an effect that, if this effect _starts_ execution, then the
 * specified `finalizer` is guaranteed to be executed, whether this effect
 * succeeds, fails, or is interrupted.
 *
 * For use cases that need access to the effect's result, see `onExit`.
 *
 * Finalizers offer very powerful guarantees, but they are low-level, and
 * should generally not be used for releasing resources. For higher-level
 * logic built on `ensuring`, see the `acquireRelease` family of methods.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const ensuring: {
  <X, R1>(
    finalizer: Effect<X, never, R1>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R1 | R>
  <A, E, R, X, R1>(
    self: Effect<A, E, R>,
    finalizer: Effect<X, never, R1>
  ): Effect<A, E, R1 | R>
} = internal.ensuring

/**
 * Runs the specified effect if this effect fails, providing the error to the
 * effect if it exists. The provided effect will not be interrupted.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const onError: {
  <E, X, R2>(
    cleanup: (cause: Cause.Cause<E>) => Effect<X, never, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E, R2 | R>
  <A, E, R, X, R2>(
    self: Effect<A, E, R>,
    cleanup: (cause: Cause.Cause<E>) => Effect<X, never, R2>
  ): Effect<A, E, R2 | R>
} = internal.onError

/**
 * Ensures that a cleanup functions runs, whether this effect succeeds, fails,
 * or is interrupted.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const onExit: {
  <A, E, X, R2>(
    cleanup: (exit: Exit.Exit<A, E>) => Effect<X, never, R2>
  ): <R>(self: Effect<A, E, R>) => Effect<A, E, R2 | R>
  <A, E, R, X, R2>(
    self: Effect<A, E, R>,
    cleanup: (exit: Exit.Exit<A, E>) => Effect<X, never, R2>
  ): Effect<A, E, R | R2>
} = internal.onExit

// -----------------------------------------------------------------------------
// Caching
// -----------------------------------------------------------------------------

/**
 * Returns an effect that lazily computes a result and caches it for subsequent
 * evaluations.
 *
 * **Details**
 *
 * This function wraps an effect and ensures that its result is computed only
 * once. Once the result is computed, it is cached, meaning that subsequent
 * evaluations of the same effect will return the cached result without
 * re-executing the logic.
 *
 * **When to Use**
 *
 * Use this function when you have an expensive or time-consuming operation that
 * you want to avoid repeating. The first evaluation will compute the result,
 * and all following evaluations will immediately return the cached value,
 * improving performance and reducing unnecessary work.
 *
 * @see {@link cachedWithTTL} for a similar function that includes a
 * time-to-live duration for the cached value.
 * @see {@link cachedInvalidateWithTTL} for a similar function that includes an
 * additional effect for manually invalidating the cached value.
 *
 * @example
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * let i = 1
 * const expensiveTask = Effect.promise<string>(() => {
 *   console.log("expensive task...")
 *   return new Promise((resolve) => {
 *     setTimeout(() => {
 *       resolve(`result ${i++}`)
 *     }, 100)
 *   })
 * })
 *
 * const program = Effect.gen(function* () {
 *   console.log("non-cached version:")
 *   yield* expensiveTask.pipe(Effect.andThen(Console.log))
 *   yield* expensiveTask.pipe(Effect.andThen(Console.log))
 *   console.log("cached version:")
 *   const cached = yield* Effect.cached(expensiveTask)
 *   yield* cached.pipe(Effect.andThen(Console.log))
 *   yield* cached.pipe(Effect.andThen(Console.log))
 * })
 *
 * Effect.runFork(program)
 * // Output:
 * // non-cached version:
 * // expensive task...
 * // result 1
 * // expensive task...
 * // result 2
 * // cached version:
 * // expensive task...
 * // result 3
 * // result 3
 * ```
 *
 * @since 2.0.0
 * @category Caching
 */
export const cached: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<Effect<A, E>, never, R> = internal.cached

/**
 * Returns an effect that caches its result for a specified `Duration`,
 * known as "timeToLive" (TTL).
 *
 * **Details**
 *
 * This function is used to cache the result of an effect for a specified amount
 * of time. This means that the first time the effect is evaluated, its result
 * is computed and stored.
 *
 * If the effect is evaluated again within the specified `timeToLive`, the
 * cached result will be used, avoiding recomputation.
 *
 * After the specified duration has passed, the cache expires, and the effect
 * will be recomputed upon the next evaluation.
 *
 * **When to Use**
 *
 * Use this function when you have an effect that involves costly operations or
 * computations, and you want to avoid repeating them within a short time frame.
 *
 * It's ideal for scenarios where the result of an effect doesn't change
 * frequently and can be reused for a specified duration.
 *
 * By caching the result, you can improve efficiency and reduce unnecessary
 * computations, especially in performance-critical applications.
 *
 * @see {@link cached} for a similar function that caches the result
 * indefinitely.
 * @see {@link cachedInvalidateWithTTL} for a similar function that includes an
 * additional effect for manually invalidating the cached value.
 *
 * @example
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * let i = 1
 * const expensiveTask = Effect.promise<string>(() => {
 *   console.log("expensive task...")
 *   return new Promise((resolve) => {
 *     setTimeout(() => {
 *       resolve(`result ${i++}`)
 *     }, 100)
 *   })
 * })
 *
 * const program = Effect.gen(function* () {
 *   const cached = yield* Effect.cachedWithTTL(expensiveTask, "150 millis")
 *   yield* cached.pipe(Effect.andThen(Console.log))
 *   yield* cached.pipe(Effect.andThen(Console.log))
 *   yield* Effect.sleep("100 millis")
 *   yield* cached.pipe(Effect.andThen(Console.log))
 * })
 *
 * Effect.runFork(program)
 * // Output:
 * // expensive task...
 * // result 1
 * // result 1
 * // expensive task...
 * // result 2
 * ```
 *
 * @since 2.0.0
 * @category Caching
 */
export const cachedWithTTL: {
  (
    timeToLive: Duration.DurationInput
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Effect<A, E>, never, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    timeToLive: Duration.DurationInput
  ): Effect<Effect<A, E>, never, R>
} = internal.cachedWithTTL

/**
 * Caches an effect's result for a specified duration and allows manual
 * invalidation before expiration.
 *
 * **Details**
 *
 * This function behaves similarly to {@link cachedWithTTL} by caching the
 * result of an effect for a specified period of time. However, it introduces an
 * additional feature: it provides an effect that allows you to manually
 * invalidate the cached result before it naturally expires.
 *
 * This gives you more control over the cache, allowing you to refresh the
 * result when needed, even if the original cache has not yet expired.
 *
 * Once the cache is invalidated, the next time the effect is evaluated, the
 * result will be recomputed, and the cache will be refreshed.
 *
 * **When to Use**
 *
 * Use this function when you have an effect whose result needs to be cached for
 * a certain period, but you also want the option to refresh the cache manually
 * before the expiration time.
 *
 * This is useful when you need to ensure that the cached data remains valid for
 * a certain period but still want to invalidate it if the underlying data
 * changes or if you want to force a recomputation.
 *
 * @see {@link cached} for a similar function that caches the result
 * indefinitely.
 * @see {@link cachedWithTTL} for a similar function that caches the result for
 * a specified duration but does not include an effect for manual invalidation.
 *
 * @example
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * let i = 1
 * const expensiveTask = Effect.promise<string>(() => {
 *   console.log("expensive task...")
 *   return new Promise((resolve) => {
 *     setTimeout(() => {
 *       resolve(`result ${i++}`)
 *     }, 100)
 *   })
 * })
 *
 * const program = Effect.gen(function* () {
 *   const [cached, invalidate] = yield* Effect.cachedInvalidateWithTTL(
 *     expensiveTask,
 *     "1 hour"
 *   )
 *   yield* cached.pipe(Effect.andThen(Console.log))
 *   yield* cached.pipe(Effect.andThen(Console.log))
 *   yield* invalidate
 *   yield* cached.pipe(Effect.andThen(Console.log))
 * })
 *
 * Effect.runFork(program)
 * // Output:
 * // expensive task...
 * // result 1
 * // result 1
 * // expensive task...
 * // result 2
 * ```
 *
 * @since 2.0.0
 * @category Caching
 */
export const cachedInvalidateWithTTL: {
  (
    timeToLive: Duration.DurationInput
  ): <A, E, R>(
    self: Effect<A, E, R>
  ) => Effect<[Effect<A, E>, Effect<void>], never, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    timeToLive: Duration.DurationInput
  ): Effect<[Effect<A, E>, Effect<void>], never, R>
} = internal.cachedInvalidateWithTTL

// -----------------------------------------------------------------------------
// Interruption
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category Interruption
 */
export const interrupt: Effect<never> = internal.interrupt

/**
 * @since 2.0.0
 * @category Interruption
 */
export const interruptible: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<A, E, R> = internal.interruptible

/**
 * @since 2.0.0
 * @category Interruption
 */
export const onInterrupt: {
  <XE, XR>(
    finalizer: Effect<void, XE, XR>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    finalizer: Effect<void, XE, XR>
  ): Effect<A, E | XE, R | XR>
} = internal.onInterrupt

/**
 * @since 2.0.0
 * @category Interruption
 */
export const uninterruptible: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<A, E, R> = internal.uninterruptible

/**
 * @since 2.0.0
 * @category Interruption
 */
export const uninterruptibleMask: <A, E, R>(
  f: (
    restore: <AX, EX, RX>(effect: Effect<AX, EX, RX>) => Effect<AX, EX, RX>
  ) => Effect<A, E, R>
) => Effect<A, E, R> = internal.uninterruptibleMask

/**
 * This function behaves like {@link interruptible}, but it also provides a
 * `restore` function. This function can be used to restore the interruptibility
 * of any specific region of code.
 *
 * @since 2.0.0
 * @category Interruption
 */
export const interruptibleMask: <A, E, R>(
  f: (
    restore: <AX, EX, RX>(effect: Effect<AX, EX, RX>) => Effect<AX, EX, RX>
  ) => Effect<A, E, R>
) => Effect<A, E, R> = internal.interruptibleMask

// -----------------------------------------------------------------------------
// Semaphore
// -----------------------------------------------------------------------------

/**
 * @category Semaphore
 * @since 2.0.0
 */
export interface Semaphore {
  /** when the given amount of permits are available, run the effect and release the permits when finished */
  withPermits(
    permits: number
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  /** only if the given permits are available, run the effect and release the permits when finished */
  withPermitsIfAvailable(
    permits: number
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Option<A>, E, R>
  /** take the given amount of permits, suspending if they are not yet available */
  take(permits: number): Effect<number>
  /** release the given amount of permits, and return the resulting available permits */
  release(permits: number): Effect<number>
  /** release all the taken permits, and return the resulting available permits */
  releaseAll: Effect<number>
}

/**
 * Unsafely creates a new Semaphore
 *
 * @since 2.0.0
 * @category Semaphore
 */
export const unsafeMakeSemaphore: (permits: number) => Semaphore = internal.unsafeMakeSemaphore

/**
 * Creates a new Semaphore
 *
 * @since 2.0.0
 * @category Semaphore
 */
export const makeSemaphore: (permits: number) => Effect<Semaphore> = internal.makeSemaphore

// -----------------------------------------------------------------------------
// Latch
// -----------------------------------------------------------------------------

/**
 * @category Latch
 * @since 3.8.0
 */
export interface Latch {
  /** open the latch, releasing all fibers waiting on it */
  readonly open: Effect<boolean>
  /** open the latch, releasing all fibers waiting on it */
  readonly unsafeOpen: () => boolean
  /** release all fibers waiting on the latch, without opening it */
  readonly release: Effect<boolean>
  /** wait for the latch to be opened */
  readonly await: Effect<void>
  /** close the latch */
  readonly close: Effect<boolean>
  /** close the latch */
  readonly unsafeClose: () => boolean
  /** only run the given effect when the latch is open */
  readonly whenOpen: <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
}

/**
 * @category Latch
 * @since 3.8.0
 */
export const unsafeMakeLatch: (open?: boolean | undefined) => Latch = internal.unsafeMakeLatch

/**
 * @category latch
 * @since 3.8.0
 */
export const makeLatch: (open?: boolean | undefined) => Effect<Latch> = internal.makeLatch

// -----------------------------------------------------------------------------
// Repetition & Recursion
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category repetition / recursion
 */
export declare namespace Repeat {
  /**
   * @since 2.0.0
   * @category repetition / recursion
   */
  export type Return<R, E, A, O extends Options<A>> = Effect<
    O extends { schedule: Schedule<infer Out, infer _I, infer _E, infer _R> } ? Out
      : O extends { until: Predicate.Refinement<A, infer B> } ? B
      : A,
    | E
    | (O extends { schedule: Schedule<infer _Out, infer _I, infer E, infer _R> } ? E
      : never)
    | (O extends {
      while: (...args: Array<any>) => Effect<infer _A, infer E, infer _R>
    } ? E
      : never)
    | (O extends {
      until: (...args: Array<any>) => Effect<infer _A, infer E, infer _R>
    } ? E
      : never),
    | R
    | (O extends { schedule: Schedule<infer _O, infer _I, infer _E, infer R> } ? R
      : never)
    | (O extends {
      while: (...args: Array<any>) => Effect<infer _A, infer _E, infer R>
    } ? R
      : never)
    | (O extends {
      until: (...args: Array<any>) => Effect<infer _A, infer _E, infer R>
    } ? R
      : never)
  > extends infer Z ? Z
    : never

  /**
   * @since 2.0.0
   * @category repetition / recursion
   */
  export interface Options<A> {
    while?: ((_: A) => boolean | Effect<boolean, any, any>) | undefined
    until?: ((_: A) => boolean | Effect<boolean, any, any>) | undefined
    times?: number | undefined
    schedule?: Schedule<any, A, any, any> | undefined
  }
}

/**
 * Repeats this effect forever (until the first error).
 *
 * @since 2.0.0
 * @category repetition / recursion
 */
export const forever: <
  Args extends
    | [
      self: Effect<any, any, any>,
      options?: { readonly autoYield?: boolean | undefined }
    ]
    | [options?: { readonly autoYield?: boolean | undefined }]
>(
  ...args: Args
) => [Args[0]] extends [Effect<infer _A, infer _E, infer _R>] ? Effect<never, _E, _R>
  : <A, E, R>(self: Effect<A, E, R>) => Effect<never, E, R> = internal.forever

/**
 * Repeats an effect based on a specified schedule or until the first failure.
 *
 * **Details**
 *
 * This function executes an effect repeatedly according to the given schedule.
 * Each repetition occurs after the initial execution of the effect, meaning
 * that the schedule determines the number of additional repetitions. For
 * example, using `Schedule.once` will result in the effect being executed twice
 * (once initially and once as part of the repetition).
 *
 * If the effect succeeds, it is repeated according to the schedule. If it
 * fails, the repetition stops immediately, and the failure is returned.
 *
 * The schedule can also specify delays between repetitions, making it useful
 * for tasks like retrying operations with backoff, periodic execution, or
 * performing a series of dependent actions.
 *
 * You can combine schedules for more advanced repetition logic, such as adding
 * delays, limiting recursions, or dynamically adjusting based on the outcome of
 * each execution.
 *
 * @example
 * ```ts
 * // Success Example
 * import { Effect, Schedule, Console } from "effect"
 *
 * const action = Console.log("success")
 * const policy = Schedule.addDelay(Schedule.recurs(2), () => "100 millis")
 * const program = Effect.repeat(action, policy)
 *
 * // Effect.runPromise(program).then((n) => console.log(`repetitions: ${n}`))
 * ```
 *
 * @example
 * // Failure Example
 * import { Effect, Schedule } from "effect"
 *
 * let count = 0
 *
 * // Define an async effect that simulates an action with possible failures
 * const action = Effect.async<string, string>((resume) => {
 *   if (count > 1) {
 *     console.log("failure")
 *     resume(Effect.fail("Uh oh!"))
 *   } else {
 *     count++
 *     console.log("success")
 *     resume(Effect.succeed("yay!"))
 *   }
 * })
 *
 * const policy = Schedule.addDelay(Schedule.recurs(2), () => "100 millis")
 * const program = Effect.repeat(action, policy)
 *
 * // Effect.runPromiseExit(program).then(console.log)
 *
 * @since 2.0.0
 * @category repetition / recursion
 */
export const repeat: {
  <O extends Repeat.Options<A>, A>(
    options: O
  ): <E, R>(self: Effect<A, E, R>) => Repeat.Return<R, E, A, O>
  <Output, Input, Error, Env>(
    schedule: Schedule<Output, Input, NoInfer<Error>, Env>
  ): <E, R>(self: Effect<Input, E, R>) => Effect<Output, E | Error, R | Env>
  <A, E, R, O extends Repeat.Options<A>>(
    self: Effect<A, E, R>,
    options: O
  ): Repeat.Return<R, E, A, O>
  <Input, E, R, Output, Error, Env>(
    self: Effect<Input, E, R>,
    schedule: Schedule<Output, Input, NoInfer<Error>, Env>
  ): Effect<Output, E | Error, R | Env>
} = internalSchedule.repeat

/**
 * Repeats an effect with a schedule, handling failures using a custom handler.
 *
 * **Details**
 *
 * This function allows you to execute an effect repeatedly based on a specified
 * schedule. If the effect fails at any point, a custom failure handler is
 * invoked. The handler is provided with both the failure value and the output
 * of the schedule at the time of failure. If the effect fails immediately, the
 * schedule will never be executed and the output provided to the handler will
 * be `None`. This enables advanced error recovery or alternative fallback logic
 * while maintaining flexibility in how repetitions are handled.
 *
 * For example, using a schedule with `recurs(2)` will allow for two additional
 * repetitions after the initial execution, provided the effect succeeds. If a
 * failure occurs during any iteration, the failure handler is invoked to handle
 * the situation.
 *
 * @since 2.0.0
 * @category repetition / recursion
 */
export const repeatOrElse: {
  <R2, A, B, E, E2, E3, R3>(
    schedule: Schedule<B, A, E2, R2>,
    orElse: (error: E | E2, option: Option<B>) => Effect<B, E3, R3>
  ): <R>(self: Effect<A, E, R>) => Effect<B, E3, R | R2 | R3>
  <A, E, R, R2, B, E2, E3, R3>(
    self: Effect<A, E, R>,
    schedule: Schedule<B, A, E2, R2>,
    orElse: (error: E | E2, option: Option<B>) => Effect<B, E3, R3>
  ): Effect<B, E3, R | R2 | R3>
} = internalSchedule.repeatOrElse

/**
 * Repeats an effect based on a specified schedule.
 *
 * **Details**
 *
 * This function allows you to execute an effect repeatedly according to a given
 * schedule. The schedule determines the timing and number of repetitions. Each
 * repetition can also depend on the decision of the schedule, providing
 * flexibility for complex workflows. This function does not modify the effect's
 * success or failure; it only controls its repetition.
 *
 * For example, you can use a schedule that recurs a specific number of times,
 * adds delays between repetitions, or customizes repetition behavior based on
 * external inputs. The effect runs initially and is repeated according to the
 * schedule.
 *
 * @see {@link scheduleFrom} for a variant that allows the schedule's decision
 * to depend on the result of this effect.
 *
 * @since 2.0.0
 * @category Repetition / Recursion
 */
export const schedule = dual<
  <Output, Error, Env>(
    schedule: Schedule<Output, unknown, Error, Env>
  ) => <A, E, R>(self: Effect<A, E, R>) => Effect<Output, E, R | Env>,
  <A, E, R, Output, Error, Env>(
    self: Effect<A, E, R>,
    schedule: Schedule<Output, unknown, Error, Env>
  ) => Effect<Output, E, R | Env>
>(2, (self, schedule) => scheduleFrom(self, undefined, schedule))

/**
 * Runs an effect repeatedly according to a schedule, starting from a specified
 * initial input value.
 *
 * **Details**
 *
 * This function allows you to repeatedly execute an effect based on a schedule.
 * The schedule starts with the given `initial` input value, which is passed to
 * the first execution. Subsequent executions of the effect are controlled by
 * the schedule's rules, using the output of the previous iteration as the input
 * for the next one.
 *
 * The returned effect will complete when the schedule ends or the effect fails,
 * propagating the error.
 *
 * @since 2.0.0
 * @category Repetition / Recursion
 */
export const scheduleFrom: {
  <Input, Output, Error, Env>(
    initial: Input,
    schedule: Schedule<Output, Input, Error, Env>
  ): <E, R>(self: Effect<Input, E, R>) => Effect<Output, E, R | Env>
  <Input, E, R, Output, Error, Env>(
    self: Effect<Input, E, R>,
    initial: Input,
    schedule: Schedule<Output, Input, Error, Env>
  ): Effect<Output, E, R | Env>
} = internalSchedule.scheduleFrom

// -----------------------------------------------------------------------------
// Tracing
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category Tracing
 */
export const tracer: Effect<Tracer> = internal.tracer

/**
 * @since 2.0.0
 * @category Tracing
 */
export const withTracer: {
  (value: Tracer): <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(effect: Effect<A, E, R>, value: Tracer): Effect<A, E, R>
} = internal.withTracer

/**
 * Disable the tracer for the given Effect.
 *
 * @since 2.0.0
 * @category Tracing
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * Effect.succeed(42).pipe(
 *   Effect.withSpan("my-span"),
 *   // the span will not be registered with the tracer
 *   Effect.withTracerEnabled(false)
 * )
 * ```
 */
export const withTracerEnabled: {
  (enabled: boolean): <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(effect: Effect<A, E, R>, enabled: boolean): Effect<A, E, R>
} = internal.withTracerEnabled

/**
 * Adds an annotation to each span in this effect.
 *
 * @since 2.0.0
 * @category Tracing
 */
export const annotateSpans: {
  (
    key: string,
    value: unknown
  ): <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>
  (
    values: Record<string, unknown>
  ): <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(
    effect: Effect<A, E, R>,
    key: string,
    value: unknown
  ): Effect<A, E, R>
  <A, E, R>(
    effect: Effect<A, E, R>,
    values: Record<string, unknown>
  ): Effect<A, E, R>
} = internal.annotateSpans

/**
 * Adds an annotation to the current span if available
 *
 * @since 2.0.0
 * @category Tracing
 */
export const annotateCurrentSpan: {
  (key: string, value: unknown): Effect<void>
  (values: Record<string, unknown>): Effect<void>
} = internal.annotateCurrentSpan

/**
 * @since 2.0.0
 * @category Tracing
 */
export const currentSpan: Effect<Span, Cause.NoSuchElementError> = internal.currentSpan

/**
 * @since 2.0.0
 * @category Tracing
 */
export const currentParentSpan: Effect<AnySpan, Cause.NoSuchElementError> = internal.currentParentSpan

/**
 * @since 2.0.0
 * @category Tracing
 */
export const spanAnnotations: Effect<Readonly<Record<string, unknown>>> = internal.spanAnnotations

/**
 * @since 2.0.0
 * @category Tracing
 */
export const spanLinks: Effect<ReadonlyArray<SpanLink>> = internal.spanLinks

/**
 * For all spans in this effect, add a link with the provided span.
 *
 * @since 2.0.0
 * @category Tracing
 */
export const linkSpans: {
  (
    span: AnySpan | ReadonlyArray<AnySpan>,
    attributes?: Record<string, unknown>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    span: AnySpan | ReadonlyArray<AnySpan>,
    attributes?: Record<string, unknown>
  ): Effect<A, E, R>
} = internal.linkSpans

/**
 * Create a new span for tracing.
 *
 * @since 2.0.0
 * @category Tracing
 */
export const makeSpan: (name: string, options?: SpanOptions & TraceOptions) => Effect<Span> = internal.makeSpan

/**
 * Create a new span for tracing, and automatically close it when the Scope
 * finalizes.
 *
 * The span is not added to the current span stack, so no child spans will be
 * created for it.
 *
 * @since 2.0.0
 * @category Tracing
 */
export const makeSpanScoped: (
  name: string,
  options?: SpanOptions & TraceOptions | undefined
) => Effect<Span, never, Scope> = internal.makeSpanScoped

/**
 * Create a new span for tracing, and automatically close it when the effect
 * completes.
 *
 * The span is not added to the current span stack, so no child spans will be
 * created for it.
 *
 * @since 2.0.0
 * @category Tracing
 */
export const useSpan: {
  <A, E, R>(
    name: string,
    evaluate: (span: Span) => Effect<A, E, R>
  ): Effect<A, E, R>
  <A, E, R>(
    name: string,
    options: SpanOptions & TraceOptions,
    evaluate: (span: Span) => Effect<A, E, R>
  ): Effect<A, E, R>
} = internal.useSpan

/**
 * Wraps the effect with a new span for tracing.
 *
 * @since 2.0.0
 * @category Tracing
 */
export const withSpan: {
  <Args extends ReadonlyArray<any>>(
    name: string,
    options?: (SpanOptions | ((...args: NoInfer<Args>) => SpanOptions)) | undefined,
    traceOptions?: TraceOptions
  ): <A, E, R>(self: Effect<A, E, R>, ...args: Args) => Effect<A, E, Exclude<R, ParentSpan>>
  <A, E, R>(
    self: Effect<A, E, R>,
    name: string,
    options?: ((() => SpanOptions) | SpanOptions) | undefined,
    traceOptions?: TraceOptions
  ): Effect<A, E, Exclude<R, ParentSpan>>
} = internal.withSpan as any

/**
 * Wraps the effect with a new span for tracing.
 *
 * The span is ended when the Scope is finalized.
 *
 * @since 2.0.0
 * @category Tracing
 */
export const withSpanScoped: {
  (
    name: string,
    options?: SpanOptions
  ): <A, E, R>(
    self: Effect<A, E, R>
  ) => Effect<A, E, Exclude<R, ParentSpan> | Scope>
  <A, E, R>(
    self: Effect<A, E, R>,
    name: string,
    options?: SpanOptions
  ): Effect<A, E, Exclude<R, ParentSpan> | Scope>
} = internal.withSpanScoped

/**
 * Adds the provided span to the current span stack.
 *
 * @since 2.0.0
 * @category Tracing
 */
export const withParentSpan: {
  (
    value: AnySpan
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, ParentSpan>>
  <A, E, R>(
    self: Effect<A, E, R>,
    value: AnySpan
  ): Effect<A, E, Exclude<R, ParentSpan>>
} = internal.withParentSpan

// -----------------------------------------------------------------------------
// Batching
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category requests & batching
 */
export const request: {
  <A extends Request<any, any, any>, EX = never, RX = never>(
    resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
  ): (
    self: A
  ) => Effect<
    Request.Success<A>,
    Request.Error<A> | EX,
    Request.Context<A> | RX
  >
  <A extends Request<any, any, any>, EX = never, RX = never>(
    self: A,
    resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
  ): Effect<Request.Success<A>, Request.Error<A> | EX, Request.Context<A> | RX>
} = internalRequest.request

// -----------------------------------------------------------------------------
// Supervision & Fiber's
// -----------------------------------------------------------------------------

/**
 * Returns an effect that forks this effect into its own separate fiber,
 * returning the fiber immediately, without waiting for it to begin executing
 * the effect.
 *
 * You can use the `fork` method whenever you want to execute an effect in a
 * new fiber, concurrently and without "blocking" the fiber executing other
 * effects. Using fibers can be tricky, so instead of using this method
 * directly, consider other higher-level methods, such as `raceWith`,
 * `zipPar`, and so forth.
 *
 * The fiber returned by this method has methods to interrupt the fiber and to
 * wait for it to finish executing the effect. See `Fiber` for more
 * information.
 *
 * Whenever you use this method to launch a new fiber, the new fiber is
 * attached to the parent fiber's scope. This means when the parent fiber
 * terminates, the child fiber will be terminated as well, ensuring that no
 * fibers leak. This behavior is called "auto supervision", and if this
 * behavior is not desired, you may use the `forkDaemon` or `forkIn` methods.
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const fork: <
  Args extends
    | [
      options: {
        readonly startImmediately: boolean
      }
    ]
    | [
      self: Effect<any, any, any>,
      options?:
        | {
          readonly startImmediately?: boolean | undefined
        }
        | undefined
    ]
>(
  ...args: Args
) => [Args[0]] extends [Effect<infer _A, infer _E, infer _R>] ? Effect<Fiber<_A, _E>, never, _R>
  : <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R> = internal.fork

/**
 * Forks the effect in the specified scope. The fiber will be interrupted
 * when the scope is closed.
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const forkIn: {
  (
    scope: Scope,
    options?: {
      readonly startImmediately?: boolean | undefined
    }
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    scope: Scope,
    options?: {
      readonly startImmediately?: boolean | undefined
    }
  ): Effect<Fiber<A, E>, never, R>
} = internal.forkIn

/**
 * Forks the fiber in a `Scope`, interrupting it when the scope is closed.
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const forkScoped: <
  Args extends
    | [
      self: Effect<any, any, any>,
      options?:
        | { readonly startImmediately?: boolean | undefined }
        | undefined
    ]
    | [
      options?:
        | { readonly startImmediately?: boolean | undefined }
        | undefined
    ]
>(
  ...args: Args
) => [Args[0]] extends [Effect<infer _A, infer _E, infer _R>] ? Effect<Fiber<_A, _E>, never, _R | Scope>
  : <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R | Scope> = internal.forkScoped

/**
 * Forks the effect into a new fiber attached to the global scope. Because the
 * new fiber is attached to the global scope, when the fiber executing the
 * returned effect terminates, the forked fiber will continue running.
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const forkDaemon: <
  Args extends
    | [
      self: Effect<any, any, any>,
      options?:
        | {
          readonly startImmediately?: boolean | undefined
        }
        | undefined
    ]
    | [
      options?:
        | {
          readonly startImmediately?: boolean | undefined
        }
        | undefined
    ]
>(
  ...args: Args
) => [Args[0]] extends [Effect<infer _A, infer _E, infer _R>] ? Effect<Fiber<_A, _E>, never, _R>
  : <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R> = internal.forkDaemon

// -----------------------------------------------------------------------------
// Running Effects
// -----------------------------------------------------------------------------

/**
 * The foundational function for running effects, returning a "fiber" that can
 * be observed or interrupted.
 *
 * **When to Use**
 *
 * `runFork` is used to run an effect in the background by creating a
 * fiber. It is the base function for all other run functions. It starts a fiber
 * that can be observed or interrupted.
 *
 * Unless you specifically need a `Promise` or synchronous operation,
 * `runFork` is a good default choice.
 *
 * @example
 * ```ts
 * // Title: Running an Effect in the Background
 * import { Effect, Console, Schedule, Fiber } from "effect"
 *
 * //      ┌─── Effect<number, never, never>
 * //      ▼
 * const program = Effect.repeat(
 *   Console.log("running..."),
 *   Schedule.spaced("200 millis")
 * )
 *
 * //      ┌─── RuntimeFiber<number, never>
 * //      ▼
 * const fiber = Effect.runFork(program)
 *
 * setTimeout(() => {
 *   Effect.runFork(Fiber.interrupt(fiber))
 * }, 500)
 * ```
 *
 * @since 2.0.0
 * @category Running Effects
 */
export const runFork: <A, E>(
  effect: Effect<A, E>,
  options?:
    | {
      readonly signal?: AbortSignal | undefined
      readonly scheduler?: Scheduler | undefined
    }
    | undefined
) => Fiber<A, E> = internal.runFork

/**
 * Executes an effect and returns the result as a `Promise`.
 *
 * **When to Use**
 *
 * Use `runPromise` when you need to execute an effect and work with the
 * result using `Promise` syntax, typically for compatibility with other
 * promise-based code.
 *
 * If the effect succeeds, the promise will resolve with the result. If the
 * effect fails, the promise will reject with an error.
 *
 * @see {@link runPromiseExit} for a version that returns an `Exit` type instead of rejecting.
 *
 * @example
 * ```ts
 * // Title: Running a Successful Effect as a Promise
 * import { Effect } from "effect"
 *
 * Effect.runPromise(Effect.succeed(1)).then(console.log)
 * // Output: 1
 * ```
 *
 * @example
 * //Example: Handling a Failing Effect as a Rejected Promise
 * import { Effect } from "effect"
 *
 * Effect.runPromise(Effect.fail("my error")).catch(console.error)
 * // Output:
 * // (FiberFailure) Error: my error
 *
 * @since 2.0.0
 * @category Running Effects
 */
export const runPromise: <A, E>(
  effect: Effect<A, E>,
  options?:
    | {
      readonly signal?: AbortSignal | undefined
      readonly scheduler?: Scheduler | undefined
    }
    | undefined
) => Promise<A> = internal.runPromise

/**
 * Runs an effect and returns a `Promise` that resolves to an `Exit`, which
 * represents the outcome (success or failure) of the effect.
 *
 * **When to Use**
 *
 * Use `runPromiseExit` when you need to determine if an effect succeeded
 * or failed, including any defects, and you want to work with a `Promise`.
 *
 * **Details**
 *
 * The `Exit` type represents the result of the effect:
 * - If the effect succeeds, the result is wrapped in a `Success`.
 * - If it fails, the failure information is provided as a `Failure` containing
 *   a `Cause` type.
 *
 * @example
 * ```ts
 * // Title: Handling Results as Exit
 * import { Effect } from "effect"
 *
 * // Execute a successful effect and get the Exit result as a Promise
 * Effect.runPromiseExit(Effect.succeed(1)).then(console.log)
 * // Output:
 * // {
 * //   _id: "Exit",
 * //   _tag: "Success",
 * //   value: 1
 * // }
 *
 * // Execute a failing effect and get the Exit result as a Promise
 * Effect.runPromiseExit(Effect.fail("my error")).then(console.log)
 * // Output:
 * // {
 * //   _id: "Exit",
 * //   _tag: "Failure",
 * //   cause: {
 * //     _id: "Cause",
 * //     _tag: "Fail",
 * //     failure: "my error"
 * //   }
 * // }
 * ```
 *
 * @since 2.0.0
 * @category Running Effects
 */
export const runPromiseExit: <A, E>(
  effect: Effect<A, E>,
  options?:
    | {
      readonly signal?: AbortSignal | undefined
      readonly scheduler?: Scheduler | undefined
    }
    | undefined
) => Promise<Exit.Exit<A, E>> = internal.runPromiseExit

/**
 * Executes an effect synchronously, running it immediately and returning the
 * result.
 *
 * **When to Use**
 *
 * Use `runSync` to run an effect that does not fail and does not include
 * any asynchronous operations.
 *
 * If the effect fails or involves asynchronous work, it will throw an error,
 * and execution will stop where the failure or async operation occurs.
 *
 * @see {@link runSyncExit} for a version that returns an `Exit` type instead of
 * throwing an error.
 *
 * @example
 * ```ts
 * // Title: Synchronous Logging
 * import { Effect } from "effect"
 *
 * const program = Effect.sync(() => {
 *   console.log("Hello, World!")
 *   return 1
 * })
 *
 * const result = Effect.runSync(program)
 * // Output: Hello, World!
 *
 * console.log(result)
 * // Output: 1
 * ```
 *
 * @example
 * // Title: Incorrect Usage with Failing or Async Effects
 * import { Effect } from "effect"
 *
 * try {
 *   // Attempt to run an effect that fails
 *   Effect.runSync(Effect.fail("my error"))
 * } catch (e) {
 *   console.error(e)
 * }
 * // Output:
 * // (FiberFailure) Error: my error
 *
 * try {
 *   // Attempt to run an effect that involves async work
 *   Effect.runSync(Effect.promise(() => Promise.resolve(1)))
 * } catch (e) {
 *   console.error(e)
 * }
 * // Output:
 * // (FiberFailure) AsyncFiberException: Fiber #0 cannot be resolved synchronously. This is caused by using runSync on an effect that performs async work
 *
 * @since 2.0.0
 * @category Running Effects
 */
export const runSync: <A, E>(effect: Effect<A, E>) => A = internal.runSync

/**
 * Runs an effect synchronously and returns the result as an `Exit` type, which
 * represents the outcome (success or failure) of the effect.
 *
 * **When to Use**
 *
 * Use `runSyncExit` to find out whether an effect succeeded or failed,
 * including any defects, without dealing with asynchronous operations.
 *
 * **Details**
 *
 * The `Exit` type represents the result of the effect:
 * - If the effect succeeds, the result is wrapped in a `Success`.
 * - If it fails, the failure information is provided as a `Failure` containing
 *   a `Cause` type.
 *
 * If the effect contains asynchronous operations, `runSyncExit` will
 * return an `Failure` with a `Die` cause, indicating that the effect cannot be
 * resolved synchronously.
 *
 * @example
 * ```ts
 * // Title: Handling Results as Exit
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSyncExit(Effect.succeed(1)))
 * // Output:
 * // {
 * //   _id: "Exit",
 * //   _tag: "Success",
 * //   value: 1
 * // }
 *
 * console.log(Effect.runSyncExit(Effect.fail("my error")))
 * // Output:
 * // {
 * //   _id: "Exit",
 * //   _tag: "Failure",
 * //   cause: {
 * //     _id: "Cause",
 * //     _tag: "Fail",
 * //     failure: "my error"
 * //   }
 * // }
 * ```
 *
 * @example
 * // Title: Asynchronous Operation Resulting in Die
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSyncExit(Effect.promise(() => Promise.resolve(1))))
 * // Output:
 * // {
 * //   _id: 'Exit',
 * //   _tag: 'Failure',
 * //   cause: {
 * //     _id: 'Cause',
 * //     _tag: 'Die',
 * //     defect: [Fiber #0 cannot be resolved synchronously. This is caused by using runSync on an effect that performs async work] {
 * //       fiber: [FiberRuntime],
 * //       _tag: 'AsyncFiberException',
 * //       name: 'AsyncFiberException'
 * //     }
 * //   }
 * // }
 *
 * @since 2.0.0
 * @category Running Effects
 */
export const runSyncExit: <A, E>(effect: Effect<A, E>) => Exit.Exit<A, E> = internal.runSyncExit

// -----------------------------------------------------------------------------
// Function
// -----------------------------------------------------------------------------

/**
 * @since 3.12.0
 * @category Function
 */
export namespace fn {
  /**
   * @since 3.11.0
   * @category Models
   */
  export type Gen = {
    <Eff extends YieldWrap<Yieldable<any, any, any>>, AEff, Args extends Array<any>>(
      body: (...args: Args) => Generator<Eff, AEff, never>
    ): (...args: Args) => Effect<
      AEff,
      [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
      [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
    >
    <Eff extends YieldWrap<Yieldable<any, any, any>>, AEff, Args extends Array<any>, A extends Effect<any, any, any>>(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A
    ): (...args: Args) => A
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B extends Effect<any, any, any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B
    ): (...args: Args) => B
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C extends Effect<any, any, any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C
    ): (...args: Args) => C
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D extends Effect<any, any, any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D
    ): (...args: Args) => D
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E extends Effect<any, any, any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E
    ): (...args: Args) => E
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F extends Effect<any, any, any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F
    ): (...args: Args) => F
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G extends Effect<any, any, any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G
    ): (...args: Args) => G
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      H extends Effect<any, any, any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H
    ): (...args: Args) => H
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      H,
      I extends Effect<any, any, any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I
    ): (...args: Args) => I
  }

  /**
   * @since 3.11.0
   * @category Models
   */
  export type NonGen = {
    <Eff extends Effect<any, any, any>, Args extends Array<any>>(
      body: (...args: Args) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A, ...args: Args) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A, ...args: Args) => B,
      b: (_: B, ...args: Args) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A, ...args: Args) => B,
      b: (_: B, ...args: Args) => C,
      c: (_: C, ...args: Args) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, D, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A, ...args: Args) => B,
      b: (_: B, ...args: Args) => C,
      c: (_: C, ...args: Args) => D,
      d: (_: D, ...args: Args) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, D, E, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A, ...args: Args) => B,
      b: (_: B, ...args: Args) => C,
      c: (_: C, ...args: Args) => D,
      d: (_: D, ...args: Args) => E,
      e: (_: E, ...args: Args) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, D, E, F, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A, ...args: Args) => B,
      b: (_: B, ...args: Args) => C,
      c: (_: C, ...args: Args) => D,
      d: (_: D, ...args: Args) => E,
      e: (_: E, ...args: Args) => F,
      f: (_: F, ...args: Args) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A, ...args: Args) => B,
      b: (_: B, ...args: Args) => C,
      c: (_: C, ...args: Args) => D,
      d: (_: D, ...args: Args) => E,
      e: (_: E, ...args: Args) => F,
      f: (_: F, ...args: Args) => G,
      g: (_: G, ...args: Args) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A, ...args: Args) => B,
      b: (_: B, ...args: Args) => C,
      c: (_: C, ...args: Args) => D,
      d: (_: D, ...args: Args) => E,
      e: (_: E, ...args: Args) => F,
      f: (_: F, ...args: Args) => G,
      g: (_: G, ...args: Args) => H,
      h: (_: H, ...args: Args) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A, ...args: Args) => B,
      b: (_: B, ...args: Args) => C,
      c: (_: C, ...args: Args) => D,
      d: (_: D, ...args: Args) => E,
      e: (_: E, ...args: Args) => F,
      f: (_: F, ...args: Args) => G,
      g: (_: G, ...args: Args) => H,
      h: (_: H, ...args: Args) => I,
      i: (_: H, ...args: Args) => Eff
    ): (...args: Args) => Eff
  }

  /**
   * @since 3.11.0
   * @category Models
   */
  export type Untraced = {
    <Eff extends YieldWrap<Yieldable<any, any, any>>, AEff, Args extends Array<any>>(
      body: (...args: Args) => Generator<Eff, AEff, never>
    ): (...args: Args) => Effect<
      AEff,
      [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
      [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
    >
    <Eff extends YieldWrap<Yieldable<any, any, any>>, AEff, Args extends Array<any>, A>(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A
    ): (...args: Args) => A
    <Eff extends YieldWrap<Yieldable<any, any, any>>, AEff, Args extends Array<any>, A, B>(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B
    ): (...args: Args) => B
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C
    ): (...args: Args) => C
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D
    ): (...args: Args) => D
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E
    ): (...args: Args) => E
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F
    ): (...args: Args) => F
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G
    ): (...args: Args) => G
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      H
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H
    ): (...args: Args) => H
    <
      Eff extends YieldWrap<Yieldable<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      H,
      I
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer _R>>] ? E : never,
          [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Yieldable<infer _A, infer _E, infer R>>] ? R : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I
    ): (...args: Args) => I
  }
}

/**
 * Creates a function that returns an Effect.
 *
 * The function can be created using a generator function that can yield
 * effects.
 *
 * `Effect.fnUntraced` also acts as a `pipe` function, allowing you to create a pipeline after the function definition.
 *
 * @example
 * ```ts
 * // Title: Creating a traced function with a generator function
 * import { Effect } from "effect"
 *
 * const logExample = Effect.fnUntraced(function*<N extends number>(n: N) {
 *   yield* Effect.annotateCurrentSpan("n", n)
 *   yield* Effect.logInfo(`got: ${n}`)
 *   yield* Effect.fail(new Error())
 * })
 *
 * Effect.runFork(logExample(100))
 * ```
 *
 * @since 3.12.0
 * @category function
 */
export const fnUntraced: fn.Untraced = internal.fnUntraced

// ========================================================================
// Clock
// ========================================================================

/**
 * Retrieves the `Clock` service from the context and provides it to the
 * specified effectful function.
 *
 * **Example**
 *
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const program = Effect.clockWith((clock) =>
 *   clock.currentTimeMillis.pipe(
 *     Effect.map((currentTime) => `Current time is: ${currentTime}`),
 *     Effect.tap(Console.log)
 *   )
 * )
 *
 * Effect.runFork(program)
 * // Example Output:
 * // Current time is: 1735484929744
 * ```
 *
 * @since 2.0.0
 * @category Clock
 */
export const clockWith: <A, E, R>(
  f: (clock: Clock) => Effect<A, E, R>
) => Effect<A, E, R> = internal.clockWith

// ========================================================================
// Logging
// ========================================================================

/**
 * @since 2.0.0
 * @category logging
 */
export const log: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel()

/**
 * @since 2.0.0
 * @category logging
 */
export const logFatal: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Fatal")

/**
 * @since 2.0.0
 * @category logging
 */
export const logWarning: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Warn")

/**
 * @since 2.0.0
 * @category logging
 */
export const logError: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Error")

/**
 * @since 2.0.0
 * @category logging
 */
export const logInfo: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Info")

/**
 * @since 2.0.0
 * @category logging
 */
export const logDebug: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Debug")

/**
 * @since 2.0.0
 * @category logging
 */
export const logTrace: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Trace")

/**
 * Adds a logger to the set of loggers which will output logs for this effect.
 *
 * @since 2.0.0
 * @category logging
 */
export const withLogger = dual<
  <Output>(
    logger: Logger<unknown, Output>
  ) => <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>,
  <A, E, R, Output>(
    effect: Effect<A, E, R>,
    logger: Logger<unknown, Output>
  ) => Effect<A, E, R>
>(2, (effect, logger) =>
  internal.updateService(
    effect,
    internal.CurrentLoggers,
    (loggers) => new Set([...loggers, logger])
  ))

/**
 * Adds an annotation to each log line in this effect.
 *
 * @since 2.0.0
 * @category logging
 */
export const annotateLogs = dual<
  {
    (
      key: string,
      value: unknown
    ): <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>
    (
      values: Record<string, unknown>
    ): <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>
  },
  {
    <A, E, R>(
      effect: Effect<A, E, R>,
      key: string,
      value: unknown
    ): Effect<A, E, R>
    <A, E, R>(
      effect: Effect<A, E, R>,
      values: Record<string, unknown>
    ): Effect<A, E, R>
  }
>(
  (args) => core.isEffect(args[0]),
  <A, E, R>(
    effect: Effect<A, E, R>,
    ...args: [Record<string, unknown>] | [key: string, value: unknown]
  ): Effect<A, E, R> =>
    internal.updateService(effect, CurrentLogAnnotations, (annotations) => {
      const newAnnotations = { ...annotations }
      if (args.length === 1) {
        Object.assign(newAnnotations, args[0])
      } else {
        newAnnotations[args[0]] = args[1]
      }
      return newAnnotations
    })
)

/**
 * Adds a span to each log line in this effect.
 *
 * @since 2.0.0
 * @category logging
 */
export const withLogSpan = dual<
  (label: string) => <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>,
  <A, E, R>(effect: Effect<A, E, R>, label: string) => Effect<A, E, R>
>(
  2,
  (effect, label) =>
    internal.flatMap(internal.currentTimeMillis, (now) =>
      internal.updateService(effect, CurrentLogSpans, (spans) => {
        const span: [label: string, timestamp: number] = [label, now]
        return [span, ...spans]
      }))
)

// -----------------------------------------------------------------------------
// Metrics
// -----------------------------------------------------------------------------

/**
 * Updates the `Metric` every time the `Effect` is executed.
 *
 * Also accepts an optional function which can be used to map the `Exit` value
 * of the `Effect` into a valid `Input` for the `Metric`.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const track: {
  <Input, State, E, A>(
    metric: Metric.Metric<Input, State>,
    f: (exit: Exit.Exit<A, E>) => Input
  ): <E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <State, E, A>(
    metric: Metric.Metric<Exit.Exit<NoInfer<A>, NoInfer<E>>, State>
  ): <R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Input, State>,
    f: (exit: Exit.Exit<A, E>) => Input
  ): Effect<A, E, R>
  <A, E, R, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Exit.Exit<NoInfer<A>, NoInfer<E>>, State>
  ): Effect<A, E, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Input, State>,
    f: (exit: Exit.Exit<A, E>) => Input
  ): Effect<A, E, R> =>
    onExit(self, (exit) => {
      const input = f === undefined ? exit : f(exit)
      return Metric.update(metric, input as any)
    })
)

/**
 * Updates the provided `Metric` every time the wrapped `Effect` succeeds with
 * a value.
 *
 * Also accepts an optional function which can be used to map the success value
 * of the `Effect` into a valid `Input` for the `Metric`.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackSuccesses: {
  <Input, State, A>(
    metric: Metric.Metric<Input, State>,
    f: (value: A) => Input
  ): <E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <State, A>(
    metric: Metric.Metric<NoInfer<A>, State>
  ): <E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Input, State>,
    f: (value: A) => Input
  ): Effect<A, E, R>
  <A, E, R, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<NoInfer<A>, State>
  ): Effect<A, E, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Input, State>,
    f: ((value: A) => Input) | undefined
  ): Effect<A, E, R> =>
    tap(self, (value) => {
      const input = f === undefined ? value : f(value)
      return Metric.update(metric, input as any)
    })
)

/**
 * Updates the provided `Metric` every time the wrapped `Effect` fails with an
 * **expected** error.
 *
 * Also accepts an optional function which can be used to map the error value
 * of the `Effect` into a valid `Input` for the `Metric`.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackErrors: {
  <Input, State, E>(
    metric: Metric.Metric<Input, State>,
    f: (error: E) => Input
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <State, E>(
    metric: Metric.Metric<NoInfer<E>, State>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Input, State>,
    f: (error: E) => Input
  ): Effect<A, E, R>
  <A, E, R, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<NoInfer<E>, State>
  ): Effect<A, E, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Input, State>,
    f: ((error: E) => Input) | undefined
  ): Effect<A, E, R> =>
    tapError(self, (error) => {
      const input = f === undefined ? error : f(error)
      return Metric.update(metric, input as any)
    })
)

/**
 * Updates the provided `Metric` every time the wrapped `Effect` fails with an
 * **unexpected** error (i.e. a defect).
 *
 * Also accepts an optional function which can be used to map the defect value
 * of the `Effect` into a valid `Input` for the `Metric`.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackDefects: {
  <Input, State>(
    metric: Metric.Metric<Input, State>,
    f: (defect: unknown) => Input
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <State, E>(
    metric: Metric.Metric<unknown, State>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Input, State>,
    f: (defect: unknown) => Input
  ): Effect<A, E, R>
  <A, E, R, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<unknown, State>
  ): Effect<A, E, R>
} = dual(
  (args) => isEffect(args[0]),
  (self, metric, f) =>
    tapDefect(self, (defect) => {
      const input = f === undefined ? defect : f(defect)
      return Metric.update(metric, input)
    })
)

/**
 * Updates the provided `Metric` with the `Duration` of time (in nanoseconds)
 * that the wrapped `Effect` took to complete.
 *
 * Also accepts an optional function which can be used to map the `Duration`
 * that the wrapped `Effect` took to complete into a valid `Input` for the
 * `Metric`.
 *
 * @since 4.0.0
 * @category Tracking
 */
export const trackDuration: {
  <Input, State>(
    metric: Metric.Metric<Input, State>,
    f: (duration: Duration.Duration) => Input
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <State, E>(
    metric: Metric.Metric<Duration.Duration, State>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Input, State>,
    f: (duration: Duration.Duration) => Input
  ): Effect<A, E, R>
  <A, E, R, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Duration.Duration, State>
  ): Effect<A, E, R>
} = dual(
  (args) => isEffect(args[0]),
  <A, E, R, Input, State>(
    self: Effect<A, E, R>,
    metric: Metric.Metric<Input, State>,
    f: ((duration: Duration.Duration) => Input) | undefined
  ): Effect<A, E, R> =>
    clockWith((clock) => {
      const startTime = clock.unsafeCurrentTimeNanos()
      return onExit(self, () => {
        const endTime = clock.unsafeCurrentTimeNanos()
        const duration = Duration.subtract(endTime, startTime)
        const input = f === undefined ? duration : f(duration)
        return Metric.update(metric, input as any)
      })
    })
)

// -----------------------------------------------------------------------------
// Transactions
// -----------------------------------------------------------------------------

/**
 * Service that holds the current transaction state, it includes
 *
 * - a journal that stores any non committed change to TxRef values
 * - a retry flag to know if the transaction should be retried
 *
 * @since 4.0.0
 * @category Transactions
 */
export class Transaction extends Context.Tag<
  Transaction,
  {
    retry: boolean
    readonly journal: Map<
      TxRef<any>,
      {
        readonly version: number
        value: any
      }
    >
  }
>()("effect/Effect/Transaction") {}

/**
 * Defines a transaction. Transactions are "all or nothing" with respect to changes made to
 * transactional values (i.e. TxRef) that occur within the transaction body.
 *
 * In Effect transactions are optimistic with retry, that means transactions are retried when:
 *
 * - the body of the transaction explicitely calls to `Effect.retryTransaction` and any of the
 *   accessed transactional values changes.
 *
 * - any of the accessed transactional values change during the execution of the transaction
 *   due to a different transaction committing before the current.
 *
 * - parent transaction retry, if you have a transaction within another transaction and
 *   the parent retries the child will also retry together with the parent.
 *
 * @since 4.0.0
 * @category Transactions
 */
export const transaction = <A, E, R>(
  effect: Effect<A, E, R>
): Effect<A, E, Exclude<R, Transaction>> => transactionWith(() => effect)

/**
 * @since 4.0.0
 * @category Transactions
 */
export const transactionWith = <A, E, R>(
  f: (state: Transaction["Type"]) => Effect<A, E, R>
): Effect<A, E, Exclude<R, Transaction>> =>
  withFiber((fiber) => {
    if (fiber.context.unsafeMap.has(Transaction.key)) {
      return f(Context.unsafeGet(fiber.context, Transaction)) as Effect<
        A,
        E,
        Exclude<R, Transaction>
      >
    }
    const state: Transaction["Type"] = { journal: new Map(), retry: false }
    const scheduler = fiber.currentScheduler
    let result: Exit.Exit<A, E> | undefined
    return uninterruptibleMask((restore) =>
      flatMap(
        whileLoop({
          while: () => !result,
          body: constant(
            restore(suspend(() => f(state))).pipe(
              provideService(Transaction, state),
              tapCause(() => {
                if (!state.retry) return _void
                return restore(awaitPendingTransaction(state))
              }),
              exit
            )
          ),
          step(exit: Exit.Exit<A, E>) {
            if (state.retry || !isTransactionConsistent(state)) {
              return clearTransaction(state)
            }
            if (Exit.isSuccess(exit)) {
              commitTransaction(scheduler, state)
            } else {
              clearTransaction(state)
            }
            result = exit
          }
        }),
        () => result!
      )
    )
  })

const isTransactionConsistent = (state: Transaction["Type"]) => {
  for (const [ref, { version }] of state.journal) {
    if (ref.version !== version) {
      return false
    }
  }
  return true
}

const awaitPendingTransaction = (state: Transaction["Type"]) =>
  suspend(() => {
    const key = {}
    const refs = Array.from(state.journal.keys())
    const clearPending = () => {
      for (const clear of refs) {
        clear.pending.delete(key)
      }
    }
    return callback<void>((resume) => {
      const onCall = () => {
        clearPending()
        resume(_void)
      }
      for (const ref of refs) {
        ref.pending.set(key, onCall)
      }
      return sync(clearPending)
    })
  })

function commitTransaction(scheduler: Scheduler, state: Transaction["Type"]) {
  for (const [ref, { value }] of state.journal) {
    if (value !== ref.value) {
      ref.version = ref.version + 1
      ref.value = value
    }
    for (const pending of ref.pending.values()) {
      scheduler.scheduleTask(pending, 0)
    }
    ref.pending.clear()
  }
}

function clearTransaction(state: Transaction["Type"]) {
  state.retry = false
  state.journal.clear()
}

/**
 * Signals that the current transaction needs to be retried.
 *
 * NOTE: the transaction retries on any change to transactional values (i.e. TxRef) accessed in its body.
 *
 * @since 4.0.0
 * @category Transactions
 *
 * @example
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as TxRef from "effect/TxRef"
 *
 * const program = Effect.gen(function*() {
 *   // create a transactional reference
 *   const ref = yield* TxRef.make(0)
 *
 *   // forks a fiber that increases the value of `ref` every 100 millis
 *   yield* Effect.fork(Effect.forever(
 *     // update to transactional value
 *     TxRef.update(ref, (n) => n + 1).pipe(Effect.delay("100 millis"))
 *   ))
 *
 *   // the following will retry 10 times until the `ref` value is 10
 *   yield* Effect.transaction(Effect.gen(function*() {
 *     const value = yield* TxRef.get(ref)
 *     if (value < 10) {
 *       yield* Effect.log(`retry due to value: ${value}`)
 *       return yield* Effect.retryTransaction
 *     }
 *     yield* Effect.log(`transaction done with value: ${value}`)
 *   }))
 * })
 *
 * Effect.runPromise(program).catch(console.error)
 * ```
 */
export const retryTransaction: Effect<never, never, Transaction> = flatMap(
  Transaction.asEffect(),
  (state) => {
    state.retry = true
    return interrupt
  }
)
/**
 * @since 4.0.0
 * @category Effectify
 */
export declare namespace Effectify {
  interface Callback<E, A> {
    (err: E, a?: A): void
  }

  type ArgsWithCallback<Args extends Array<any>, E, A> = [...args: Args, cb: Callback<E, A>]

  type WithoutNull<A> = unknown extends A ? void : Exclude<A, null | undefined>

  /**
   * @since 4.0.0
   * @category Effectify
   */
  export type Effectify<T, E> = T extends {
    (...args: ArgsWithCallback<infer Args1, infer _E1, infer A1>): infer _R1
    (...args: ArgsWithCallback<infer Args2, infer _E2, infer A2>): infer _R2
    (...args: ArgsWithCallback<infer Args3, infer _E3, infer A3>): infer _R3
    (...args: ArgsWithCallback<infer Args4, infer _E4, infer A4>): infer _R4
    (...args: ArgsWithCallback<infer Args5, infer _E5, infer A5>): infer _R5
    (...args: ArgsWithCallback<infer Args6, infer _E6, infer A6>): infer _R6
    (...args: ArgsWithCallback<infer Args7, infer _E7, infer A7>): infer _R7
    (...args: ArgsWithCallback<infer Args8, infer _E8, infer A8>): infer _R8
    (...args: ArgsWithCallback<infer Args9, infer _E9, infer A9>): infer _R9
    (...args: ArgsWithCallback<infer Args10, infer _E10, infer A10>): infer _R10
  } ? {
      (...args: Args1): Effect<WithoutNull<A1>, E>
      (...args: Args2): Effect<WithoutNull<A2>, E>
      (...args: Args3): Effect<WithoutNull<A3>, E>
      (...args: Args4): Effect<WithoutNull<A4>, E>
      (...args: Args5): Effect<WithoutNull<A5>, E>
      (...args: Args6): Effect<WithoutNull<A6>, E>
      (...args: Args7): Effect<WithoutNull<A7>, E>
      (...args: Args8): Effect<WithoutNull<A8>, E>
      (...args: Args9): Effect<WithoutNull<A9>, E>
      (...args: Args10): Effect<WithoutNull<A10>, E>
    }
    : T extends {
      (...args: ArgsWithCallback<infer Args1, infer _E1, infer A1>): infer _R1
      (...args: ArgsWithCallback<infer Args2, infer _E2, infer A2>): infer _R2
      (...args: ArgsWithCallback<infer Args3, infer _E3, infer A3>): infer _R3
      (...args: ArgsWithCallback<infer Args4, infer _E4, infer A4>): infer _R4
      (...args: ArgsWithCallback<infer Args5, infer _E5, infer A5>): infer _R5
      (...args: ArgsWithCallback<infer Args6, infer _E6, infer A6>): infer _R6
      (...args: ArgsWithCallback<infer Args7, infer _E7, infer A7>): infer _R7
      (...args: ArgsWithCallback<infer Args8, infer _E8, infer A8>): infer _R8
      (...args: ArgsWithCallback<infer Args9, infer _E9, infer A9>): infer _R9
    } ? {
        (...args: Args1): Effect<WithoutNull<A1>, E>
        (...args: Args2): Effect<WithoutNull<A2>, E>
        (...args: Args3): Effect<WithoutNull<A3>, E>
        (...args: Args4): Effect<WithoutNull<A4>, E>
        (...args: Args5): Effect<WithoutNull<A5>, E>
        (...args: Args6): Effect<WithoutNull<A6>, E>
        (...args: Args7): Effect<WithoutNull<A7>, E>
        (...args: Args8): Effect<WithoutNull<A8>, E>
        (...args: Args9): Effect<WithoutNull<A9>, E>
      }
    : T extends {
      (...args: ArgsWithCallback<infer Args1, infer _E1, infer A1>): infer _R1
      (...args: ArgsWithCallback<infer Args2, infer _E2, infer A2>): infer _R2
      (...args: ArgsWithCallback<infer Args3, infer _E3, infer A3>): infer _R3
      (...args: ArgsWithCallback<infer Args4, infer _E4, infer A4>): infer _R4
      (...args: ArgsWithCallback<infer Args5, infer _E5, infer A5>): infer _R5
      (...args: ArgsWithCallback<infer Args6, infer _E6, infer A6>): infer _R6
      (...args: ArgsWithCallback<infer Args7, infer _E7, infer A7>): infer _R7
      (...args: ArgsWithCallback<infer Args8, infer _E8, infer A8>): infer _R8
    } ? {
        (...args: Args1): Effect<WithoutNull<A1>, E>
        (...args: Args2): Effect<WithoutNull<A2>, E>
        (...args: Args3): Effect<WithoutNull<A3>, E>
        (...args: Args4): Effect<WithoutNull<A4>, E>
        (...args: Args5): Effect<WithoutNull<A5>, E>
        (...args: Args6): Effect<WithoutNull<A6>, E>
        (...args: Args7): Effect<WithoutNull<A7>, E>
        (...args: Args8): Effect<WithoutNull<A8>, E>
      }
    : T extends {
      (...args: ArgsWithCallback<infer Args1, infer _E1, infer A1>): infer _R1
      (...args: ArgsWithCallback<infer Args2, infer _E2, infer A2>): infer _R2
      (...args: ArgsWithCallback<infer Args3, infer _E3, infer A3>): infer _R3
      (...args: ArgsWithCallback<infer Args4, infer _E4, infer A4>): infer _R4
      (...args: ArgsWithCallback<infer Args5, infer _E5, infer A5>): infer _R5
      (...args: ArgsWithCallback<infer Args6, infer _E6, infer A6>): infer _R6
      (...args: ArgsWithCallback<infer Args7, infer _E7, infer A7>): infer _R7
    } ? {
        (...args: Args1): Effect<WithoutNull<A1>, E>
        (...args: Args2): Effect<WithoutNull<A2>, E>
        (...args: Args3): Effect<WithoutNull<A3>, E>
        (...args: Args4): Effect<WithoutNull<A4>, E>
        (...args: Args5): Effect<WithoutNull<A5>, E>
        (...args: Args6): Effect<WithoutNull<A6>, E>
        (...args: Args7): Effect<WithoutNull<A7>, E>
      }
    : T extends {
      (...args: ArgsWithCallback<infer Args1, infer _E1, infer A1>): infer _R1
      (...args: ArgsWithCallback<infer Args2, infer _E2, infer A2>): infer _R2
      (...args: ArgsWithCallback<infer Args3, infer _E3, infer A3>): infer _R3
      (...args: ArgsWithCallback<infer Args4, infer _E4, infer A4>): infer _R4
      (...args: ArgsWithCallback<infer Args5, infer _E5, infer A5>): infer _R5
      (...args: ArgsWithCallback<infer Args6, infer _E6, infer A6>): infer _R6
    } ? {
        (...args: Args1): Effect<WithoutNull<A1>, E>
        (...args: Args2): Effect<WithoutNull<A2>, E>
        (...args: Args3): Effect<WithoutNull<A3>, E>
        (...args: Args4): Effect<WithoutNull<A4>, E>
        (...args: Args5): Effect<WithoutNull<A5>, E>
        (...args: Args6): Effect<WithoutNull<A6>, E>
      }
    : T extends {
      (...args: ArgsWithCallback<infer Args1, infer _E1, infer A1>): infer _R1
      (...args: ArgsWithCallback<infer Args2, infer _E2, infer A2>): infer _R2
      (...args: ArgsWithCallback<infer Args3, infer _E3, infer A3>): infer _R3
      (...args: ArgsWithCallback<infer Args4, infer _E4, infer A4>): infer _R4
      (...args: ArgsWithCallback<infer Args5, infer _E5, infer A5>): infer _R5
    } ? {
        (...args: Args1): Effect<WithoutNull<A1>, E>
        (...args: Args2): Effect<WithoutNull<A2>, E>
        (...args: Args3): Effect<WithoutNull<A3>, E>
        (...args: Args4): Effect<WithoutNull<A4>, E>
        (...args: Args5): Effect<WithoutNull<A5>, E>
      }
    : T extends {
      (...args: ArgsWithCallback<infer Args1, infer _E1, infer A1>): infer _R1
      (...args: ArgsWithCallback<infer Args2, infer _E2, infer A2>): infer _R2
      (...args: ArgsWithCallback<infer Args3, infer _E3, infer A3>): infer _R3
      (...args: ArgsWithCallback<infer Args4, infer _E4, infer A4>): infer _R4
    } ? {
        (...args: Args1): Effect<WithoutNull<A1>, E>
        (...args: Args2): Effect<WithoutNull<A2>, E>
        (...args: Args3): Effect<WithoutNull<A3>, E>
        (...args: Args4): Effect<WithoutNull<A4>, E>
      }
    : T extends {
      (...args: ArgsWithCallback<infer Args1, infer _E1, infer A1>): infer _R1
      (...args: ArgsWithCallback<infer Args2, infer _E2, infer A2>): infer _R2
      (...args: ArgsWithCallback<infer Args3, infer _E3, infer A3>): infer _R3
    } ? {
        (...args: Args1): Effect<WithoutNull<A1>, E>
        (...args: Args2): Effect<WithoutNull<A2>, E>
        (...args: Args3): Effect<WithoutNull<A3>, E>
      }
    : T extends {
      (...args: ArgsWithCallback<infer Args1, infer _E1, infer A1>): infer _R1
      (...args: ArgsWithCallback<infer Args2, infer _E2, infer A2>): infer _R2
    } ? {
        (...args: Args1): Effect<WithoutNull<A1>, E>
        (...args: Args2): Effect<WithoutNull<A2>, E>
      }
    : T extends {
      (...args: ArgsWithCallback<infer Args1, infer _E1, infer A1>): infer _R1
    } ? {
        (...args: Args1): Effect<WithoutNull<A1>, E>
      }
    : never

  /**
   * @category util
   * @since 4.0.0
   */
  export type EffectifyError<T> = T extends {
    (...args: ArgsWithCallback<infer _Args1, infer E1, infer _A1>): infer _R1
    (...args: ArgsWithCallback<infer _Args2, infer E2, infer _A2>): infer _R2
    (...args: ArgsWithCallback<infer _Args3, infer E3, infer _A3>): infer _R3
    (...args: ArgsWithCallback<infer _Args4, infer E4, infer _A4>): infer _R4
    (...args: ArgsWithCallback<infer _Args5, infer E5, infer _A5>): infer _R5
    (...args: ArgsWithCallback<infer _Args6, infer E6, infer _A6>): infer _R6
    (...args: ArgsWithCallback<infer _Args7, infer E7, infer _A7>): infer _R7
    (...args: ArgsWithCallback<infer _Args8, infer E8, infer _A8>): infer _R8
    (...args: ArgsWithCallback<infer _Args9, infer E9, infer _A9>): infer _R9
    (...args: ArgsWithCallback<infer _Args10, infer E10, infer _A10>): infer _R10
  } ? NonNullable<E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E9 | E10>
    : T extends {
      (...args: ArgsWithCallback<infer _Args1, infer E1, infer _A1>): infer _R1
      (...args: ArgsWithCallback<infer _Args2, infer E2, infer _A2>): infer _R2
      (...args: ArgsWithCallback<infer _Args3, infer E3, infer _A3>): infer _R3
      (...args: ArgsWithCallback<infer _Args4, infer E4, infer _A4>): infer _R4
      (...args: ArgsWithCallback<infer _Args5, infer E5, infer _A5>): infer _R5
      (...args: ArgsWithCallback<infer _Args6, infer E6, infer _A6>): infer _R6
      (...args: ArgsWithCallback<infer _Args7, infer E7, infer _A7>): infer _R7
      (...args: ArgsWithCallback<infer _Args8, infer E8, infer _A8>): infer _R8
      (...args: ArgsWithCallback<infer _Args9, infer E9, infer _A9>): infer _R9
    } ? NonNullable<E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E9>
    : T extends {
      (...args: ArgsWithCallback<infer _Args1, infer E1, infer _A1>): infer _R1
      (...args: ArgsWithCallback<infer _Args2, infer E2, infer _A2>): infer _R2
      (...args: ArgsWithCallback<infer _Args3, infer E3, infer _A3>): infer _R3
      (...args: ArgsWithCallback<infer _Args4, infer E4, infer _A4>): infer _R4
      (...args: ArgsWithCallback<infer _Args5, infer E5, infer _A5>): infer _R5
      (...args: ArgsWithCallback<infer _Args6, infer E6, infer _A6>): infer _R6
      (...args: ArgsWithCallback<infer _Args7, infer E7, infer _A7>): infer _R7
      (...args: ArgsWithCallback<infer _Args8, infer E8, infer _A8>): infer _R8
    } ? NonNullable<E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8>
    : T extends {
      (...args: ArgsWithCallback<infer _Args1, infer E1, infer _A1>): infer _R1
      (...args: ArgsWithCallback<infer _Args2, infer E2, infer _A2>): infer _R2
      (...args: ArgsWithCallback<infer _Args3, infer E3, infer _A3>): infer _R3
      (...args: ArgsWithCallback<infer _Args4, infer E4, infer _A4>): infer _R4
      (...args: ArgsWithCallback<infer _Args5, infer E5, infer _A5>): infer _R5
      (...args: ArgsWithCallback<infer _Args6, infer E6, infer _A6>): infer _R6
      (...args: ArgsWithCallback<infer _Args7, infer E7, infer _A7>): infer _R7
    } ? NonNullable<E1 | E2 | E3 | E4 | E5 | E6 | E7>
    : T extends {
      (...args: ArgsWithCallback<infer _Args1, infer E1, infer _A1>): infer _R1
      (...args: ArgsWithCallback<infer _Args2, infer E2, infer _A2>): infer _R2
      (...args: ArgsWithCallback<infer _Args3, infer E3, infer _A3>): infer _R3
      (...args: ArgsWithCallback<infer _Args4, infer E4, infer _A4>): infer _R4
      (...args: ArgsWithCallback<infer _Args5, infer E5, infer _A5>): infer _R5
      (...args: ArgsWithCallback<infer _Args6, infer E6, infer _A6>): infer _R6
    } ? NonNullable<E1 | E2 | E3 | E4 | E5 | E6>
    : T extends {
      (...args: ArgsWithCallback<infer _Args1, infer E1, infer _A1>): infer _R1
      (...args: ArgsWithCallback<infer _Args2, infer E2, infer _A2>): infer _R2
      (...args: ArgsWithCallback<infer _Args3, infer E3, infer _A3>): infer _R3
      (...args: ArgsWithCallback<infer _Args4, infer E4, infer _A4>): infer _R4
      (...args: ArgsWithCallback<infer _Args5, infer E5, infer _A5>): infer _R5
    } ? NonNullable<E1 | E2 | E3 | E4 | E5>
    : T extends {
      (...args: ArgsWithCallback<infer _Args1, infer E1, infer _A1>): infer _R1
      (...args: ArgsWithCallback<infer _Args2, infer E2, infer _A2>): infer _R2
      (...args: ArgsWithCallback<infer _Args3, infer E3, infer _A3>): infer _R3
      (...args: ArgsWithCallback<infer _Args4, infer E4, infer _A4>): infer _R4
    } ? NonNullable<E1 | E2 | E3 | E4>
    : T extends {
      (...args: ArgsWithCallback<infer _Args1, infer E1, infer _A1>): infer _R1
      (...args: ArgsWithCallback<infer _Args2, infer E2, infer _A2>): infer _R2
      (...args: ArgsWithCallback<infer _Args3, infer E3, infer _A3>): infer _R3
    } ? NonNullable<E1 | E2 | E3>
    : T extends {
      (...args: ArgsWithCallback<infer _Args1, infer E1, infer _A1>): infer _R1
      (...args: ArgsWithCallback<infer _Args2, infer E2, infer _A2>): infer _R2
    } ? NonNullable<E1 | E2>
    : T extends {
      (...args: ArgsWithCallback<infer _Args1, infer E1, infer _A1>): infer _R1
    } ? NonNullable<E1>
    : never
}

/**
 * Converts a callback-based function to a function that returns an `Effect`.
 *
 * @since 4.0.0
 * @category Effectify
 */
export const effectify: {
  <F extends (...args: Array<any>) => any>(fn: F): Effectify.Effectify<F, Effectify.EffectifyError<F>>
  <F extends (...args: Array<any>) => any, E>(
    fn: F,
    onError: (error: Effectify.EffectifyError<F>, args: Parameters<F>) => E
  ): Effectify.Effectify<F, E>
  <F extends (...args: Array<any>) => any, E, E2>(
    fn: F,
    onError: (error: Effectify.EffectifyError<F>, args: Parameters<F>) => E,
    onSyncError: (error: unknown, args: Parameters<F>) => E2
  ): Effectify.Effectify<F, E | E2>
} =
  (<A>(fn: Function, onError?: (e: any, args: any) => any, onSyncError?: (e: any, args: any) => any) =>
  (...args: Array<any>) =>
    callback<A, Error>((resume) => {
      try {
        fn(...args, (err: Error | null, result: A) => {
          if (err) {
            resume(fail(onError ? onError(err, args) : err))
          } else {
            resume(succeed(result))
          }
        })
      } catch (err) {
        resume(onSyncError ? fail(onSyncError(err, args)) : die(err))
      }
    })) as any

export declare namespace Fn {
  const unset: unique symbol
  type unset = typeof unset

  type InferRet<Eff extends YieldWrap<Yieldable<any, any, any>>, Ret> = Types.Equals<Eff, never> extends true ?
    Effect<Ret, never, never> :
    [Eff] extends [YieldWrap<Yieldable<infer _A, infer E, infer R>>] ? Effect<Ret, E, R> :
    never

  type Options<Args extends Array<any>> = {
    name?: string
    attributes?: (...args: Args) => Record<string, unknown>
  }
}

export const fn: {
  // bounded without this
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>
  ): (...args: Args) => Fn.InferRet<Eff, Ret>
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A
  ): (...args: Args) => A
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B
  ): (...args: Args) => B
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C
  ): (...args: Args) => C
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D
  ): (...args: Args) => D
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E
  ): (...args: Args) => E
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F
  ): (...args: Args) => F
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G
  ): (...args: Args) => G
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H
  ): (...args: Args) => H
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I
  ): (...args: Args) => I
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J
  ): (...args: Args) => J
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K
  ): (...args: Args) => K
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L
  ): (...args: Args) => L
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M
  ): (...args: Args) => M
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N
  ): (...args: Args) => N
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O
  ): (...args: Args) => O
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P
  ): (...args: Args) => P
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q
  ): (...args: Args) => Q
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q,
    r: (_: Q, ...args: NoInfer<Args>) => R
  ): (...args: Args) => R
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R,
    S
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q,
    r: (_: Q, ...args: NoInfer<Args>) => R,
    s: (_: R, ...args: NoInfer<Args>) => S
  ): (...args: Args) => S
  <
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R,
    S,
    T
  >(
    gen: (this: Fn.unset, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q,
    r: (_: Q, ...args: NoInfer<Args>) => R,
    s: (_: R, ...args: NoInfer<Args>) => S,
    t: (_: S, ...args: NoInfer<Args>) => T
  ): (...args: Args) => T
  // bounded with this
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>
  ): (...args: Args) => Fn.InferRet<Eff, Ret>
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A
  ): (...args: Args) => A
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B
  ): (...args: Args) => B
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C
  ): (...args: Args) => C
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D
  ): (...args: Args) => D
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E
  ): (...args: Args) => E
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F
  ): (...args: Args) => F
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G
  ): (...args: Args) => G
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H
  ): (...args: Args) => H
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I
  ): (...args: Args) => I
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J
  ): (...args: Args) => J
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K
  ): (...args: Args) => K
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L
  ): (...args: Args) => L
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M
  ): (...args: Args) => M
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N
  ): (...args: Args) => N
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O
  ): (...args: Args) => O
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P
  ): (...args: Args) => P
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q
  ): (...args: Args) => Q
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q,
    r: (_: Q, ...args: NoInfer<Args>) => R
  ): (...args: Args) => R
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R,
    S
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q,
    r: (_: Q, ...args: NoInfer<Args>) => R,
    s: (_: R, ...args: NoInfer<Args>) => S
  ): (...args: Args) => S
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R,
    S,
    T
  >(
    self: { this: This },
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q,
    r: (_: Q, ...args: NoInfer<Args>) => R,
    s: (_: R, ...args: NoInfer<Args>) => S,
    t: (_: S, ...args: NoInfer<Args>) => T
  ): (...args: Args) => T
  // unbounded
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>
  ): (this: This, ...args: Args) => Fn.InferRet<Eff, Ret>
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A
  ): (this: This, ...args: Args) => A
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B
  ): (this: This, ...args: Args) => B
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C
  ): (this: This, ...args: Args) => C
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D
  ): (this: This, ...args: Args) => D
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E
  ): (this: This, ...args: Args) => E
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F
  ): (this: This, ...args: Args) => F
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G
  ): (this: This, ...args: Args) => G
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H
  ): (this: This, ...args: Args) => H
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I
  ): (this: This, ...args: Args) => I
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J
  ): (this: This, ...args: Args) => J
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K
  ): (this: This, ...args: Args) => K
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L
  ): (this: This, ...args: Args) => L
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M
  ): (this: This, ...args: Args) => M
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N
  ): (this: This, ...args: Args) => N
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O
  ): (this: This, ...args: Args) => O
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P
  ): (this: This, ...args: Args) => P
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q
  ): (this: This, ...args: Args) => Q
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q,
    r: (_: Q, ...args: NoInfer<Args>) => R
  ): (this: This, ...args: Args) => R
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R,
    S
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q,
    r: (_: Q, ...args: NoInfer<Args>) => R,
    s: (_: R, ...args: NoInfer<Args>) => S
  ): (this: This, ...args: Args) => S
  <
    This,
    Args extends Array<any>,
    Eff extends YieldWrap<Yieldable<any, any, any>>,
    Ret,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I,
    J,
    K,
    L,
    M,
    N,
    O,
    P,
    Q,
    R,
    S,
    T
  >(
    gen: (this: This, ...args: Args) => Generator<Eff, Ret>,
    a: (_: Fn.InferRet<Eff, Ret>, ...args: NoInfer<Args>) => A,
    b: (_: A, ...args: NoInfer<Args>) => B,
    c: (_: B, ...args: NoInfer<Args>) => C,
    d: (_: C, ...args: NoInfer<Args>) => D,
    e: (_: D, ...args: NoInfer<Args>) => E,
    f: (_: E, ...args: NoInfer<Args>) => F,
    g: (_: F, ...args: NoInfer<Args>) => G,
    h: (_: G, ...args: NoInfer<Args>) => H,
    i: (_: H, ...args: NoInfer<Args>) => I,
    j: (_: I, ...args: NoInfer<Args>) => J,
    k: (_: J, ...args: NoInfer<Args>) => K,
    l: (_: K, ...args: NoInfer<Args>) => L,
    m: (_: L, ...args: NoInfer<Args>) => M,
    n: (_: M, ...args: NoInfer<Args>) => N,
    o: (_: N, ...args: NoInfer<Args>) => O,
    p: (_: O, ...args: NoInfer<Args>) => P,
    q: (_: P, ...args: NoInfer<Args>) => Q,
    r: (_: Q, ...args: NoInfer<Args>) => R,
    s: (_: R, ...args: NoInfer<Args>) => S,
    t: (_: S, ...args: NoInfer<Args>) => T
  ): (this: This, ...args: Args) => T
} = function() {
  const hasThisBinding = typeof arguments[0] === "function" ? false : true
  const body = hasThisBinding ? arguments[1] : arguments[0]
  const noPipe = hasThisBinding ? arguments.length === 2 : arguments.length === 1
  const parentArguments = arguments
  return noPipe
    ? function(this: any, ...args: Array<any>) {
      return suspend(() =>
        internal.unsafeFromIterator(body.apply(hasThisBinding ? parentArguments[0].this : this, args))
      )
    }
    : function(this: any, ...args: Array<any>) {
      let effect = suspend(() =>
        internal.unsafeFromIterator(body.apply(hasThisBinding ? parentArguments[0].this : this, args))
      )
      let shouldTraceCall = false
      for (let i = hasThisBinding ? 2 : 1; i < parentArguments.length; i++) {
        if ("~effect/withSpan" in parentArguments[i]) {
          shouldTraceCall = true
        }
        effect = parentArguments[i](effect)
      }
      globalThis.console.log({ shouldTraceCall })
      return effect
    }
}
