/**
 * This module provides utilities for working with `Cause`, a data type that represents
 * the different ways an `Effect` can fail. It includes structured error handling with
 * typed errors, defects, and interruptions.
 *
 * A `Cause` can represent:
 * - **Fail**: A typed, expected error that can be handled
 * - **Die**: An unrecoverable defect (like a programming error)
 * - **Interrupt**: A fiber interruption
 *
 * @example
 * ```ts
 * import { Cause, Effect } from "effect"
 *
 * // Creating different types of causes
 * const failCause = Cause.fail("Something went wrong")
 * const dieCause = Cause.die(new Error("Unexpected error"))
 * const interruptCause = Cause.interrupt(123)
 *
 * // Working with effects that can fail
 * const program = Effect.fail("user error").pipe(
 *   Effect.catchCause((cause) => {
 *     if (Cause.hasFail(cause)) {
 *       const error = Cause.filterError(cause)
 *       console.log("Expected error:", error)
 *     }
 *     return Effect.succeed("handled")
 *   })
 * )
 *
 * // Analyzing failure types
 * const analyzeCause = (cause: Cause.Cause<string>) => {
 *   if (Cause.hasFail(cause)) return "Has user error"
 *   if (Cause.hasDie(cause)) return "Has defect"
 *   if (Cause.hasInterrupt(cause)) return "Was interrupted"
 *   return "Unknown cause"
 * }
 * ```
 *
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
import * as ServiceMap from "./ServiceMap.js"
import type { Span } from "./Tracer.js"
import type { NoInfer } from "./Types.js"

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause = Cause.fail("error")
 * console.log(cause[Cause.TypeId]) // "~effect/Cause"
 * ```
 *
 * @since 2.0.0
 * @category type ids
 */
export const TypeId: TypeId = core.CauseTypeId

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * type MyCauseTypeId = Cause.TypeId
 * // type MyCauseTypeId = "~effect/Cause"
 * ```
 *
 * @since 2.0.0
 * @category type ids
 */
export type TypeId = "~effect/Cause"

/**
 * A `Cause` is a data type that represents the different ways a `Effect` can fail.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const failCause: Cause.Cause<string> = Cause.fail("Something went wrong")
 * const dieCause: Cause.Cause<never> = Cause.die(new Error("Unexpected error"))
 * const interruptCause: Cause.Cause<never> = Cause.interrupt(123)
 *
 * console.log(failCause.failures.length) // 1
 * console.log(dieCause.failures.length) // 1
 * console.log(interruptCause.failures.length) // 1
 * ```
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const failCause = Cause.fail("error")
 * const failure: Cause.Failure<string> = failCause.failures[0]
 *
 * if (Cause.failureIsFail(failure)) {
 *   console.log(failure.error) // "error"
 * }
 * ```
 *
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * type StringCauseError = Cause.Cause.Error<Cause.Cause<string>>
 * // type StringCauseError = string
 *
 * const cause = Cause.fail("error")
 * const failure = cause.failures[0]
 * if (Cause.failureIsFail(failure)) {
 *   console.log(failure._tag) // "Fail"
 *   console.log(failure.error) // "error"
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export declare namespace Cause {
  /**
   * @example
   * ```ts
   * import { Cause } from "effect"
   *
   * type ErrorType = Cause.Cause.Error<Cause.Cause<string>>
   * // type ErrorType = string
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export type Error<T> = T extends Cause<infer E> ? E : never

  /**
   * @example
   * ```ts
   * import { Cause } from "effect"
   *
   * const cause = Cause.fail("error")
   * const failure = cause.failures[0]
   * if (Cause.failureIsFail(failure)) {
   *   console.log(failure._tag) // "Fail"
   *   console.log(failure.annotations.size) // 0
   * }
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export interface FailureProto<Tag extends string> extends Inspectable {
    readonly _tag: Tag
    readonly annotations: ReadonlyMap<string, unknown>
    annotate<I, S>(tag: ServiceMap.Key<I, S>, value: S, options?: {
      readonly onlyIfMissing?: boolean | undefined
    }): this
  }
}

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * type StringFailureError = Cause.Failure.Error<Cause.Failure<string>>
 * // type StringFailureError = string
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export declare namespace Failure {
  /**
   * @example
   * ```ts
   * import { Cause } from "effect"
   *
   * type ErrorType = Cause.Failure.Error<Cause.Failure<string>>
   * // type ErrorType = string
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export type Error<T> = T extends Failure<infer E> ? E : never
}

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause = Cause.die(new Error("Unexpected error"))
 * const failure = cause.failures[0]
 * if (Cause.failureIsDie(failure)) {
 *   console.log(failure._tag) // "Die"
 *   console.log(failure.defect) // Error: Unexpected error
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Die extends Cause.FailureProto<"Die"> {
  readonly defect: unknown
}

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause = Cause.fail("Something went wrong")
 * const failure = cause.failures[0]
 * if (Cause.failureIsFail(failure)) {
 *   console.log(failure._tag) // "Fail"
 *   console.log(failure.error) // "Something went wrong"
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Fail<out E> extends Cause.FailureProto<"Fail"> {
  readonly error: E
}

/**
 * @example
 * ```ts
 * import { Cause, Option } from "effect"
 *
 * const cause = Cause.interrupt(123)
 * const failure = cause.failures[0]
 * if (Cause.failureIsInterrupt(failure)) {
 *   console.log(failure._tag) // "Interrupt"
 *   console.log(Option.isSome(failure.fiberId)) // true
 * }
 * ```
 *
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
 * Merges two causes into a single cause containing failures from both.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const cause1 = Cause.fail("error1")
 * const cause2 = Cause.fail("error2")
 * const merged = Cause.merge(cause1, cause2)
 * console.log(merged.failures.length) // 2
 * ```
 *
 * @category utils
 * @since 4.0.0
 */
export const merge: {
  <E2>(that: Cause<E2>): <E>(self: Cause<E>) => Cause<E | E2>
  <E, E2>(self: Cause<E>, that: Cause<E2>): Cause<E | E2>
} = effect.causeMerge

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
 * @example
 * ```ts
 * import { Cause, Filter } from "effect"
 *
 * const cause = Cause.interrupt(123)
 * const interruptor = Cause.filterInterruptor(cause)
 * console.log(interruptor === 123) // true
 *
 * const failCause = Cause.fail("error")
 * const noInterruptor = Cause.filterInterruptor(failCause)
 * console.log(noInterruptor === Filter.absent) // true
 * ```
 *
 * @since 4.0.0
 * @category filters
 */
export const filterInterruptor: <E>(self: Cause<E>) => number | Filter.absent = effect.causeFilterInterruptor

/**
 * @since 4.0.0
 * @category Pretty printing
 */
export const prettyErrors: <E>(self: Cause<E>) => Array<Error> = effect.causePrettyErrors

/**
 * @since 4.0.0
 * @category Pretty printing
 */
export const pretty: <E>(cause: Cause<E>) => string = effect.causePretty

/**
 * @example
 * ```ts
 * import { Cause, Effect } from "effect"
 *
 * const error = new Cause.NoSuchElementError("Item not found")
 *
 * // Can be used directly in Effect.gen
 * const program = Effect.gen(function* () {
 *   yield* error // This will fail with the error
 * })
 *
 * // Or converted to an Effect
 * const effectError = error.asEffect()
 * ```
 *
 * @since 2.0.0
 * @category errors
 */
export interface YieldableError extends Error {
  [Symbol.iterator](): Effect.EffectIterator<this>
  asEffect(): Effect.Effect<never, this, never>
}

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.NoSuchElementError()
 * console.log(error[Cause.NoSuchElementErrorTypeId]) // "~effect/Cause/NoSuchElementError"
 * ```
 *
 * @since 4.0.0
 * @category errors
 */
export const NoSuchElementErrorTypeId: NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError"

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * type MyNoSuchElementErrorTypeId = Cause.NoSuchElementErrorTypeId
 * // type MyNoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError"
 * ```
 *
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error: Cause.NoSuchElementError = new Cause.NoSuchElementError("Element not found")
 * console.log(error._tag) // "NoSuchElementError"
 * console.log(error.message) // "Element not found"
 * console.log(Cause.isNoSuchElementError(error)) // true
 * ```
 *
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.TimeoutError()
 * console.log(error[Cause.TimeoutErrorTypeId]) // "~effect/Cause/TimeoutError"
 * ```
 *
 * @since 4.0.0
 * @category errors
 */
export const TimeoutErrorTypeId: TimeoutErrorTypeId = "~effect/Cause/TimeoutError"

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * type MyTimeoutErrorTypeId = Cause.TimeoutErrorTypeId
 * // type MyTimeoutErrorTypeId = "~effect/Cause/TimeoutError"
 * ```
 *
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error: Cause.TimeoutError = new Cause.TimeoutError("Operation timed out")
 * console.log(error._tag) // "TimeoutError"
 * console.log(error.message) // "Operation timed out"
 * console.log(Cause.isTimeoutError(error)) // true
 * ```
 *
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.IllegalArgumentError()
 * console.log(error[Cause.IllegalArgumentErrorTypeId]) // "~effect/Cause/IllegalArgumentError"
 * ```
 *
 * @since 4.0.0
 * @category errors
 */
export const IllegalArgumentErrorTypeId: IllegalArgumentErrorTypeId = "~effect/Cause/IllegalArgumentError"

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * type MyIllegalArgumentErrorTypeId = Cause.IllegalArgumentErrorTypeId
 * // type MyIllegalArgumentErrorTypeId = "~effect/Cause/IllegalArgumentError"
 * ```
 *
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error: Cause.IllegalArgumentError = new Cause.IllegalArgumentError("Invalid argument")
 * console.log(error._tag) // "IllegalArgumentError"
 * console.log(error.message) // "Invalid argument"
 * console.log(Cause.isIllegalArgumentError(error)) // true
 * ```
 *
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.ExceededCapacityError()
 * console.log(error[Cause.ExceededCapacityErrorTypeId]) // "~effect/Cause/ExceededCapacityError"
 * ```
 *
 * @since 4.0.0
 * @category errors
 */
export const ExceededCapacityErrorTypeId: ExceededCapacityErrorTypeId = "~effect/Cause/ExceededCapacityError"

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * type MyExceededCapacityErrorTypeId = Cause.ExceededCapacityErrorTypeId
 * // type MyExceededCapacityErrorTypeId = "~effect/Cause/ExceededCapacityError"
 * ```
 *
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error: Cause.ExceededCapacityError = new Cause.ExceededCapacityError("Capacity exceeded")
 * console.log(error._tag) // "ExceededCapacityError"
 * console.log(error.message) // "Capacity exceeded"
 * console.log(Cause.isExceededCapacityError(error)) // true
 * ```
 *
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error = new Cause.UnknownError("original cause")
 * console.log(error[Cause.UnknownErrorTypeId]) // "~effect/Cause/UnknownError"
 * ```
 *
 * @since 4.0.0
 * @category errors
 */
export const UnknownErrorTypeId: UnknownErrorTypeId = "~effect/Cause/UnknownError"

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * type MyUnknownErrorTypeId = Cause.UnknownErrorTypeId
 * // type MyUnknownErrorTypeId = "~effect/Cause/UnknownError"
 * ```
 *
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
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error: Cause.UnknownError = new Cause.UnknownError("original cause", "Unknown error occurred")
 * console.log(error._tag) // "UnknownError"
 * console.log(error.message) // "Unknown error occurred"
 * console.log(Cause.isUnknownError(error)) // true
 * ```
 *
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

/**
 * Adds annotations to a `Cause` using a `ServiceMap.Key` to store metadata
 * that can be retrieved later for debugging or tracing purposes.
 *
 * @example
 * ```ts
 * import { Cause, ServiceMap } from "effect"
 *
 * // Define a custom annotation key
 * class UserId extends ServiceMap.Key<UserId, string>()("UserId") {}
 *
 * // Create a cause and add an annotation
 * const originalCause = Cause.fail("Something went wrong")
 * const annotatedCause = Cause.annotate(originalCause, UserId, "user123")
 * ```
 *
 * @category Annotations
 * @since 4.0.0
 */
export const annotate: {
  <I, S>(
    key: ServiceMap.Key<I, S>,
    value: NoInfer<S>,
    options?: { readonly onlyIfMissing?: boolean | undefined }
  ): <E>(self: Cause<E>) => Cause<E>
  <E, I, S>(
    self: Cause<E>,
    key: ServiceMap.Key<I, S>,
    value: NoInfer<S>,
    options?: { readonly onlyIfMissing?: boolean | undefined }
  ): Cause<E>
} = core.causeAnnotate

/**
 * Retrieves the annotations from a `Failure`.
 *
 * @category Annotations
 * @since 4.0.0
 */
export const failureAnnotations: <E>(self: Failure<E>) => ServiceMap.ServiceMap<never> = effect.failureAnnotations

/**
 * Retrieves the merged annotations from all failures in a `Cause`.
 *
 * @category Annotations
 * @since 4.0.0
 */
export const annotations: <E>(self: Cause<E>) => ServiceMap.ServiceMap<never> = effect.causeAnnotations

/**
 * Represents the span captured at the point of failure.
 *
 * @category Annotations
 * @since 4.0.0
 */
export class CurrentSpan extends ServiceMap.Key<CurrentSpan, Span>()("effect/Cause/CurrentSpan") {}

/**
 * Represents the span captured at the point of failure.
 *
 * @category Annotations
 * @since 4.0.0
 */
export class InterruptorSpan extends ServiceMap.Key<InterruptorSpan, Span>()("effect/Cause/InterruptorSpan") {}

/**
 * Represents the trace captured at the point an Effect.fn was called.
 *
 * @category Annotations
 * @since 4.0.0
 */
export class FnCallsiteTrace extends ServiceMap.Key<FnCallsiteTrace, Error>()("effect/Cause/FnCallsiteTrace") {}

/**
 * Represents the trace captured at the point an Effect.fn was defined.
 *
 * @category Annotations
 * @since 4.0.0
 */
export class FnDefinitionTrace extends ServiceMap.Key<FnDefinitionTrace, Error>()("effect/Cause/FnDefinitionTrace") {}
