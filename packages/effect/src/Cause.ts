/**
 * @since 2.0.0
 */
import type * as Effect from "./Effect.js"
import type { Equal } from "./Equal.js"
import type * as Filter from "./Filter.js"
import type { Inspectable } from "./Inspectable.js"
import * as core from "./internal/core.js"
import * as effect from "./internal/effect.js"
import type { Option } from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import type * as ServiceMap from "./ServiceMap.js"

/**
 * @since 2.0.0
 * @category type ids
 */
export const TypeId: TypeId = core.CauseTypeId

/**
 * @since 2.0.0
 * @category type ids
 */
export type TypeId = "~effect/Cause"

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
 * Tests if a value is a `Cause`.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * console.log(Cause.isCause(Cause.fail("error"))) // true
 * console.log(Cause.isCause("not a cause")) // false
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isCause: (self: unknown) => self is Cause<unknown> = core.isCause

/**
 * @since 4.0.0
 * @category models
 */
export type Failure<E> = Fail<E> | Die | Interrupt

/**
 * Tests if a `Failure` is a `Fail`.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause = Cause.fail("error")
 * const failure = cause.failures[0]
 * console.log(Cause.failureIsFail(failure)) // true
 * ```
 *
 * @category guards
 * @since 4.0.0
 */
export const failureIsFail: <E>(self: Failure<E>) => self is Fail<E> = core.failureIsFail

/**
 * Tests if a `Failure` is a `Die`.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause = Cause.die("defect")
 * const failure = cause.failures[0]
 * console.log(Cause.failureIsDie(failure)) // true
 * ```
 *
 * @category guards
 * @since 4.0.0
 */
export const failureIsDie: <E>(self: Failure<E>) => self is Die = core.failureIsDie

/**
 * Tests if a `Failure` is an `Interrupt`.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause = Cause.interrupt(123)
 * const failure = cause.failures[0]
 * console.log(Cause.failureIsInterrupt(failure)) // true
 * ```
 *
 * @category guards
 * @since 4.0.0
 */
export const failureIsInterrupt: <E>(self: Failure<E>) => self is Interrupt = core.failureIsInterrupt

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
    annotate<I, S>(tag: ServiceMap.Key<I, S>, value: S): this
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
 * Creates a `Cause` from a collection of `Failure` values.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const fail1 = Cause.fail("error1").failures[0]
 * const fail2 = Cause.fail("error2").failures[0]
 * const cause = Cause.fromFailures([fail1, fail2])
 * console.log(cause.failures.length) // 2
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const fromFailures: <E>(
  failures: ReadonlyArray<Failure<E>>
) => Cause<E> = core.causeFromFailures

/**
 * Creates a `Cause` that represents a typed error.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause = Cause.fail("Something went wrong")
 * console.log(cause.failures.length) // 1
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const fail: <E>(error: E) => Cause<E> = core.causeFail

/**
 * Creates a `Cause` that represents an unrecoverable defect.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause = Cause.die(new Error("Unexpected error"))
 * console.log(cause.failures.length) // 1
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const die: (defect: unknown) => Cause<never> = core.causeDie

/**
 * Creates a `Cause` that represents fiber interruption.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause = Cause.interrupt(123)
 * console.log(cause.failures.length) // 1
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const interrupt: (fiberId?: number | undefined) => Cause<never> = effect.causeInterrupt

/**
 * Tests if a `Cause` contains only interruptions.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const interruptCause = Cause.interrupt(123)
 * const failCause = Cause.fail("error")
 *
 * console.log(Cause.isInterruptedOnly(interruptCause)) // true
 * console.log(Cause.isInterruptedOnly(failCause)) // false
 * ```
 *
 * @category utils
 * @since 2.0.0
 */
export const isInterruptedOnly: <E>(self: Cause<E>) => boolean = effect.causeIsInterruptedOnly

/**
 * Squashes a `Cause` down to a single defect, chosen to be the "most important"
 * defect.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause = Cause.fail("error")
 * const squashed = Cause.squash(cause)
 * console.log(squashed) // "error"
 * ```
 *
 * @category destructors
 * @since 2.0.0
 */
export const squash: <E>(self: Cause<E>) => unknown = effect.causeSquash

/**
 * Tests if a `Cause` contains any typed errors.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const failCause = Cause.fail("error")
 * const dieCause = Cause.die("defect")
 *
 * console.log(Cause.hasFail(failCause)) // true
 * console.log(Cause.hasFail(dieCause)) // false
 * ```
 *
 * @category utils
 * @since 2.0.0
 */
export const hasFail: <E>(self: Cause<E>) => boolean = effect.causeHasFail

/**
 * Filters out the first typed error from a `Cause`.
 *
 * @example
 * ```ts
 * import { Cause, Filter } from "effect"
 *
 * const cause = Cause.fail("error")
 * const filtered = Cause.filterFail(cause)
 * console.log(filtered !== Filter.absent) // true
 * ```
 *
 * @category filters
 * @since 4.0.0
 */
export const filterFail: <E>(self: Cause<E>) => Fail<E> | Filter.absent = effect.causeFilterFail

/**
 * Filters out the first typed error value from a `Cause`.
 *
 * @example
 * ```ts
 * import { Cause, Filter } from "effect"
 *
 * const cause = Cause.fail("error")
 * const filtered = Cause.filterError(cause)
 * console.log(filtered === "error") // true
 * ```
 *
 * @category filters
 * @since 4.0.0
 */
export const filterError: <E>(self: Cause<E>) => E | Filter.absent = effect.causeFilterError

/**
 * Tests if a `Cause` contains any defects.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const dieCause = Cause.die("defect")
 * const failCause = Cause.fail("error")
 *
 * console.log(Cause.hasDie(dieCause)) // true
 * console.log(Cause.hasDie(failCause)) // false
 * ```
 *
 * @category utils
 * @since 2.0.0
 */
export const hasDie: <E>(self: Cause<E>) => boolean = effect.causeHasDie

/**
 * Filters out the first defect from a `Cause`.
 *
 * @example
 * ```ts
 * import { Cause, Filter } from "effect"
 *
 * const cause = Cause.die("defect")
 * const filtered = Cause.filterDie(cause)
 * console.log(filtered !== Filter.absent) // true
 * ```
 *
 * @category filters
 * @since 4.0.0
 */
export const filterDie: <E>(self: Cause<E>) => Die | Filter.absent = effect.causeFilterDie

/**
 * Tests if a `Cause` contains any interruptions.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const interruptCause = Cause.interrupt(123)
 * const failCause = Cause.fail("error")
 *
 * console.log(Cause.hasInterrupt(interruptCause)) // true
 * console.log(Cause.hasInterrupt(failCause)) // false
 * ```
 *
 * @category utils
 * @since 2.0.0
 */
export const hasInterrupt: <E>(self: Cause<E>) => boolean = effect.causeHasInterrupt

/**
 * Filters out the first interruption from a `Cause`.
 *
 * @example
 * ```ts
 * import { Cause, Filter } from "effect"
 *
 * const cause = Cause.interrupt(123)
 * const filtered = Cause.filterInterrupt(cause)
 * console.log(filtered !== Filter.absent) // true
 * ```
 *
 * @category filters
 * @since 4.0.0
 */
export const filterInterrupt: <E>(self: Cause<E>) => Interrupt | Filter.absent = effect.causeFilterInterrupt

/**
 * @since 4.0.0
 * @category Filters
 */
export const filterInterruptor: <E>(self: Cause<E>) => number | Filter.absent = effect.causeFilterInterruptor

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
export const NoSuchElementErrorTypeId: NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError"

/**
 * @since 4.0.0
 * @category errors
 */
export type NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError"

/**
 * Tests if a value is a `NoSuchElementError`.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.NoSuchElementError()
 * console.log(Cause.isNoSuchElementError(error)) // true
 * console.log(Cause.isNoSuchElementError("not an error")) // false
 * ```
 *
 * @category guards
 * @since 4.0.0
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
 * Creates a `NoSuchElementError` with an optional message.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.NoSuchElementError("Element not found")
 * console.log(error.message) // "Element not found"
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const NoSuchElementError: new(message?: string) => NoSuchElementError = core.NoSuchElementError

/**
 * @since 4.0.0
 * @category errors
 */
export const TimeoutErrorTypeId: TimeoutErrorTypeId = "~effect/Cause/TimeoutError"

/**
 * @since 4.0.0
 * @category errors
 */
export type TimeoutErrorTypeId = "~effect/Cause/TimeoutError"

/**
 * Tests if a value is a `TimeoutError`.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.TimeoutError()
 * console.log(Cause.isTimeoutError(error)) // true
 * console.log(Cause.isTimeoutError("not an error")) // false
 * ```
 *
 * @category guards
 * @since 4.0.0
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
 * Creates a `TimeoutError` with an optional message.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.TimeoutError("Operation timed out")
 * console.log(error.message) // "Operation timed out"
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const TimeoutError: new(message?: string) => TimeoutError = effect.TimeoutError

/**
 * @since 4.0.0
 * @category errors
 */
export const IllegalArgumentErrorTypeId: IllegalArgumentErrorTypeId = "~effect/Cause/IllegalArgumentError"

/**
 * @since 4.0.0
 * @category errors
 */
export type IllegalArgumentErrorTypeId = "~effect/Cause/IllegalArgumentError"

/**
 * Tests if a value is an `IllegalArgumentError`.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.IllegalArgumentError()
 * console.log(Cause.isIllegalArgumentError(error)) // true
 * console.log(Cause.isIllegalArgumentError("not an error")) // false
 * ```
 *
 * @category guards
 * @since 4.0.0
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
 * Creates an `IllegalArgumentError` with an optional message.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.IllegalArgumentError("Invalid argument")
 * console.log(error.message) // "Invalid argument"
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const IllegalArgumentError: new(message?: string) => IllegalArgumentError = effect.IllegalArgumentError

/**
 * @since 4.0.0
 * @category errors
 */
export const ExceededCapacityErrorTypeId: ExceededCapacityErrorTypeId = "~effect/Cause/ExceededCapacityError"

/**
 * @since 4.0.0
 * @category errors
 */
export type ExceededCapacityErrorTypeId = "~effect/Cause/ExceededCapacityError"

/**
 * Tests if a value is an `ExceededCapacityError`.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.ExceededCapacityError()
 * console.log(Cause.isExceededCapacityError(error)) // true
 * console.log(Cause.isExceededCapacityError("not an error")) // false
 * ```
 *
 * @category guards
 * @since 4.0.0
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
 * Creates an `ExceededCapacityError` with an optional message.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.ExceededCapacityError("Capacity exceeded")
 * console.log(error.message) // "Capacity exceeded"
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const ExceededCapacityError: new(message?: string) => ExceededCapacityError = effect.ExceededCapacityError

/**
 * @since 4.0.0
 * @category errors
 */
export const UnknownErrorTypeId: UnknownErrorTypeId = "~effect/Cause/UnknownError"

/**
 * @since 4.0.0
 * @category errors
 */
export type UnknownErrorTypeId = "~effect/Cause/UnknownError"

/**
 * Tests if a value is an `UnknownError`.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.UnknownError("some cause")
 * console.log(Cause.isUnknownError(error)) // true
 * console.log(Cause.isUnknownError("not an error")) // false
 * ```
 *
 * @category guards
 * @since 4.0.0
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
 * Creates an `UnknownError` with a cause and optional message.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.UnknownError("original cause", "Unknown error occurred")
 * console.log(error.message) // "Unknown error occurred"
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const UnknownError: new(cause: unknown, message?: string) => UnknownError = effect.UnknownError
