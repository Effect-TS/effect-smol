/**
 * @since 2.0.0
 */
import type * as Context from "./Context.js"
import type * as Effect from "./Effect.js"
import type { Equal } from "./Equal.js"
import type * as Filter from "./Filter.js"
import type { Inspectable } from "./Inspectable.js"
import * as core from "./internal/core.js"
import * as effect from "./internal/effect.js"
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
 * @since 4.0.0
 * @category guards
 */
export const failureIsFail: <E>(self: Failure<E>) => self is Fail<E> = core.failureIsFail

/**
 * @since 4.0.0
 * @category guards
 */
export const failureIsDie: <E>(self: Failure<E>) => self is Die = core.failureIsDie

/**
 * @since 4.0.0
 * @category guards
 */
export const failureIsInterrupt: <E>(self: Failure<E>) => self is Interrupt = core.failureIsInterrupt

/**
 * @since 4.0.0
 * @category Filters
 */
export const failureFilterFail: <E>(self: Failure<E>) => Fail<E> | Filter.absent = core.failureFilterFail

/**
 * @since 4.0.0
 * @category Filters
 */
export const failureFilterError: <E>(self: Failure<E>) => E | Filter.absent = core.failureFilterError

/**
 * @since 4.0.0
 * @category Filters
 */
export const failureFilterDie: <E>(self: Failure<E>) => Die | Filter.absent = core.failureFilterDie

/**
 * @since 4.0.0
 * @category Filters
 */
export const failureFilterInterrupt: <E>(self: Failure<E>) => Interrupt | Filter.absent = core.failureFilterInterrupt

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
    readonly annotations: ReadonlyMap<string, unknown>
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
export const interrupt: (fiberId?: number | undefined) => Cause<never> = effect.causeInterrupt

/**
 * @since 2.0.0
 * @category constructors
 */
export const isInterruptedOnly: <E>(self: Cause<E>) => boolean = effect.causeIsInterruptedOnly

/**
 * Squashes a `Cause` down to a single defect, chosen to be the "most important"
 * defect.
 *
 * @since 2.0.0
 * @category destructors
 */
export const squash: <E>(self: Cause<E>) => unknown = effect.causeSquash

/**
 * @since 2.0.0
 * @category utils
 */
export const hasFail: <E>(self: Cause<E>) => boolean = effect.causeHasFail

/**
 * @since 4.0.0
 * @category Filters
 */
export const filterFail: <E>(self: Cause<E>) => Fail<E> | Filter.absent = effect.causeFilterFail

/**
 * @since 4.0.0
 * @category Filters
 */
export const filterError: <E>(self: Cause<E>) => E | Filter.absent = effect.causeFilterError

/**
 * @since 2.0.0
 * @category utils
 */
export const hasDie: <E>(self: Cause<E>) => boolean = effect.causeHasDie

/**
 * @since 4.0.0
 * @category Filters
 */
export const filterDie: <E>(self: Cause<E>) => Die | Filter.absent = effect.causeFilterDie

/**
 * @since 2.0.0
 * @category utils
 */
export const hasInterrupt: <E>(self: Cause<E>) => boolean = effect.causeHasInterrupt

/**
 * @since 4.0.0
 * @category Filters
 */
export const filterInterrupt: <E>(self: Cause<E>) => Interrupt | Filter.absent = effect.causeFilterInterrupt

/**
 * @since 2.0.0
 * @category errors
 */
export interface YieldableError extends Readonly<Error> {
  [Symbol.iterator](): Effect.EffectIterator<this>
  asEffect(): Effect.Effect<never, this, never>
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
export const TimeoutErrorTypeId: unique symbol = effect.TimeoutErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export type TimeoutErrorTypeId = typeof TimeoutErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export const isTimeoutError: (u: unknown) => u is TimeoutError = effect.isTimeoutError

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
export const TimeoutError: new(message?: string) => TimeoutError = effect.TimeoutError

/**
 * @since 4.0.0
 * @category errors
 */
export const IllegalArgumentErrorTypeId: unique symbol = effect.IllegalArgumentErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export type IllegalArgumentErrorTypeId = typeof IllegalArgumentErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export const isIllegalArgumentError: (u: unknown) => u is IllegalArgumentError = effect.isIllegalArgumentError

/**
 * @since 4.0.0
 * @category errors
 */
export interface IllegalArgumentError extends YieldableError {
  readonly [IllegalArgumentErrorTypeId]: IllegalArgumentErrorTypeId
  readonly _tag: "IllegalArgumentError"
}

/**
 * @since 4.0.0
 * @category errors
 */
export const IllegalArgumentError: new(message?: string) => IllegalArgumentError = effect.IllegalArgumentError

/**
 * @since 4.0.0
 * @category errors
 */
export const ExceededCapacityErrorTypeId: unique symbol = effect.ExceededCapacityErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export type ExceededCapacityErrorTypeId = typeof ExceededCapacityErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export const isExceededCapacityError: (u: unknown) => u is ExceededCapacityError = effect.isExceededCapacityError

/**
 * @since 4.0.0
 * @category errors
 */
export interface ExceededCapacityError extends YieldableError {
  readonly [ExceededCapacityErrorTypeId]: ExceededCapacityErrorTypeId
  readonly _tag: "ExceededCapacityError"
}

/**
 * @since 4.0.0
 * @category errors
 */
export const ExceededCapacityError: new(message?: string) => ExceededCapacityError = effect.ExceededCapacityError

/**
 * @since 4.0.0
 * @category errors
 */
export const UnknownErrorTypeId: unique symbol = effect.UnknownErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export type UnknownErrorTypeId = typeof UnknownErrorTypeId

/**
 * @since 4.0.0
 * @category errors
 */
export const isUnknownError: (u: unknown) => u is UnknownError = effect.isUnknownError

/**
 * @since 4.0.0
 * @category errors
 */
export interface UnknownError extends YieldableError {
  readonly [UnknownErrorTypeId]: UnknownErrorTypeId
  readonly _tag: "UnknownError"
}

/**
 * @since 4.0.0
 * @category errors
 */
export const UnknownError: new(cause: unknown, message?: string) => UnknownError = effect.UnknownError
