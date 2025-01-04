/**
 * @since 2.0.0
 */
import type * as Context from "./Context.js"
import type * as Effect from "./Effect.js"
import type { Equal } from "./Equal.js"
import type { Inspectable } from "./Inspectable.js"
import * as core from "./internal/core.js"
import type { Option } from "./Option.js"
import type { Pipeable } from "./Pipeable.js"

/**
 * @since 2.0.0
 * @category type ids
 */
export const TypeId: unique symbol = core.CauseTypeId

/**
 * @since 2.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * A `Cause` is a data type that represents the different ways a `Effect` can fail.
 *
 * @since 2.0.0
 * @category models
 */
export interface Cause<out E> extends Pipeable, Inspectable, Equal {
  readonly [TypeId]: TypeId
  readonly failures: ReadonlyArray<Failure<E>>
}

/**
 * @since 2.0.0
 * @category guards
 */
export const isCause: (self: unknown) => self is Cause<unknown> = core.isCause

/**
 * @since 4.0.0
 * @category models
 */
export type Failure<E> = Fail<E> | Die | Interrupt

/**
 * @since 2.0.0
 * @category models
 */
export declare namespace Cause {
  /**
   * @since 4.0.0
   */
  export type Error<T> = T extends Cause<infer E> ? E : never

  /**
   * @since 4.0.0
   */
  export interface FailureProto<Tag extends string> extends Inspectable {
    readonly _tag: Tag
    readonly annotations: Context.Context<never>
    annotate<I, S>(tag: Context.Tag<I, S>, value: S): this
  }
}

/**
 * @since 2.0.0
 * @category models
 */
export declare namespace Failure {
  /**
   * @since 4.0.0
   */
  export type Error<T> = T extends Failure<infer E> ? E : never
}

/**
 * @since 2.0.0
 * @category models
 */
export interface Die extends Cause.FailureProto<"Die"> {
  readonly defect: unknown
}

/**
 * @since 2.0.0
 * @category models
 */
export interface Fail<out E> extends Cause.FailureProto<"Fail"> {
  readonly error: E
}

/**
 * @since 2.0.0
 * @category models
 */
export interface Interrupt extends Cause.FailureProto<"Interrupt"> {
  readonly fiberId: Option<number>
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const fromFailures: <E>(
  failures: ReadonlyArray<Failure<E>>
) => Cause<E> = core.causeFromFailures

/**
 * @since 2.0.0
 * @category constructors
 */
export const fail: <E>(error: E) => Cause<E> = core.causeFail

/**
 * @since 2.0.0
 * @category constructors
 */
export const die: (defect: unknown) => Cause<never> = core.causeDie

/**
 * @since 2.0.0
 * @category constructors
 */
export const interrupt: (fiberId?: number | undefined) => Cause<never> = core.causeInterrupt

/**
 * @since 2.0.0
 * @category constructors
 */
export const isInterruptedOnly: <E>(self: Cause<E>) => boolean = core.causeIsInterruptedOnly

/**
 * Squashes a `Cause` down to a single defect, chosen to be the "most important"
 * defect.
 *
 * @since 2.0.0
 * @category destructors
 */
export const squash: <E>(self: Cause<E>) => unknown = core.causeSquash

/**
 * @since 2.0.0
 * @category utils
 */
export const causeHasFail: <E>(self: Cause<E>) => boolean = core.causeHasFail

/**
 * @since 2.0.0
 * @category utils
 */
export const causeHasDie: <E>(self: Cause<E>) => boolean = core.causeHasDie

/**
 * @since 2.0.0
 * @category utils
 */
export const causeHasInterrupt: <E>(self: Cause<E>) => boolean = core.causeHasInterrupt

/**
 * @since 2.0.0
 * @category errors
 */
export interface YieldableError extends Pipeable, Inspectable, Readonly<Error> {
  [Symbol.iterator](): Effect.EffectIterator<Effect.Effect<never, this, never>>
}

/**
 * @since 4.0.0
 * @category errors
 */
export const NoSuchElementErrorTypeId: unique symbol = core.NoSuchElementErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export type NoSuchElementErrorTypeId = typeof NoSuchElementErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export const isNoSuchElementError: (u: unknown) => u is NoSuchElementError = core.isNoSuchElementError

/**
 * @since 4.0.0
 * @category errors
 */
export interface NoSuchElementError extends YieldableError {
  readonly [NoSuchElementErrorTypeId]: NoSuchElementErrorTypeId
  readonly _tag: "NoSuchElementError"
}

/**
 * @since 4.0.0
 * @category errors
 */
export const NoSuchElementError: new(message?: string) => NoSuchElementError = core.NoSuchElementError

/**
 * @since 4.0.0
 * @category errors
 */
export const TimeoutErrorTypeId: unique symbol = core.TimeoutErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export type TimeoutErrorTypeId = typeof TimeoutErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export const isTimeoutError: (u: unknown) => u is TimeoutError = core.isTimeoutError

/**
 * @since 4.0.0
 * @category errors
 */
export interface TimeoutError extends YieldableError {
  readonly [TimeoutErrorTypeId]: TimeoutErrorTypeId
  readonly _tag: "TimeoutError"
}

/**
 * @since 4.0.0
 * @category errors
 */
export const TimeoutError: new(message?: string) => TimeoutError = core.TimeoutError
