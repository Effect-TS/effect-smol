/**
 * This module provides utilities for working with `Deferred`, a powerful concurrency
 * primitive that represents an asynchronous variable that can be set exactly once.
 * Multiple fibers can await the same `Deferred` and will all be notified when it
 * completes.
 *
 * A `Deferred<A, E>` can be:
 * - **Completed successfully** with a value of type `A`
 * - **Failed** with an error of type `E`
 * - **Interrupted** if the fiber setting it is interrupted
 *
 * Key characteristics:
 * - **Single assignment**: Can only be completed once
 * - **Multiple waiters**: Many fibers can await the same `Deferred`
 * - **Fiber-safe**: Thread-safe operations across concurrent fibers
 * - **Composable**: Works seamlessly with other Effect operations
 *
 * @example
 * ```ts
 * import { Deferred, Effect, Fiber } from "effect"
 *
 * // Basic usage: coordinate between fibers
 * const program = Effect.gen(function* () {
 *   const deferred = yield* Deferred.make<string, never>()
 *
 *   // Fiber 1: waits for the value
 *   const waiter = yield* Effect.fork(
 *     Effect.gen(function* () {
 *       const value = yield* Deferred.await(deferred)
 *       console.log("Received:", value)
 *       return value
 *     })
 *   )
 *
 *   // Fiber 2: sets the value after a delay
 *   const setter = yield* Effect.fork(
 *     Effect.gen(function* () {
 *       yield* Effect.sleep("1 second")
 *       yield* Deferred.succeed(deferred, "Hello from setter!")
 *     })
 *   )
 *
 *   // Wait for both fibers
 *   yield* Fiber.join(waiter)
 *   yield* Fiber.join(setter)
 * })
 *
 * // Producer-consumer pattern
 * const producerConsumer = Effect.gen(function* () {
 *   const buffer = yield* Deferred.make<number[], never>()
 *
 *   const producer = Effect.gen(function* () {
 *     const data = [1, 2, 3, 4, 5]
 *     yield* Deferred.succeed(buffer, data)
 *   })
 *
 *   const consumer = Effect.gen(function* () {
 *     const data = yield* Deferred.await(buffer)
 *     return data.reduce((sum, n) => sum + n, 0)
 *   })
 *
 *   const [, result] = yield* Effect.all([producer, consumer])
 *   return result // 15
 * })
 * ```
 *
 * @since 2.0.0
 */
import * as Cause from "./Cause.js"
import type { Effect, EffectUnify, EffectUnifyIgnore, Latch } from "./Effect.js"
import * as Exit from "./Exit.js"
import { dual, identity, type LazyArg } from "./Function.js"
import * as core from "./internal/core.js"
import * as internalEffect from "./internal/effect.js"
import * as Option from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { pipeArguments } from "./Pipeable.js"
import type * as Types from "./Types.js"
import type * as Unify from "./Unify.js"

/**
 * @example
 * ```ts
 * import { Deferred } from "effect"
 *
 * // TypeId can be used to identify Deferred instances
 * const deferred = Deferred.unsafeMake<number>()
 * console.log(deferred[Deferred.TypeId]) // { _A: [Function: identity], _E: [Function: identity] }
 * console.log(Deferred.TypeId) // "~effect/Deferred"
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/Deferred"

/**
 * @example
 * ```ts
 * import { Deferred } from "effect"
 *
 * // TypeId is a type-level identifier for Deferred instances
 * type DeferredTypeId = Deferred.TypeId // "~effect/Deferred"
 *
 * // It can be used in type guards or type-level operations
 * function isDeferredTypeId(value: string): value is Deferred.TypeId {
 *   return value === "~effect/Deferred"
 * }
 * ```
 *
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = "~effect/Deferred"

/**
 * A `Deferred` represents an asynchronous variable that can be set exactly
 * once, with the ability for an arbitrary number of fibers to suspend (by
 * calling `Deferred.await`) and automatically resume when the variable is set.
 *
 * `Deferred` can be used for building primitive actions whose completions
 * require the coordinated action of multiple fibers, and for building
 * higher-level concurrent or asynchronous structures.
 *
 * @example
 * ```ts
 * import { Deferred, Effect, Fiber } from "effect"
 *
 * // Create and use a Deferred for inter-fiber communication
 * const program = Effect.gen(function* () {
 *   // Create a Deferred that will hold a string value
 *   const deferred: Deferred.Deferred<string> = yield* Deferred.make<string>()
 *
 *   // Fork a fiber that will set the deferred value
 *   const producer = yield* Effect.fork(
 *     Effect.gen(function* () {
 *       yield* Effect.sleep("100 millis")
 *       yield* Deferred.succeed(deferred, "Hello, World!")
 *     })
 *   )
 *
 *   // Fork a fiber that will await the deferred value
 *   const consumer = yield* Effect.fork(
 *     Effect.gen(function* () {
 *       const value = yield* Deferred.await(deferred)
 *       console.log("Received:", value)
 *       return value
 *     })
 *   )
 *
 *   // Wait for both fibers to complete
 *   yield* Fiber.join(producer)
 *   const result = yield* Fiber.join(consumer)
 *   return result
 * })
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Deferred<in out A, in out E = never> extends Deferred.Variance<A, E>, Pipeable {
  /** @internal */
  effect?: Effect<A, E>
  /** @internal */
  latch?: Latch | undefined
  readonly [Unify.typeSymbol]?: unknown
  readonly [Unify.unifySymbol]?: DeferredUnify<this>
  readonly [Unify.ignoreSymbol]?: DeferredUnifyIgnore
}

/**
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * // DeferredUnify is used internally for type-level operations
 * // It helps with unifying Deferred types in complex type operations
 * // Example of the interface structure (used internally by the type system)
 * type DeferredUnifyStructure = {
 *   Deferred?: () => Deferred.Deferred<any, any>
 * }
 *
 * // This interface extends EffectUnify to provide Deferred-specific unification
 * declare const unifyExample: DeferredUnifyStructure
 * ```
 *
 * @category models
 * @since 3.8.0
 */
export interface DeferredUnify<A extends { [Unify.typeSymbol]?: any }> extends EffectUnify<A> {
  Deferred?: () => Extract<A[Unify.typeSymbol], Deferred<any, any>>
}

/**
 * @example
 * ```ts
 * import { Deferred } from "effect"
 *
 * // DeferredUnifyIgnore specifies which types to ignore during unification
 * // It extends EffectUnifyIgnore and specifically ignores Effect types
 * type IgnoreConfig = Deferred.DeferredUnifyIgnore
 *
 * // This configuration is used internally by the type system
 * // to control which types participate in unification operations
 * declare const ignoreExample: IgnoreConfig
 * ```
 *
 * @category models
 * @since 3.8.0
 */
export interface DeferredUnifyIgnore extends EffectUnifyIgnore {
  Effect?: true
}

/**
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * // The Deferred namespace contains types and interfaces related to Deferred
 *
 * // Example usage with the namespace types
 * const program = Effect.gen(function* () {
 *   const deferred: Deferred.Deferred<string, Error> = yield* Deferred.make<string, Error>()
 *   yield* Deferred.succeed(deferred, "namespace example")
 *   return yield* Deferred.await(deferred)
 * })
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export declare namespace Deferred {
  /**
   * @example
   * ```ts
   * import { Deferred } from "effect"
   *
   * // Variance interface defines the type variance for Deferred
   * // It specifies how the type parameters A and E behave in subtyping
   * // The variance information is used internally by TypeScript
   * // to ensure type safety with respect to covariance and contravariance
   * type VarianceExample = {
   *   readonly [Deferred.TypeId]: {
   *     readonly _A: unknown
   *     readonly _E: unknown
   *   }
   * }
   * ```
   *
   * @since 2.0.0
   * @category models
   */
  export interface Variance<in out A, in out E> {
    readonly [TypeId]: {
      readonly _A: Types.Invariant<A>
      readonly _E: Types.Invariant<E>
    }
  }
}

const DeferredProto = {
  [TypeId]: {
    _A: identity,
    _E: identity
  },
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * Unsafely creates a new `Deferred` from the specified `FiberId`.
 *
 * @example
 * ```ts
 * import { Deferred } from "effect"
 *
 * const deferred = Deferred.unsafeMake<number>()
 * console.log(deferred)
 * ```
 *
 * @since 2.0.0
 * @category unsafe
 */
export const unsafeMake = <A, E = never>(): Deferred<A, E> => {
  const self = Object.create(DeferredProto)
  self.latch = undefined
  self.effect = undefined
  return self
}

/**
 * Creates a new `Deferred`.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   yield* Deferred.succeed(deferred, 42)
 *   const value = yield* Deferred.await(deferred)
 *   console.log(value) // 42
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make = <A, E = never>(): Effect<Deferred<A, E>> => internalEffect.sync(() => unsafeMake())

const _await = <A, E>(self: Deferred<A, E>): Effect<A, E> =>
  internalEffect.suspend(() => {
    if (self.effect) return self.effect
    self.latch ??= internalEffect.unsafeMakeLatch(false)
    return internalEffect.flatMap(self.latch.await, () => self.effect!)
  })

export {
  /**
   * Retrieves the value of the `Deferred`, suspending the fiber running the
   * workflow until the result is available.
   *
   * @example
   * ```ts
   * import { Deferred, Effect } from "effect"
   *
   * const program = Effect.gen(function*() {
   *   const deferred = yield* Deferred.make<number>()
   *   yield* Deferred.succeed(deferred, 42)
   *
   *   const value = yield* Deferred.await(deferred)
   *   console.log(value) // 42
   * })
   * ```
   *
   * @since 2.0.0
   * @category getters
   */
  _await as await
}

/**
 * Completes the deferred with the result of the specified effect. If the
 * deferred has already been completed, the method will produce false.
 *
 * Note that `Deferred.completeWith` will be much faster, so consider using
 * that if you do not need to memoize the result of the specified effect.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   const completed = yield* Deferred.complete(deferred, Effect.succeed(42))
 *   console.log(completed) // true
 *
 *   const value = yield* Deferred.await(deferred)
 *   console.log(value) // 42
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const complete: {
  <A, E, R>(effect: Effect<A, E, R>): (self: Deferred<A, E>) => Effect<boolean, never, R>
  <A, E, R>(self: Deferred<A, E>, effect: Effect<A, E, R>): Effect<boolean, never, R>
} = dual(
  2,
  <A, E, R>(self: Deferred<A, E>, effect: Effect<A, E, R>): Effect<boolean, never, R> =>
    internalEffect.suspend(() => self.effect ? internalEffect.succeed(false) : into(effect, self))
)

/**
 * Completes the deferred with the result of the specified effect. If the
 * deferred has already been completed, the method will produce false.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   const completed = yield* Deferred.completeWith(deferred, Effect.succeed(42))
 *   console.log(completed) // true
 *
 *   const value = yield* Deferred.await(deferred)
 *   console.log(value) // 42
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const completeWith: {
  <A, E>(effect: Effect<A, E>): (self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, effect: Effect<A, E>): Effect<boolean>
} = dual(
  2,
  <A, E>(self: Deferred<A, E>, effect: Effect<A, E>): Effect<boolean> =>
    internalEffect.sync(() => unsafeDone(self, effect))
)

/**
 * Exits the `Deferred` with the specified `Exit` value, which will be
 * propagated to all fibers waiting on the value of the `Deferred`.
 *
 * @example
 * ```ts
 * import { Deferred, Effect, Exit } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   yield* Deferred.done(deferred, Exit.succeed(42))
 *
 *   const value = yield* Deferred.await(deferred)
 *   console.log(value) // 42
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const done: {
  <A, E>(exit: Exit.Exit<A, E>): (self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, exit: Exit.Exit<A, E>): Effect<boolean>
} = completeWith as any

/**
 * Fails the `Deferred` with the specified error, which will be propagated to
 * all fibers waiting on the value of the `Deferred`.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number, string>()
 *   const success = yield* Deferred.fail(deferred, "Operation failed")
 *   console.log(success) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const fail: {
  <E>(error: E): <A>(self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, error: E): Effect<boolean>
} = dual(2, <A, E>(self: Deferred<A, E>, error: E): Effect<boolean> => done(self, Exit.fail(error)))

/**
 * Fails the `Deferred` with the specified error, which will be propagated to
 * all fibers waiting on the value of the `Deferred`.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number, string>()
 *   const success = yield* Deferred.failSync(deferred, () => "Lazy error")
 *   console.log(success) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const failSync: {
  <E>(evaluate: LazyArg<E>): <A>(self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, evaluate: LazyArg<E>): Effect<boolean>
} = dual(
  2,
  <A, E>(self: Deferred<A, E>, evaluate: LazyArg<E>): Effect<boolean> =>
    internalEffect.suspend(() => fail(self, evaluate()))
)

/**
 * Fails the `Deferred` with the specified `Cause`, which will be propagated to
 * all fibers waiting on the value of the `Deferred`.
 *
 * @example
 * ```ts
 * import { Deferred, Effect, Cause } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number, string>()
 *   const success = yield* Deferred.failCause(deferred, Cause.fail("Operation failed"))
 *   console.log(success) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const failCause: {
  <E>(cause: Cause.Cause<E>): <A>(self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, cause: Cause.Cause<E>): Effect<boolean>
} = dual(
  2,
  <A, E>(self: Deferred<A, E>, cause: Cause.Cause<E>): Effect<boolean> => done(self, Exit.failCause(cause))
)

/**
 * Fails the `Deferred` with the specified `Cause`, which will be propagated to
 * all fibers waiting on the value of the `Deferred`.
 *
 * @example
 * ```ts
 * import { Deferred, Effect, Cause } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number, string>()
 *   const success = yield* Deferred.failCauseSync(deferred, () => Cause.fail("Lazy error"))
 *   console.log(success) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const failCauseSync: {
  <E>(evaluate: LazyArg<Cause.Cause<E>>): <A>(self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, evaluate: LazyArg<Cause.Cause<E>>): Effect<boolean>
} = dual(
  2,
  <A, E>(self: Deferred<A, E>, evaluate: LazyArg<Cause.Cause<E>>): Effect<boolean> =>
    internalEffect.suspend(() => failCause(self, evaluate()))
)

/**
 * Kills the `Deferred` with the specified defect, which will be propagated to
 * all fibers waiting on the value of the `Deferred`.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   const success = yield* Deferred.die(deferred, new Error("Something went wrong"))
 *   console.log(success) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const die: {
  (defect: unknown): <A, E>(self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, defect: unknown): Effect<boolean>
} = dual(2, <A, E>(self: Deferred<A, E>, defect: unknown): Effect<boolean> => done(self, Exit.die(defect)))

/**
 * Kills the `Deferred` with the specified defect, which will be propagated to
 * all fibers waiting on the value of the `Deferred`.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   const success = yield* Deferred.dieSync(deferred, () => new Error("Lazy error"))
 *   console.log(success) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const dieSync: {
  (evaluate: LazyArg<unknown>): <A, E>(self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, evaluate: LazyArg<unknown>): Effect<boolean>
} = dual(
  2,
  <A, E>(self: Deferred<A, E>, evaluate: LazyArg<unknown>): Effect<boolean> =>
    internalEffect.suspend(() => die(self, evaluate()))
)

/**
 * Completes the `Deferred` with interruption. This will interrupt all fibers
 * waiting on the value of the `Deferred` with the `FiberId` of the fiber
 * calling this method.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   const success = yield* Deferred.interrupt(deferred)
 *   console.log(success) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const interrupt = <A, E>(self: Deferred<A, E>): Effect<boolean> =>
  core.withFiber((fiber) => interruptWith(self, fiber.id))

/**
 * Completes the `Deferred` with interruption. This will interrupt all fibers
 * waiting on the value of the `Deferred` with the specified `FiberId`.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   const success = yield* Deferred.interruptWith(deferred, 42)
 *   console.log(success) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const interruptWith: {
  (fiberId: number): <A, E>(self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, fiberId: number): Effect<boolean>
} = dual(
  2,
  <A, E>(self: Deferred<A, E>, fiberId: number): Effect<boolean> => failCause(self, Cause.interrupt(fiberId))
)

/**
 * Returns `true` if this `Deferred` has already been completed with a value or
 * an error, `false` otherwise.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   const beforeCompletion = yield* Deferred.isDone(deferred)
 *   console.log(beforeCompletion) // false
 *
 *   yield* Deferred.succeed(deferred, 42)
 *   const afterCompletion = yield* Deferred.isDone(deferred)
 *   console.log(afterCompletion) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const isDone = <A, E>(self: Deferred<A, E>): Effect<boolean> =>
  internalEffect.sync(() => self.effect !== undefined)

/**
 * Returns a `Some<Effect<A, E, R>>` from the `Deferred` if this `Deferred` has
 * already been completed, `None` otherwise.
 *
 * @example
 * ```ts
 * import { Deferred, Effect, Option } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   const beforeCompletion = yield* Deferred.poll(deferred)
 *   console.log(Option.isNone(beforeCompletion)) // true
 *
 *   yield* Deferred.succeed(deferred, 42)
 *   const afterCompletion = yield* Deferred.poll(deferred)
 *   console.log(Option.isSome(afterCompletion)) // true
 * })
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const poll = <A, E>(
  self: Deferred<A, E>
): Effect<Option.Option<Effect<A, E>>> => internalEffect.sync(() => Option.fromNullable(self.effect))

/**
 * Completes the `Deferred` with the specified value.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   yield* Deferred.succeed(deferred, 42)
 *
 *   const value = yield* Deferred.await(deferred)
 *   console.log(value) // 42
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const succeed: {
  <A>(value: A): <E>(self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, value: A): Effect<boolean>
} = dual(2, <A, E>(self: Deferred<A, E>, value: A): Effect<boolean> => done(self, Exit.succeed(value)))

/**
 * Completes the `Deferred` with the specified lazily evaluated value.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const deferred = yield* Deferred.make<number>()
 *   yield* Deferred.sync(deferred, () => 42)
 *
 *   const value = yield* Deferred.await(deferred)
 *   console.log(value) // 42
 * })
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const sync: {
  <A>(evaluate: LazyArg<A>): <E>(self: Deferred<A, E>) => Effect<boolean>
  <A, E>(self: Deferred<A, E>, evaluate: LazyArg<A>): Effect<boolean>
} = dual(
  2,
  <A, E>(self: Deferred<A, E>, evaluate: LazyArg<A>): Effect<boolean> =>
    internalEffect.suspend(() => succeed(self, evaluate()))
)

/**
 * Unsafely exits the `Deferred` with the specified `Exit` value, which will be
 * propagated to all fibers waiting on the value of the `Deferred`.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * const deferred = Deferred.unsafeMake<number>()
 * const success = Deferred.unsafeDone(deferred, Effect.succeed(42))
 * console.log(success) // true
 * ```
 *
 * @since 2.0.0
 * @category unsafe
 */
export const unsafeDone = <A, E>(self: Deferred<A, E>, effect: Effect<A, E>): boolean => {
  if (self.effect) return false
  self.effect = effect
  if (self.latch) {
    self.latch.unsafeOpen()
    self.latch = undefined
  }
  return true
}

/**
 * Converts an `Effect` into an operation that completes a `Deferred` with its result.
 *
 * **Details**
 *
 * The `into` function takes an effect and a `Deferred` and ensures that the `Deferred`
 * is completed based on the outcome of the effect. If the effect succeeds, the `Deferred` is
 * completed with the success value. If the effect fails, the `Deferred` is completed with the
 * failure. Additionally, if the effect is interrupted, the `Deferred` will also be interrupted.
 *
 * @example
 * ```ts
 * import { Deferred, Effect } from "effect"
 *
 * // Define an effect that succeeds
 * const successEffect = Effect.succeed(42)
 *
 * const program = Effect.gen(function*() {
 *   // Create a deferred
 *   const deferred = yield* Deferred.make<number, string>()
 *
 *   // Complete the deferred using the successEffect
 *   const isCompleted = yield* Deferred.into(successEffect, deferred)
 *
 *   // Access the value of the deferred
 *   const value = yield* Deferred.await(deferred)
 *   console.log(value)
 *
 *   return isCompleted
 * })
 *
 * Effect.runPromise(program).then(console.log)
 * // Output:
 * // 42
 * // true
 * ```
 *
 * @since 2.0.0
 * @category Synchronization Utilities
 */
export const into: {
  <A, E>(deferred: Deferred<A, E>): <R>(self: Effect<A, E, R>) => Effect<boolean, never, R>
  <A, E, R>(self: Effect<A, E, R>, deferred: Deferred<A, E>): Effect<boolean, never, R>
} = dual(
  2,
  <A, E, R>(self: Effect<A, E, R>, deferred: Deferred<A, E>): Effect<boolean, never, R> =>
    internalEffect.uninterruptibleMask((restore) =>
      internalEffect.flatMap(
        internalEffect.exit(restore(self)),
        (exit) => done(deferred, exit)
      )
    )
)
