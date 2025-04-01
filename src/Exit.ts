/**
 * @since 2.0.0
 */
import type * as Cause from "./Cause.ts"
import type * as Effect from "./Effect.ts"
import * as core from "./internal/core.ts"
import * as effect from "./internal/effect.ts"
import type { NoInfer } from "./Types.ts"

/**
 * @since 2.0.0
 * @category type ids
 */
export const TypeId: unique symbol = core.ExitTypeId

/**
 * @since 2.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * The `Exit` type is used to represent the result of a `Effect` computation. It
 * can either be successful, containing a value of type `A`, or it can fail,
 * containing an error of type `E` wrapped in a `EffectCause`.
 *
 * @since 2.0.0
 * @category models
 */
export type Exit<A, E = never> = Success<A, E> | Failure<A, E>

/**
 * @since 2.0.0
 * @category models
 */
export declare namespace Exit {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Proto<out A, out E = never> extends Effect.Effect<A, E> {
    readonly [TypeId]: TypeId
  }
}

/**
 * @since 2.0.0
 * @category models
 */
export interface Success<out A, out E> extends Exit.Proto<A, E> {
  readonly _tag: "Success"
  readonly value: A
}

/**
 * @since 2.0.0
 * @category models
 */
export interface Failure<out A, out E> extends Exit.Proto<A, E> {
  readonly _tag: "Failure"
  readonly cause: Cause.Cause<E>
}

/**
 * @since 2.0.0
 * @category guards
 */
export const isExit: (u: unknown) => u is Exit<unknown, unknown> = core.isExit

/**
 * @since 2.0.0
 * @category constructors
 */
export const succeed: <A>(a: A) => Exit<A> = core.exitSucceed

/**
 * @since 2.0.0
 * @category constructors
 */
export const failCause: <E>(cause: Cause.Cause<E>) => Exit<never, E> = core.exitFailCause

/**
 * @since 2.0.0
 * @category constructors
 */
export const fail: <E>(e: E) => Exit<never, E> = core.exitFail

/**
 * @since 2.0.0
 * @category constructors
 */
export const die: (defect: unknown) => Exit<never> = core.exitDie

/**
 * @since 2.0.0
 * @category constructors
 */
export const interrupt: (fiberId: number) => Exit<never> = effect.exitInterrupt

const void_: Exit<void> = effect.exitVoid
export {
  /**
   * @since 2.0.0
   * @category constructors
   */
  void_ as void
}

/**
 * @since 2.0.0
 * @category guards
 */
export const isSuccess: <A, E>(self: Exit<A, E>) => self is Success<A, E> = effect.exitIsSuccess

/**
 * @since 2.0.0
 * @category guards
 */
export const isFailure: <A, E>(self: Exit<A, E>) => self is Failure<A, E> = effect.exitIsFailure

/**
 * @since 4.0.0
 * @category guards
 */
export const hasFail: <A, E>(self: Exit<A, E>) => self is Failure<A, E> = effect.exitHasFail

/**
 * @since 4.0.0
 * @category guards
 */
export const hasDie: <A, E>(self: Exit<A, E>) => self is Failure<A, E> = effect.exitHasDie

/**
 * @since 4.0.0
 * @category guards
 */
export const hasInterrupt: <A, E>(self: Exit<A, E>) => self is Failure<A, E> = effect.exitHasInterrupt

/**
 * @since 2.0.0
 * @category pattern matching
 */
export const match: {
  <A, E, X1, X2>(options: {
    readonly onSuccess: (a: NoInfer<A>) => X1
    readonly onFailure: (cause: Cause.Cause<NoInfer<E>>) => X2
  }): (self: Exit<A, E>) => X1 | X2
  <A, E, X1, X2>(
    self: Exit<A, E>,
    options: {
      readonly onSuccess: (a: A) => X1
      readonly onFailure: (cause: Cause.Cause<E>) => X2
    }
  ): X1 | X2
} = effect.exitMatch

/**
 * @since 2.0.0
 * @category combinators
 */
export const asVoid: <A, E>(self: Exit<A, E>) => Exit<void, E> = effect.exitAsVoid

/**
 * @since 4.0.0
 * @category combinators
 */
export const asVoidAll: <I extends Iterable<Exit<any, any>>>(
  exits: I
) => Exit<void, I extends Iterable<Exit<infer _A, infer _E>> ? _E : never> = effect.exitAsVoidAll
