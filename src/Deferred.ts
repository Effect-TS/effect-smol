/**
 * @since 2.0.0
 */
import * as Cause from "./Cause.ts"
import type { Effect, EffectUnify, EffectUnifyIgnore, Latch } from "./Effect.ts"
import * as Exit from "./Exit.ts"
import { dual, identity, type LazyArg } from "./Function.ts"
import * as core from "./internal/core.ts"
import * as internalEffect from "./internal/effect.ts"
import * as Option from "./Option.ts"
import type { Pipeable } from "./Pipeable.ts"
import { pipeArguments } from "./Pipeable.ts"
import type * as Types from "./Types.ts"
import type * as Unify from "./Unify.ts"

/**
 * @since 2.0.0
 * @category symbols
 */
export const DeferredTypeId: unique symbol = Symbol.for("effect/Deferred")

/**
 * @since 2.0.0
 * @category symbols
 */
export type DeferredTypeId = typeof DeferredTypeId

/**
 * A `Deferred` represents an asynchronous variable that can be set exactly
 * once, with the ability for an arbitrary number of fibers to suspend (by
 * calling `Deferred.await`) and automatically resume when the variable is set.
 *
 * `Deferred` can be used for building primitive actions whose completions
 * require the coordinated action of multiple fibers, and for building
 * higher-level concurrent or asynchronous structures.
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
 * @category models
 * @since 3.8.0
 */
export interface DeferredUnify<A extends { [Unify.typeSymbol]?: any }> extends EffectUnify<A> {
  Deferred?: () => Extract<A[Unify.typeSymbol], Deferred<any, any>>
}

/**
 * @category models
 * @since 3.8.0
 */
export interface DeferredUnifyIgnore extends EffectUnifyIgnore {
  Effect?: true
}

/**
 * @since 2.0.0
 */
export declare namespace Deferred {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<in out A, in out E> {
    readonly [DeferredTypeId]: {
      readonly _A: Types.Invariant<A>
      readonly _E: Types.Invariant<E>
    }
  }
}

const DeferredProto = {
  [DeferredTypeId]: {
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
 * @since 2.0.0
 * @category utils
 */
export const interrupt = <A, E>(self: Deferred<A, E>): Effect<boolean> =>
  core.withFiber((fiber) => interruptWith(self, fiber.id))

/**
 * Completes the `Deferred` with interruption. This will interrupt all fibers
 * waiting on the value of the `Deferred` with the specified `FiberId`.
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
 * @since 2.0.0
 * @category getters
 */
export const isDone = <A, E>(self: Deferred<A, E>): Effect<boolean> =>
  internalEffect.sync(() => self.effect !== undefined)

/**
 * Returns a `Some<Effect<A, E, R>>` from the `Deferred` if this `Deferred` has
 * already been completed, `None` otherwise.
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
