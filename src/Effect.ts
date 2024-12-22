/**
 * @since 2.0.0
 */
import type * as Arr from "./Array.js"
import type { Cause, Failure } from "./Cause.js"
import type { Context } from "./Context.js"
import type { Exit } from "./Exit.js"
import type { Fiber } from "./Fiber.js"
import type { LazyArg } from "./Function.js"
import type { TypeLambda } from "./HKT.js"
import * as core from "./internal/core.js"
import type { Option } from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import type { Predicate, Refinement } from "./Predicate.js"
import type { Scheduler } from "./Scheduler.js"
import type { Scope } from "./Scope.js"
import type { Concurrency, Covariant, NotFunction } from "./Types.js"
import type * as Unify from "./Unify.js"
import type { YieldWrap } from "./Utils.js"

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
export interface Effect<out A, out E = never, out R = never> extends Pipeable {
  readonly [TypeId]: Effect.Variance<A, E, R>
  [Symbol.iterator](): EffectIterator<Effect<A, E, R>>
  [Unify.typeSymbol]?: unknown
  [Unify.unifySymbol]?: EffectUnify<this>
  [Unify.ignoreSymbol]?: EffectUnifyIgnore
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
  export type Success<T> = T extends Effect<infer _A, infer _E, infer _R> ? _A : never

  /**
   * @since 2.0.0
   */
  export type Error<T> = T extends Effect<infer _A, infer _E, infer _R> ? _E : never

  /**
   * @since 2.0.0
   */
  export type Context<T> = T extends Effect<infer _A, infer _E, infer _R> ? _R : never
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
export interface EffectIterator<T extends Effect<any, any, any>> {
  next(
    ...args: ReadonlyArray<any>
  ): IteratorResult<YieldWrap<T>, Effect.Success<T>>
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
 * ```ts
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
 * and collect results as `Either` or `Option`.
 *
 * **The `mode` option**
 *
 * The `{ mode: "either" }` option changes the behavior of `Effect.all` to
 * ensure all effects run, even if some fail. Instead of stopping on the first
 * failure, this mode collects both successes and failures, returning an array
 * of `Either` instances where each result is either a `Right` (success) or a
 * `Left` (failure).
 *
 * Similarly, the `{ mode: "validate" }` option uses `Option` to indicate
 * success or failure. Each effect returns `None` for success and `Some` with
 * the error for failure.
 *
 * @see {@link forEach} for iterating over elements and applying an effect.
 * @see {@link allWith} for a data-last version of this function.
 *
 * @example
 * ```ts
 * // Title: Combining Effects in Tuples
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
 * @example
 * // Title: Combining Effects in Iterables
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
 *
 * @example
 * // Title: Combining Effects in Structs
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
 *
 * @example
 * // Title: Combining Effects in Records
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
 *
 * @example
 * // Title: Short-Circuiting Behavior
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
 *
 * @example
 * // Title: Collecting Results with `mode: "either"`
 * import { Effect, Console } from "effect"
 *
 * const effects = [
 *   Effect.succeed("Task1").pipe(Effect.tap(Console.log)),
 *   Effect.fail("Task2: Oh no!").pipe(Effect.tap(Console.log)),
 *   Effect.succeed("Task3").pipe(Effect.tap(Console.log))
 * ]
 *
 * const program = Effect.all(effects, { mode: "either" })
 *
 * Effect.runPromiseExit(program).then(console.log)
 * // Output:
 * // Task1
 * // Task3
 * // {
 * //   _id: 'Exit',
 * //   _tag: 'Success',
 * //   value: [
 * //     { _id: 'Either', _tag: 'Right', right: 'Task1' },
 * //     { _id: 'Either', _tag: 'Left', left: 'Task2: Oh no!' },
 * //     { _id: 'Either', _tag: 'Right', right: 'Task3' }
 * //   ]
 * // }
 *
 * @example
 * //Example: Collecting Results with `mode: "validate"`
 * import { Effect, Console } from "effect"
 *
 * const effects = [
 *   Effect.succeed("Task1").pipe(Effect.tap(Console.log)),
 *   Effect.fail("Task2: Oh no!").pipe(Effect.tap(Console.log)),
 *   Effect.succeed("Task3").pipe(Effect.tap(Console.log))
 * ]
 *
 * const program = Effect.all(effects, { mode: "validate" })
 *
 * Effect.runPromiseExit(program).then((result) => console.log("%o", result))
 * // Output:
 * // Task1
 * // Task3
 * // {
 * //   _id: 'Exit',
 * //   _tag: 'Failure',
 * //   cause: {
 * //     _id: 'Cause',
 * //     _tag: 'Fail',
 * //     failure: [
 * //       { _id: 'Option', _tag: 'None' },
 * //       { _id: 'Option', _tag: 'Some', value: 'Task2: Oh no!' },
 * //       { _id: 'Option', _tag: 'None' }
 * //     ]
 * //   }
 * // }
 *
 * @since 2.0.0
 * @category Collecting
 */
export const all: <
  const Arg extends Iterable<Effect<any, any, any>> | Record<string, Effect<any, any, any>>,
  O extends { readonly concurrency?: Concurrency | undefined; readonly discard?: boolean | undefined }
>(arg: Arg, options?: O) => All.Return<Arg, O> = core.all

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
    options?: {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: false | undefined
    } | undefined
  ): (
    self: S
  ) => Effect<Arr.ReadonlyArray.With<S, B>, E, R>
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
    options?: {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: false | undefined
    } | undefined
  ): Effect<Arr.ReadonlyArray.With<S, B>, E, R>
  <A, B, E, R>(
    self: Iterable<A>,
    f: (a: A, i: number) => Effect<B, E, R>,
    options: {
      readonly concurrency?: Concurrency | undefined
      readonly discard: true
    }
  ): Effect<void, E, R>
} = core.forEach as any

/**
 * @since 2.0.0
 * @category Collecting
 */
export const whileLoop: <A, E, R>(options: {
  readonly while: LazyArg<boolean>
  readonly body: LazyArg<Effect<A, E, R>>
  readonly step: (a: A) => void
}) => Effect<void, E, R> = core.whileLoop

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
) => Effect<A> = core.promise

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
export const succeed: <A>(value: A) => Effect<A> = core.succeed

/**
 * Returns an effect which succeeds with `None`.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const succeedNone: Effect<Option<never>> = core.succeedNone

/**
 * Returns an effect which succeeds with the value wrapped in a `Some`.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const succeedSome: <A>(value: A) => Effect<Option<A>> = core.succeedSome

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
) => Effect<A, E, R> = core.suspend

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
export const sync: <A>(thunk: LazyArg<A>) => Effect<A> = core.sync

const _void: Effect<void> = core.void
export {
  /**
   * @since 2.0.0
   * @category Creating Effects
   */
  _void as void
}

/**
 * Returns an effect that will never produce anything. The moral equivalent of
 * `while(true) {}`, only without the wasted CPU cycles.
 *
 * @since 2.0.0
 * @category Creating Effects
 */
export const never: Effect<never> = core.never

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
  <Eff extends YieldWrap<Effect<any, any, any>>, AEff>(
    f: () => Generator<Eff, AEff, never>
  ): Effect<
    AEff,
    [Eff] extends [never] ? never
      : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
      : never,
    [Eff] extends [never] ? never
      : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
      : never
  >
  <Self, Eff extends YieldWrap<Effect<any, any, any>>, AEff>(
    self: Self,
    f: (this: Self) => Generator<Eff, AEff, never>
  ): Effect<
    AEff,
    [Eff] extends [never] ? never
      : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
      : never,
    [Eff] extends [never] ? never
      : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
      : never
  >
} = core.gen

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
export const fail: <E>(error: E) => Effect<never, E> = core.fail

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const failSync: <E>(evaluate: LazyArg<E>) => Effect<never, E> = core.failSync

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const failCause: <E>(cause: Cause<E>) => Effect<never, E> = core.failCause

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const failCauseSync: <E>(
  evaluate: LazyArg<Cause<E>>
) => Effect<never, E> = core.failCauseSync

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
export const die: (defect: unknown) => Effect<never> = core.die

/**
 * @since 2.0.0
 * @category Creating Effects
 */
export const yieldNow: Effect<void> = core.yieldNow

// -----------------------------------------------------------------------------
// Mapping
// -----------------------------------------------------------------------------

/**
 * Chains effects to produce new `Effect` instances, useful for combining
 * operations that depend on previous results.
 *
 * **Syntax**
 * ```ts
 * const flatMappedEffect = pipe(myEffect, Effect.flatMap(transformation))
 * // or
 * const flatMappedEffect = Effect.flatMap(myEffect, transformation)
 * // or
 * const flatMappedEffect = myEffect.pipe(Effect.flatMap(transformation))
 * ```
 *
 * **When to Use**
 *
 * Use `flatMap` when you need to chain multiple effects, ensuring that each
 * step produces a new `Effect` while flattening any nested effects that may
 * occur.
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
 * @example
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
 * @since 2.0.0
 * @category Mapping
 */
export const flatMap: {
  <A, B, E1, R1>(
    f: (a: A) => Effect<B, E1, R1>
  ): <E, R>(self: Effect<A, E, R>) => Effect<B, E1 | E, R1 | R>
  <A, E, R, B, E1, R1>(
    self: Effect<A, E, R>,
    f: (a: A) => Effect<B, E1, R1>
  ): Effect<B, E | E1, R | R1>
} = core.flatMap

/**
 * Chains two actions, where the second action can depend on the result of the
 * first.
 *
 * **Syntax**
 * ```ts
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
 * - An `Effect`
 * - A function returning an `Effect` (similar to {@link flatMap})
 *
 * **Note:** `andThen` works well with both `Option` and `Either` types,
 * treating them as effects.
 *
 * @example
 * ```ts
 * // Title: Applying a Discount Based on Fetched Amount
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
 * @category Mapping
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
} = core.andThen

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
} = core.tap

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
 * @see {@link either} for a version that uses `Either` instead.
 *
 * @example
 * ```ts
 * import { Effect, Cause, Console, Exit } from "effect"
 *
 * // Simulating a runtime error
 * const task = Effect.dieMessage("Boom!")
 *
 * const program = Effect.gen(function* () {
 *   const exit = yield* Effect.exit(task)
 *   if (Exit.isFailure(exit)) {
 *     const cause = exit.cause
 *     if (
 *       Cause.isDieType(cause) &&
 *       Cause.isRuntimeException(cause.defect)
 *     ) {
 *       yield* Console.log(
 *         `RuntimeException defect caught: ${cause.defect.message}`
 *       )
 *     } else {
 *       yield* Console.log("Unknown failure caught.")
 *     }
 *   }
 * })
 *
 * // We get an Exit.Success because we caught all failures
 * Effect.runPromiseExit(program).then(console.log)
 * // Output:
 * // RuntimeException defect caught: Boom!
 * // {
 * //   _id: "Exit",
 * //   _tag: "Success",
 * //   value: undefined
 * // }
 * ```
 *
 * @since 2.0.0
 * @category Outcome Encapsulation
 */
export const exit: <A, E, R>(self: Effect<A, E, R>) => Effect<Exit<A, E>, never, R> = core.exit

/**
 * Transforms the value inside an effect by applying a function to it.
 *
 * **Syntax**
 *
 * ```ts
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
 * @see {@link mapError} for a version that operates on the error channel.
 * @see {@link mapBoth} for a version that operates on both channels.
 * @see {@link flatMap} or {@link andThen} for a version that can return a new effect.
 *
 * @example
 * ```ts
 * // Title: Adding a Service Charge
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
 * @since 2.0.0
 * @category Mapping
 */
export const map: {
  <A, B>(f: (a: A) => B): <E, R>(self: Effect<A, E, R>) => Effect<B, E, R>
  <A, E, R, B>(self: Effect<A, E, R>, f: (a: A) => B): Effect<B, E, R>
} = core.map

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
} = core.catch_

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
   * @example
   * ```ts
   * // Title: Providing Recovery Logic for Recoverable Errors
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
   * //      ┌─── Effect<string, HttpError | ValidationError, never>
   * //      ▼
   * const program = Effect.gen(function* () {
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
   * //      ┌─── Effect<string, never, never>
   * //      ▼
   * const recovered = program.pipe(
   *   Effect.catchAll((error) =>
   *     Effect.succeed(`Recovering from ${error._tag}`)
   *   )
   * )
   * ```
   *
   * @since 4.0.0
   * @category Error handling
   */
  catch_ as catch
}

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
 * @example
 * ```ts
 * // Title: Recovering from All Errors
 * import { Cause, Effect } from "effect"
 *
 * // Define an effect that may fail with a recoverable or unrecoverable error
 * const program = Effect.fail("Something went wrong!")
 *
 * // Recover from all errors by examining the cause
 * const recovered = program.pipe(
 *   Effect.catchAllCause((cause) =>
 *     Cause.isFailType(cause)
 *       ? Effect.succeed("Recovered from a regular error")
 *       : Effect.succeed("Recovered from a defect")
 *   )
 * )
 *
 * Effect.runPromise(recovered).then(console.log)
 * // Output: "Recovered from a regular error"
 * ```
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchCause: {
  <E, A2, E2, R2>(
    f: (cause: Cause<E>) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E2, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    f: (cause: Cause<E>) => Effect<A2, E2, R2>
  ): Effect<A | A2, E2, R | R2>
} = core.catchCause

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
 * @example
 * ```ts
 * // Title: Handling All Defects
 * import { Effect, Cause, Console } from "effect"
 *
 * // Simulating a runtime error
 * const task = Effect.dieMessage("Boom!")
 *
 * const program = Effect.catchAllDefect(task, (defect) => {
 *   if (Cause.isRuntimeException(defect)) {
 *     return Console.log(
 *       `RuntimeException defect caught: ${defect.message}`
 *     )
 *   }
 *   return Console.log("Unknown defect caught.")
 * })
 *
 * // We get an Exit.Success because we caught all defects
 * Effect.runPromiseExit(program).then(console.log)
 * // Output:
 * // RuntimeException defect caught: Boom!
 * // {
 * //   _id: "Exit",
 * //   _tag: "Success",
 * //   value: undefined
 * // }
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
} = core.catchDefect

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
 * @example
 * ```ts
 * // Title: Catching Specific Errors with a Predicate
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
 * //      ┌─── Effect<string, HttpError | ValidationError, never>
 * //      ▼
 * const program = Effect.gen(function* () {
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
 * //      ┌─── Effect<string, ValidationError, never>
 * //      ▼
 * const recovered = program.pipe(
 *   Effect.catchIf(
 *     // Only handle HttpError errors
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
    refinement: Refinement<NoInfer<E>, EB>,
    f: (e: EB) => Effect<A2, E2, R2>
  ): <A, R>(
    self: Effect<A, E, R>
  ) => Effect<A2 | A, E2 | Exclude<E, EB>, R2 | R>
  <E, A2, E2, R2>(
    predicate: Predicate<NoInfer<E>>,
    f: (e: NoInfer<E>) => Effect<A2, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A2 | A, E | E2, R2 | R>
  <A, E, R, EB extends E, A2, E2, R2>(
    self: Effect<A, E, R>,
    refinement: Refinement<E, EB>,
    f: (e: EB) => Effect<A2, E2, R2>
  ): Effect<A | A2, E2 | Exclude<E, EB>, R | R2>
  <A, E, R, A2, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate<E>,
    f: (e: E) => Effect<A2, E2, R2>
  ): Effect<A | A2, E | E2, R | R2>
} = core.catchIf

/**
 * Recovers from specific failures based on a predicate.
 *
 * @since 4.0.0
 * @category Error handling
 */
export const catchFailure: {
  <E, B, E2, R2, EB extends Failure<E>>(
    refinement: Refinement<Failure<E>, EB>,
    f: (failure: EB, cause: Cause<E>) => Effect<B, E2, R2>
  ): <A, R>(
    self: Effect<A, E, R>
  ) => Effect<A | B, Exclude<E, Failure.Error<EB>> | E2, R | R2>
  <E, B, E2, R2>(
    predicate: Predicate<Failure<NoInfer<E>>>,
    f: (failure: NoInfer<Failure<E>>, cause: Cause<E>) => Effect<B, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A | B, E | E2, R | R2>
  <A, E, R, B, E2, R2, EB extends Failure<E>>(
    self: Effect<A, E, R>,
    refinement: Refinement<Failure<E>, EB>,
    f: (failure: EB, cause: Cause<E>) => Effect<B, E2, R2>
  ): Effect<A | B, Exclude<E, Failure.Error<EB>> | E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Effect<A, E, R>,
    predicate: Predicate<Failure<NoInfer<E>>>,
    f: (failure: NoInfer<Failure<E>>, cause: Cause<E>) => Effect<B, E2, R2>
  ): Effect<A | B, E | E2, R | R2>
} = core.catchFailure

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
 * @category Mapping
 */
export const mapError: {
  <E, E2>(f: (e: E) => E2): <A, R>(self: Effect<A, E, R>) => Effect<A, E2, R>
  <A, E, R, E2>(self: Effect<A, E, R>, f: (e: E) => E2): Effect<A, E2, R>
} = core.mapError

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
  <A, E, R, X, E2, R2>(self: Effect<A, E, R>, f: (e: E) => Effect<X, E2, R2>): Effect<A, E | E2, R | R2>
} = core.tapError

/**
 * The `tapErrorCause` function allows you to inspect the complete cause
 * of an error, including failures and defects.
 *
 * This function is helpful when you need to log, monitor, or handle specific
 * error causes in your effects. It gives you access to the full error cause,
 * whether it’s a failure, defect, or other exceptional conditions, without
 * altering the error or the overall result of the effect.
 *
 * @example
 * ```ts
 * import { Effect, Console } from "effect"
 *
 * // Create a task that fails with a NetworkError
 * const task1: Effect.Effect<number, string> = Effect.fail("NetworkError")
 *
 * const tapping1 = Effect.tapErrorCause(task1, (cause) =>
 *   Console.log(`error cause: ${cause}`)
 * )
 *
 * Effect.runFork(tapping1)
 * // Output:
 * // error cause: Error: NetworkError
 *
 * // Simulate a severe failure in the system
 * const task2: Effect.Effect<number, string> = Effect.dieMessage(
 *   "Something went wrong"
 * )
 *
 * const tapping2 = Effect.tapErrorCause(task2, (cause) =>
 *   Console.log(`error cause: ${cause}`)
 * )
 *
 * Effect.runFork(tapping2)
 * // Output:
 * // error cause: RuntimeException: Something went wrong
 * //   ... stack trace ...
 * ```
 *
 * @since 2.0.0
 * @category sequencing
 */
export const tapCause: {
  <E, X, E2, R2>(
    f: (cause: Cause<NoInfer<E>>) => Effect<X, E2, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E | E2, R2 | R>
  <A, E, R, X, E2, R2>(
    self: Effect<A, E, R>,
    f: (cause: Cause<E>) => Effect<X, E2, R2>
  ): Effect<A, E | E2, R | R2>
} = core.tapCause

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
} = core.match

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
 * @example
 * ```ts
 * // Title: Handling Different Failure Causes
 * import { Effect } from "effect"
 *
 * const task: Effect.Effect<number, Error> = Effect.die("Uh oh!")
 *
 * const program = Effect.matchCause(task, {
 *   onFailure: (cause) => {
 *     switch (cause._tag) {
 *       case "Fail":
 *         // Handle standard failure
 *         return `Fail: ${cause.error.message}`
 *       case "Die":
 *         // Handle defects (unexpected errors)
 *         return `Die: ${cause.defect}`
 *       case "Interrupt":
 *         // Handle interruption
 *         return `${cause.fiberId} interrupted!`
 *     }
 *     // Fallback for other causes
 *     return "failed due to other causes"
 *   },
 *   onSuccess: (value) =>
 *     // task completes successfully
 *     `succeeded with ${value} value`
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output: "Die: Uh oh!"
 *
 * ```
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const matchCause: {
  <E, A2, A, A3>(options: {
    readonly onFailure: (cause: Cause<E>) => A2
    readonly onSuccess: (a: A) => A3
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause<E>) => A2
      readonly onSuccess: (a: A) => A3
    }
  ): Effect<A2 | A3, never, R>
} = core.matchCause

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
 * @example
 * ```ts
 * // Title: Handling Different Failure Causes with Side Effects
 * import { Effect, Console } from "effect"
 *
 * const task: Effect.Effect<number, Error> = Effect.die("Uh oh!")
 *
 * const program = Effect.matchCauseEffect(task, {
 *   onFailure: (cause) => {
 *     switch (cause._tag) {
 *       case "Fail":
 *         // Handle standard failure with a logged message
 *         return Console.log(`Fail: ${cause.error.message}`)
 *       case "Die":
 *         // Handle defects (unexpected errors) by logging the defect
 *         return Console.log(`Die: ${cause.defect}`)
 *       case "Interrupt":
 *         // Handle interruption and log the fiberId that was interrupted
 *         return Console.log(`${cause.fiberId} interrupted!`)
 *     }
 *     // Fallback for other causes
 *     return Console.log("failed due to other causes")
 *   },
 *   onSuccess: (value) =>
 *     // Log success if the task completes successfully
 *     Console.log(`succeeded with ${value} value`)
 * })
 *
 * Effect.runPromise(program)
 * // Output: "Die: Uh oh!"
 * ```
 *
 * @since 2.0.0
 * @category Pattern matching
 */
export const matchCauseEffect: {
  <E, A2, E2, R2, A, A3, E3, R3>(options: {
    readonly onFailure: (cause: Cause<E>) => Effect<A2, E2, R2>
    readonly onSuccess: (a: A) => Effect<A3, E3, R3>
  }): <R>(self: Effect<A, E, R>) => Effect<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Effect<A, E, R>,
    options: {
      readonly onFailure: (cause: Cause<E>) => Effect<A2, E2, R2>
      readonly onSuccess: (a: A) => Effect<A3, E3, R3>
    }
  ): Effect<A2 | A3, E2 | E3, R2 | R3 | R>
} = core.matchCauseEffect

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
} = core.matchEffect

// -----------------------------------------------------------------------------
// Environment
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category Environment
 */
export const context: <R>() => Effect<Context<R>, never, R> = core.context

/**
 * @since 2.0.0
 * @category Environment
 */
export const provideContext: {
  <XR>(
    context: Context<XR>
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, XR>>
  <A, E, R, XR>(
    self: Effect<A, E, R>,
    context: Context<XR>
  ): Effect<A, E, Exclude<R, XR>>
} = core.provideContext

// -----------------------------------------------------------------------------
// Resource management & finalization
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const scope: Effect<Scope, never, Scope> = core.scope

/**
 * Scopes all resources used in this workflow to the lifetime of the workflow,
 * ensuring that their finalizers are run as soon as this workflow completes
 * execution, whether by success, failure, or interruption.
 *
 * @since 2.0.0
 * @category scoping, resources & finalization
 */
export const scoped: <A, E, R>(
  effect: Effect<A, E, R>
) => Effect<A, E, Exclude<R, Scope>> = core.scoped

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
  release: (a: A, exit: Exit<unknown, unknown>) => Effect<unknown>
) => Effect<A, E, R | Scope> = core.acquireRelease

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
  release: (a: Resource, exit: Exit<A, E2>) => Effect<void, E3, R3>
) => Effect<A, E | E2 | E3, R | R2 | R3> = core.acquireUseRelease

/**
 * This function adds a finalizer to the scope of the calling `Effect` value.
 * The finalizer is guaranteed to be run when the scope is closed, and it may
 * depend on the `Exit` value that the scope is closed with.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const addFinalizer: (
  finalizer: (exit: Exit<unknown, unknown>) => Effect<void>
) => Effect<void, never, Scope> = core.addFinalizer

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
} = core.ensuring

/**
 * Runs the specified effect if this effect fails, providing the error to the
 * effect if it exists. The provided effect will not be interrupted.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const onError: {
  <E, X, R2>(
    cleanup: (cause: Cause<E>) => Effect<X, never, R2>
  ): <A, R>(self: Effect<A, E, R>) => Effect<A, E, R2 | R>
  <A, E, R, X, R2>(
    self: Effect<A, E, R>,
    cleanup: (cause: Cause<E>) => Effect<X, never, R2>
  ): Effect<A, E, R2 | R>
} = core.onError

/**
 * Ensures that a cleanup functions runs, whether this effect succeeds, fails,
 * or is interrupted.
 *
 * @since 2.0.0
 * @category Resource management & finalization
 */
export const onExit: {
  <A, E, X, R2>(
    cleanup: (exit: Exit<A, E>) => Effect<X, never, R2>
  ): <R>(self: Effect<A, E, R>) => Effect<A, E, R2 | R>
  <A, E, R, X, R2>(
    self: Effect<A, E, R>,
    cleanup: (exit: Exit<A, E>) => Effect<X, never, R2>
  ): Effect<A, E, R | R2>
} = core.onExit

// -----------------------------------------------------------------------------
// Interruption
// -----------------------------------------------------------------------------

/**
 * @since 2.0.0
 * @category Interruption
 */
export const interrupt: Effect<never> = core.interrupt

/**
 * @since 2.0.0
 * @category Interruption
 */
export const interruptible: <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R> = core.interruptible

/**
 * @since 2.0.0
 * @category Interruption
 */
export const onInterrupt: {
  <XE, XR>(finalizer: Effect<void, XE, XR>): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | XE, R | XR>
  <A, E, R, XE, XR>(self: Effect<A, E, R>, finalizer: Effect<void, XE, XR>): Effect<A, E | XE, R | XR>
} = core.onInterrupt

/**
 * @since 2.0.0
 * @category Interruption
 */
export const uninterruptible: <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R> = core.uninterruptible

/**
 * @since 2.0.0
 * @category Interruption
 */
export const uninterruptibleMask: <A, E, R>(
  f: (restore: <AX, EX, RX>(effect: Effect<AX, EX, RX>) => Effect<AX, EX, RX>) => Effect<A, E, R>
) => Effect<A, E, R> = core.uninterruptibleMask

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
export const unsafeMakeSemaphore: (permits: number) => Semaphore = core.unsafeMakeSemaphore

/**
 * Creates a new Semaphore
 *
 * @since 2.0.0
 * @category Semaphore
 */
export const makeSemaphore: (permits: number) => Effect<Semaphore> = core.makeSemaphore

// -----------------------------------------------------------------------------
// Latch
// -----------------------------------------------------------------------------

/**
 * @category Latch
 * @since 3.8.0
 */
export interface Latch {
  /** open the latch, releasing all fibers waiting on it */
  readonly open: Effect<void>
  /** release all fibers waiting on the latch, without opening it */
  readonly release: Effect<void>
  /** wait for the latch to be opened */
  readonly await: Effect<void>
  /** close the latch */
  readonly close: Effect<void>
  /** close the latch */
  readonly unsafeClose: () => void
  /** only run the given effect when the latch is open */
  readonly whenOpen: <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>
}

/**
 * @category Latch
 * @since 3.8.0
 */
export const unsafeMakeLatch: (open?: boolean | undefined) => Latch = core.unsafeMakeLatch

/**
 * @category latch
 * @since 3.8.0
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * Effect.gen(function*() {
 *   // Create a latch, starting in the closed state
 *   const latch = yield* Effect.makeLatch(false)
 *
 *   // Fork a fiber that logs "open sesame" when the latch is opened
 *   const fiber = yield* Effect.log("open sesame").pipe(
 *     latch.whenOpen,
 *     Effect.fork
 *   )
 *
 *   // Open the latch
 *   yield* latch.open
 *   yield* fiber.await
 * })
 * ```
 */
export const makeLatch: (open?: boolean | undefined) => Effect<Latch> = core.makeLatch

// -----------------------------------------------------------------------------
// Repetition & recursion
// -----------------------------------------------------------------------------

/**
 * Repeats this effect forever (until the first error).
 *
 * @since 2.0.0
 * @category repetition / recursion
 */
export const forever: <
  Args extends [self: Effect<any, any, any>, options?: { readonly autoYield?: boolean | undefined }] | [
    options?: { readonly autoYield?: boolean | undefined }
  ]
>(...args: Args) => [Args[0]] extends [Effect<infer _A, infer _E, infer _R>] ? Effect<never, _E, _R>
  : <A, E, R>(self: Effect<A, E, R>) => Effect<never, E, R> = core.forever

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
export const fork: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<Fiber<A, E>, never, R> = core.fork

/**
 * Forks the effect in the specified scope. The fiber will be interrupted
 * when the scope is closed.
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const forkIn: {
  (
    scope: Scope
  ): <A, E, R>(self: Effect<A, E, R>) => Effect<Fiber<A, E>, never, R>
  <A, E, R>(self: Effect<A, E, R>, scope: Scope): Effect<Fiber<A, E>, never, R>
} = core.forkIn

/**
 * Forks the fiber in a `Scope`, interrupting it when the scope is closed.
 *
 * @since 2.0.0
 * @category supervision & fibers
 */
export const forkScoped: <A, E, R>(
  self: Effect<A, E, R>
) => Effect<Fiber<A, E>, never, Scope | R> = core.forkScoped

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
) => Fiber<A, E> = core.runFork

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
) => Promise<A> = core.runPromise

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
) => Promise<Exit<A, E>> = core.runPromiseExit

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
export const runSync: <A, E>(effect: Effect<A, E>) => A = core.runSync

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
export const runSyncExit: <A, E>(effect: Effect<A, E>) => Exit<A, E> = core.runSyncExit

// -----------------------------------------------------------------------------
// Function
// -----------------------------------------------------------------------------

/**
 * @since 3.12.0
 * @category Function
 */
export namespace fn {
  /**
   * @since 3.12.0
   * @category Function
   */
  export interface Gen {
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>
    ): (
      ...args: Args
    ) => Effect<
      AEff,
      [Eff] extends [never] ? never
        : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
        : never,
      [Eff] extends [never] ? never
        : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
        : never
    >
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A extends Effect<any, any, any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
            : never
        >
      ) => A
    ): (...args: Args) => A
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
      AEff,
      Args extends Array<any>,
      A,
      B extends Effect<any, any, any>
    >(
      body: (...args: Args) => Generator<Eff, AEff, never>,
      a: (
        _: Effect<
          AEff,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
            : never
        >
      ) => A,
      b: (_: A) => B
    ): (...args: Args) => B
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
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
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
            : never
        >
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C
    ): (...args: Args) => C
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
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
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
            : never
        >
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D
    ): (...args: Args) => D
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
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
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
            : never
        >
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
      e: (_: D) => E
    ): (...args: Args) => E
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
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
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
            : never
        >
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
      e: (_: D) => E,
      f: (_: E) => F
    ): (...args: Args) => F
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
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
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
            : never
        >
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
      e: (_: D) => E,
      f: (_: E) => F,
      g: (_: F) => G
    ): (...args: Args) => G
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
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
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
            : never
        >
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
      e: (_: D) => E,
      f: (_: E) => F,
      g: (_: F) => G,
      h: (_: G) => H
    ): (...args: Args) => H
    <
      Eff extends YieldWrap<Effect<any, any, any>>,
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
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer E, infer _R>>] ? E
            : never,
          [Eff] extends [never] ? never
            : [Eff] extends [YieldWrap<Effect<infer _A, infer _E, infer R>>] ? R
            : never
        >
      ) => A,
      b: (_: A) => B,
      c: (_: B) => C,
      d: (_: C) => D,
      e: (_: D) => E,
      f: (_: E) => F,
      g: (_: F) => G,
      h: (_: G) => H,
      i: (_: H) => I
    ): (...args: Args) => I
  }

  /**
   * @since 3.11.0
   * @category models
   */
  export interface NonGen {
    <Eff extends Effect<any, any, any>, Args extends Array<any>>(
      body: (...args: Args) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, D, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => Eff
    ): (...args: Args) => Eff
    <Eff extends Effect<any, any, any>, A, B, C, D, E, Args extends Array<any>>(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => E,
      e: (_: E) => Eff
    ): (...args: Args) => Eff
    <
      Eff extends Effect<any, any, any>,
      A,
      B,
      C,
      D,
      E,
      F,
      Args extends Array<any>
    >(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => E,
      e: (_: E) => F,
      f: (_: E) => Eff
    ): (...args: Args) => Eff
    <
      Eff extends Effect<any, any, any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      Args extends Array<any>
    >(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => E,
      e: (_: E) => F,
      f: (_: E) => G,
      g: (_: G) => Eff
    ): (...args: Args) => Eff
    <
      Eff extends Effect<any, any, any>,
      A,
      B,
      C,
      D,
      E,
      F,
      G,
      H,
      Args extends Array<any>
    >(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => E,
      e: (_: E) => F,
      f: (_: E) => G,
      g: (_: G) => H,
      h: (_: H) => Eff
    ): (...args: Args) => Eff
    <
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
      Args extends Array<any>
    >(
      body: (...args: Args) => A,
      a: (_: A) => B,
      b: (_: B) => C,
      c: (_: C) => D,
      d: (_: D) => E,
      e: (_: E) => F,
      f: (_: E) => G,
      g: (_: G) => H,
      h: (_: H) => I,
      i: (_: H) => Eff
    ): (...args: Args) => Eff
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
export const fnUntraced: fn.Gen = core.fnUntraced
