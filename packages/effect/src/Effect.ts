/**
 * The `Effect` module is the core of the Effect library, providing a powerful and expressive
 * way to model and compose asynchronous, concurrent, and effectful computations.
 *
 * An `Effect<A, E, R>` represents a computation that:
 * - May succeed with a value of type `A`
 * - May fail with an error of type `E`
 * - Requires a context/environment of type `R`
 *
 * Effects are lazy and immutable - they describe computations that can be executed later.
 * This allows for powerful composition, error handling, resource management, and concurrency
 * patterns.
 *
 * ## Key Features
 *
 * - **Type-safe error handling**: Errors are tracked in the type system
 * - **Resource management**: Automatic cleanup with scoped resources
 * - **Structured concurrency**: Safe parallel and concurrent execution
 * - **Composable**: Effects can be combined using operators like `flatMap`, `map`, `zip`
 * - **Testable**: Built-in support for testing with controlled environments
 * - **Interruptible**: Effects can be safely interrupted and cancelled
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * // Creating a simple effect
 * const hello = Effect.succeed("Hello, World!")
 *
 * // Composing effects
 * const program = Effect.gen(function*() {
 *   const message = yield* hello
 *   yield* Console.log(message)
 *   return message.length
 * })
 *
 * // Running the effect
 * Effect.runPromise(program).then(console.log) // 13
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Effect that may fail
 * const divide = (a: number, b: number) =>
 *   b === 0
 *     ? Effect.fail(new Error("Division by zero"))
 *     : Effect.succeed(a / b)
 *
 * // Error handling
 * const program = Effect.gen(function*() {
 *   const result = yield* divide(10, 2)
 *   console.log("Result:", result) // Result: 5
 *   return result
 * })
 *
 * // Handle errors
 * const safeProgram = program.pipe(
 *   Effect.match({
 *     onFailure: (error) => -1,
 *     onSuccess: (value) => value
 *   })
 * )
 * ```
 *
 * @since 2.0.0
 */
import type * as Arr from "./Array.ts"
import type * as Cause from "./Cause.ts"
import type { Clock } from "./Clock.ts"
import * as Duration from "./Duration.ts"
import type { ExecutionPlan } from "./ExecutionPlan.ts"
import * as Exit from "./Exit.ts"
import type { Fiber } from "./Fiber.ts"
import type * as Filter from "./Filter.ts"
import { constant, dual, type LazyArg } from "./Function.ts"
import type { TypeLambda } from "./HKT.ts"
import * as core from "./internal/core.ts"
import * as internal from "./internal/effect.ts"
import * as internalExecutionPlan from "./internal/executionPlan.ts"
import * as internalLayer from "./internal/layer.ts"
import * as internalRequest from "./internal/request.ts"
import * as internalSchedule from "./internal/schedule.ts"
import type * as Layer from "./Layer.ts"
import type { Logger } from "./Logger.ts"
import type { LogLevel } from "./LogLevel.ts"
import * as Metric from "./Metric.ts"
import type { Option } from "./Option.ts"
import type { Pipeable } from "./Pipeable.ts"
import type * as Predicate from "./Predicate.ts"
import { CurrentLogAnnotations, CurrentLogSpans } from "./References.ts"
import type * as Request from "./Request.ts"
import type { RequestResolver } from "./RequestResolver.ts"
import type * as Result from "./Result.ts"
import type { Schedule } from "./Schedule.ts"
import type { Scheduler } from "./Scheduler.ts"
import type { Scope } from "./Scope.ts"
import * as ServiceMap from "./ServiceMap.ts"
import type {
  AnySpan,
  ParentSpan,
  Span,
  SpanLink,
  SpanOptions,
  SpanOptionsNoTrace,
  TraceOptions,
  Tracer
} from "./Tracer.ts"
import type { TxRef } from "./TxRef.ts"
import type {
  Concurrency,
  Covariant,
  EqualsWith,
  ExcludeTag,
  ExtractReason,
  ExtractTag,
  NoInfer,
  NotFunction,
  ReasonOf,
  ReasonTags,
  Tags,
  unassigned
} from "./Types.ts"
import type * as Unify from "./Unify.ts"
import { internalCall, SingleShotGen } from "./Utils.ts"

const TypeId = core.EffectTypeId

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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // A simple effect that succeeds with a value
 * const success = Effect.succeed(42)
 *
 * // An effect that may fail
 * const risky = Effect.fail(new Error("Something went wrong"))
 *
 * // Effects can be composed using generator functions
 * const program = Effect.gen(function*() {
 *   const value = yield* success
 *   console.log(value) // 42
 *   return value * 2
 * })
 * ```
 *
 * @since 2.0.0
 * @category Models
 */
export interface Effect<out A, out E = never, out R = never> extends Pipeable, Yieldable<Effect<A, E, R>, A, E, R> {
  readonly [TypeId]: Variance<A, E, R>
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: EffectUnify<this>
  [Unify.ignoreSymbol]?: EffectUnifyIgnore
}

/**
 * A type that can be yielded in an Effect generator function.
 *
 * The `Yieldable` interface allows values to be used with the `yield*` syntax
 * in Effect generator functions, providing a clean way to sequence effectful operations.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Effects implement Yieldable and can be used with yield*
 * const effect1 = Effect.succeed(10)
 * const effect2 = Effect.succeed(20)
 *
 * const program = Effect.gen(function*() {
 *   const a = yield* effect1 // yields the Effect which implements Yieldable
 *   const b = yield* effect2
 *   return a + b
 * })
 *
 * Effect.runPromise(program).then(console.log) // 30
 * ```
 *
 * @since 4.0.0
 * @category Yieldable
 */
export interface Yieldable<
  out Self extends Yieldable<any, any, any, any>,
  out A,
  out E = never,
  out R = never
> {
  asEffect(): Effect<A, E, R>
  [Symbol.iterator](): EffectIterator<Self>
}

/**
 * @since 4.0.0
 * @category Yieldable
 */
export abstract class YieldableClass<A, E = never, R = never> implements Yieldable<any, A, E, R> {
  [Symbol.iterator](): EffectIterator<this> {
    return new SingleShotGen(this) as any
  }
  abstract asEffect(): Effect<A, E, R>
}

/**
 * @category models
 * @since 2.0.0
 * @example
 * ```ts
 * import type { Effect } from "effect"
 *
 * // EffectUnify is used internally for type unification
 * // It enables automatic unification of Effect types in unions
 * declare const unified: Effect.EffectUnify<any>
 * ```
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
 * @example
 * ```ts
 * import type { Effect } from "effect"
 *
 * // EffectUnifyIgnore is used internally to control type unification
 * // It prevents certain types from being unified with Effect types
 * declare const ignored: Effect.EffectUnifyIgnore
 * ```
 */
export interface EffectUnifyIgnore {
  Effect?: true
}
/**
 * @category type lambdas
 * @since 2.0.0
 * @example
 * ```ts
 * import type { Effect } from "effect"
 *
 * // EffectTypeLambda is used for higher-kinded type operations
 * // It defines the type structure for Effect in higher-kinded contexts
 * declare const lambda: Effect.EffectTypeLambda
 * ```
 */
export interface EffectTypeLambda extends TypeLambda {
  readonly type: Effect<this["Target"], this["Out1"], this["Out2"]>
}

/**
 * @since 2.0.0
 * @category models
 */
export interface Variance<A, E, R> {
  _A: Covariant<A>
  _E: Covariant<E>
  _R: Covariant<R>
}

/**
 * @since 2.0.0
 * @category models
 * @example
 * ```ts
 * import type { Effect } from "effect"
 *
 * // Extract the success type from an Effect
 * declare const myEffect: Effect.Effect<string, Error, never>
 * // This type utility extracts the success type A from Effect<A, E, R>
 * ```
 */
export type Success<T> = T extends Effect<infer _A, infer _E, infer _R> ? _A
  : never

/**
 * @since 2.0.0
 * @category models
 * @example
 * ```ts
 * import type { Effect } from "effect"
 *
 * // Extract the error type from an Effect
 * declare const myEffect: Effect.Effect<string, Error, never>
 * // This type utility extracts the error type E from Effect<A, E, R>
 * ```
 */
export type Error<T> = T extends Effect<infer _A, infer _E, infer _R> ? _E
  : never

/**
 * @since 2.0.0
 * @category models
 * @example
 * ```ts
 * import type { Effect } from "effect"
 *
 * // Extract the context/services type from an Effect
 * declare const myEffect: Effect.Effect<string, Error, { database: string }>
 * // This type utility extracts the context type R from Effect<A, E, R>
 * ```
 */
export type Services<T> = T extends Effect<infer _A, infer _E, infer _R> ? _R
  : never

/**
 * @since 4.0.0
 * @category models
 */
export declare namespace Yieldable {
  /**
   * @since 4.0.0
   * @category models
   */
  export type Any = Yieldable<any, any, any, any>

  /**
   * @since 4.0.0
   * @category models
   * @example
   * ```ts
   * import type { Effect } from "effect"
   *
   * // Extract the success type from a Yieldable
   * type SuccessType = Effect.Yieldable.Success<Effect.Effect<string>> // string
   * ```
   */
  export type Success<T> = T extends Yieldable<infer _Self, infer _A, infer _E, infer _R> ? _A
    : never
}

/**
 * Tests if a value is an `Effect`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(1))) // true
 * console.log(Effect.isEffect("hello")) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isEffect = (u: unknown): u is Effect<any, any, any> => typeof u === "object" && u !== null && TypeId in u

/**
 * Iterator interface for Effect generators, enabling Effect values to work with generator functions.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Effects are iterable and work with generator functions
 * const program = Effect.gen(function*() {
 *   const effect: Effect.Effect<number, never, never> = Effect.succeed(42)
 *
 *   // The effect's iterator is used internally by yield*
 *   const result = yield* effect
 *   return result * 2
 * })
 *
 * Effect.runPromise(program).then(console.log) // 84
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface EffectIterator<T extends Yieldable<any, any, any, any>> {
  next(
    ...args: ReadonlyArray<any>
  ): IteratorResult<T, Yieldable.Success<T>>
}

// ========================================================================
// Collecting
// ========================================================================

/**
 * Namespace containing type utilities for the `Effect.all` function, which handles
 * collecting multiple effects into various output structures.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // All namespace types are used when working with Effect.all
 * const effects = [
 *   Effect.succeed(1),
 *   Effect.succeed("hello"),
 *   Effect.succeed(true)
 * ] as const
 *
 * const program = Effect.all(effects).pipe(
 *   Effect.map(([num, str, bool]) => ({ num, str, bool }))
 * )
 *
 * Effect.runPromise(program).then(console.log) // { num: 1, str: "hello", bool: true }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export declare namespace All {
  /**
   * @since 2.0.0
   * @category models
   * @example
   * ```ts
   * import { Effect } from "effect"
   *
   * // EffectAny represents an Effect with any type parameters
   * const effects: Array<Effect.All.EffectAny> = [
   *   Effect.succeed(42),
   *   Effect.succeed("hello"),
   *   Effect.fail(new Error("oops"))
   * ]
   * ```
   */
  export type EffectAny = Effect<any, any, any>

  /**
   * @since 2.0.0
   * @category models
   * @example
   * ```ts
   * import type { Effect } from "effect"
   *
   * // ReturnIterable computes the return type for Effect.all with iterables
   * type EffectArray = Array<Effect.Effect<number, string, never>>
   * type Result = Effect.All.ReturnIterable<EffectArray, false>
   * // Result: Effect<Array<number>, string, never>
   * ```
   */
  export type ReturnIterable<
    T extends Iterable<EffectAny>,
    Discard extends boolean
  > = [T] extends [Iterable<Effect<infer A, infer E, infer R>>] ? Effect<Discard extends true ? void : Array<A>, E, R>
    : never

  /**
   * @since 2.0.0
   * @category models
   * @example
   * ```ts
   * import type { Effect } from "effect"
   *
   * // ReturnTuple computes the return type for Effect.all with tuples
   * type EffectTuple = [
   *   Effect.Effect<string, Error, never>,
   *   Effect.Effect<number, Error, never>
   * ]
   * type Result = Effect.All.ReturnTuple<EffectTuple, false>
   * // Result: Effect<[string, number], Error, never>
   * ```
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
   * @category models
   * @example
   * ```ts
   * import type { Effect } from "effect"
   *
   * // ReturnObject computes the return type for Effect.all with objects
   * type EffectRecord = {
   *   a: Effect.Effect<string, Error, never>
   *   b: Effect.Effect<number, Error, never>
   * }
   * type Result = Effect.All.ReturnObject<EffectRecord, false>
   * // Result: Effect<{ a: string, b: number }, Error, never>
   * ```
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
   * @category models
   * @example
   * ```ts
   * import type { Effect } from "effect"
   *
   * // IsDiscard checks if options have discard flag set to true
   * type DiscardOptions = { discard: true }
   * type NoDiscardOptions = { discard: false }
   * type WithDiscard = Effect.All.IsDiscard<DiscardOptions> // true
   * type WithoutDiscard = Effect.All.IsDiscard<NoDiscardOptions> // false
   * ```
   */
  export type IsDiscard<A> = [Extract<A, { readonly discard: true }>] extends [
    never
  ] ? false
    : true

  /**
   * @since 2.0.0
   * @category models
   * @example
   * ```ts
   * import type { Effect } from "effect"
   *
   * // Return determines the result type based on input and options
   * type EffectArray = Array<Effect.Effect<number, string, never>>
   * type Options = { discard: false }
   * type Result = Effect.All.Return<EffectArray, Options>
   * // Result: Effect<Array<number>, string, never>
   * ```
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
 * @example Combining Effects in Tuples
 * ```ts
 * import { Console, Effect } from "effect"
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
 * @example Combining Effects in Iterables
 * ```ts
 * import { Console, Effect } from "effect"
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
 * @example Combining Effects in Structs
 * ```ts
 * import { Console, Effect } from "effect"
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
 * @example Combining Effects in Records
 * ```ts
 * import { Console, Effect } from "effect"
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
 * @example Short-Circuiting Behavior
 * ```ts
 * import { Console, Effect } from "effect"
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
 * import { Effect } from "effect"
 * import { Console } from "effect"
 *
 * const result = Effect.forEach(
 *   [1, 2, 3, 4, 5],
 *   (n, index) =>
 *     Console.log(`Currently at index ${index}`).pipe(Effect.as(n * 2))
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
 * import { Effect } from "effect"
 * import { Console } from "effect"
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
  <B, E, R, S extends Iterable<any>, const Discard extends boolean = false>(
    f: (a: Arr.ReadonlyArray.Infer<S>, i: number) => Effect<B, E, R>,
    options?: { readonly concurrency?: Concurrency | undefined; readonly discard?: Discard | undefined } | undefined
  ): (self: S) => Effect<Discard extends false ? Arr.ReadonlyArray.With<S, B> : void, E, R>
  <B, E, R, S extends Iterable<any>, const Discard extends boolean = false>(
    self: S,
    f: (a: Arr.ReadonlyArray.Infer<S>, i: number) => Effect<B, E, R>,
    options?: { readonly concurrency?: Concurrency | undefined; readonly discard?: Discard | undefined } | undefined
  ): Effect<Discard extends false ? Arr.ReadonlyArray.With<S, B> : void, E, R>
} = internal.forEach

/**
 * Executes a body effect repeatedly while a condition holds true.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * let counter = 0
 *
 * const program = Effect.whileLoop({
 *   while: () => counter < 5,
 *   body: () => Effect.sync(() => ++counter),
 *   step: (n) => console.log(`Current count: ${n}`)
 * })
 *
 * Effect.runPromise(program)
 * // Output:
 * // Current count: 1
 * // Current count: 2
 * // Current count: 3
 * // Current count: 4
 * // Current count: 5
 * ```
 *
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
 * @example Fetching a TODO Item
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
 * @example Custom Error Handling
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.succeedNone
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: { _id: 'Option', _tag: 'None' }
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const succeedNone: Effect<Option<never>> = internal.succeedNone

/**
 * Returns an effect which succeeds with the value wrapped in a `Some`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.succeedSome(42)
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: { _id: 'Option', _tag: 'Some', value: 42 }
 * ```
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

const void_: Effect<void> = internal.void
export {
  /**
   * @since 2.0.0
   * @category Creating Effects
   */
  void_ as void
}

const undefined_: Effect<undefined> = internal.undefined
export {
  /**
   * @since 4.0.0
   * @category Creating Effects
   */
  undefined_ as undefined
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const delay = (ms: number) =>
 *   Effect.callback<void>((resume) => {
 *     const timeoutId = setTimeout(() => {
 *       resume(Effect.void)
 *     }, ms)
 *     // Cleanup function for interruption
 *     return Effect.sync(() => clearTimeout(timeoutId))
 *   })
 *
 * const program = delay(1000)
 * ```
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // This effect will never complete
 * const program = Effect.never
 *
 * // This will run forever (or until interrupted)
 * // Effect.runPromise(program) // Never resolves
 *
 * // Use with timeout for practical applications
 * const timedProgram = Effect.timeout(program, "1 second")
 * ```
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
 * export const program = Effect.gen(function*() {
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
  <Eff extends Yieldable<any, any, any, any>, AEff>(
    f: () => Generator<Eff, AEff, never>
  ): Effect<
    AEff,
    [Eff] extends [never] ? never
      : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
      : never,
    [Eff] extends [never] ? never
      : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
      : never
  >
  <Self, Eff extends Yieldable<any, any, any, any>, AEff>(
    self: Self,
    f: (this: Self) => Generator<Eff, AEff, never>
  ): Effect<
    AEff,
    [Eff] extends [never] ? never
      : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
      : never,
    [Eff] extends [never] ? never
      : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
      : never
  >
} = internal.gen

/**
 * @since 4.0.0
 */
export namespace gen {
  /**
   * @since 4.0.0
   */
  export type Return<A, E = never, R = never> = Generator<Effect<any, E, R>, A, any>
}

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
 * Creates an `Effect` that represents a recoverable error using a lazy evaluation.
 *
 * This function is useful when you need to create an error effect but want to
 * defer the computation of the error value until the effect is actually run.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.failSync(() => new Error("Something went wrong"))
 *
 * Effect.runPromiseExit(program).then(console.log)
 * // Output: { _id: 'Exit', _tag: 'Failure', cause: ... }
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const failSync: <E>(evaluate: LazyArg<E>) => Effect<never, E> = internal.failSync

/**
 * Creates an `Effect` that represents a failure with a specific `Cause`.
 *
 * This function allows you to create effects that fail with complex error
 * structures, including multiple errors, defects, interruptions, and more.
 *
 * @example
 * ```ts
 * import { Cause, Effect } from "effect"
 *
 * const program = Effect.failCause(
 *   Cause.fail("Network error")
 * )
 *
 * Effect.runPromiseExit(program).then(console.log)
 * // Output: { _id: 'Exit', _tag: 'Failure', cause: ... }
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const failCause: <E>(cause: Cause.Cause<E>) => Effect<never, E> = internal.failCause

/**
 * Creates an `Effect` that represents a failure with a `Cause` computed lazily.
 *
 * This function is useful when you need to create a failure effect with a
 * complex cause but want to defer the computation until the effect is run.
 *
 * @example
 * ```ts
 * import { Cause, Effect } from "effect"
 *
 * const program = Effect.failCauseSync(() =>
 *   Cause.fail("Error computed at runtime")
 * )
 *
 * Effect.runPromiseExit(program).then(console.log)
 * // Output: { _id: 'Exit', _tag: 'Failure', cause: ... }
 * ```
 *
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
   * @example Basic Usage with Default Error Handling
   * ```ts
   * import { Effect } from "effect"
   *
   * const parseJSON = (input: string) =>
   *   Effect.try({
   *     try: () => JSON.parse(input),
   *     catch: (error) => error as Error
   *   })
   *
   * // Success case
   * Effect.runPromise(parseJSON("{\"name\": \"Alice\"}")).then(console.log)
   * // Output: { name: "Alice" }
   *
   * // Failure case
   * Effect.runPromiseExit(parseJSON("invalid json")).then(console.log)
   * // Output: Exit.failure with Error
   * ```
   *
   * @example Custom Error Handling
   * ```ts
   * import { Effect } from "effect"
   *
   * const parseJSON = (input: string) =>
   *   Effect.try({
   *     try: () => JSON.parse(input),
   *     catch: (error) => new Error(`JSON parsing failed: ${error}`)
   *   })
   *
   * Effect.runPromiseExit(parseJSON("invalid json")).then(console.log)
   * // Output: Exit.failure with custom Error message
   * ```
   *
   * @since 2.0.0
   * @category Creating Effects
   */
  try_ as try
}

/**
 * Yields control back to the Effect runtime, allowing other fibers to execute.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   console.log("Before yield")
 *   yield* Effect.yieldNow
 *   console.log("After yield")
 * })
 *
 * Effect.runPromise(program)
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const yieldNow: Effect<void> = internal.yieldNow

/**
 * Yields control back to the Effect runtime with a specified priority, allowing other fibers to execute.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   console.log("High priority task")
 *   yield* Effect.yieldNowWith(10) // Higher priority
 *   console.log("Continued after yield")
 * })
 *
 * Effect.runPromise(program)
 * ```
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const yieldNowWith: (priority?: number) => Effect<void> = internal.yieldNowWith

/**
 * Provides access to the current fiber within an effect computation.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.withFiber((fiber) =>
 *   Effect.succeed(`Fiber ID: ${fiber.id}`)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: Fiber ID: 1
 * ```
 *
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
 * Converts a `Result` to an `Effect`.
 *
 * @example
 * ```ts
 * import { Effect, Result } from "effect"
 *
 * const success = Result.succeed(42)
 * const failure = Result.fail("Something went wrong")
 *
 * const effect1 = Effect.fromResult(success)
 * const effect2 = Effect.fromResult(failure)
 *
 * Effect.runPromise(effect1).then(console.log) // 42
 * Effect.runPromiseExit(effect2).then(console.log)
 * // { _id: 'Exit', _tag: 'Failure', cause: { _id: 'Cause', _tag: 'Fail', failure: 'Something went wrong' } }
 * ```
 *
 * @since 4.0.0
 * @category Conversions
 */
export const fromResult: <A, E>(result: Result.Result<A, E>) => Effect<A, E> = internal.fromResult

/**
 * Converts an `Option` to an `Effect`.
 *
 * @example
 * ```ts
 * import { Effect, Option } from "effect"
 *
 * const some = Option.some(42)
 * const none = Option.none()
 *
 * const effect1 = Effect.fromOption(some)
 * const effect2 = Effect.fromOption(none)
 *
 * Effect.runPromise(effect1).then(console.log) // 42
 * Effect.runPromiseExit(effect2).then(console.log)
 * // { _id: 'Exit', _tag: 'Failure', cause: { _id: 'Cause', _tag: 'Fail', failure: { _id: 'NoSuchElementError' } } }
 * ```
 *
 * @since 4.0.0
 * @category Conversions
 */
export const fromOption: <A>(
  option: Option<A>
) => Effect<A, Cause.NoSuchElementError> = internal.fromOption

/**
 * Converts a nullish value to an `Effect`, failing with a `NoSuchElementError`
 * if the value is `null` or `undefined`.
 *
 * @since 4.0.0
 * @category Conversions
 */
export const fromNullishOr: <A>(value: A) => Effect<NonNullable<A>, Cause.NoSuchElementError> = internal.fromNullishOr

/**
 * Converts a yieldable value to an Effect.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as Option from "effect/Option"
 *
 * // Option is yieldable in Effect
 * const program = Effect.gen(function*() {
 *   const value = yield* Effect.fromYieldable(Option.some(42))
 *   return value * 2
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: 84
 * ```
 *
 * @since 4.0.0
 * @category Conversions
 */
export const fromYieldable: <Self extends Yieldable.Any, A, E, R>(
  yieldable: Yieldable<Self, A, E, R>
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
 * @example
 * ```ts
 * import { Effect, pipe } from "effect"
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
 * @since 2.0.0
 * @category Sequencing
 */
export const flatten: <A, E, R, E2, R2>(self: Effect<Effect<A, E, R>, E2, R2>) => Effect<A, E | E2, R | R2> =
  internal.flatten

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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Effect.zipRight`
 *
 * @example Applying a Discount Based on Fetched Amount
 * ```ts
 * import { Effect, pipe } from "effect"
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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Effect.zipLeft`
 *
 * @example
 * ```ts
 * // Title: Logging a step in a pipeline
 * import { Effect, pipe } from "effect"
 * import { Console } from "effect"
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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Effect.either`
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const success = Effect.succeed(42)
 * const failure = Effect.fail("Something went wrong")
 *
 * const program1 = Effect.result(success)
 * const program2 = Effect.result(failure)
 *
 * Effect.runPromise(program1).then(console.log)
 * // { _id: 'Result', _tag: 'Success', value: 42 }
 *
 * Effect.runPromise(program2).then(console.log)
 * // { _id: 'Result', _tag: 'Failure', error: 'Something went wrong' }
 * ```
 *
 * @see {@link option} for a version that uses `Option` instead.
 * @see {@link exit} for a version that encapsulates both recoverable errors and defects in an `Exit`.
 *
 * @since 4.0.0
 * @category Outcome Encapsulation
 */
export const result: <A, E, R>(self: Effect<A, E, R>) => Effect<Result.Result<A, E>, never, R> = internal.result

/**
 * Encapsulates the result of an effect in an `Option`.
 *
 * **Details**
 *
 * This function wraps the outcome of an effect in an `Option` type. If the
 * original effect succeeds, the success value is wrapped in `Option.some`. If
 * the effect fails, the failure is converted to `Option.none`.
 *
 * This is particularly useful for scenarios where you want to represent the
 * absence of a value explicitly, without causing the resulting effect to fail.
 * The resulting effect has an error type of `never`, meaning it cannot fail
 * directly. However, unrecoverable errors, also referred to as defects, are
 * not captured and will still result in failure.
 *
 * @see {@link result} for a version that uses `Result` instead.
 * @see {@link exit} for a version that encapsulates both recoverable errors and defects in an `Exit`.
 *
 * @since 2.0.0
 * @category Output Encapsulation
 */
export const option: <A, E, R>(self: Effect<A, E, R>) => Effect<Option<A>, never, R> = internal.option

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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const success = Effect.succeed(42)
 * const failure = Effect.fail("Something went wrong")
 *
 * const program1 = Effect.exit(success)
 * const program2 = Effect.exit(failure)
 *
 * Effect.runPromise(program1).then(console.log)
 * // { _id: 'Exit', _tag: 'Success', value: 42 }
 *
 * Effect.runPromise(program2).then(console.log)
 * // { _id: 'Exit', _tag: 'Failure', cause: { _id: 'Cause', _tag: 'Fail', failure: 'Something went wrong' } }
 * ```
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
 * @example Adding a Service Charge
 * ```ts
 * import { Effect, pipe } from "effect"
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
 * import { Effect, pipe } from "effect"
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.asSome(Effect.succeed(42))
 *
 * Effect.runPromise(program).then(console.log)
 * // { _id: 'Option', _tag: 'Some', value: 42 }
 * ```
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.asVoid(Effect.succeed(42))
 *
 * Effect.runPromise(program).then(console.log)
 * // undefined (void)
 * ```
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
   * @see {@link catchCause} for a version that can recover from both recoverable and unrecoverable errors.
   *
   * **Previously Known As**
   *
   * This API replaces the following from Effect 3.x:
   *
   * - `Effect.catchAll`
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * class NetworkError {
 *   readonly _tag = "NetworkError"
 *   constructor(readonly message: string) {}
 * }
 *
 * class ValidationError {
 *   readonly _tag = "ValidationError"
 *   constructor(readonly message: string) {}
 * }
 *
 * declare const task: Effect.Effect<string, NetworkError | ValidationError>
 *
 * const program = Effect.catchTag(
 *   task,
 *   "NetworkError",
 *   (error) => Effect.succeed(`Recovered from network error: ${error.message}`)
 * )
 * ```
 *
 * @since 2.0.0
 * @category Error handling
 */
export const catchTag: {
  <const K extends Tags<E> | Arr.NonEmptyReadonlyArray<Tags<E>>, E, A1, E1, R1>(
    k: K,
    f: (e: ExtractTag<NoInfer<E>, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>) => Effect<A1, E1, R1>
  ): <A, R>(
    self: Effect<A, E, R>
  ) => Effect<A1 | A, E1 | ExcludeTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R>
  <A, E, R, const K extends Tags<E> | Arr.NonEmptyReadonlyArray<Tags<E>>, R1, E1, A1>(
    self: Effect<A, E, R>,
    k: K,
    f: (e: ExtractTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>) => Effect<A1, E1, R1>
  ): Effect<A1 | A, E1 | ExcludeTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>, R1 | R>
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
 * @example
 * ```ts
 * import { Data, Effect } from "effect"
 *
 * // Define tagged error types
 * class ValidationError extends Data.TaggedError("ValidationError")<{
 *   message: string
 * }> {}
 *
 * class NetworkError extends Data.TaggedError("NetworkError")<{
 *   statusCode: number
 * }> {}
 *
 * // An effect that might fail with multiple error types
 * declare const program: Effect.Effect<string, ValidationError | NetworkError>
 *
 * // Handle multiple error types at once
 * const handled = Effect.catchTags(program, {
 *   ValidationError: (error) =>
 *     Effect.succeed(`Validation failed: ${error.message}`),
 *   NetworkError: (error) => Effect.succeed(`Network error: ${error.statusCode}`)
 * })
 * ```
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
 * Catches a specific reason within a tagged error.
 *
 * Use this to handle nested error causes without removing the parent error
 * from the error channel. The handler receives the unwrapped reason.
 *
 * @example
 * ```ts
 * import { Data, Effect } from "effect"
 *
 * class RateLimitError extends Data.TaggedError("RateLimitError")<{
 *   retryAfter: number
 * }> {}
 *
 * class QuotaExceededError extends Data.TaggedError("QuotaExceededError")<{
 *   limit: number
 * }> {}
 *
 * class AiError extends Data.TaggedError("AiError")<{
 *   reason: RateLimitError | QuotaExceededError
 * }> {}
 *
 * declare const program: Effect.Effect<string, AiError>
 *
 * // Handle rate limits specifically
 * const handled = program.pipe(
 *   Effect.catchReason("AiError", "RateLimitError", (reason) =>
 *     Effect.succeed(`Retry after ${reason.retryAfter}s`)
 *   )
 * )
 * ```
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchReason: {
  <
    K extends Tags<E>,
    E,
    RK extends ReasonTags<ExtractTag<NoInfer<E>, K>>,
    A2,
    E2,
    R2
  >(
    errorTag: K,
    reasonTag: RK,
    f: (reason: ExtractReason<ExtractTag<NoInfer<E>, K>, RK>) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | A2, E | E2, R | R2>
  <
    A,
    E,
    R,
    K extends Tags<E>,
    RK extends ReasonTags<ExtractTag<E, K>>,
    A2,
    E2,
    R2
  >(
    self: Effect<A, E, R>,
    errorTag: K,
    reasonTag: RK,
    f: (reason: ExtractReason<ExtractTag<E, K>, RK>) => Effect<A2, E2, R2>
  ): Effect<A | A2, E | E2, R | R2>
} = internal.catchReason

/**
 * Catches multiple reasons within a tagged error using an object of handlers.
 *
 * @example
 * ```ts
 * import { Data, Effect } from "effect"
 *
 * class RateLimitError extends Data.TaggedError("RateLimitError")<{
 *   retryAfter: number
 * }> {}
 *
 * class QuotaExceededError extends Data.TaggedError("QuotaExceededError")<{
 *   limit: number
 * }> {}
 *
 * class AiError extends Data.TaggedError("AiError")<{
 *   reason: RateLimitError | QuotaExceededError
 * }> {}
 *
 * declare const program: Effect.Effect<string, AiError>
 *
 * const handled = program.pipe(
 *   Effect.catchReasons("AiError", {
 *     RateLimitError: (reason) =>
 *       Effect.succeed(`Retry after ${reason.retryAfter}s`),
 *     QuotaExceededError: (reason) =>
 *       Effect.succeed(`Quota exceeded: ${reason.limit}`)
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchReasons: {
  <
    K extends Tags<E>,
    E,
    Cases extends {
      [RK in ReasonTags<ExtractTag<NoInfer<E>, K>>]+?: (
        reason: ExtractReason<ExtractTag<NoInfer<E>, K>, RK>
      ) => Effect<any, any, any>
    }
  >(
    errorTag: K,
    cases: Cases
  ): <A, R>(self: Effect<A, E, R>) => Effect<
    | A
    | {
      [RK in keyof Cases]: Cases[RK] extends (...args: Array<any>) => Effect<infer A, any, any> ? A : never
    }[keyof Cases],
    | E
    | {
      [RK in keyof Cases]: Cases[RK] extends (...args: Array<any>) => Effect<any, infer E, any> ? E : never
    }[keyof Cases],
    | R
    | {
      [RK in keyof Cases]: Cases[RK] extends (...args: Array<any>) => Effect<any, any, infer R> ? R : never
    }[keyof Cases]
  >
  <
    A,
    E,
    R,
    K extends Tags<E>,
    Cases extends {
      [RK in ReasonTags<ExtractTag<E, K>>]+?: (
        reason: ExtractReason<ExtractTag<E, K>, RK>
      ) => Effect<any, any, any>
    }
  >(
    self: Effect<A, E, R>,
    errorTag: K,
    cases: Cases
  ): Effect<
    | A
    | {
      [RK in keyof Cases]: Cases[RK] extends (...args: Array<any>) => Effect<infer A, any, any> ? A : never
    }[keyof Cases],
    | E
    | {
      [RK in keyof Cases]: Cases[RK] extends (...args: Array<any>) => Effect<any, infer E, any> ? E : never
    }[keyof Cases],
    | R
    | {
      [RK in keyof Cases]: Cases[RK] extends (...args: Array<any>) => Effect<any, any, infer R> ? R : never
    }[keyof Cases]
  >
} = internal.catchReasons

/**
 * A helper type to filter tags that have reason fields with tagged variants.
 *
 * @since 4.0.0
 * @category Error handling
 */
export type TagsWithReason<E> = {
  [T in Tags<E>]: ReasonTags<ExtractTag<E, T>> extends never ? never : T
}[Tags<E>]

/**
 * Promotes nested reason errors into the Effect error channel, replacing
 * the parent error.
 *
 * @example
 * ```ts
 * import { Data, Effect } from "effect"
 *
 * class RateLimitError extends Data.TaggedError("RateLimitError")<{
 *   retryAfter: number
 * }> {}
 *
 * class QuotaExceededError extends Data.TaggedError("QuotaExceededError")<{
 *   limit: number
 * }> {}
 *
 * class AiError extends Data.TaggedError("AiError")<{
 *   reason: RateLimitError | QuotaExceededError
 * }> {}
 *
 * declare const program: Effect.Effect<string, AiError>
 *
 * // Before: Effect<string, AiError>
 * // After:  Effect<string, RateLimitError | QuotaExceededError>
 * const unwrapped = program.pipe(Effect.unwrapReason("AiError"))
 * ```
 *
 * @since 4.0.0
 * @category Error handling
 */
export const unwrapReason: {
  <
    K extends TagsWithReason<E>,
    E
  >(
    errorTag: K
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, ExcludeTag<E, K> | ReasonOf<ExtractTag<E, K>>, R>
  <
    A,
    E,
    R,
    K extends TagsWithReason<E>
  >(
    self: Effect<A, E, R>,
    errorTag: K
  ): Effect<A, ExcludeTag<E, K> | ReasonOf<ExtractTag<E, K>>, R>
} = internal.unwrapReason

/**
 * Handles both recoverable and unrecoverable errors by providing a recovery
 * effect.
 *
 * **When to Use**
 *
 * The `catchCause` function allows you to handle all errors, including
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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Effect.catchAllCause`
 *
 * @example
 * ```ts
 * import { Cause, Console, Effect } from "effect"
 *
 * // An effect that might fail in different ways
 * const program = Effect.die("Something went wrong")
 *
 * // Recover from any cause (including defects)
 * const recovered = Effect.catchCause(program, (cause) => {
 *   if (Cause.hasDie(cause)) {
 *     return Console.log("Caught defect").pipe(
 *       Effect.as("Recovered from defect")
 *     )
 *   }
 *   return Effect.succeed("Unknown error")
 * })
 * ```
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
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Effect.catchAllDefect`
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * // An effect that might throw an unexpected error (defect)
 * const program = Effect.sync(() => {
 *   throw new Error("Unexpected error")
 * })
 *
 * // Recover from defects only
 * const recovered = Effect.catchDefect(program, (defect) => {
 *   return Console.log(`Caught defect: ${defect}`).pipe(
 *     Effect.as("Recovered from defect")
 *   )
 * })
 * ```
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
 * `catchIf` lets you recover from errors with a predicate. If the predicate
 * matches the error, the recovery effect is applied. This function doesn't
 * alter the error type, so the resulting effect still carries the original
 * error type unless a user-defined type guard is used to narrow the type.
 *
 * **Example** (Catching Specific Errors with a Predicate)
 *
 * ```ts
 * import { Effect, Random } from "effect"
 *
 * class HttpError {
 *   readonly _tag = "HttpError"
 * }
 *
 * class ValidationError {
 *   readonly _tag = "ValidationError"
 * }
 *
 * const program = Effect.gen(function*() {
 *   const n1 = yield* Random.next
 *   const n2 = yield* Random.next
 *   if (n1 < 0.5) {
 *     yield* Effect.fail(new HttpError())
 *   }
 *   if (n2 < 0.5) {
 *     yield* Effect.fail(new ValidationError())
 *   }
 *   return "some result"
 * })
 *
 * const recovered = program.pipe(
 *   Effect.catchIf(
 *     (error) => error._tag === "HttpError",
 *     () => Effect.succeed("Recovering from HttpError")
 *   )
 * )
 * ```
 *
 * @since 2.0.0
 * @category Error handling
 */
export const catchIf: {
  <E, EB extends E, A2, E2, R2>(
    refinement: Predicate.Refinement<NoInfer<E>, EB>,
    f: (e: EB) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E2 | Exclude<E, EB>, R2 | R>
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
 * Recovers from specific errors using a `Filter`.
 *
 * **When to Use**
 *
 * `catchFilter` lets you recover from errors with a `Filter` from the `Filter`
 * module. If the filter matches the error, the recovery effect is applied. This
 * function doesn't alter the error type, so the resulting effect still carries
 * the original error type unless a type-guarding filter narrows the type.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Effect.catchSome`
 *
 * @example
 * ```ts
 * import { Effect, Filter } from "effect"
 *
 * // An effect that might fail with a number
 * const program = Effect.fail(42)
 *
 * // Recover only from specific error values
 * const recovered = Effect.catchFilter(
 *   program,
 *   Filter.fromPredicate((error: number) => error === 42),
 *   (error) => Effect.succeed(`Recovered from error: ${error}`)
 * )
 * ```
 *
 * @since 2.0.0
 * @category Error handling
 */
export const catchFilter: {
  <E, EB, A2, E2, R2, X>(
    filter: Filter.Filter<NoInfer<E>, EB, X>,
    f: (e: EB) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E2 | X, R2 | R>
  <A, E, R, EB, A2, E2, R2, X>(
    self: Effect<A, E, R>,
    filter: Filter.Filter<NoInfer<E>, EB, X>,
    f: (e: EB) => Effect<A2, E2, R2>
  ): Effect<A | A2, E2 | X, R | R2>
} = internal.catchFilter

/**
 * Recovers from specific failures based on a predicate.
 *
 * This function allows you to conditionally catch and recover from failures
 * that match a specific predicate. This is useful when you want to handle
 * only certain types of errors while letting others propagate.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Effect.catchSomeCause`
 *
 * @example
 * ```ts
 * import { Cause, Console, Effect } from "effect"
 *
 * const httpRequest = Effect.fail("Network Error")
 *
 * // Only catch network-related failures
 * const program = Effect.catchCauseFilter(
 *   httpRequest,
 *   (cause) => Cause.hasFail(cause),
 *   (failure, cause) =>
 *     Effect.gen(function*() {
 *       yield* Console.log(`Caught network error: ${Cause.squash(cause)}`)
 *       return "Fallback response"
 *     })
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: "Caught network error: Network Error"
 * // Then: "Fallback response"
 * ```
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchCauseFilter: {
  <E, B, E2, R2, EB, X extends Cause.Cause<any>>(
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (failure: EB, cause: Cause.Cause<E>) => Effect<B, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | B, Cause.Cause.Error<X> | E2, R | R2>
  <A, E, R, B, E2, R2, EB, X extends Cause.Cause<any>>(
    self: Effect<A, E, R>,
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (failure: EB, cause: Cause.Cause<E>) => Effect<B, E2, R2>
  ): Effect<A | B, Cause.Cause.Error<X> | E2, R | R2>
} = internal.catchCauseFilter

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
 * @example
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
 * import { Console, Effect } from "effect"
 *
 * // Simulate a task that fails with an error
 * const task: Effect.Effect<number, string> = Effect.fail("NetworkError")
 *
 * // Use tapError to log the error message when the task fails
 * const tapping = Effect.tapError(
 *   task,
 *   (error) => Console.log(`expected error: ${error}`)
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
 * Inspect errors matching a specific tag without altering the original effect.
 *
 * **When to Use**
 *
 * Use this function when your errors are modeled as tagged unions and you want
 * to run a side effect for a matching tag without changing the error channel.
 *
 * **Details**
 *
 * This function allows you to inspect and handle specific error types based on
 * their `_tag` property. It is useful when errors are modeled with tagged
 * unions, letting you log or perform actions on matched errors while leaving the
 * error channel unchanged.
 *
 * If the error doesn't match the specified tag, this function does nothing and
 * the effect proceeds as usual.
 *
 * **Example**
 *
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * class NetworkError {
 *   readonly _tag = "NetworkError"
 *   constructor(readonly statusCode: number) {}
 * }
 *
 * class ValidationError {
 *   readonly _tag = "ValidationError"
 *   constructor(readonly field: string) {}
 * }
 *
 * const task: Effect.Effect<number, NetworkError | ValidationError> =
 *   Effect.fail(new NetworkError(504))
 *
 * const tapping = Effect.tapErrorTag(task, "NetworkError", (error) =>
 *   Console.log(`expected error: ${error.statusCode}`)
 * )
 *
 * Effect.runFork(tapping)
 * // Output:
 * // expected error: 504
 * ```
 *
 * @since 2.0.0
 * @category Sequencing
 */
export const tapErrorTag: {
  <const K extends Tags<E> | Arr.NonEmptyReadonlyArray<Tags<E>>, E, A1, E1, R1>(
    k: K,
    f: (e: ExtractTag<NoInfer<E>, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>) => Effect<A1, E1, R1>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E1, R1 | R>
  <
    A,
    E,
    R,
    const K extends Tags<E> | Arr.NonEmptyReadonlyArray<Tags<E>>,
    R1,
    E1,
    A1
  >(
    self: Effect<A, E, R>,
    k: K,
    f: (e: ExtractTag<E, K extends Arr.NonEmptyReadonlyArray<string> ? K[number] : K>) => Effect<A1, E1, R1>
  ): Effect<A, E | E1, R | R1>
} = internal.tapErrorTag

/**
 * The `tapCause` function allows you to inspect the complete cause
 * of an error, including failures and defects.
 *
 * This function is helpful when you need to log, monitor, or handle specific
 * error causes in your effects. It gives you access to the full error cause,
 * whether it's a failure, defect, or other exceptional conditions, without
 * altering the error or the overall result of the effect.
 *
 * **Previously Known As**
 *
 * This API replaces the following from Effect 3.x:
 *
 * - `Effect.tapErrorCause`
 *
 * @example
 * ```ts
 * import { Cause, Console, Effect } from "effect"
 *
 * const task = Effect.fail("Something went wrong")
 *
 * const program = Effect.tapCause(
 *   task,
 *   (cause) => Console.log(`Logging cause: ${Cause.squash(cause)}`)
 * )
 *
 * Effect.runPromiseExit(program).then(console.log)
 * // Output: "Logging cause: Error: Something went wrong"
 * // Then: { _id: 'Exit', _tag: 'Failure', cause: ... }
 * ```
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
 * Conditionally executes a side effect based on the cause of a failed effect.
 *
 * This function allows you to tap into the cause of an effect's failure only when
 * the cause matches a specific predicate. This is useful for conditional logging,
 * monitoring, or other side effects based on the type of failure.
 *
 * @example
 * ```ts
 * import { Cause, Console, Effect } from "effect"
 *
 * const task = Effect.fail("Network timeout")
 *
 * // Only log causes that contain failures (not interrupts or defects)
 * const program = Effect.tapCauseFilter(
 *   task,
 *   (cause) => Cause.hasFail(cause),
 *   (_, cause) => Console.log(`Logging failure cause: ${Cause.squash(cause)}`)
 * )
 *
 * Effect.runPromiseExit(program).then(console.log)
 * // Output: "Logging failure cause: Network timeout"
 * // Then: { _id: 'Exit', _tag: 'Failure', cause: ... }
 * ```
 *
 * @since 4.0.0
 * @category sequencing
 */
export const tapCauseFilter: {
  <E, B, E2, R2, EB, X extends Cause.Cause<any>>(
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (a: EB, cause: Cause.Cause<E>) => Effect<B, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E2, R | R2>
  <A, E, R, B, E2, R2, EB, X extends Cause.Cause<any>>(
    self: Effect<A, E, R>,
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (a: EB, cause: Cause.Cause<E>) => Effect<B, E2, R2>
  ): Effect<A, E | E2, R | R2>
} = internal.tapCauseFilter

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
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * // Simulate a task that fails with a recoverable error
 * const task1: Effect.Effect<number, string> = Effect.fail("NetworkError")
 *
 * // tapDefect won't log anything because NetworkError is not a defect
 * const tapping1 = Effect.tapDefect(
 *   task1,
 *   (cause) => Console.log(`defect: ${cause}`)
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
 * const tapping2 = Effect.tapDefect(
 *   task2,
 *   (cause) => Console.log(`defect: ${cause}`)
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

/**
 * Runs an effect repeatedly until it succeeds, ignoring errors.
 *
 * **Details**
 *
 * This function takes an effect and runs it repeatedly until the effect
 * successfully completes. If the effect fails, it will ignore the error and
 * retry the operation. This is useful when you need to perform a task that may
 * fail occasionally, but you want to keep trying until it eventually succeeds.
 * It works by repeatedly executing the effect until it no longer throws an
 * error.
 *
 * **When to Use**
 *
 * Use this function when you want to retry an operation multiple times until it
 * succeeds. It is helpful in cases where the operation may fail temporarily
 * (e.g., a network request), and you want to keep trying without handling or
 * worrying about the errors.
 *
 * @since 2.0.0
 * @category Error handling
 */
export const eventually: <A, E, R>(self: Effect<A, E, R>) => Effect<A, never, R> = internal.eventually

// -----------------------------------------------------------------------------
// Error Handling
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category Error handling
 * @example
 * ```ts
 * import type { Effect } from "effect"
 *
 * // Retry namespace contains types for retry operations
 * declare const effect: Effect.Effect<string, Error, never>
 * declare const options: Effect.Retry.Options<Error>
 * // Use Effect.retry with these types for retrying failed effects
 * ```
 */
export declare namespace Retry {
  /**
   * @since 2.0.0
   * @category Error handling
   * @example
   * ```ts
   * import type { Effect } from "effect"
   *
   * // Return type for retry operations with specific options
   * declare const options: Effect.Retry.Options<Error>
   * type RetryResult = Effect.Retry.Return<never, Error, string, typeof options>
   * // Result: Effect with retried operation result types
   * ```
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
   * @example
   * ```ts
   * import { Schedule } from "effect"
   * import type { Effect } from "effect"
   *
   * // Options for configuring retry behavior
   * const retryOptions: Effect.Retry.Options<Error> = {
   *   times: 3,
   *   schedule: Schedule.exponential("100 millis"),
   *   while: (error) => error.message !== "STOP"
   * }
   * ```
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
 * @example
 * ```ts
 * import { Effect, Schedule } from "effect"
 *
 * let attempt = 0
 * const task = Effect.callback<string, Error>((resume) => {
 *   attempt++
 *   if (attempt <= 2) {
 *     resume(Effect.fail(new Error(`Attempt ${attempt} failed`)))
 *   } else {
 *     resume(Effect.succeed("Success!"))
 *   }
 * })
 *
 * const policy = Schedule.addDelay(Schedule.recurs(5), () => "100 millis")
 * const program = Effect.retry(task, policy)
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: "Success!" (after 2 retries)
 * ```
 *
 * @see {@link retryOrElse} for a version that allows you to run a fallback.
 * @see {@link repeat} if your retry condition is based on successful outcomes rather than errors.
 *
 * @since 2.0.0
 * @category Error handling
 */
export const retry: {
  <E, O extends Retry.Options<E>>(options: O): <A, R>(self: Effect<A, E, R>) => Retry.Return<R, E, A, O>
  <B, E, Error, Env>(
    policy: Schedule<B, NoInfer<E>, Error, Env>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | Error, R | Env>
  <A, E, R, O extends Retry.Options<E>>(self: Effect<A, E, R>, options: O): Retry.Return<R, E, A, O>
  <A, E, R, B, Error, Env>(
    self: Effect<A, E, R>,
    policy: Schedule<B, NoInfer<E>, Error, Env>
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
 * @example
 * ```ts
 * import { Console, Effect, Schedule } from "effect"
 *
 * let attempt = 0
 * const networkRequest = Effect.gen(function*() {
 *   attempt++
 *   yield* Console.log(`Network attempt ${attempt}`)
 *   if (attempt < 3) {
 *     return yield* Effect.fail(new Error("Network timeout"))
 *   }
 *   return "Network data"
 * })
 *
 * // Retry up to 2 times, then fall back to cached data
 * const program = Effect.retryOrElse(
 *   networkRequest,
 *   Schedule.recurs(2),
 *   (error, retryCount) =>
 *     Effect.gen(function*() {
 *       yield* Console.log(`All ${retryCount} retries failed, using cache`)
 *       return "Cached data"
 *     })
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // Network attempt 1
 * // Network attempt 2
 * // Network attempt 3
 * // Network data
 * ```
 *
 * @since 2.0.0
 * @category Error handling
 */
export const retryOrElse: {
  <A1, E, E1, R1, A2, E2, R2>(
    policy: Schedule<A1, NoInfer<E>, E1, R1>,
    orElse: (e: NoInfer<E>, out: A1) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | A2, E1 | E2, R | R1 | R2>
  <A, E, R, A1, E1, R1, A2, E2, R2>(
    self: Effect<A, E, R>,
    policy: Schedule<A1, NoInfer<E>, E1, R1>,
    orElse: (e: NoInfer<E>, out: A1) => Effect<A2, E2, R2>
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
 * @example
 * ```ts
 * import { Cause, Effect } from "effect"
 *
 * const task = Effect.fail("Something went wrong")
 *
 * // Sandbox exposes the full cause as the error type
 * const program = Effect.gen(function*() {
 *   const result = yield* Effect.flip(Effect.sandbox(task))
 *   return `Caught cause: ${Cause.squash(result)}`
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: "Caught cause: Something went wrong"
 * ```
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

/**
 * @since 2.0.0
 * @category Error handling
 */
export const ignoreLogged: <A, E, R>(self: Effect<A, E, R>) => Effect<void, never, R> = internal.ignoreLogged

/**
 * Apply an `ExecutionPlan` to the effect, which allows you to fallback to
 * different resources in case of failure.
 *
 * @since 3.16.0
 * @category Error handling
 */
export const withExecutionPlan: {
  <Input, Provides, PlanE, PlanR>(
    plan: ExecutionPlan<{ provides: Provides; input: Input; error: PlanE; requirements: PlanR }>
  ): <A, E extends Input, R>(
    effect: Effect<A, E, R>
  ) => Effect<A, E | PlanE, Exclude<R, Provides> | PlanR>
  <A, E extends Input, R, Provides, Input, PlanE, PlanR>(
    effect: Effect<A, E, R>,
    plan: ExecutionPlan<{ provides: Provides; input: Input; error: PlanE; requirements: PlanR }>
  ): Effect<A, E | PlanE, Exclude<R, Provides> | PlanR>
} = internalExecutionPlan.withExecutionPlan

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
 * const task = Effect.gen(function*() {
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
 * const task = Effect.gen(function*() {
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
 * Applies a timeout to an effect, with a fallback effect executed if the timeout is reached.
 *
 * This function is useful when you want to set a maximum duration for an operation
 * and provide an alternative action if the timeout is exceeded.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const slowQuery = Effect.gen(function*() {
 *   yield* Console.log("Starting database query...")
 *   yield* Effect.sleep("5 seconds")
 *   return "Database result"
 * })
 *
 * // Use cached data as fallback when timeout is reached
 * const program = Effect.timeoutOrElse(slowQuery, {
 *   duration: "2 seconds",
 *   onTimeout: () =>
 *     Effect.gen(function*() {
 *       yield* Console.log("Query timed out, using cached data")
 *       return "Cached result"
 *     })
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // Starting database query...
 * // Query timed out, using cached data
 * // Cached result
 * ```
 *
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
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const program = Effect.delay(
 *   Console.log("Delayed message"),
 *   "1 second"
 * )
 *
 * Effect.runFork(program)
 * // Waits 1 second, then prints: "Delayed message"
 * ```
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
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Console.log("Start")
 *   yield* Effect.sleep("2 seconds")
 *   yield* Console.log("End")
 * })
 *
 * Effect.runFork(program)
 * // Output: "Start" (immediately)
 * // Output: "End" (after 2 seconds)
 * ```
 *
 * @since 2.0.0
 * @category delays & timeouts
 */
export const sleep: (duration: Duration.DurationInput) => Effect<void> = internal.sleep

/**
 * Executes an effect and measures the time it takes to complete.
 *
 * **Details**
 *
 * This function wraps the provided effect and returns a new effect that, when
 * executed, performs the original effect and calculates its execution duration.
 *
 * The result of the new effect includes both the execution time (as a
 * `Duration`) and the original effect's result. This is useful for monitoring
 * performance or gaining insights into the time taken by specific operations.
 *
 * The original effect's behavior (success, failure, or interruption) remains
 * unchanged, and the timing information is provided alongside the result in a
 * tuple.
 *
 * @since 2.0.0
 * @category Delays & Timeouts
 */
export const timed: <A, E, R>(self: Effect<A, E, R>) => Effect<[duration: Duration.Duration, result: A], E, R> =
  internal.timed

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
 * @example
 * ```ts
 * import { Duration, Effect } from "effect"
 *
 * // Multiple effects with different delays
 * const effect1 = Effect.delay(Effect.succeed("Fast"), Duration.millis(100))
 * const effect2 = Effect.delay(Effect.succeed("Slow"), Duration.millis(500))
 * const effect3 = Effect.delay(Effect.succeed("Very Slow"), Duration.millis(1000))
 *
 * // Race all effects - the first to succeed wins
 * const raced = Effect.raceAll([effect1, effect2, effect3])
 *
 * // Result: "Fast" (after ~100ms)
 * ```
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
) => Effect<Success<Eff>, Error<Eff>, Services<Eff>> = internal.raceAll

/**
 * Races multiple effects and returns the first successful result.
 *
 * **Details**
 *
 * Similar to `raceAll`, this function runs multiple effects concurrently
 * and returns the result of the first one to succeed. If one effect succeeds,
 * the others will be interrupted.
 *
 * @example
 * ```ts
 * import { Duration, Effect } from "effect"
 *
 * // Multiple effects with different delays and potential failures
 * const effect1 = Effect.delay(Effect.succeed("First"), Duration.millis(200))
 * const effect2 = Effect.delay(Effect.fail("Second failed"), Duration.millis(100))
 * const effect3 = Effect.delay(Effect.succeed("Third"), Duration.millis(300))
 *
 * // Race all effects - the first to succeed wins
 * const raced = Effect.raceAllFirst([effect1, effect2, effect3])
 *
 * // Result: "First" (after ~200ms, even though effect2 completes first but fails)
 * ```
 *
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
) => Effect<Success<Eff>, Error<Eff>, Services<Eff>> = internal.raceAllFirst

/**
 * Races two effects and returns the result of the first one to complete.
 *
 * **Details**
 *
 * This function takes two effects and runs them concurrently, returning the
 * result of the first one that completes, regardless of whether it succeeds or
 * fails.
 *
 * **When to Use**
 *
 * This function is useful when you want to race two operations, and you want to
 * proceed with whichever one finishes first, regardless of whether it succeeds
 * or fails.
 *
 * @since 2.0.0
 * @category Racing
 */
export const raceFirst: {
  <A2, E2, R2>(
    that: Effect<A2, E2, R2>,
    options?: {
      readonly onWinner?: (
        options: { readonly fiber: Fiber<any, any>; readonly index: number; readonly parentFiber: Fiber<any, any> }
      ) => void
    }
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    that: Effect<A2, E2, R2>,
    options?: {
      readonly onWinner?: (
        options: { readonly fiber: Fiber<any, any>; readonly index: number; readonly parentFiber: Fiber<any, any> }
      ) => void
    }
  ): Effect<A | A2, E | E2, R | R2>
} = internal.raceFirst

// -----------------------------------------------------------------------------
// Filtering
// -----------------------------------------------------------------------------

/**
 * Filters an iterable using the specified effectful predicate.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const isEven = (n: number) => Effect.succeed(n % 2 === 0)
 *
 * const program = Effect.filter([1, 2, 3, 4, 5], isEven)
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: [2, 4]
 * ```
 *
 * @since 2.0.0
 * @category Filtering
 */
export const filter: {
  <A, E, R>(
    predicate: (a: NoInfer<A>, i: number) => Effect<boolean, E, R>,
    options?: { readonly concurrency?: Concurrency | undefined }
  ): (iterable: Iterable<A>) => Effect<Array<A>, E, R>
  <A, E, R>(
    iterable: Iterable<A>,
    predicate: (a: NoInfer<A>, i: number) => Effect<boolean, E, R>,
    options?: { readonly concurrency?: Concurrency | undefined }
  ): Effect<Array<A>, E, R>
} = internal.filter

/**
 * @since 2.0.0
 * @category Filtering
 */
export const filterMap: {
  <A, B, X, E, R>(
    filter: Filter.FilterEffect<NoInfer<A>, B, X, E, R>,
    options?: { readonly concurrency?: Concurrency | undefined }
  ): (elements: Iterable<A>) => Effect<Array<B>, E, R>
  <A, B, X, E, R>(
    elements: Iterable<A>,
    filter: Filter.FilterEffect<NoInfer<A>, B, X, E, R>,
    options?: { readonly concurrency?: Concurrency | undefined }
  ): Effect<Array<B>, E, R>
} = internal.filterMap

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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // An effect that produces a number
 * const program = Effect.succeed(5)
 *
 * // Filter for even numbers, provide alternative for odd numbers
 * const filtered = Effect.filterOrElse(
 *   program,
 *   (n) => n % 2 === 0,
 *   (n) => Effect.succeed(`Number ${n} is odd`)
 * )
 *
 * // Result: "Number 5 is odd" (since 5 is not even)
 * ```
 *
 * @since 2.0.0
 * @category Filtering
 */
export const filterOrElse: {
  <A, C, E2, R2, B extends A>(
    refinement: Predicate.Refinement<NoInfer<A>, B>,
    orElse: (a: EqualsWith<A, B, NoInfer<A>, Exclude<NoInfer<A>, B>>) => Effect<C, E2, R2>
  ): <E, R>(self: Effect<A, E, R>) => Effect<B | C, E2 | E, R2 | R>
  <A, C, E2, R2>(
    predicate: Predicate.Predicate<NoInfer<A>>,
    orElse: (a: NoInfer<A>) => Effect<C, E2, R2>
  ): <E, R>(self: Effect<A, E, R>) => Effect<A | C, E2 | E, R2 | R>
  <A, E, R, C, E2, R2, B extends A>(
    self: Effect<A, E, R>,
    refinement: Predicate.Refinement<A, B>,
    orElse: (a: EqualsWith<A, B, A, Exclude<A, B>>) => Effect<C, E2, R2>
  ): Effect<B | C, E | E2, R | R2>
  <A, E, R, C, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate.Predicate<A>,
    orElse: (a: A) => Effect<C, E2, R2>
  ): Effect<A | C, E | E2, R | R2>
} = internal.filterOrElse

/**
 * Filters an effect, failing with a custom error if the predicate fails.
 *
 * **Details**
 *
 * This function applies a predicate to the result of an effect. If the
 * predicate evaluates to `false`, the effect fails with either a custom
 * error (if `orFailWith` is provided) or a `NoSuchElementError`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // An effect that produces a number
 * const program = Effect.succeed(5)
 *
 * // Filter for even numbers, fail for odd numbers
 * const filtered = Effect.filterOrFail(
 *   program,
 *   (n) => n % 2 === 0,
 *   (n) => `Expected even number, got ${n}`
 * )
 *
 * // Result: Effect.fail("Expected even number, got 5")
 * ```
 *
 * @since 2.0.0
 * @category Filtering
 */
export const filterOrFail: {
  <A, E2, B extends A>(
    refinement: Predicate.Refinement<NoInfer<A>, B>,
    orFailWith: (a: NoInfer<A>) => E2
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E2 | E, R>
  <A, E2>(
    predicate: Predicate.Predicate<NoInfer<A>>,
    orFailWith: (a: NoInfer<A>) => E2
  ): <E, R>(self: Effect<A, E, R>) => Effect<A, E2 | E, R>
  <A, B extends A>(
    refinement: Predicate.Refinement<NoInfer<A>, B>
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, Cause.NoSuchElementError | E, R>
  <A>(
    predicate: Predicate.Predicate<NoInfer<A>>
  ): <E, R>(self: Effect<A, E, R>) => Effect<A, Cause.NoSuchElementError | E, R>
  <A, E, R, E2, B extends A>(
    self: Effect<A, E, R>,
    refinement: Predicate.Refinement<NoInfer<A>, B>,
    orFailWith: (a: NoInfer<A>) => E2
  ): Effect<B, E2 | E, R>
  <A, E, R, E2>(
    self: Effect<A, E, R>,
    predicate: Predicate.Predicate<NoInfer<A>>,
    orFailWith: (a: NoInfer<A>) => E2
  ): Effect<A, E2 | E, R>
  <A, E, R, B extends A>(
    self: Effect<A, E, R>,
    refinement: Predicate.Refinement<NoInfer<A>, B>
  ): Effect<B, E | Cause.NoSuchElementError, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    predicate: Predicate.Predicate<NoInfer<A>>
  ): Effect<A, E | Cause.NoSuchElementError, R>
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
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const shouldLog = true
 *
 * const program = Effect.when(
 *   Console.log("Condition is true!"),
 *   () => shouldLog
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: "Condition is true!"
 * // { _id: 'Option', _tag: 'Some', value: undefined }
 * ```
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
 * Handles both success and failure cases of an effect without performing side
 * effects, with eager evaluation for resolved effects.
 *
 * **Details**
 *
 * `matchEager` works like `match` but provides better performance for resolved
 * effects (Success or Failure). When the effect is already resolved, it applies
 * the handlers immediately without fiber scheduling. For unresolved effects,
 * it falls back to the regular `match` behavior.
 *
 * **When to Use**
 *
 * Use this when you need to handle both success and failure cases and want
 * optimal performance for resolved effects. This is particularly useful in
 * scenarios where you frequently work with already computed values.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const result = yield* Effect.matchEager(Effect.succeed(42), {
 *     onFailure: (error) => `Failed: ${error}`,
 *     onSuccess: (value) => `Success: ${value}`
 *   })
 *   console.log(result) // "Success: 42"
 * })
 * ```
 *
 * @see {@link match} for the non-eager version.
 * @see {@link matchEffect} if you need to perform side effects in the handlers.
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const matchEager: {
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
} = internal.matchEager

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
 * @example
 * ```ts
 * import { Cause, Effect } from "effect"
 *
 * const task = Effect.fail("Something went wrong")
 *
 * const program = Effect.matchCause(task, {
 *   onFailure: (cause) => `Failed: ${Cause.squash(cause)}`,
 *   onSuccess: (value) => `Success: ${value}`
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: "Failed: Error: Something went wrong"
 * ```
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
 * Handles failures by matching the cause of failure with eager evaluation.
 *
 * **Details**
 *
 * `matchCauseEager` works like `matchCause` but provides better performance for resolved
 * effects by immediately applying the matching function instead of deferring it
 * through the effect pipeline.
 *
 * **When to Use**
 *
 * This is useful when you have effects that are likely to be already resolved
 * and you want to avoid the overhead of the effect pipeline. For pending effects,
 * it automatically falls back to the regular `matchCause` behavior.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const handleResult = Effect.matchCauseEager(Effect.succeed(42), {
 *   onSuccess: (value) => `Success: ${value}`,
 *   onFailure: (cause) => `Failed: ${cause}`
 * })
 * ```
 *
 * @since 3.8.0
 * @category Pattern matching
 */
export const matchCauseEager: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (cause: Cause.Cause<E>) => A2
    readonly onSuccess: (value: A) => A3
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): Effect<A2 | A3, never, R>
} = internal.matchCauseEager

/**
 * @since 4.0.0
 * @category Pattern matching
 */
export const matchCauseEffectEager: {
  <E, A2, E2, R2, A, A3, E3, R3>(
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    }
  ): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause.Cause<E>) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    }
  ): Effect<A2 | A3, E2 | E3, R2 | R3 | R>
} = internal.matchCauseEffectEager

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
 * @example
 * ```ts
 * import { Cause, Console, Effect } from "effect"
 * import * as Filter from "effect/Filter"
 *
 * const task = Effect.fail(new Error("Task failed"))
 *
 * const program = Effect.matchCauseEffect(task, {
 *   onFailure: (cause) =>
 *     Effect.gen(function*() {
 *       if (Cause.hasFail(cause)) {
 *         const error = Cause.filterError(cause)
 *         if (Filter.isPass(error)) {
 *           yield* Console.log(`Handling error: ${(error as Error).message}`)
 *         }
 *         return "recovered from error"
 *       } else {
 *         yield* Console.log("Handling interruption or defect")
 *         return "recovered from interruption/defect"
 *       }
 *     }),
 *   onSuccess: (value) =>
 *     Effect.gen(function*() {
 *       yield* Console.log(`Success: ${value}`)
 *       return `processed ${value}`
 *     })
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // Handling error: Task failed
 * // recovered from error
 * ```
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
// Condition checking
// -----------------------------------------------------------------------------

/**
 * Checks if an effect has failed.
 *
 * **Details**
 *
 * This function evaluates whether an effect has resulted in a failure. It
 * returns a boolean value wrapped in an effect, with `true` indicating the
 * effect failed and `false` otherwise.
 *
 * The resulting effect cannot fail (`never` in the error channel) but retains
 * the context of the original effect.
 *
 * **Example**
 *
 * ```ts
 * import { Effect } from "effect"
 *
 * const failure = Effect.fail("Uh oh!")
 *
 * console.log(Effect.runSync(Effect.isFailure(failure)))
 * // Output: true
 *
 * const defect = Effect.die("BOOM!")
 *
 * Effect.runSync(Effect.isFailure(defect))
 * // throws: BOOM!
 * ```
 *
 * @since 2.0.0
 * @category Condition Checking
 */
export const isFailure: <A, E, R>(self: Effect<A, E, R>) => Effect<boolean, never, R> = internal.isFailure

/**
 * Checks if an effect has succeeded.
 *
 * **Details**
 *
 * This function evaluates whether an effect has resulted in a success. It
 * returns a boolean value wrapped in an effect, with `true` indicating the
 * effect succeeded and `false` otherwise.
 *
 * The resulting effect cannot fail (`never` in the error channel) but retains
 * the context of the original effect.
 *
 * @since 2.0.0
 * @category Condition Checking
 */
export const isSuccess: <A, E, R>(self: Effect<A, E, R>) => Effect<boolean, never, R> = internal.isSuccess

// -----------------------------------------------------------------------------
// Environment
// -----------------------------------------------------------------------------

/**
 * Returns the complete service map from the current context.
 *
 * This function allows you to access all services that are currently available
 * in the effect's environment. This can be useful for debugging, introspection,
 * or when you need to pass the entire context to another function.
 *
 * @example
 * ```ts
 * import { Console, Effect, Option, ServiceMap } from "effect"
 *
 * const Logger = ServiceMap.Service<{
 *   log: (msg: string) => void
 * }>("Logger")
 * const Database = ServiceMap.Service<{
 *   query: (sql: string) => string
 * }>("Database")
 *
 * const program = Effect.gen(function*() {
 *   const allServices = yield* Effect.services()
 *
 *   // Check if specific services are available
 *   const loggerOption = ServiceMap.getOption(allServices, Logger)
 *   const databaseOption = ServiceMap.getOption(allServices, Database)
 *
 *   yield* Console.log(`Logger available: ${Option.isSome(loggerOption)}`)
 *   yield* Console.log(`Database available: ${Option.isSome(databaseOption)}`)
 * })
 *
 * const serviceMap = ServiceMap.make(Logger, { log: console.log })
 *   .pipe(ServiceMap.add(Database, { query: () => "result" }))
 *
 * const provided = Effect.provideServices(program, serviceMap)
 * ```
 *
 * @since 2.0.0
 * @category Environment
 */
export const services: <R>() => Effect<ServiceMap.ServiceMap<R>, never, R> = internal.services

/**
 * Transforms the current service map using the provided function.
 *
 * This function allows you to access the complete service map and perform
 * computations based on all available services. This is useful when you need
 * to conditionally execute logic based on what services are available.
 *
 * @example
 * ```ts
 * import { Console, Effect, Option, ServiceMap } from "effect"
 *
 * const Logger = ServiceMap.Service<{
 *   log: (msg: string) => void
 * }>("Logger")
 * const Cache = ServiceMap.Service<{
 *   get: (key: string) => string | null
 * }>("Cache")
 *
 * const program = Effect.servicesWith((services) => {
 *   const cacheOption = ServiceMap.getOption(services, Cache)
 *   const hasCache = Option.isSome(cacheOption)
 *
 *   if (hasCache) {
 *     return Effect.gen(function*() {
 *       const cache = yield* Effect.service(Cache)
 *       yield* Console.log("Using cached data")
 *       return cache.get("user:123") || "default"
 *     })
 *   } else {
 *     return Effect.gen(function*() {
 *       yield* Console.log("No cache available, using fallback")
 *       return "fallback data"
 *     })
 *   }
 * })
 *
 * const withCache = Effect.provideService(program, Cache, {
 *   get: () => "cached_value"
 * })
 * ```
 *
 * @since 2.0.0
 * @category Environment
 */
export const servicesWith: <R, A, E, R2>(
  f: (services: ServiceMap.ServiceMap<R>) => Effect<A, E, R2>
) => Effect<A, E, R | R2> = internal.servicesWith

/**
 * Provides dependencies to an effect using layers or a context.
 *
 * @example
 * ```ts
 * import { Effect, Layer, ServiceMap } from "effect"
 *
 * interface Database {
 *   readonly query: (sql: string) => Effect.Effect<string>
 * }
 *
 * const Database = ServiceMap.Service<Database>("Database")
 *
 * const DatabaseLive = Layer.succeed(Database)({
 *   query: (sql: string) => Effect.succeed(`Result for: ${sql}`)
 * })
 *
 * const program = Effect.gen(function*() {
 *   const db = yield* Database
 *   return yield* db.query("SELECT * FROM users")
 * })
 *
 * const provided = Effect.provide(program, DatabaseLive)
 *
 * Effect.runPromise(provided).then(console.log)
 * // Output: "Result for: SELECT * FROM users"
 * ```
 *
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
    Layer.Services<Layers[number]> | Exclude<R, Layer.Success<Layers[number]>>
  >
  <ROut, E2, RIn>(
    layer: Layer.Layer<ROut, E2, RIn>
  ): <A, E, R>(
    self: Effect<A, E, R>
  ) => Effect<A, E | E2, RIn | Exclude<R, ROut>>
  <R2>(
    context: ServiceMap.ServiceMap<R2>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, R2>>
  <A, E, R, const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
    self: Effect<A, E, R>,
    layers: Layers
  ): Effect<
    A,
    E | Layer.Error<Layers[number]>,
    Layer.Services<Layers[number]> | Exclude<R, Layer.Success<Layers[number]>>
  >
  <A, E, R, ROut, E2, RIn>(
    self: Effect<A, E, R>,
    layer: Layer.Layer<ROut, E2, RIn>
  ): Effect<A, E | E2, RIn | Exclude<R, ROut>>
  <A, E, R, R2>(
    self: Effect<A, E, R>,
    context: ServiceMap.ServiceMap<R2>
  ): Effect<A, E, Exclude<R, R2>>
} = internalLayer.provide

/**
 * Provides a service map to an effect, fulfilling its service requirements.
 *
 * **Details**
 *
 * This function provides multiple services at once by supplying a service map
 * that contains all the required services. It removes the provided services
 * from the effect's requirements, making them available to the effect.
 *
 * @example
 * ```ts
 * import { Effect, ServiceMap } from "effect"
 *
 * // Define service keys
 * const Logger = ServiceMap.Service<{
 *   log: (msg: string) => void
 * }>("Logger")
 * const Database = ServiceMap.Service<{
 *   query: (sql: string) => string
 * }>("Database")
 *
 * // Create service map with multiple services
 * const serviceMap = ServiceMap.make(Logger, { log: console.log })
 *   .pipe(ServiceMap.add(Database, { query: () => "result" }))
 *
 * // An effect that requires both services
 * const program = Effect.gen(function*() {
 *   const logger = yield* Effect.service(Logger)
 *   const db = yield* Effect.service(Database)
 *   logger.log("Querying database")
 *   return db.query("SELECT * FROM users")
 * })
 *
 * const provided = Effect.provideServices(program, serviceMap)
 * ```
 *
 * @since 2.0.0
 * @category Environment
 */
export const provideServices: {
  <XR>(
    context: ServiceMap.ServiceMap<XR>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, XR>>
  <A, E, R, XR>(
    self: Effect<A, E, R>,
    context: ServiceMap.ServiceMap<XR>
  ): Effect<A, E, Exclude<R, XR>>
} = internal.provideServices

/**
 * Accesses a service from the context.
 *
 * @example
 * ```ts
 * import { Effect, ServiceMap } from "effect"
 *
 * interface Database {
 *   readonly query: (sql: string) => Effect.Effect<string>
 * }
 *
 * const Database = ServiceMap.Service<Database>("Database")
 *
 * const program = Effect.gen(function*() {
 *   const db = yield* Effect.service(Database)
 *   return yield* db.query("SELECT * FROM users")
 * })
 * ```
 *
 * @since 4.0.0
 * @category ServiceMap
 */
export const service: <I, S>(service: ServiceMap.Service<I, S>) => Effect<S, never, I> = internal.service

/**
 * Optionally accesses a service from the environment.
 *
 * **Details**
 *
 * This function attempts to access a service from the environment. If the
 * service is available, it returns `Some(service)`. If the service is not
 * available, it returns `None`. Unlike `service`, this function does not
 * require the service to be present in the environment.
 *
 * @example
 * ```ts
 * import { Effect, Option, ServiceMap } from "effect"
 *
 * // Define a service key
 * const Logger = ServiceMap.Service<{
 *   log: (msg: string) => void
 * }>("Logger")
 *
 * // Use serviceOption to optionally access the logger
 * const program = Effect.gen(function*() {
 *   const maybeLogger = yield* Effect.serviceOption(Logger)
 *
 *   if (Option.isSome(maybeLogger)) {
 *     maybeLogger.value.log("Service is available")
 *   } else {
 *     console.log("Service not available")
 *   }
 * })
 * ```
 *
 * @since 2.0.0
 * @category ServiceMap
 */
export const serviceOption: <I, S>(key: ServiceMap.Service<I, S>) => Effect<Option<S>> = internal.serviceOption

/**
 * Provides part of the required context while leaving the rest unchanged.
 *
 * **Details**
 *
 * This function allows you to transform the context required by an effect,
 * providing part of the context and leaving the rest to be fulfilled later.
 *
 * @example
 * ```ts
 * import { Effect, ServiceMap } from "effect"
 *
 * // Define services
 * const Logger = ServiceMap.Service<{
 *   log: (msg: string) => void
 * }>("Logger")
 * const Config = ServiceMap.Service<{
 *   name: string
 * }>("Config")
 *
 * const program = Effect.service(Config).pipe(
 *   Effect.map((config) => `Hello ${config.name}!`)
 * )
 *
 * // Transform services by providing Config while keeping Logger requirement
 * const configured = program.pipe(
 *   Effect.updateServices((services: ServiceMap.ServiceMap<typeof Logger>) =>
 *     ServiceMap.add(services, Config, { name: "World" })
 *   )
 * )
 *
 * // The effect now requires only Logger service
 * const result = Effect.provideService(configured, Logger, {
 *   log: (msg) => console.log(msg)
 * })
 * ```
 *
 * @since 4.0.0
 * @category ServiceMap
 */
export const updateServices: {
  <R2, R>(
    f: (services: ServiceMap.ServiceMap<R2>) => ServiceMap.ServiceMap<NoInfer<R>>
  ): <A, E>(self: Effect<A, E, R>) => Effect<A, E, R2>
  <A, E, R, R2>(
    self: Effect<A, E, R>,
    f: (services: ServiceMap.ServiceMap<R2>) => ServiceMap.ServiceMap<NoInfer<R>>
  ): Effect<A, E, R2>
} = internal.updateServices

/**
 * Updates the service with the required service entry.
 *
 * @example
 * ```ts
 * import { Console, Effect, ServiceMap } from "effect"
 *
 * // Define a counter service
 * const Counter = ServiceMap.Service<{ count: number }>("Counter")
 *
 * const program = Effect.gen(function*() {
 *   const updatedCounter = yield* Effect.service(Counter)
 *   yield* Console.log(`Updated count: ${updatedCounter.count}`)
 *   return updatedCounter.count
 * }).pipe(
 *   Effect.updateService(Counter, (counter) => ({ count: counter.count + 1 }))
 * )
 *
 * // Provide initial service and run
 * const result = Effect.provideService(program, Counter, { count: 0 })
 * Effect.runPromise(result).then(console.log)
 * // Output: Updated count: 1
 * // 1
 * ```
 *
 * @since 2.0.0
 * @category ServiceMap
 */
export const updateService: {
  <I, A>(
    service: ServiceMap.Service<I, A>,
    f: (value: A) => A
  ): <XA, E, R>(self: Effect<XA, E, R>) => Effect<XA, E, R | I>
  <XA, E, R, I, A>(
    self: Effect<XA, E, R>,
    service: ServiceMap.Service<I, A>,
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
 * @example
 * ```ts
 * import { Console, Effect, ServiceMap } from "effect"
 *
 * // Define a service for configuration
 * const Config = ServiceMap.Service<{
 *   apiUrl: string
 *   timeout: number
 * }>("Config")
 *
 * const fetchData = Effect.gen(function*() {
 *   const config = yield* Effect.service(Config)
 *   yield* Console.log(`Fetching from: ${config.apiUrl}`)
 *   yield* Console.log(`Timeout: ${config.timeout}ms`)
 *   return "data"
 * })
 *
 * // Provide the service implementation
 * const program = Effect.provideService(fetchData, Config, {
 *   apiUrl: "https://api.example.com",
 *   timeout: 5000
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // Fetching from: https://api.example.com
 * // Timeout: 5000ms
 * // data
 * ```
 *
 * @since 2.0.0
 * @category ServiceMap
 */
export const provideService: {
  <I, S>(
    service: ServiceMap.Service<I, S>
  ): {
    (implementation: S): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, I>>
    <A, E, R>(self: Effect<A, E, R>, implementation: S): Effect<A, E, Exclude<R, I>>
  }
  <I, S>(
    service: ServiceMap.Service<I, S>,
    implementation: S
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, I>>
  <A, E, R, I, S>(
    self: Effect<A, E, R>,
    service: ServiceMap.Service<I, S>,
    implementation: S
  ): Effect<A, E, Exclude<R, I>>
} = internal.provideService

/**
 * Provides the effect with the single service it requires. If the effect
 * requires more than one service use `provide` instead.
 *
 * This function is similar to `provideService`, but instead of providing a
 * static service implementation, it allows you to provide an effect that
 * will produce the service. This is useful when the service needs to be
 * acquired through an effectful computation (e.g., reading from a database,
 * making an HTTP request, or allocating resources).
 *
 * @example
 * ```ts
 * import { Console, Effect, ServiceMap } from "effect"
 *
 * // Define a database connection service
 * interface DatabaseConnection {
 *   readonly query: (sql: string) => Effect.Effect<string>
 * }
 * const Database = ServiceMap.Service<DatabaseConnection>("Database")
 *
 * // Effect that creates a database connection
 * const createConnection = Effect.gen(function*() {
 *   yield* Console.log("Establishing database connection...")
 *   yield* Effect.sleep("100 millis") // Simulate connection time
 *   yield* Console.log("Database connected!")
 *   return {
 *     query: (sql: string) => Effect.succeed(`Result for: ${sql}`)
 *   }
 * })
 *
 * const program = Effect.gen(function*() {
 *   const db = yield* Effect.service(Database)
 *   return yield* db.query("SELECT * FROM users")
 * })
 *
 * // Provide the service through an effect
 * const withDatabase = Effect.provideServiceEffect(
 *   program,
 *   Database,
 *   createConnection
 * )
 *
 * Effect.runPromise(withDatabase).then(console.log)
 * // Output:
 * // Establishing database connection...
 * // Database connected!
 * // Result for: SELECT * FROM users
 * ```
 *
 * @since 2.0.0
 * @category ServiceMap
 */
export const provideServiceEffect: {
  <I, S, E2, R2>(
    service: ServiceMap.Service<I, S>,
    acquire: Effect<S, E2, R2>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | E2, Exclude<R, I> | R2>
  <A, E, R, I, S, E2, R2>(
    self: Effect<A, E, R>,
    service: ServiceMap.Service<I, S>,
    acquire: Effect<S, E2, R2>
  ): Effect<A, E | E2, Exclude<R, I> | R2>
} = internal.provideServiceEffect

// -----------------------------------------------------------------------------
// References
// -----------------------------------------------------------------------------

/**
 * Sets the concurrency level for parallel operations within an effect.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const task = (id: number) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Task ${id} starting`)
 *     yield* Effect.sleep("100 millis")
 *     yield* Console.log(`Task ${id} completed`)
 *     return id
 *   })
 *
 * // Run tasks with limited concurrency (max 2 at a time)
 * const program = Effect.gen(function*() {
 *   const tasks = [1, 2, 3, 4, 5].map(task)
 *   return yield* Effect.all(tasks, { concurrency: 2 })
 * }).pipe(
 *   Effect.withConcurrency(2)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Tasks will run with max 2 concurrent operations
 * // [1, 2, 3, 4, 5]
 * ```
 *
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
 * Returns the current scope for resource management.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const currentScope = yield* Effect.scope
 *   yield* Console.log("Got scope for resource management")
 *
 *   // Use the scope to manually manage resources if needed
 *   const resource = yield* Effect.acquireRelease(
 *     Console.log("Acquiring resource").pipe(Effect.as("resource")),
 *     () => Console.log("Releasing resource")
 *   )
 *
 *   return resource
 * })
 *
 * Effect.runPromise(Effect.scoped(program)).then(console.log)
 * // Output:
 * // Got scope for resource management
 * // Acquiring resource
 * // resource
 * // Releasing resource
 * ```
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const scope: Effect<Scope, never, Scope> = internal.scope

/**
 * Scopes all resources used in this workflow to the lifetime of the workflow,
 * ensuring that their finalizers are run as soon as this workflow completes
 * execution, whether by success, failure, or interruption.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const resource = Effect.acquireRelease(
 *   Console.log("Acquiring resource").pipe(Effect.as("resource")),
 *   () => Console.log("Releasing resource")
 * )
 *
 * const program = Effect.scoped(
 *   Effect.gen(function*() {
 *     const res = yield* resource
 *     yield* Console.log(`Using ${res}`)
 *     return res
 *   })
 * )
 *
 * Effect.runFork(program)
 * // Output: "Acquiring resource"
 * // Output: "Using resource"
 * // Output: "Releasing resource"
 * ```
 *
 * @since 2.0.0
 * @category scoping, resources & finalization
 */
export const scoped: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<A, E, Exclude<R, Scope>> = internal.scoped

/**
 * Creates a scoped effect by providing access to the scope.
 *
 * @example
 * ```ts
 * import { Console, Effect, Scope } from "effect"
 *
 * const program = Effect.scopedWith((scope) =>
 *   Effect.gen(function*() {
 *     yield* Console.log("Inside scoped context")
 *
 *     // Manually add a finalizer to the scope
 *     yield* Scope.addFinalizer(scope, Console.log("Manual finalizer"))
 *
 *     // Create a scoped resource
 *     const resource = yield* Effect.scoped(
 *       Effect.acquireRelease(
 *         Console.log("Acquiring resource").pipe(Effect.as("resource")),
 *         () => Console.log("Releasing resource")
 *       )
 *     )
 *
 *     return resource
 *   })
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // Inside scoped context
 * // Acquiring resource
 * // resource
 * // Releasing resource
 * // Manual finalizer
 * ```
 *
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
 * @example
 * ```ts
 * import { Console, Effect, Exit } from "effect"
 *
 * // Simulate a resource that needs cleanup
 * interface FileHandle {
 *   readonly path: string
 *   readonly content: string
 * }
 *
 * // Acquire a file handle
 * const acquire = Effect.gen(function*() {
 *   yield* Console.log("Opening file")
 *   return { path: "/tmp/file.txt", content: "file content" }
 * })
 *
 * // Release the file handle
 * const release = (handle: FileHandle, exit: Exit.Exit<unknown, unknown>) =>
 *   Console.log(
 *     `Closing file ${handle.path} with exit: ${
 *       Exit.isSuccess(exit) ? "success" : "failure"
 *     }`
 *   )
 *
 * // Create a scoped resource
 * const resource = Effect.acquireRelease(acquire, release)
 *
 * // Use the resource within a scope
 * const program = Effect.scoped(
 *   Effect.gen(function*() {
 *     const handle = yield* resource
 *     yield* Console.log(`Using file: ${handle.path}`)
 *     return handle.content
 *   })
 * )
 * ```
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
 * @example
 * ```ts
 * import { Console, Effect, Exit } from "effect"
 *
 * interface Database {
 *   readonly connection: string
 *   readonly query: (sql: string) => Effect.Effect<string>
 * }
 *
 * const program = Effect.acquireUseRelease(
 *   // Acquire - connect to database
 *   Effect.gen(function*() {
 *     yield* Console.log("Connecting to database...")
 *     return {
 *       connection: "db://localhost:5432",
 *       query: (sql: string) => Effect.succeed(`Result for: ${sql}`)
 *     }
 *   }),
 *   // Use - perform database operations
 *   (db) =>
 *     Effect.gen(function*() {
 *       yield* Console.log(`Connected to ${db.connection}`)
 *       const result = yield* db.query("SELECT * FROM users")
 *       yield* Console.log(`Query result: ${result}`)
 *       return result
 *     }),
 *   // Release - close database connection
 *   (db, exit) =>
 *     Effect.gen(function*() {
 *       if (Exit.isSuccess(exit)) {
 *         yield* Console.log(`Closing connection to ${db.connection} (success)`)
 *       } else {
 *         yield* Console.log(`Closing connection to ${db.connection} (failure)`)
 *       }
 *     })
 * )
 *
 * Effect.runPromise(program)
 * // Output:
 * // Connecting to database...
 * // Connected to db://localhost:5432
 * // Query result: Result for: SELECT * FROM users
 * // Closing connection to db://localhost:5432 (success)
 * ```
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
 * Finalizers are useful for cleanup operations that must run regardless of
 * whether the effect succeeds or fails. They're commonly used for resource
 * cleanup, logging, or other side effects that should always occur.
 *
 * @example
 * ```ts
 * import { Console, Effect, Exit } from "effect"
 *
 * const program = Effect.scoped(
 *   Effect.gen(function*() {
 *     // Add a finalizer that runs when the scope closes
 *     yield* Effect.addFinalizer((exit) =>
 *       Console.log(
 *         Exit.isSuccess(exit)
 *           ? "Cleanup: Operation completed successfully"
 *           : "Cleanup: Operation failed, cleaning up resources"
 *       )
 *     )
 *
 *     yield* Console.log("Performing main operation...")
 *
 *     // This could succeed or fail
 *     return "operation result"
 *   })
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // Performing main operation...
 * // Cleanup: Operation completed successfully
 * // operation result
 * ```
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const addFinalizer: <R>(
  finalizer: (exit: Exit.Exit<unknown, unknown>) => Effect<void, never, R>
) => Effect<void, never, R | Scope> = internal.addFinalizer

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
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const task = Effect.gen(function*() {
 *   yield* Console.log("Task started")
 *   yield* Effect.sleep("1 second")
 *   yield* Console.log("Task completed")
 *   return 42
 * })
 *
 * // Ensure cleanup always runs, regardless of success or failure
 * const program = Effect.ensuring(
 *   task,
 *   Console.log("Cleanup: This always runs!")
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // Task started
 * // Task completed
 * // Cleanup: This always runs!
 * // 42
 * ```
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
 * @example
 * ```ts
 * import { Cause, Console, Effect } from "effect"
 *
 * const task = Effect.fail(new Error("Something went wrong"))
 *
 * const program = Effect.onError(
 *   task,
 *   (cause) => Console.log(`Cleanup on error: ${Cause.squash(cause)}`)
 * )
 *
 * Effect.runPromise(program).catch(console.error)
 * // Output:
 * // Cleanup on error: Error: Something went wrong
 * // Error: Something went wrong
 * ```
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
 * Runs the specified effect if this effect fails, providing the error to the
 * effect if it exists. The provided effect will not be interrupted.
 *
 * @since 4.0.0
 * @category Resource management & finalization
 */
export const onErrorFilter: {
  <A, E, EB, X, XE, XR>(
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (failure: EB, cause: Cause.Cause<E>) => Effect<void, XE, XR>
  ): <R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, EB, X, XE, XR>(
    self: Effect<A, E, R>,
    filter: Filter.Filter<Cause.Cause<E>, EB, X>,
    f: (failure: EB, cause: Cause.Cause<E>) => Effect<void, XE, XR>
  ): Effect<A, E | XE, R | XR>
} = internal.onErrorFilter

/**
 * Ensures that a cleanup functions runs, whether this effect succeeds, fails,
 * or is interrupted.
 *
 * @example
 * ```ts
 * import { Console, Effect, Exit } from "effect"
 *
 * const task = Effect.succeed(42)
 *
 * const program = Effect.onExit(task, (exit) =>
 *   Console.log(
 *     Exit.isSuccess(exit)
 *       ? `Task succeeded with: ${exit.value}`
 *       : `Task failed: ${Exit.isFailure(exit) ? exit.cause : "interrupted"}`
 *   ))
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // Task succeeded with: 42
 * // 42
 * ```
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const onExit: {
  <A, E, XE = never, XR = never>(
    f: (exit: Exit.Exit<A, E>) => Effect<void, XE, XR> | void
  ): <R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE = never, XR = never>(
    self: Effect<A, E, R>,
    f: (exit: Exit.Exit<A, E>) => Effect<void, XE, XR> | void
  ): Effect<A, E | XE, R | XR>
} = internal.onExit

/**
 * @since 4.0.0
 * @category Resource management & finalization
 */
export const onExitInterruptible: {
  <A, E, XE = never, XR = never>(
    f: (exit: Exit.Exit<A, E>) => Effect<void, XE, XR> | void
  ): <R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE = never, XR = never>(
    self: Effect<A, E, R>,
    f: (exit: Exit.Exit<A, E>) => Effect<void, XE, XR> | void
  ): Effect<A, E | XE, R | XR>
} = internal.onExitInterruptible

/**
 * @since 4.0.0
 * @category Resource management & finalization
 */
export const onExitFilter: {
  <A, E, XE, XR, B, X>(
    filter: Filter.Filter<Exit.Exit<NoInfer<A>, NoInfer<E>>, B, X>,
    f: (b: B, exit: Exit.Exit<NoInfer<A>, NoInfer<E>>) => Effect<void, XE, XR>
  ): <R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR, B, X>(
    self: Effect<A, E, R>,
    filter: Filter.Filter<Exit.Exit<NoInfer<A>, NoInfer<E>>, B, X>,
    f: (b: B, exit: Exit.Exit<NoInfer<A>, NoInfer<E>>) => Effect<void, XE, XR>
  ): Effect<A, E | XE, R | XR>
} = internal.onExitFilter

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
 * import { Console, Effect } from "effect"
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
 * const program = Effect.gen(function*() {
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
export const cached: <A, E, R>(self: Effect<A, E, R>) => Effect<Effect<A, E, R>> = internal.cached

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
 * import { Console, Effect } from "effect"
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
 * const program = Effect.gen(function*() {
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
  (timeToLive: Duration.DurationInput): <A, E, R>(self: Effect<A, E, R>) => Effect<Effect<A, E, R>>
  <A, E, R>(self: Effect<A, E, R>, timeToLive: Duration.DurationInput): Effect<Effect<A, E, R>>
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
 * import { Console, Effect } from "effect"
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
 * const program = Effect.gen(function*() {
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
  (timeToLive: Duration.DurationInput): <A, E, R>(self: Effect<A, E, R>) => Effect<[Effect<A, E, R>, Effect<void>]>
  <A, E, R>(self: Effect<A, E, R>, timeToLive: Duration.DurationInput): Effect<[Effect<A, E, R>, Effect<void>]>
} = internal.cachedInvalidateWithTTL

// -----------------------------------------------------------------------------
// Interruption
// -----------------------------------------------------------------------------

/**
 * Returns an effect that is immediately interrupted.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.interrupt
 *   yield* Effect.succeed("This won't execute")
 * })
 *
 * Effect.runPromise(program).catch(console.error)
 * // Throws: InterruptedException
 * ```
 *
 * @since 2.0.0
 * @category Interruption
 */
export const interrupt: Effect<never> = internal.interrupt

/**
 * Returns a new effect that allows the effect to be interruptible.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const longRunning = Effect.forever(Effect.succeed("working..."))
 *
 * const program = Effect.interruptible(longRunning)
 *
 * // This effect can now be interrupted
 * const fiber = Effect.runFork(program)
 * // Later: fiber.interrupt()
 * ```
 *
 * @since 2.0.0
 * @category Interruption
 */
export const interruptible: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<A, E, R> = internal.interruptible

/**
 * Runs the specified finalizer effect if this effect is interrupted.
 *
 * @example
 * ```ts
 * import { Console, Effect, Fiber } from "effect"
 *
 * const task = Effect.forever(Effect.succeed("working..."))
 *
 * const program = Effect.onInterrupt(
 *   task,
 *   Console.log("Task was interrupted, cleaning up...")
 * )
 *
 * const fiber = Effect.runFork(program)
 * // Later interrupt the task
 * Effect.runPromise(Fiber.interrupt(fiber))
 * // Output: Task was interrupted, cleaning up...
 * ```
 *
 * @since 2.0.0
 * @category Interruption
 */
export const onInterrupt: {
  <XE, XR>(
    finalizer: Effect<void, XE, XR> | ((interruptors: ReadonlySet<number>) => Effect<void, XE, XR>)
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(
    self: Effect<A, E, R>,
    finalizer: Effect<void, XE, XR> | ((interruptors: ReadonlySet<number>) => Effect<void, XE, XR>)
  ): Effect<A, E | XE, R | XR>
} = internal.onInterrupt

/**
 * Returns a new effect that disables interruption for the given effect.
 *
 * @example
 * ```ts
 * import { Console, Effect, Fiber } from "effect"
 *
 * const criticalTask = Effect.gen(function*() {
 *   yield* Console.log("Starting critical section...")
 *   yield* Effect.sleep("2 seconds")
 *   yield* Console.log("Critical section completed")
 * })
 *
 * const program = Effect.uninterruptible(criticalTask)
 *
 * const fiber = Effect.runFork(program)
 * // Even if interrupted, the critical task will complete
 * Effect.runPromise(Fiber.interrupt(fiber))
 * ```
 *
 * @since 2.0.0
 * @category Interruption
 */
export const uninterruptible: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<A, E, R> = internal.uninterruptible

/**
 * Disables interruption and provides a restore function to restore the
 * interruptible state within the effect.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const program = Effect.uninterruptibleMask((restore) =>
 *   Effect.gen(function*() {
 *     yield* Console.log("Uninterruptible phase...")
 *     yield* Effect.sleep("1 second")
 *
 *     // Restore interruptibility for this part
 *     yield* restore(
 *       Effect.gen(function*() {
 *         yield* Console.log("Interruptible phase...")
 *         yield* Effect.sleep("2 seconds")
 *       })
 *     )
 *
 *     yield* Console.log("Back to uninterruptible")
 *   })
 * )
 * ```
 *
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
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * const program = Effect.interruptibleMask((restore) =>
 *   Effect.gen(function*() {
 *     yield* Console.log("Interruptible phase...")
 *     yield* Effect.sleep("1 second")
 *
 *     // Make this part uninterruptible
 *     yield* restore(
 *       Effect.gen(function*() {
 *         yield* Console.log("Uninterruptible phase...")
 *         yield* Effect.sleep("2 seconds")
 *       })
 *     )
 *
 *     yield* Console.log("Back to interruptible")
 *   })
 * )
 * ```
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Create and use a semaphore for controlling concurrent access
 * const program = Effect.gen(function*() {
 *   const semaphore = yield* Effect.makeSemaphore(2)
 *
 *   return yield* semaphore.withPermits(1)(
 *     Effect.succeed("Resource accessed")
 *   )
 * })
 * ```
 */
export interface Semaphore {
  /**
   * Adjusts the number of permits available in the semaphore.
   */
  resize(permits: number): Effect<void>

  /**
   * Runs an effect with the given number of permits and releases the permits
   * when the effect completes.
   *
   * **Details**
   *
   * This function acquires the specified number of permits before executing
   * the provided effect. Once the effect finishes, the permits are released.
   * If insufficient permits are available, the function will wait until they
   * are released by other tasks.
   */
  withPermits(permits: number): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>

  /**
   * Runs an effect with the given number of permits and releases the permits
   * when the effect completes.
   *
   * **Details**
   *
   * This function acquires the specified number of permits before executing
   * the provided effect. Once the effect finishes, the permits are released.
   * If insufficient permits are available, the function will wait until they
   * are released by other tasks.
   */
  withPermit<A, E, R>(self: Effect<A, E, R>): Effect<A, E, R>

  /**
   * Runs an effect only if the specified number of permits are immediately
   * available.
   *
   * **Details**
   *
   * This function attempts to acquire the specified number of permits. If they
   * are available, it runs the effect and releases the permits after the effect
   * completes. If permits are not available, the effect does not execute, and
   * the result is `Option.none`.
   */
  withPermitsIfAvailable(permits: number): <A, E, R>(self: Effect<A, E, R>) => Effect<Option<A>, E, R>

  /**
   * Acquires the specified number of permits and returns the resulting
   * available permits, suspending the task if they are not yet available.
   * Concurrent pending `take` calls are processed in a first-in, first-out manner.
   */
  take(permits: number): Effect<number>

  /**
   * Releases the specified number of permits and returns the resulting
   * available permits.
   */
  release(permits: number): Effect<number>

  /**
   * Releases all permits held by this semaphore and returns the resulting available permits.
   */
  releaseAll: Effect<number>
}

/**
 * Unsafely creates a new Semaphore.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const semaphore = Effect.makeSemaphoreUnsafe(3)
 *
 * const task = (id: number) =>
 *   semaphore.withPermits(1)(
 *     Effect.gen(function*() {
 *       yield* Effect.log(`Task ${id} started`)
 *       yield* Effect.sleep("1 second")
 *       yield* Effect.log(`Task ${id} completed`)
 *     })
 *   )
 *
 * // Only 3 tasks can run concurrently
 * const program = Effect.all([
 *   task(1),
 *   task(2),
 *   task(3),
 *   task(4),
 *   task(5)
 * ], { concurrency: "unbounded" })
 * ```
 *
 * @since 2.0.0
 * @category Semaphore
 */
export const makeSemaphoreUnsafe: (permits: number) => Semaphore = internal.makeSemaphoreUnsafe

/**
 * Creates a new Semaphore.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const semaphore = yield* Effect.makeSemaphore(2)
 *
 *   const task = (id: number) =>
 *     semaphore.withPermits(1)(
 *       Effect.gen(function*() {
 *         yield* Effect.log(`Task ${id} acquired permit`)
 *         yield* Effect.sleep("1 second")
 *         yield* Effect.log(`Task ${id} releasing permit`)
 *       })
 *     )
 *
 *   // Run 4 tasks, but only 2 can run concurrently
 *   yield* Effect.all([task(1), task(2), task(3), task(4)])
 * })
 * ```
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Create and use a latch for coordination between fibers
 * const program = Effect.gen(function*() {
 *   const latch = yield* Effect.makeLatch()
 *
 *   // Wait for the latch to be opened
 *   yield* latch.await
 *
 *   return "Latch was opened!"
 * })
 * ```
 */
export interface Latch {
  /** open the latch, releasing all fibers waiting on it */
  readonly open: Effect<boolean>
  /** open the latch, releasing all fibers waiting on it */
  readonly openUnsafe: () => boolean
  /** release all fibers waiting on the latch, without opening it */
  readonly release: Effect<boolean>
  /** wait for the latch to be opened */
  readonly await: Effect<void>
  /** close the latch */
  readonly close: Effect<boolean>
  /** close the latch */
  readonly closeUnsafe: () => boolean
  /** only run the given effect when the latch is open */
  readonly whenOpen: <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
}

/**
 * Creates a new Latch.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const latch = Effect.makeLatchUnsafe(false)
 *
 * const waiter = Effect.gen(function*() {
 *   yield* Effect.log("Waiting for latch to open...")
 *   yield* latch.await
 *   yield* Effect.log("Latch opened! Continuing...")
 * })
 *
 * const opener = Effect.gen(function*() {
 *   yield* Effect.sleep("2 seconds")
 *   yield* Effect.log("Opening latch...")
 *   yield* latch.open
 * })
 *
 * const program = Effect.all([waiter, opener])
 * ```
 *
 * @category Latch
 * @since 3.8.0
 */
export const makeLatchUnsafe: (open?: boolean | undefined) => Latch = internal.makeLatchUnsafe

/**
 * Creates a new Latch.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const latch = yield* Effect.makeLatch(false)
 *
 *   const waiter = Effect.gen(function*() {
 *     yield* Effect.log("Waiting for latch to open...")
 *     yield* latch.await
 *     yield* Effect.log("Latch opened! Continuing...")
 *   })
 *
 *   const opener = Effect.gen(function*() {
 *     yield* Effect.sleep("2 seconds")
 *     yield* Effect.log("Opening latch...")
 *     yield* latch.open
 *   })
 *
 *   yield* Effect.all([waiter, opener])
 * })
 * ```
 *
 * @category Latch
 * @since 3.8.0
 */
export const makeLatch: (open?: boolean | undefined) => Effect<Latch> = internal.makeLatch

// -----------------------------------------------------------------------------
// Repetition & Recursion
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category repetition / recursion
 * @example
 * ```ts
 * import type { Effect } from "effect"
 *
 * // Repeat namespace contains types for repeating operations
 * declare const effect: Effect.Effect<string, Error, never>
 * declare const options: Effect.Repeat.Options<string>
 * // Use Effect.repeat with these types for repeating successful effects
 * ```
 */
export declare namespace Repeat {
  /**
   * @since 2.0.0
   * @category repetition / recursion
   * @example
   * ```ts
   * import type { Effect } from "effect"
   *
   * // Return type for repeat operations with specific options
   * declare const options: Effect.Repeat.Options<string>
   * type RepeatResult = Effect.Repeat.Return<never, Error, string, typeof options>
   * // Result: Effect with repeated operation result types
   * ```
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
   * @example
   * ```ts
   * import { Schedule } from "effect"
   * import type { Effect } from "effect"
   *
   * // Options for configuring repeat behavior
   * const repeatOptions: Effect.Repeat.Options<number> = {
   *   times: 5,
   *   schedule: Schedule.fixed("100 millis"),
   *   while: (result) => result < 10
   * }
   * ```
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
 * @example
 * ```ts
 * import { Console, Effect, Fiber } from "effect"
 *
 * const task = Effect.gen(function*() {
 *   yield* Console.log("Task running...")
 *   yield* Effect.sleep("1 second")
 * })
 *
 * // This will run forever, printing every second
 * const program = Effect.forever(task)
 *
 * // Run for 5 seconds then interrupt
 * const timedProgram = Effect.gen(function*() {
 *   const fiber = yield* Effect.forkChild(program)
 *   yield* Effect.sleep("5 seconds")
 *   yield* Fiber.interrupt(fiber)
 * })
 * ```
 *
 * @since 2.0.0
 * @category repetition / recursion
 */
export const forever: <Arg extends Effect<any, any, any> | { readonly autoYield?: boolean | undefined } | undefined>(
  effectOrOptions: Arg,
  options?: { readonly autoYield?: boolean | undefined } | undefined
) => [Arg] extends [Effect<infer _A, infer _E, infer _R>] ? Effect<never, _E, _R>
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
 * import { Effect } from "effect"
 * import { Schedule } from "effect"
 * import { Console } from "effect"
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
 * import { Effect } from "effect"
 * import { Schedule } from "effect"
 *
 * let count = 0
 *
 * // Define a callback effect that simulates an action with possible failures
 * const action = Effect.callback<string, string>((resume) => {
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
  <O extends Repeat.Options<A>, A>(options: O): <E, R>(self: Effect<A, E, R>) => Repeat.Return<R, E, A, O>
  <Output, Input, Error, Env>(
    schedule: Schedule<Output, NoInfer<Input>, Error, Env>
  ): <E, R>(self: Effect<Input, E, R>) => Effect<Output, E | Error, R | Env>
  <A, E, R, O extends Repeat.Options<A>>(self: Effect<A, E, R>, options: O): Repeat.Return<R, E, A, O>
  <Input, E, R, Output, Error, Env>(
    self: Effect<Input, E, R>,
    schedule: Schedule<Output, NoInfer<Input>, Error, Env>
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
 * @example
 * ```ts
 * import { Console, Effect, Schedule } from "effect"
 * import * as Option from "effect/Option"
 *
 * let attempt = 0
 * const task = Effect.gen(function*() {
 *   attempt++
 *   if (attempt <= 2) {
 *     yield* Console.log(`Attempt ${attempt} failed`)
 *     yield* Effect.fail(`Error ${attempt}`)
 *   }
 *   yield* Console.log(`Attempt ${attempt} succeeded`)
 *   return "success"
 * })
 *
 * const program = Effect.repeatOrElse(
 *   task,
 *   Schedule.recurs(3),
 *   (error, attempts) =>
 *     Console.log(
 *       `Final failure: ${error}, after ${
 *         Option.getOrElse(attempts, () => 0)
 *       } attempts`
 *     ).pipe(Effect.map(() => 0))
 * )
 * ```
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
 * Replicates the given effect `n` times.
 *
 * **Details**
 *
 * This function takes an effect and replicates it a specified number of times
 * (`n`). The result is an array of `n` effects, each of which is identical to
 * the original effect.
 *
 * @since 2.0.0
 */
export const replicate: {
  (n: number): <A, E, R>(self: Effect<A, E, R>) => Array<Effect<A, E, R>>
  <A, E, R>(self: Effect<A, E, R>, n: number): Array<Effect<A, E, R>>
} = internal.replicate

/**
 * Performs this effect the specified number of times and collects the results.
 *
 * **Details**
 *
 * This function repeats an effect multiple times and collects the results into
 * an array. You specify how many times to execute the effect, and it runs that
 * many times, either in sequence or concurrently depending on the provided
 * options.
 *
 * **Options**
 *
 * If the `discard` option is set to `true`, the intermediate results are not
 * collected, and the final result of the operation is `void`.
 *
 * The function also allows you to customize how the effects are handled by
 * specifying options such as concurrency, batching, and how finalizers behave.
 * These options provide flexibility in running the effects concurrently or
 * adjusting other execution details.
 *
 * @since 2.0.0
 * @category Collecting
 */
export const replicateEffect: {
  (
    n: number,
    options?: { readonly concurrency?: Concurrency | undefined; readonly discard?: false | undefined }
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Array<A>, E, R>
  (
    n: number,
    options: { readonly concurrency?: Concurrency | undefined; readonly discard: true }
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<void, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    n: number,
    options?: { readonly concurrency?: Concurrency | undefined; readonly discard?: false | undefined }
  ): Effect<Array<A>, E, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    n: number,
    options: { readonly concurrency?: Concurrency | undefined; readonly discard: true }
  ): Effect<void, E, R>
} = internal.replicateEffect

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
 * @example
 * ```ts
 * import { Console, Effect, Schedule } from "effect"
 *
 * const task = Effect.gen(function*() {
 *   yield* Console.log("Task executing...")
 *   return Math.random()
 * })
 *
 * // Repeat 3 times with 1 second delay between executions
 * const program = Effect.schedule(
 *   task,
 *   Schedule.addDelay(Schedule.recurs(2), () => "1 second")
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // Task executing... (immediate)
 * // Task executing... (after 1 second)
 * // Task executing... (after 1 second)
 * // Returns the count from Schedule.recurs
 * ```
 *
 * @see {@link scheduleFrom} for a variant that allows the schedule's decision
 * to depend on the result of this effect.
 *
 * @since 2.0.0
 * @category Repetition / Recursion
 */
export const schedule: {
  <Output, Error, Env>(
    schedule: Schedule<Output, unknown, Error, Env>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Output, E, R | Env>
  <A, E, R, Output, Error, Env>(
    self: Effect<A, E, R>,
    schedule: Schedule<Output, unknown, Error, Env>
  ): Effect<Output, E, R | Env>
} = dual(2, <A, E, R, Output, Error, Env>(
  self: Effect<A, E, R>,
  schedule: Schedule<Output, unknown, Error, Env>
): Effect<Output, E, R | Env> => scheduleFrom(self, undefined, schedule))

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
 * @example
 * ```ts
 * import { Console, Effect, Schedule } from "effect"
 *
 * const task = (input: number) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Processing: ${input}`)
 *     return input + 1
 *   })
 *
 * // Start with 0, repeat 3 times
 * const program = Effect.scheduleFrom(
 *   task(0),
 *   0,
 *   Schedule.recurs(2)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * // Returns the schedule count
 * ```
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
 * Returns the current tracer from the context.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const currentTracer = yield* Effect.tracer
 *   yield* Effect.log(`Using tracer: ${currentTracer}`)
 *   return "operation completed"
 * })
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const tracer: Effect<Tracer> = internal.tracer

/**
 * Provides a tracer to an effect.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.log("Using tracer")
 *   return "completed"
 * })
 *
 * // withTracer provides a tracer to the effect context
 * // const traced = Effect.withTracer(program, customTracer)
 * ```
 *
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
 *
 * @since 2.0.0
 * @category Tracing
 */
export const withTracerEnabled: {
  (enabled: boolean): <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(effect: Effect<A, E, R>, enabled: boolean): Effect<A, E, R>
} = internal.withTracerEnabled

/**
 * Enables or disables tracer timing for the given Effect.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * Effect.succeed(42).pipe(
 *   Effect.withSpan("my-span"),
 *   // the span will not have timing information
 *   Effect.withTracerTiming(false)
 * )
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const withTracerTiming: {
  (enabled: boolean): <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>
  <A, E, R>(effect: Effect<A, E, R>, enabled: boolean): Effect<A, E, R>
} = internal.withTracerTiming

/**
 * Adds an annotation to each span in this effect.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.log("Doing some work...")
 *   return "result"
 * })
 *
 * // Add single annotation
 * const annotated1 = Effect.annotateSpans(program, "user", "john")
 *
 * // Add multiple annotations
 * const annotated2 = Effect.annotateSpans(program, {
 *   operation: "data-processing",
 *   version: "1.0.0",
 *   environment: "production"
 * })
 * ```
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
 * Adds an annotation to the current span if available.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.annotateCurrentSpan("userId", "123")
 *   yield* Effect.annotateCurrentSpan({
 *     operation: "user-lookup",
 *     timestamp: Date.now()
 *   })
 *   yield* Effect.log("User lookup completed")
 *   return "success"
 * })
 *
 * const traced = Effect.withSpan(program, "user-operation")
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const annotateCurrentSpan: {
  (key: string, value: unknown): Effect<void>
  (values: Record<string, unknown>): Effect<void>
} = internal.annotateCurrentSpan

/**
 * Returns the current span from the context.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const span = yield* Effect.currentSpan
 *   yield* Effect.log(`Current span: ${span}`)
 *   return "done"
 * })
 *
 * const traced = Effect.withSpan(program, "my-span")
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const currentSpan: Effect<Span, Cause.NoSuchElementError> = internal.currentSpan

/**
 * Returns the current parent span from the context.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const childOperation = Effect.gen(function*() {
 *   const parentSpan = yield* Effect.currentParentSpan
 *   yield* Effect.log(`Parent span: ${parentSpan}`)
 *   return "child completed"
 * })
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.withSpan(childOperation, "child-span")
 *   return "parent completed"
 * })
 *
 * const traced = Effect.withSpan(program, "parent-span")
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const currentParentSpan: Effect<AnySpan, Cause.NoSuchElementError> = internal.currentParentSpan

/**
 * Returns the annotations of the current span.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Add some annotations to the current span
 *   yield* Effect.annotateCurrentSpan("userId", "123")
 *   yield* Effect.annotateCurrentSpan("operation", "data-processing")
 *
 *   // Retrieve all annotations
 *   const annotations = yield* Effect.spanAnnotations
 *
 *   console.log("Current span annotations:", annotations)
 *   return annotations
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: Current span annotations: { userId: "123", operation: "data-processing" }
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const spanAnnotations: Effect<Readonly<Record<string, unknown>>> = internal.spanAnnotations

/**
 * Retrieves the span links associated with the current span.
 *
 * Span links are connections between spans that are related but not in a
 * parent-child relationship. They are useful for linking spans across different
 * traces or connecting spans from parallel operations.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Get the current span links
 *   const links = yield* Effect.spanLinks
 *   console.log(`Current span has ${links.length} links`)
 *   return links
 * })
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const spanLinks: Effect<ReadonlyArray<SpanLink>> = internal.spanLinks

/**
 * For all spans in this effect, add a link with the provided span.
 *
 * This is useful for connecting spans that are related but not in a direct
 * parent-child relationship. For example, you might want to link spans from
 * parallel operations or connect spans across different traces.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const parentEffect = Effect.withSpan("parent-operation")(
 *   Effect.succeed("parent result")
 * )
 *
 * const childEffect = Effect.withSpan("child-operation")(
 *   Effect.succeed("child result")
 * )
 *
 * // Link the child span to the parent span
 * const program = Effect.gen(function*() {
 *   const parentSpan = yield* Effect.currentSpan
 *   const result = yield* childEffect.pipe(
 *     Effect.linkSpans(parentSpan, { relationship: "follows" })
 *   )
 *   return result
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Link multiple spans
 * const program = Effect.gen(function*() {
 *   const span1 = yield* Effect.currentSpan
 *   const span2 = yield* Effect.currentSpan
 *
 *   return yield* Effect.succeed("result").pipe(
 *     Effect.linkSpans([span1, span2], {
 *       type: "dependency",
 *       source: "multiple-operations"
 *     })
 *   )
 * })
 * ```
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const span = yield* Effect.makeSpan("my-operation")
 *   yield* Effect.log("Operation in progress")
 *   return "completed"
 * })
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const makeSpan: (name: string, options?: SpanOptionsNoTrace) => Effect<Span> = internal.makeSpan

/**
 * Create a new span for tracing, and automatically close it when the Scope
 * finalizes.
 *
 * The span is not added to the current span stack, so no child spans will be
 * created for it.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.scoped(
 *   Effect.gen(function*() {
 *     const span = yield* Effect.makeSpanScoped("scoped-operation")
 *     yield* Effect.log("Working...")
 *     return "done"
 *     // Span automatically closes when scope ends
 *   })
 * )
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const makeSpanScoped: (
  name: string,
  options?: SpanOptionsNoTrace | undefined
) => Effect<Span, never, Scope> = internal.makeSpanScoped

/**
 * Create a new span for tracing, and automatically close it when the effect
 * completes.
 *
 * The span is not added to the current span stack, so no child spans will be
 * created for it.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.useSpan(
 *   "user-operation",
 *   (span) =>
 *     Effect.gen(function*() {
 *       yield* Effect.log("Processing user data")
 *       return "success"
 *     })
 * )
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const useSpan: {
  <A, E, R>(name: string, evaluate: (span: Span) => Effect<A, E, R>): Effect<A, E, R>
  <A, E, R>(name: string, options: SpanOptionsNoTrace, evaluate: (span: Span) => Effect<A, E, R>): Effect<A, E, R>
} = internal.useSpan

/**
 * Wraps the effect with a new span for tracing.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const task = Effect.gen(function*() {
 *   yield* Effect.log("Executing task")
 *   return "result"
 * })
 *
 * const traced = Effect.withSpan(task, "my-task", {
 *   attributes: { version: "1.0" }
 * })
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const withSpan: {
  <Args extends ReadonlyArray<any>>(
    name: string,
    options?:
      | SpanOptionsNoTrace
      | ((...args: NoInfer<Args>) => SpanOptionsNoTrace)
      | undefined,
    traceOptions?: TraceOptions | undefined
  ): <A, E, R>(self: Effect<A, E, R>, ...args: Args) => Effect<A, E, Exclude<R, ParentSpan>>
  <A, E, R>(
    self: Effect<A, E, R>,
    name: string,
    options?: SpanOptions | undefined
  ): Effect<A, E, Exclude<R, ParentSpan>>
} = internal.withSpan

/**
 * Wraps the effect with a new span for tracing.
 *
 * The span is ended when the Scope is finalized.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.scoped(
 *   Effect.gen(function*() {
 *     const task = Effect.log("Working...")
 *     yield* Effect.withSpanScoped(task, "scoped-task")
 *     return "completed"
 *   })
 * )
 * ```
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const span = yield* Effect.makeSpan("parent-span")
 *   const childTask = Effect.log("Child operation")
 *   yield* Effect.withParentSpan(childTask, span)
 *   return "completed"
 * })
 * ```
 *
 * @since 2.0.0
 * @category Tracing
 */
export const withParentSpan: {
  (value: AnySpan, options?: TraceOptions): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, ParentSpan>>
  <A, E, R>(self: Effect<A, E, R>, value: AnySpan, options?: TraceOptions): Effect<A, E, Exclude<R, ParentSpan>>
} = internal.withParentSpan

// -----------------------------------------------------------------------------
// Batching
// -----------------------------------------------------------------------------

/**
 * Executes a request using the provided resolver.
 *
 * @since 2.0.0
 * @category requests & batching
 */
export const request: {
  <A extends Request.Any, EX = never, RX = never>(
    resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
  ): (self: A) => Effect<Request.Success<A>, Request.Error<A> | EX, Request.Services<A> | RX>
  <A extends Request.Any, EX = never, RX = never>(
    self: A,
    resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
  ): Effect<Request.Success<A>, Request.Error<A> | EX, Request.Services<A> | RX>
} = internalRequest.request

/**
 * A low-level function that executes a request using the provided resolver.
 *
 * The resolver will call the `onExit` function with the exit value of the request.
 *
 * It returns a function that, when called, will cancel the request.
 *
 * @since 4.0.0
 * @category requests & batching
 */
export const requestUnsafe: <A extends Request.Any>(
  self: A,
  options: {
    readonly resolver: RequestResolver<A>
    readonly onExit: (exit: Exit.Exit<Request.Success<A>, Request.Error<A>>) => void
    readonly services: ServiceMap.ServiceMap<never>
  }
) => () => void = internalRequest.requestUnsafe

// -----------------------------------------------------------------------------
// Supervision & Fiber's
// -----------------------------------------------------------------------------

/**
 * Returns an effect that forks this effect into its own separate fiber,
 * returning the fiber immediately, without waiting for it to begin executing
 * the effect.
 *
 * You can use the `forkChild` method whenever you want to execute an effect in a
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
 * behavior is not desired, you may use the `forkDetach` or `forkIn` methods.
 *
 * @example
 * ```ts
 * import { Effect, Fiber } from "effect"
 *
 * const longRunningTask = Effect.gen(function*() {
 *   yield* Effect.sleep("2 seconds")
 *   yield* Effect.log("Task completed")
 *   return "result"
 * })
 *
 * const program = Effect.gen(function*() {
 *   const fiber = yield* Effect.forkChild(longRunningTask)
 *   yield* Effect.log("Task forked, continuing...")
 *   const result = yield* Fiber.join(fiber)
 *   return result
 * })
 * ```
 *
 * @since 4.0.0
 * @category supervision & fibers
 */
export const forkChild: <
  Arg extends Effect<any, any, any> | {
    readonly startImmediately?: boolean | undefined
    readonly uninterruptible?: boolean | "inherit" | undefined
  } | undefined
>(
  effectOrOptions: Arg,
  options?: {
    readonly startImmediately?: boolean | undefined
    readonly uninterruptible?: boolean | "inherit" | undefined
  } | undefined
) => [Arg] extends [Effect<infer _A, infer _E, infer _R>] ? Effect<Fiber<_A, _E>, never, _R>
  : <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R> = internal.forkChild

/**
 * Forks the effect in the specified scope. The fiber will be interrupted
 * when the scope is closed.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const task = Effect.gen(function*() {
 *   yield* Effect.sleep("10 seconds")
 *   return "completed"
 * })
 *
 * const program = Effect.scoped(
 *   Effect.gen(function*() {
 *     const scope = yield* Effect.scope
 *     const fiber = yield* Effect.forkIn(task, scope)
 *     yield* Effect.sleep("1 second")
 *     // Fiber will be interrupted when scope closes
 *     return "done"
 *   })
 * )
 * ```
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const forkIn: {
  (
    scope: Scope,
    options?: {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    }
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R>
  <A, E, R>(
    self: Effect<A, E, R>,
    scope: Scope,
    options?: {
      readonly startImmediately?: boolean | undefined
      readonly uninterruptible?: boolean | "inherit" | undefined
    }
  ): Effect<Fiber<A, E>, never, R>
} = internal.forkIn

/**
 * Forks the fiber in a `Scope`, interrupting it when the scope is closed.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const backgroundTask = Effect.gen(function*() {
 *   yield* Effect.sleep("5 seconds")
 *   yield* Effect.log("Background task completed")
 *   return "result"
 * })
 *
 * const program = Effect.scoped(
 *   Effect.gen(function*() {
 *     const fiber = yield* Effect.forkScoped(backgroundTask)
 *     yield* Effect.log("Task forked in scope")
 *     yield* Effect.sleep("1 second")
 *     // Fiber will be interrupted when scope closes
 *     return "scope completed"
 *   })
 * )
 * ```
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const forkScoped: <
  Arg extends Effect<any, any, any> | {
    readonly startImmediately?: boolean | undefined
    readonly uninterruptible?: boolean | "inherit" | undefined
  } | undefined
>(
  effectOrOptions: Arg,
  options?: {
    readonly startImmediately?: boolean | undefined
    readonly uninterruptible?: boolean | "inherit" | undefined
  } | undefined
) => [Arg] extends [Effect<infer _A, infer _E, infer _R>] ? Effect<Fiber<_A, _E>, never, _R>
  : <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R | Scope> = internal.forkScoped

/**
 * Forks the effect into a new fiber attached to the global scope. Because the
 * new fiber is attached to the global scope, when the fiber executing the
 * returned effect terminates, the forked fiber will continue running.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const daemonTask = Effect.gen(function*() {
 *   while (true) {
 *     yield* Effect.sleep("1 second")
 *     yield* Effect.log("Daemon running...")
 *   }
 * })
 *
 * const program = Effect.gen(function*() {
 *   const fiber = yield* Effect.forkDetach(daemonTask)
 *   yield* Effect.log("Daemon started")
 *   yield* Effect.sleep("3 seconds")
 *   // Daemon continues running after this effect completes
 *   return "main completed"
 * })
 * ```
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const forkDetach: <
  Arg extends Effect<any, any, any> | {
    readonly startImmediately?: boolean | undefined
    readonly uninterruptible?: boolean | "inherit" | undefined
  } | undefined
>(
  effectOrOptions: Arg,
  options?: {
    readonly startImmediately?: boolean | undefined
    readonly uninterruptible?: boolean | "inherit" | undefined
  } | undefined
) => [Arg] extends [Effect<infer _A, infer _E, infer _R>] ? Effect<Fiber<_A, _E>, never, _R>
  : <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R> = internal.forkDetach

/**
 * Access the current fiber executing the effect.
 *
 * @since 4.0.0
 * @category supervision & fibers
 */
export const fiber: Effect<Fiber<unknown, unknown>> = internal.fiber

/**
 * Access the current fiber id executing the effect.
 *
 * @since 4.0.0
 * @category supervision & fibers
 */
export const fiberId: Effect<number> = internal.fiberId

// -----------------------------------------------------------------------------
// Running Effects
// -----------------------------------------------------------------------------

/**
 * Configuration options for running Effect programs, providing control over
 * interruption and scheduling behavior.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.sleep("2 seconds")
 *   return "completed"
 * })
 *
 * // Run with abort signal for cancellation
 * const controller = new AbortController()
 * const options: Effect.RunOptions = {
 *   signal: controller.signal
 * }
 *
 * const fiber = Effect.runFork(program, options)
 * // Later: controller.abort() to cancel
 * ```
 *
 * @since 4.0.0
 * @category Running Effects
 */
export interface RunOptions {
  readonly signal?: AbortSignal | undefined
  readonly scheduler?: Scheduler | undefined
  readonly uninterruptible?: boolean | undefined
}

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
 * import { Effect } from "effect"
 * import { Schedule } from "effect"
 * import { Fiber } from "effect"
 * import { Console } from "effect"
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
export const runFork: <A, E>(effect: Effect<A, E, never>, options?: RunOptions | undefined) => Fiber<A, E> =
  internal.runFork

/**
 * Runs an effect in the background with the provided services.
 *
 * @example
 * ```ts
 * import { Effect, ServiceMap } from "effect"
 *
 * interface Logger {
 *   log: (message: string) => void
 * }
 *
 * const Logger = ServiceMap.Service<Logger>("Logger")
 *
 * const services = ServiceMap.make(Logger, {
 *   log: (message) => console.log(message)
 * })
 *
 * const program = Effect.gen(function*() {
 *   const logger = yield* Logger
 *   logger.log("Hello from service!")
 *   return "done"
 * })
 *
 * const fiber = Effect.runForkWith(services)(program)
 * ```
 *
 * @since 4.0.0
 * @category Running Effects
 */
export const runForkWith: <R>(
  services: ServiceMap.ServiceMap<R>
) => <A, E>(effect: Effect<A, E, R>, options?: RunOptions | undefined) => Fiber<A, E> = internal.runForkWith

/**
 * @since 4.0.0
 * @category Running Effects
 */
export const runCallbackWith: <R>(
  services: ServiceMap.ServiceMap<R>
) => <A, E>(
  effect: Effect<A, E, R>,
  options?: (RunOptions & { readonly onExit: (exit: Exit.Exit<A, E>) => void }) | undefined
) => (interruptor?: number | undefined) => void = internal.runCallbackWith

/**
 * @since 4.0.0
 * @category Running Effects
 */
export const runCallback: <A, E>(
  effect: Effect<A, E, never>,
  options?: (RunOptions & { readonly onExit: (exit: Exit.Exit<A, E>) => void }) | undefined
) => (interruptor?: number | undefined) => void = internal.runCallback

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
  options?: RunOptions | undefined
) => Promise<A> = internal.runPromise

/**
 * Executes an effect as a Promise with the provided services.
 *
 * @example
 * ```ts
 * import { Effect, ServiceMap } from "effect"
 *
 * interface Config {
 *   apiUrl: string
 * }
 *
 * const Config = ServiceMap.Service<Config>("Config")
 *
 * const services = ServiceMap.make(Config, {
 *   apiUrl: "https://api.example.com"
 * })
 *
 * const program = Effect.gen(function*() {
 *   const config = yield* Config
 *   return `Connecting to ${config.apiUrl}`
 * })
 *
 * Effect.runPromiseWith(services)(program).then(console.log)
 * ```
 *
 * @since 4.0.0
 * @category Running Effects
 */
export const runPromiseWith: <R>(
  services: ServiceMap.ServiceMap<R>
) => <A, E>(effect: Effect<A, E, R>, options?: RunOptions | undefined) => Promise<A> = internal.runPromiseWith

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
  options?: RunOptions | undefined
) => Promise<Exit.Exit<A, E>> = internal.runPromiseExit

/**
 * Runs an effect and returns a Promise of Exit with provided services.
 *
 * @example
 * ```ts
 * import { Effect, Exit, ServiceMap } from "effect"
 *
 * interface Database {
 *   query: (sql: string) => string
 * }
 *
 * const Database = ServiceMap.Service<Database>("Database")
 *
 * const services = ServiceMap.make(Database, {
 *   query: (sql) => `Result for: ${sql}`
 * })
 *
 * const program = Effect.gen(function*() {
 *   const db = yield* Database
 *   return db.query("SELECT * FROM users")
 * })
 *
 * Effect.runPromiseExitWith(services)(program).then((exit) => {
 *   if (Exit.isSuccess(exit)) {
 *     console.log("Success:", exit.value)
 *   }
 * })
 * ```
 *
 * @since 4.0.0
 * @category Running Effects
 */
export const runPromiseExitWith: <R>(
  services: ServiceMap.ServiceMap<R>
) => <A, E>(effect: Effect<A, E, R>, options?: RunOptions | undefined) => Promise<Exit.Exit<A, E>> =
  internal.runPromiseExitWith

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
 * Executes an effect synchronously with provided services.
 *
 * @example
 * ```ts
 * import { Effect, ServiceMap } from "effect"
 *
 * interface MathService {
 *   add: (a: number, b: number) => number
 * }
 *
 * const MathService = ServiceMap.Service<MathService>("MathService")
 *
 * const services = ServiceMap.make(MathService, {
 *   add: (a, b) => a + b
 * })
 *
 * const program = Effect.gen(function*() {
 *   const math = yield* MathService
 *   return math.add(2, 3)
 * })
 *
 * const result = Effect.runSyncWith(services)(program)
 * console.log(result) // 5
 * ```
 *
 * @since 4.0.0
 * @category Running Effects
 */
export const runSyncWith: <R>(
  services: ServiceMap.ServiceMap<R>
) => <A, E>(effect: Effect<A, E, R>) => A = internal.runSyncWith

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

/**
 * Runs an effect synchronously with provided services, returning an Exit result.
 *
 * @example
 * ```ts
 * import { Effect, Exit, ServiceMap } from "effect"
 *
 * // Define a logger service
 * const Logger = ServiceMap.Service<{
 *   log: (msg: string) => void
 * }>("Logger")
 *
 * const program = Effect.gen(function*() {
 *   const logger = yield* Effect.service(Logger)
 *   logger.log("Computing result...")
 *   return 42
 * })
 *
 * // Prepare services
 * const services = ServiceMap.make(Logger, {
 *   log: (msg) => console.log(`[LOG] ${msg}`)
 * })
 *
 * const exit = Effect.runSyncExitWith(services)(program)
 *
 * if (Exit.isSuccess(exit)) {
 *   console.log(`Success: ${exit.value}`)
 * } else {
 *   console.log(`Failure: ${exit.cause}`)
 * }
 * // Output:
 * // [LOG] Computing result...
 * // Success: 42
 * ```
 *
 * @since 4.0.0
 * @category Running Effects
 */
export const runSyncExitWith: <R>(
  services: ServiceMap.ServiceMap<R>
) => <A, E>(effect: Effect<A, E, R>) => Exit.Exit<A, E> = internal.runSyncExitWith

// -----------------------------------------------------------------------------
// Function
// -----------------------------------------------------------------------------

/**
 * @since 3.12.0
 * @category Function
 */
export namespace fn {
  /**
   * @since 3.19.0
   * @category Models
   */
  export type Return<A, E = never, R = never> = Generator<Effect<any, E, R>, A, any>

  /**
   * @since 3.11.0
   * @category Models
   */
  export type Gen = {
    <Eff extends Yieldable<any, any, any, any>, AEff, Args extends Array<any>>(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>
    ): (...args: Args) => Effect<
      AEff,
      [Eff] extends [never] ? never
        : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
        : never,
      [Eff] extends [never] ? never
        : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
        : never
    >
    <Self, Eff extends Yieldable<any, any, any, any>, AEff, Args extends Array<any>>(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>
    ): (this: Self, ...args: Args) => Effect<
      AEff,
      [Eff] extends [never] ? never
        : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
        : never,
      [Eff] extends [never] ? never
        : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
        : never
    >
    <Eff extends Yieldable<any, any, any, any>, AEff, Args extends Array<any>, A>(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A
    ): (...args: Args) => A
    <Self, Eff extends Yieldable<any, any, any, any>, AEff, Args extends Array<any>, A>(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A
    ): (this: Self, ...args: Args) => A
    <Eff extends Yieldable<any, any, any, any>, AEff, Args extends Array<any>, A, B>(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B
    ): (...args: Args) => B
    <Self, Eff extends Yieldable<any, any, any, any>, AEff, Args extends Array<any>, A, B>(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B
    ): (this: Self, ...args: Args) => B
    <
      Eff extends Yieldable<any, any, any, any>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C
    >(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C
    ): (...args: Args) => C
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C
    ): (this: Self, ...args: Args) => C
    <
      Eff extends Yieldable<any, any, any, any>,
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
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D
    ): (...args: Args) => D
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D
    ): (this: Self, ...args: Args) => D
    <
      Eff extends Yieldable<any, any, any, any>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E
    >(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E
    ): (...args: Args) => E
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E
    ): (this: Self, ...args: Args) => E
    <
      Eff extends Yieldable<any, any, any, any>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F
    >(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      Self,
      Eff extends Yieldable<any, any, any, any>,
      AEff,
      Args extends Array<any>,
      A,
      B,
      C,
      D,
      E,
      F
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F
    ): (this: Self, ...args: Args) => F
    <
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
        >,
        ...args: Args
      ) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G
    ): (this: Self, ...args: Args) => G
    <
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
    ): (this: Self, ...args: Args) => H
    <
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
    ): (this: Self, ...args: Args) => I
    <
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J
    >(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J
    ): (...args: Args) => J
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J
    ): (this: Self, ...args: Args) => J
    <
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K
    >(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K
    ): (...args: Args) => K
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K
    ): (this: Self, ...args: Args) => K
    <
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K,
      L
    >(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L
    ): (...args: Args) => L
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K,
      L
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L
    ): (this: Self, ...args: Args) => L
    <
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K,
      L,
      M
    >(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M
    ): (...args: Args) => M
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K,
      L,
      M
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M
    ): (this: Self, ...args: Args) => M
    <
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K,
      L,
      M,
      N
    >(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N
    ): (...args: Args) => N
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K,
      L,
      M,
      N
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N
    ): (this: Self, ...args: Args) => N
    <
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K,
      L,
      M,
      N,
      O
    >(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O
    ): (...args: Args) => O
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K,
      L,
      M,
      N,
      O
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O
    ): (this: Self, ...args: Args) => O
    <
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K,
      L,
      M,
      N,
      O,
      P
    >(
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P
    ): (...args: Args) => P
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      I,
      J,
      K,
      L,
      M,
      N,
      O,
      P
    >(
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P
    ): (this: Self, ...args: Args) => P
    <
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q
    ): (...args: Args) => Q
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q
    ): (this: Self, ...args: Args) => Q
    <
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R
    ): (...args: Args) => R
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R
    ): (this: Self, ...args: Args) => R
    <
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R,
      s: (_: R, ...args: Args) => S
    ): (...args: Args) => S
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R,
      s: (_: R, ...args: Args) => S
    ): (this: Self, ...args: Args) => S
    <
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: unassigned, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R,
      s: (_: R, ...args: Args) => S,
      t: (_: S, ...args: Args) => T
    ): (...args: Args) => T
    <
      Self,
      Eff extends Yieldable<any, any, any, any>,
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
      body: (this: Self, ...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer E, infer _R>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [Yieldable<infer _S, infer _A, infer _E, infer R>] ? R
            : never
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
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R,
      s: (_: R, ...args: Args) => S,
      t: (_: S, ...args: Args) => T
    ): (this: Self, ...args: Args) => T
  }

  /**
   * @since 3.11.0
   * @category Models
   */
  export type NonGen = {
    <Args extends Array<any>, A, E, R>(
      body: (this: unassigned, ...args: Args) => Effect<A, E, R>
    ): (...args: Args) => Effect<A, E, R>
    <Self, Args extends Array<any>, A, E, R>(
      body: (this: Self, ...args: Args) => Effect<A, E, R>
    ): (this: Self, ...args: Args) => Effect<A, E, R>

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A
    ): (...args: Args) => A
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A
    ): (this: Self, ...args: Args) => A

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B
    ): (...args: Args) => B
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B
    ): (this: Self, ...args: Args) => B

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C
    ): (...args: Args) => C
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C
    ): (this: Self, ...args: Args) => C

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D
    ): (...args: Args) => D
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D
    ): (this: Self, ...args: Args) => D

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E
    ): (...args: Args) => E
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E
    ): (this: Self, ...args: Args) => E

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F
    ): (...args: Args) => F
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F
    ): (this: Self, ...args: Args) => F

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G
    ): (...args: Args) => G
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G
    ): (this: Self, ...args: Args) => G

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H
    ): (...args: Args) => H
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H
    ): (this: Self, ...args: Args) => H

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I
    ): (...args: Args) => H
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I
    ): (this: Self, ...args: Args) => I

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J
    ): (...args: Args) => J
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J
    ): (this: Self, ...args: Args) => J

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K
    ): (...args: Args) => K
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K
    ): (this: Self, ...args: Args) => K

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L
    ): (...args: Args) => L
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L
    ): (this: Self, ...args: Args) => L

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L, M>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M
    ): (...args: Args) => M
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L, M>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M
    ): (this: Self, ...args: Args) => M

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L, M, N>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N
    ): (...args: Args) => N
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L, M, N>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N
    ): (this: Self, ...args: Args) => N

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O
    ): (...args: Args) => O
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O
    ): (this: Self, ...args: Args) => O

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P
    ): (...args: Args) => P
    <Self, Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P>(
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P
    ): (this: Self, ...args: Args) => P

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q
    ): (...args: Args) => Q
    <
      Self,
      Args extends Array<any>,
      Eff extends Effect<any, any, any>,
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
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q
    ): (this: Self, ...args: Args) => Q

    <Args extends Array<any>, Eff extends Effect<any, any, any>, A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R>(
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R
    ): (...args: Args) => R
    <
      Self,
      Args extends Array<any>,
      Eff extends Effect<any, any, any>,
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
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R
    ): (this: Self, ...args: Args) => R

    <
      Args extends Array<any>,
      Eff extends Effect<any, any, any>,
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
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R,
      s: (_: R, ...args: Args) => S
    ): (...args: Args) => S
    <
      Self,
      Args extends Array<any>,
      Eff extends Effect<any, any, any>,
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
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R,
      s: (_: R, ...args: Args) => S
    ): (this: Self, ...args: Args) => S

    <
      Args extends Array<any>,
      Eff extends Effect<any, any, any>,
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
      body: (this: unassigned, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R,
      s: (_: R, ...args: Args) => S,
      t: (_: S, ...args: Args) => T
    ): (...args: Args) => T
    <
      Self,
      Args extends Array<any>,
      Eff extends Effect<any, any, any>,
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
      body: (this: Self, ...args: Args) => Eff,
      a: (_: Eff, ...args: Args) => A,
      b: (_: A, ...args: Args) => B,
      c: (_: B, ...args: Args) => C,
      d: (_: C, ...args: Args) => D,
      e: (_: D, ...args: Args) => E,
      f: (_: E, ...args: Args) => F,
      g: (_: F, ...args: Args) => G,
      h: (_: G, ...args: Args) => H,
      i: (_: H, ...args: Args) => I,
      j: (_: I, ...args: Args) => J,
      k: (_: J, ...args: Args) => K,
      l: (_: K, ...args: Args) => L,
      m: (_: L, ...args: Args) => M,
      n: (_: M, ...args: Args) => N,
      o: (_: N, ...args: Args) => O,
      p: (_: O, ...args: Args) => P,
      q: (_: P, ...args: Args) => Q,
      r: (_: Q, ...args: Args) => R,
      s: (_: R, ...args: Args) => S,
      t: (_: S, ...args: Args) => T
    ): (this: Self, ...args: Args) => T
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
export const fnUntraced: fn.Gen = internal.fnUntraced

/**
 * @since 3.12.0
 * @category function
 */
export const fn: fn.Gen & fn.NonGen & {
  (name: string, options?: SpanOptionsNoTrace): fn.Gen
  (name: string, options?: SpanOptionsNoTrace): fn.NonGen
} = internal.fn

// ========================================================================
// Clock
// ========================================================================

/**
 * Retrieves the `Clock` service from the context and provides it to the
 * specified effectful function.
 *
 * @example
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
export const logWithLevel: (level?: LogLevel) => (...message: ReadonlyArray<any>) => Effect<void> =
  internal.logWithLevel

/**
 * Logs one or more messages using the default log level.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.log("Starting computation")
 *   const result = 2 + 2
 *   yield* Effect.log("Result:", result)
 *   yield* Effect.log("Multiple", "values", "can", "be", "logged")
 *   return result
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // timestamp=2023-... level=INFO message="Starting computation"
 * // timestamp=2023-... level=INFO message="Result: 4"
 * // timestamp=2023-... level=INFO message="Multiple values can be logged"
 * // 4
 * ```
 *
 * @since 2.0.0
 * @category logging
 */
export const log: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel()

/**
 * Logs one or more messages at the FATAL level.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   try {
 *     // Simulate a critical system failure
 *     throw new Error("System memory exhausted")
 *   } catch (error) {
 *     const errorMessage = error instanceof Error ? error.message : String(error)
 *     yield* Effect.logFatal("Critical system failure:", errorMessage)
 *     yield* Effect.logFatal("System shutting down")
 *   }
 * })
 *
 * Effect.runPromise(program)
 * // Output:
 * // timestamp=2023-... level=FATAL message="Critical system failure: System memory exhausted"
 * // timestamp=2023-... level=FATAL message="System shutting down"
 * ```
 *
 * @since 2.0.0
 * @category logging
 */
export const logFatal: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Fatal")

/**
 * Logs one or more messages at the WARNING level.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.logWarning("API rate limit approaching")
 *   yield* Effect.logWarning("Retries remaining:", 2, "Operation:", "fetchData")
 *
 *   // Useful for non-critical issues
 *   const deprecated = true
 *   if (deprecated) {
 *     yield* Effect.logWarning("Using deprecated API endpoint")
 *   }
 * })
 *
 * Effect.runPromise(program)
 * // Output:
 * // timestamp=2023-... level=WARN message="API rate limit approaching"
 * // timestamp=2023-... level=WARN message="Retries remaining: 2 Operation: fetchData"
 * // timestamp=2023-... level=WARN message="Using deprecated API endpoint"
 * ```
 *
 * @since 2.0.0
 * @category logging
 */
export const logWarning: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Warn")

/**
 * Logs one or more messages at the ERROR level.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.logError("Database connection failed")
 *   yield* Effect.logError(
 *     "Error code:",
 *     500,
 *     "Message:",
 *     "Internal server error"
 *   )
 *
 *   // Can be used with error objects
 *   const error = new Error("Something went wrong")
 *   yield* Effect.logError("Caught error:", error.message)
 * })
 *
 * Effect.runPromise(program)
 * // Output:
 * // timestamp=2023-... level=ERROR message="Database connection failed"
 * // timestamp=2023-... level=ERROR message="Error code: 500 Message: Internal server error"
 * // timestamp=2023-... level=ERROR message="Caught error: Something went wrong"
 * ```
 *
 * @since 2.0.0
 * @category logging
 */
export const logError: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Error")

/**
 * Logs one or more messages at the INFO level.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.logInfo("Application starting up")
 *   yield* Effect.logInfo("Config loaded:", "production", "Port:", 3000)
 *
 *   // Useful for general information
 *   const version = "1.2.3"
 *   yield* Effect.logInfo("Application version:", version)
 * })
 *
 * Effect.runPromise(program)
 * // Output:
 * // timestamp=2023-... level=INFO message="Application starting up"
 * // timestamp=2023-... level=INFO message="Config loaded: production Port: 3000"
 * // timestamp=2023-... level=INFO message="Application version: 1.2.3"
 * ```
 *
 * @since 2.0.0
 * @category logging
 */
export const logInfo: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Info")

/**
 * Logs one or more messages at the DEBUG level.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.logDebug("Debug mode enabled")
 *
 *   const userInput = { name: "Alice", age: 30 }
 *   yield* Effect.logDebug("Processing user input:", userInput)
 *
 *   // Useful for detailed diagnostic information
 *   yield* Effect.logDebug("Variable state:", "x=10", "y=20", "z=30")
 * })
 *
 * Effect.runPromise(program)
 * // Output:
 * // timestamp=2023-... level=DEBUG message="Debug mode enabled"
 * // timestamp=2023-... level=DEBUG message="Processing user input: [object Object]"
 * // timestamp=2023-... level=DEBUG message="Variable state: x=10 y=20 z=30"
 * ```
 *
 * @since 2.0.0
 * @category logging
 */
export const logDebug: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Debug")

/**
 * Logs one or more messages at the TRACE level.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.logTrace("Entering function processData")
 *
 *   // Trace detailed execution flow
 *   for (let i = 0; i < 3; i++) {
 *     yield* Effect.logTrace("Loop iteration:", i, "Processing item")
 *   }
 *
 *   yield* Effect.logTrace("Exiting function processData")
 * })
 *
 * Effect.runPromise(program)
 * // Output:
 * // timestamp=2023-... level=TRACE message="Entering function processData"
 * // timestamp=2023-... level=TRACE message="Loop iteration: 0 Processing item"
 * // timestamp=2023-... level=TRACE message="Loop iteration: 1 Processing item"
 * // timestamp=2023-... level=TRACE message="Loop iteration: 2 Processing item"
 * // timestamp=2023-... level=TRACE message="Exiting function processData"
 * ```
 *
 * @since 2.0.0
 * @category logging
 */
export const logTrace: (...message: ReadonlyArray<any>) => Effect<void> = internal.logWithLevel("Trace")

/**
 * Adds a logger to the set of loggers which will output logs for this effect.
 *
 * @example
 * ```ts
 * import { Effect, Logger } from "effect"
 *
 * // Create a custom logger that logs to the console
 * const customLogger = Logger.make(({ message }) =>
 *   Effect.sync(() => console.log(`[CUSTOM]: ${message}`))
 * )
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.log("This will go to both default and custom logger")
 *   return "completed"
 * })
 *
 * // Add the custom logger to the effect
 * const programWithLogger = Effect.withLogger(program, customLogger)
 *
 * Effect.runPromise(programWithLogger)
 * // Output includes both default and custom log outputs
 * ```
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   yield* Effect.log("Starting operation")
 *   yield* Effect.log("Processing data")
 *   yield* Effect.log("Operation completed")
 * })
 *
 * // Add annotations to all log messages
 * const annotatedProgram = Effect.annotateLogs(program, {
 *   userId: "user123",
 *   operation: "data-processing"
 * })
 *
 * // Also supports single key-value annotations
 * const singleAnnotated = Effect.annotateLogs(program, "requestId", "req-456")
 *
 * Effect.runPromise(annotatedProgram)
 * // All log messages will include the userId and operation annotations
 * ```
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const databaseOperation = Effect.gen(function*() {
 *   yield* Effect.log("Connecting to database")
 *   yield* Effect.log("Executing query")
 *   yield* Effect.log("Processing results")
 *   return "data"
 * })
 *
 * const httpRequest = Effect.gen(function*() {
 *   yield* Effect.log("Making HTTP request")
 *   const data = yield* Effect.withLogSpan(databaseOperation, "db-operation")
 *   yield* Effect.log("Sending response")
 *   return data
 * })
 *
 * const program = Effect.withLogSpan(httpRequest, "http-handler")
 *
 * Effect.runPromise(program)
 * // All log messages will include span information showing the nested operation context
 * ```
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
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const counter = Metric.counter("effect_executions", {
 *   description: "Counts effect executions"
 * }).pipe(Metric.withConstantInput(1))
 *
 * const program = Effect.succeed("Hello").pipe(
 *   Effect.track(counter)
 * )
 *
 * // This will increment the counter by 1 when executed
 * Effect.runPromise(program).then(() =>
 *   Effect.runPromise(Metric.value(counter)).then(console.log)
 *   // Output: { count: 1, incremental: false }
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Exit, Metric } from "effect"
 *
 * // Track different exit types with custom mapping
 * const exitTracker = Metric.frequency("exit_types", {
 *   description: "Tracks success/failure/defect counts"
 * })
 *
 * const mapExitToString = (exit: Exit.Exit<string, Error>) => {
 *   if (Exit.isSuccess(exit)) return "success"
 *   if (Exit.isFailure(exit)) return "failure"
 *   return "defect"
 * }
 *
 * const effect = Effect.succeed("result").pipe(
 *   Effect.track(exitTracker, mapExitToString)
 * )
 * ```
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
      const input = f === undefined ? exit : internalCall(() => f(exit))
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
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const successCounter = Metric.counter("successes").pipe(
 *   Metric.withConstantInput(1)
 * )
 *
 * const program = Effect.succeed(42).pipe(
 *   Effect.trackSuccesses(successCounter)
 * )
 *
 * Effect.runPromise(program).then(() =>
 *   Effect.runPromise(Metric.value(successCounter)).then(console.log)
 *   // Output: { count: 1, incremental: false }
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * // Track successful request sizes
 * const requestSizeGauge = Metric.gauge("request_size_bytes")
 *
 * const program = Effect.succeed("Hello World!").pipe(
 *   Effect.trackSuccesses(requestSizeGauge, (value: string) => value.length)
 * )
 *
 * Effect.runPromise(program).then(() =>
 *   Effect.runPromise(Metric.value(requestSizeGauge)).then(console.log)
 *   // Output: { value: 12 }
 * )
 * ```
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
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const errorCounter = Metric.counter("errors").pipe(
 *   Metric.withConstantInput(1)
 * )
 *
 * const program = Effect.fail("Network timeout").pipe(
 *   Effect.trackErrors(errorCounter)
 * )
 *
 * Effect.runPromiseExit(program).then(() =>
 *   Effect.runPromise(Metric.value(errorCounter)).then(console.log)
 *   // Output: { count: 1, incremental: false }
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * // Track error types using frequency metric
 * const errorTypeFrequency = Metric.frequency("error_types")
 *
 * const program = Effect.fail(new Error("Connection failed")).pipe(
 *   Effect.trackErrors(errorTypeFrequency, (error: Error) => error.name)
 * )
 *
 * Effect.runPromiseExit(program).then(() =>
 *   Effect.runPromise(Metric.value(errorTypeFrequency)).then(console.log)
 *   // Output: { occurrences: Map(1) { "Error" => 1 } }
 * )
 * ```
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
      const input = f === undefined ? error : internalCall(() => f(error))
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
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const defectCounter = Metric.counter("defects").pipe(
 *   Metric.withConstantInput(1)
 * )
 *
 * const program = Effect.die("Critical system failure").pipe(
 *   Effect.trackDefects(defectCounter)
 * )
 *
 * Effect.runPromiseExit(program).then(() =>
 *   Effect.runPromise(Metric.value(defectCounter)).then(console.log)
 *   // Output: { count: 1, incremental: false }
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * // Track defect types using frequency metric
 * const defectTypeFrequency = Metric.frequency("defect_types")
 *
 * const program = Effect.die(new Error("Null pointer exception")).pipe(
 *   Effect.trackDefects(defectTypeFrequency, (defect: unknown) => {
 *     if (defect instanceof Error) return defect.constructor.name
 *     return typeof defect
 *   })
 * )
 *
 * Effect.runPromiseExit(program).then(() =>
 *   Effect.runPromise(Metric.value(defectTypeFrequency)).then(console.log)
 *   // Output: { occurrences: Map(1) { "Error" => 1 } }
 * )
 * ```
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
      const input = f === undefined ? defect : internalCall(() => f(defect))
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
 * @example
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const executionTimer = Metric.timer("execution_time")
 *
 * const program = Effect.sleep("100 millis").pipe(
 *   Effect.trackDuration(executionTimer)
 * )
 *
 * Effect.runPromise(program).then(() =>
 *   Effect.runPromise(Metric.value(executionTimer)).then(console.log)
 *   // Output: { count: 1, min: 100000000, max: 100000000, sum: 100000000 }
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Duration, Effect, Metric } from "effect"
 *
 * // Track execution time in milliseconds using custom mapping
 * const durationGauge = Metric.gauge("execution_millis")
 *
 * const program = Effect.sleep("200 millis").pipe(
 *   Effect.trackDuration(durationGauge, (duration) => Duration.toMillis(duration))
 * )
 *
 * Effect.runPromise(program).then(() =>
 *   Effect.runPromise(Metric.value(durationGauge)).then(console.log)
 *   // Output: { value: 200 }
 * )
 * ```
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
      const startTime = clock.currentTimeNanosUnsafe()
      return onExit(self, () => {
        const endTime = clock.currentTimeNanosUnsafe()
        const duration = Duration.subtract(
          Duration.fromDurationInputUnsafe(endTime),
          Duration.fromDurationInputUnsafe(startTime)
        )
        const input = f === undefined ? duration : internalCall(() => f(duration))
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Transaction class for software transactional memory operations
 * const txEffect = Effect.gen(function*() {
 *   const tx = yield* Effect.Transaction
 *   // Use transaction for coordinated state changes
 *   return "Transaction complete"
 * })
 * ```
 *
 * @since 4.0.0
 * @category Transactions
 */
export class Transaction extends ServiceMap.Service<
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
 * @example
 * ```ts
 * import { Effect, TxRef } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const ref1 = yield* TxRef.make(0)
 *   const ref2 = yield* TxRef.make(0)
 *
 *   // All operations within atomic block succeed or fail together
 *   yield* Effect.atomic(Effect.gen(function*() {
 *     yield* TxRef.set(ref1, 10)
 *     yield* TxRef.set(ref2, 20)
 *     const sum = (yield* TxRef.get(ref1)) + (yield* TxRef.get(ref2))
 *     console.log(`Transaction sum: ${sum}`)
 *   }))
 *
 *   console.log(`Final ref1: ${yield* TxRef.get(ref1)}`) // 10
 *   console.log(`Final ref2: ${yield* TxRef.get(ref2)}`) // 20
 * })
 * ```
 *
 * @since 4.0.0
 * @category Transactions
 */
export const atomic = <A, E, R>(
  effect: Effect<A, E, R>
): Effect<A, E, Exclude<R, Transaction>> => atomicWith(() => effect)

/**
 * Executes a function within a transaction context, providing access to the transaction state.
 *
 * @example
 * ```ts
 * import { Effect, TxRef } from "effect"
 *
 * const program = Effect.atomicWith((txState) =>
 *   Effect.gen(function*() {
 *     const ref = yield* TxRef.make(0)
 *
 *     // Access transaction state for debugging
 *     console.log(`Journal size: ${txState.journal.size}`)
 *     console.log(`Retry flag: ${txState.retry}`)
 *
 *     yield* TxRef.set(ref, 42)
 *     return yield* TxRef.get(ref)
 *   })
 * )
 *
 * Effect.runPromise(program).then(console.log) // 42
 * ```
 *
 * @since 4.0.0
 * @category Transactions
 */
export const atomicWith = <A, E, R>(
  f: (state: Transaction["Service"]) => Effect<A, E, R>
): Effect<A, E, Exclude<R, Transaction>> =>
  withFiber((fiber) => {
    // Check if transaction already exists and reuse it (composing behavior)
    if (fiber.services.mapUnsafe.has(Transaction.key)) {
      return internalCall(() => f(ServiceMap.getUnsafe(fiber.services, Transaction))) as Effect<
        A,
        E,
        Exclude<R, Transaction>
      >
    }
    // No existing transaction, create isolated one using transactionWith
    return transactionWith(f)
  })

/**
 * Creates an isolated transaction that never composes with parent transactions.
 *
 * **Details**
 *
 * Unlike `Effect.atomic`, which composes with parent transactions when nested,
 * `Effect.transaction` always creates a new isolated transaction boundary.
 * This ensures complete isolation between different transaction scopes.
 *
 * **Key Differences from Effect.atomic:**
 * - Always creates a new transaction, even when called within another transaction
 * - Parent transaction failures don't affect isolated transactions
 * - Isolated transaction failures don't affect parent transactions
 * - Each transaction has its own journal and retry logic
 *
 * **When to Use:**
 * - When you need guaranteed isolation between transaction scopes
 * - For implementing independent operations that shouldn't be affected by outer transactions
 * - When building transaction-based systems where isolation is critical
 *
 * @example
 * ```ts
 * import { Effect, TxRef } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const ref1 = yield* TxRef.make(0)
 *   const ref2 = yield* TxRef.make(100)
 *
 *   // Nested atomic transaction - ref1 will be part of outer transaction
 *   yield* Effect.atomic(Effect.gen(function*() {
 *     yield* TxRef.set(ref1, 10)
 *
 *     // This atomic operation composes with the parent
 *     yield* Effect.atomic(Effect.gen(function*() {
 *       yield* TxRef.set(ref1, 20) // Part of same transaction
 *     }))
 *   }))
 *
 *   // Isolated transaction - ref2 will be in its own transaction
 *   yield* Effect.transaction(Effect.gen(function*() {
 *     yield* TxRef.set(ref2, 200)
 *   }))
 *
 *   const val1 = yield* TxRef.get(ref1) // 20
 *   const val2 = yield* TxRef.get(ref2) // 200
 *   return { ref1: val1, ref2: val2 }
 * })
 * ```
 *
 * @since 4.0.0
 * @category Transactions
 */
export const transaction = <A, E, R>(
  effect: Effect<A, E, R>
): Effect<A, E, Exclude<R, Transaction>> => transactionWith(() => effect)

/**
 * Executes a function within an isolated transaction context, providing access to the transaction state.
 *
 * This function always creates a new transaction boundary, regardless of whether it's called
 * within another transaction. This ensures complete isolation between transaction scopes.
 *
 * @example
 * ```ts
 * import { Effect, TxRef } from "effect"
 *
 * const program = Effect.transactionWith((txState) =>
 *   Effect.gen(function*() {
 *     const ref = yield* TxRef.make(0)
 *
 *     // This transaction is isolated - it has its own journal
 *     // txState.journal is independent of any parent transaction
 *
 *     yield* TxRef.set(ref, 42)
 *     return yield* TxRef.get(ref)
 *   })
 * )
 *
 * // Even when nested in another atomic block, this transaction is isolated
 * const nestedProgram = Effect.atomic(
 *   Effect.gen(function*() {
 *     const result = yield* program // Runs in its own isolated transaction
 *     return result
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category Transactions
 */
export const transactionWith = <A, E, R>(
  f: (state: Transaction["Service"]) => Effect<A, E, R>
): Effect<A, E, Exclude<R, Transaction>> =>
  withFiber((fiber) => {
    // Always create a new transaction state, never compose with parent
    const state: Transaction["Service"] = { journal: new Map(), retry: false }
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
                if (!state.retry) return void_
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

const isTransactionConsistent = (state: Transaction["Service"]) => {
  for (const [ref, { version }] of state.journal) {
    if (ref.version !== version) {
      return false
    }
  }
  return true
}

const awaitPendingTransaction = (state: Transaction["Service"]) =>
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
        resume(void_)
      }
      for (const ref of refs) {
        ref.pending.set(key, onCall)
      }
      return sync(clearPending)
    })
  })

function commitTransaction(scheduler: Scheduler, state: Transaction["Service"]) {
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

function clearTransaction(state: Transaction["Service"]) {
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
 * import { Effect, TxRef } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // create a transactional reference
 *   const ref = yield* TxRef.make(0)
 *
 *   // forks a fiber that increases the value of `ref` every 100 millis
 *   yield* Effect.forkChild(Effect.forever(
 *     // update to transactional value
 *     TxRef.update(ref, (n) => n + 1).pipe(Effect.delay("100 millis"))
 *   ))
 *
 *   // the following will retry 10 times until the `ref` value is 10
 *   yield* Effect.atomic(Effect.gen(function*() {
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Effectify namespace contains utilities for converting callback-based APIs
 * declare function readFile(
 *   path: string,
 *   cb: (err: Error | null, data?: string) => void
 * ): void
 * const effectReadFile = Effect.effectify(readFile)
 * // Converts callback-based functions to Effect-based functions
 * ```
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
   * @example
   * ```ts
   * import type { Effect } from "effect"
   *
   * // Effectify type converts callback-based function types to Effect-based types
   * type CallbackFn = (
   *   x: number,
   *   cb: (err: Error | null, result?: string) => void
   * ) => void
   * type EffectFn = Effect.Effectify.Effectify<CallbackFn, Error>
   * // Result: (x: number) => Effect<string, Error>
   * ```
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
   * @example
   * ```ts
   * import type { Effect } from "effect"
   *
   * // EffectifyError extracts error types from callback-based function types
   * type CallbackFn = (
   *   x: number,
   *   cb: (err: Error | null, result?: string) => void
   * ) => void
   * type ErrorType = Effect.Effectify.EffectifyError<CallbackFn>
   * // Result: Error | null
   * ```
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
 * @example Basic Usage
 * ```ts
 * import { Effect } from "effect"
 * import * as fs from "fs"
 *
 * // Convert Node.js readFile to an Effect
 * const readFile = Effect.effectify(fs.readFile)
 *
 * // Use the effectified function
 * const program = readFile("package.json", "utf8")
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: contents of package.json
 * ```
 *
 * @example Custom Error Handling
 * ```ts
 * import { Effect } from "effect"
 * import * as fs from "fs"
 *
 * const readFile = Effect.effectify(
 *   fs.readFile,
 *   (error, args) => new Error(`Failed to read file ${args[0]}: ${error.message}`)
 * )
 *
 * const program = readFile("nonexistent.txt", "utf8")
 *
 * Effect.runPromiseExit(program).then(console.log)
 * // Output: Exit.failure with custom error message
 * ```
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
    callback<A, globalThis.Error>((resume) => {
      try {
        fn(...args, (err: globalThis.Error | null, result: A) => {
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

// -----------------------------------------------------------------------------
// Type constraints
// -----------------------------------------------------------------------------

/**
 * Ensures that an effect's success type extends a given type `A`.
 *
 * This function provides compile-time type checking to ensure that the success
 * value of an effect conforms to a specific type constraint.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Define a constraint that the success type must be a number
 * const satisfiesNumber = Effect.satisfiesSuccessType<number>()
 *
 * // This works - Effect<42, never, never> extends Effect<number, never, never>
 * const validEffect = satisfiesNumber(Effect.succeed(42))
 *
 * // This would cause a TypeScript compilation error:
 * // const invalidEffect = satisfiesNumber(Effect.succeed("string"))
 * //                                      ^^^^^^^^^^^^^^^^^^^^^^
 * // Type 'string' is not assignable to type 'number'
 * ```
 *
 * @since 4.0.0
 * @category Type constraints
 */
export const satisfiesSuccessType = <A>() => <A2 extends A, E, R>(effect: Effect<A2, E, R>): Effect<A2, E, R> => effect

/**
 * Ensures that an effect's error type extends a given type `E`.
 *
 * This function provides compile-time type checking to ensure that the error
 * type of an effect conforms to a specific type constraint.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Define a constraint that the error type must be an Error
 * const satisfiesError = Effect.satisfiesErrorType<Error>()
 *
 * // This works - Effect<number, TypeError, never> extends Effect<number, Error, never>
 * const validEffect = satisfiesError(Effect.fail(new TypeError("Invalid type")))
 *
 * // This would cause a TypeScript compilation error:
 * // const invalidEffect = satisfiesError(Effect.fail("string error"))
 * //                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^
 * // Type 'string' is not assignable to type 'Error'
 * ```
 *
 * @since 4.0.0
 * @category Type constraints
 */
export const satisfiesErrorType = <E>() => <A, E2 extends E, R>(effect: Effect<A, E2, R>): Effect<A, E2, R> => effect

/**
 * Ensures that an effect's requirements type extends a given type `R`.
 *
 * This function provides compile-time type checking to ensure that the
 * requirements (context) type of an effect conforms to a specific type constraint.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Define a constraint that requires a string as the requirements type
 * const satisfiesStringServices = Effect.satisfiesServicesType<string>()
 *
 * // This works - effect requires string
 * const validEffect: Effect.Effect<number, never, "config"> = Effect.succeed(42)
 * const constrainedEffect = satisfiesStringServices(validEffect)
 *
 * // This would cause a TypeScript compilation error if uncommented:
 * // const invalidEffect: Effect.Effect<number, never, number> = Effect.succeed(42)
 * // const constrainedInvalid = satisfiesStringServices(invalidEffect)
 * ```
 *
 * @since 4.0.0
 * @category Type constraints
 */
export const satisfiesServicesType = <R>() => <A, E, R2 extends R>(effect: Effect<A, E, R2>): Effect<A, E, R2> => effect

/**
 * An optimized version of `map` that checks if an effect is already resolved
 * and applies the mapping function eagerly when possible.
 *
 * **When to Use**
 *
 * `mapEager` provides better performance for effects that are already resolved
 * by applying the transformation immediately instead of deferring it through
 * the effect pipeline.
 *
 * **Behavior**
 *
 * - For **Success effects**: Applies the mapping function immediately to the value
 * - For **Failure effects**: Returns the failure as-is without applying the mapping
 * - For **Pending effects**: Falls back to the regular `map` behavior
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // For resolved effects, the mapping is applied immediately
 * const resolved = Effect.succeed(5)
 * const mapped = Effect.mapEager(resolved, (n) => n * 2) // Applied eagerly
 *
 * // For pending effects, behaves like regular map
 * const pending = Effect.delay(Effect.succeed(5), "100 millis")
 * const mappedPending = Effect.mapEager(pending, (n) => n * 2) // Uses regular map
 * ```
 *
 * @since 4.0.0
 * @category Eager
 */
export const mapEager: {
  <A, B>(f: (a: A) => B): <E, R>(self: Effect<A, E, R>) => Effect<B, E, R>
  <A, E, R, B>(self: Effect<A, E, R>, f: (a: A) => B): Effect<B, E, R>
} = internal.mapEager

/**
 * An optimized version of `mapError` that checks if an effect is already resolved
 * and applies the error mapping function eagerly when possible.
 *
 * **When to Use**
 *
 * `mapErrorEager` provides better performance for effects that are already resolved
 * by applying the error transformation immediately instead of deferring it through
 * the effect pipeline.
 *
 * **Behavior**
 *
 * - For **Success effects**: Returns the success as-is (no error to transform)
 * - For **Failure effects**: Applies the mapping function immediately to the error
 * - For **Pending effects**: Falls back to the regular `mapError` behavior
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // For resolved failure effects, the error mapping is applied immediately
 * const failed = Effect.fail("original error")
 * const mapped = Effect.mapErrorEager(failed, (err: string) => `mapped: ${err}`) // Applied eagerly
 *
 * // For pending effects, behaves like regular mapError
 * const pending = Effect.delay(Effect.fail("error"), "100 millis")
 * const mappedPending = Effect.mapErrorEager(
 *   pending,
 *   (err: string) => `mapped: ${err}`
 * ) // Uses regular mapError
 * ```
 *
 * @since 4.0.0
 * @category Eager
 */
export const mapErrorEager: {
  <E, E2>(f: (e: E) => E2): <A, R>(self: Effect<A, E, R>) => Effect<A, E2, R>
  <A, E, R, E2>(self: Effect<A, E, R>, f: (e: E) => E2): Effect<A, E2, R>
} = internal.mapErrorEager

/**
 * An optimized version of `mapBoth` that checks if an effect is already resolved
 * and applies the appropriate mapping function eagerly when possible.
 *
 * **When to Use**
 *
 * `mapBothEager` provides better performance for effects that are already resolved
 * by applying the transformation immediately instead of deferring it through
 * the effect pipeline.
 *
 * **Behavior**
 *
 * - For **Success effects**: Applies the `onSuccess` function immediately to the value
 * - For **Failure effects**: Applies the `onFailure` function immediately to the error
 * - For **Pending effects**: Falls back to the regular `mapBoth` behavior
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // For resolved effects, the appropriate mapping is applied immediately
 * const success = Effect.succeed(5)
 * const mapped = Effect.mapBothEager(success, {
 *   onFailure: (err: string) => `Failed: ${err}`,
 *   onSuccess: (n: number) => n * 2
 * }) // onSuccess applied eagerly
 *
 * const failure = Effect.fail("error")
 * const mappedError = Effect.mapBothEager(failure, {
 *   onFailure: (err: string) => `Failed: ${err}`,
 *   onSuccess: (n: number) => n * 2
 * }) // onFailure applied eagerly
 * ```
 *
 * @since 4.0.0
 * @category Eager
 */
export const mapBothEager: {
  <E, E2, A, A2>(
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): <R>(self: Effect<A, E, R>) => Effect<A2, E2, R>
  <A, E, R, E2, A2>(
    self: Effect<A, E, R>,
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): Effect<A2, E2, R>
} = internal.mapBothEager

/**
 * An optimized version of `flatMap` that checks if an effect is already resolved
 * and applies the flatMap function eagerly when possible.
 *
 * **When to Use**
 *
 * `flatMapEager` provides better performance for effects that are already resolved
 * by applying the transformation immediately instead of deferring it through
 * the effect pipeline.
 *
 * **Behavior**
 *
 * - For **Success effects**: Applies the flatMap function immediately to the value
 * - For **Failure effects**: Returns the failure as-is without applying the flatMap
 * - For **Pending effects**: Falls back to the regular `flatMap` behavior
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // For resolved effects, the flatMap is applied immediately
 * const resolved = Effect.succeed(5)
 * const flatMapped = Effect.flatMapEager(resolved, (n) => Effect.succeed(n * 2)) // Applied eagerly
 *
 * // For pending effects, behaves like regular flatMap
 * const pending = Effect.delay(Effect.succeed(5), "100 millis")
 * const flatMappedPending = Effect.flatMapEager(
 *   pending,
 *   (n) => Effect.succeed(n * 2)
 * ) // Uses regular flatMap
 * ```
 *
 * @since 4.0.0
 * @category Eager
 */
export const flatMapEager: {
  <A, B, E2, R2>(f: (a: A) => Effect<B, E2, R2>): <E, R>(self: Effect<A, E, R>) => Effect<B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(self: Effect<A, E, R>, f: (a: A) => Effect<B, E2, R2>): Effect<B, E | E2, R | R2>
} = internal.flatMapEager

/**
 * An optimized version of `catch` that checks if an effect is already resolved
 * and applies the catch function eagerly when possible.
 *
 * **When to Use**
 *
 * `catchEager` provides better performance for effects that are already resolved
 * by applying the error recovery immediately instead of deferring it through
 * the effect pipeline.
 *
 * **Behavior**
 *
 * - For **Success effects**: Returns the success as-is (no error to catch)
 * - For **Failure effects**: Applies the catch function immediately to the error
 * - For **Pending effects**: Falls back to the regular `catch` behavior
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // For resolved failure effects, the catch function is applied immediately
 * const failed = Effect.fail("original error")
 * const recovered = Effect.catchEager(
 *   failed,
 *   (err: string) => Effect.succeed(`recovered from: ${err}`)
 * ) // Applied eagerly
 *
 * // For success effects, returns success as-is
 * const success = Effect.succeed(42)
 * const unchanged = Effect.catchEager(
 *   success,
 *   (err: string) => Effect.succeed(`recovered from: ${err}`)
 * ) // Returns success as-is
 *
 * // For pending effects, behaves like regular catch
 * const pending = Effect.delay(Effect.fail("error"), "100 millis")
 * const recoveredPending = Effect.catchEager(
 *   pending,
 *   (err: string) => Effect.succeed(`recovered from: ${err}`)
 * ) // Uses regular catch
 * ```
 *
 * @since 4.0.0
 * @category Eager
 */
export const catchEager: {
  <E, B, E2, R2>(
    f: (e: NoInfer<E>) => Effect<B, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | B, E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    f: (e: NoInfer<E>) => Effect<B, E2, R2>
  ): Effect<A | B, E2, R | R2>
} = internal.catchEager

/**
 * Creates untraced function effects with eager evaluation optimization.
 *
 * Executes generator functions eagerly when all yielded effects are synchronous,
 * stopping at the first async effect and deferring to normal execution.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const computation = Effect.fnUntracedEager(function*() {
 *   yield* Effect.succeed(1)
 *   yield* Effect.succeed(2)
 *   return "computed eagerly"
 * })
 *
 * const effect = computation() // Executed immediately if all effects are sync
 * ```
 *
 * @since 4.0.0
 * @category Eager
 */
export const fnUntracedEager: fn.Gen = internal.fnUntracedEager
