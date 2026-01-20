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
import type * as Effect from "./Effect.ts"
import type { Equal } from "./Equal.ts"
import type * as Filter from "./Filter.ts"
import type { Inspectable } from "./Inspectable.ts"
import * as core from "./internal/core.ts"
import * as effect from "./internal/effect.ts"
import type { Option } from "./Option.ts"
import type { Pipeable } from "./Pipeable.ts"
import type { StackFrame } from "./References.ts"
import * as ServiceMap from "./ServiceMap.ts"
import type { NoInfer } from "./Types.ts"

/**
 * @since 2.0.0
 */
export const TypeId: "~effect/Cause" = core.CauseTypeId

/**
 * @since 2.0.0
 */
export const FailureTypeId: "~effect/Cause/Failure" = core.CauseFailureTypeId

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
  readonly [TypeId]: typeof TypeId
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
 * @category guards
 * @since 2.0.0
 */
export const isFailure: (self: unknown) => self is Failure<unknown> = core.isCauseFailure

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
   * import type { Cause } from "effect"
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
  export interface FailureProto<Tag extends string> extends Inspectable, Equal {
    readonly [FailureTypeId]: typeof FailureTypeId
    readonly _tag: Tag
    readonly annotations: ReadonlyMap<string, unknown>
    annotate(annotations: ServiceMap.ServiceMap<never> | ReadonlyMap<string, unknown>, options?: {
      readonly overwrite?: boolean | undefined
    }): this
  }
}

/**
 * @example
 * ```ts
 * import type { Cause } from "effect"
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
   * import type { Cause } from "effect"
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
 * import { Cause } from "effect"
 *
 * const cause = Cause.interrupt(123)
 * const failure = cause.failures[0]
 * if (Cause.failureIsInterrupt(failure)) {
 *   console.log(failure._tag) // "Interrupt"
 *   console.log(failure.fiberId !== undefined) // true
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Interrupt extends Cause.FailureProto<"Interrupt"> {
  readonly fiberId: number | undefined
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
 * A `Cause` that that contains no failures, representing a successful
 * computation or an empty state.
 *
 * @category constructors
 * @since 2.0.0
 */
export const empty: Cause<never> = core.causeEmpty

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
 * @category Failure
 * @since 4.0.0
 */
export const failureFail = <E>(error: E): Fail<E> => new core.Fail(error)

/**
 * @category Failure
 * @since 4.0.0
 */
export const failureDie = (defect: unknown): Die => new core.Die(defect)

/**
 * @category Failure
 * @since 4.0.0
 */
export const failureInterrupt: (fiberId?: number | undefined) => Interrupt = effect.failureInterrupt

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
 * @category Mapping
 * @since 4.0.0
 */
export const map: {
  <E, E2>(f: (error: NoInfer<E>) => E2): (self: Cause<E>) => Cause<E2>
  <E, E2>(self: Cause<E>, f: (error: NoInfer<E>) => E2): Cause<E2>
} = effect.causeMap

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
 * @category filters
 * @since 4.0.0
 */
export const filterFail: <E>(self: Cause<E>) => Fail<E> | Filter.fail<Cause<never>> = effect.causeFilterFail

/**
 * Filters out the first typed error value from a `Cause`.
 *
 * @category filters
 * @since 4.0.0
 */
export const filterError: <E>(self: Cause<E>) => E | Filter.fail<Cause<never>> = effect.causeFilterError

/**
 * @category Failure
 * @since 4.0.0
 */
export const errorOption: <E>(input: Cause<E>) => Option<E> = effect.causeErrorOption

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
 * Filters out the first Die failure from a `Cause`.
 *
 * @category filters
 * @since 4.0.0
 */
export const filterDie: <E>(self: Cause<E>) => Die | Filter.fail<Cause<E>> = effect.causeFilterDie

/**
 * Filters out the first defect from a `Cause`.
 *
 * @category filters
 * @since 4.0.0
 */
export const filterDefect: <E>(self: Cause<E>) => {} | Filter.fail<Cause<E>> = effect.causeFilterDefect

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
 * @category filters
 * @since 4.0.0
 */
export const filterInterrupt: <E>(self: Cause<E>) => Interrupt | Filter.fail<Cause<E>> = effect.causeFilterInterrupt

/**
 * @since 4.0.0
 * @category Accessors
 */
export const interruptors: <E>(self: Cause<E>) => ReadonlySet<number> = effect.causeInterruptors

/**
 * @since 4.0.0
 * @category filters
 */
export const filterInterruptors: <E>(self: Cause<E>) => Set<number> | Filter.fail<Cause<E>> =
  effect.causeFilterInterruptors

/**
 * @since 4.0.0
 * @category Pretty printing
 */
export const prettyErrors: <E>(self: Cause<E>) => Array<Error> = effect.causePrettyErrors

/**
 * Pretty prints a `Cause` as a string, cleaning up the output for better
 * readability & adding trace information from annotations.
 *
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
 * const program = Effect.gen(function*() {
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
export const NoSuchElementErrorTypeId: "~effect/Cause/NoSuchElementError" = core.NoSuchElementErrorTypeId

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error: Cause.NoSuchElementError = new Cause.NoSuchElementError(
 *   "Element not found"
 * )
 * console.log(error._tag) // "NoSuchElementError"
 * console.log(error.message) // "Element not found"
 * console.log(Cause.isNoSuchElementError(error)) // true
 * ```
 *
 * @since 4.0.0
 * @category errors
 */
export interface NoSuchElementError extends YieldableError {
  readonly [NoSuchElementErrorTypeId]: typeof NoSuchElementErrorTypeId
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
 * Tests if a value is a `Done` error.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * console.log(Cause.isDone(Cause.Done)) // true
 * console.log(Cause.isDone("not an error")) // false
 * ```
 *
 * @category guards
 * @since 4.0.0
 */
export const isDone: (u: unknown) => u is Done<any> = core.isDone

/**
 * @since 4.0.0
 * @category errors
 */
export const DoneTypeId: "~effect/Cause/Done" = core.DoneTypeId

/**
 * Represents a graceful completion signal for queues and streams.
 *
 * `Done` is used to signal that a queue or stream has completed normally
 * and no more elements will be produced. This is distinct from an error
 * or interruption - it represents successful completion.
 *
 * @example
 * ```ts
 * import { Cause, Effect } from "effect"
 * import { Queue } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number, Cause.Done>(10)
 *
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *
 *   // Signal completion
 *   yield* Queue.end(queue)
 *
 *   // Taking from ended queue fails with Done
 *   const result = yield* Effect.flip(Queue.take(queue))
 *   console.log(Cause.isDone(result)) // true
 * })
 * ```
 *
 * @since 4.0.0
 * @category errors
 */
export interface Done<A = void> {
  readonly [DoneTypeId]: typeof DoneTypeId
  readonly _tag: "Done"
  readonly value: A
}

/**
 * @since 4.0.0
 * @category Done
 */
export declare namespace Done {
  /**
   * Extracts the leftover type from a Done error.
   *
   * @since 4.0.0
   * @category Done
   */
  export type Extract<E> = E extends Done<infer L> ? L : never

  /**
   * Filters a type union to only include Done errors.
   *
   * @since 4.0.0
   * @category Done
   */
  export type Only<E> = E extends Done<infer L> ? Done<L> : never
}

/**
 * An error for signaling graceful completion with an optional value.
 *
 * @category constructors
 * @since 4.0.0
 */
export const Done: <A = void>(value?: A) => Done<A> = core.Done

/**
 * @category constructors
 * @since 4.0.0
 */
export const done: <A = void>(value?: A) => Effect.Effect<never, Done<A>> = core.done

/**
 * @category errors
 * @since 4.0.0
 */
export const TimeoutErrorTypeId: "~effect/Cause/TimeoutError" = effect.TimeoutErrorTypeId

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
  readonly [TimeoutErrorTypeId]: typeof TimeoutErrorTypeId
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
 * @category errors
 * @since 4.0.0
 */
export const IllegalArgumentErrorTypeId: "~effect/Cause/IllegalArgumentError" = effect.IllegalArgumentErrorTypeId

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
 * const error: Cause.IllegalArgumentError = new Cause.IllegalArgumentError(
 *   "Invalid argument"
 * )
 * console.log(error._tag) // "IllegalArgumentError"
 * console.log(error.message) // "Invalid argument"
 * console.log(Cause.isIllegalArgumentError(error)) // true
 * ```
 *
 * @since 4.0.0
 * @category errors
 */
export interface IllegalArgumentError extends YieldableError {
  readonly [IllegalArgumentErrorTypeId]: typeof IllegalArgumentErrorTypeId
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
 * @category errors
 * @since 4.0.0
 */
export const ExceededCapacityErrorTypeId: "~effect/Cause/ExceededCapacityError" = effect.ExceededCapacityErrorTypeId

/**
 * @example
 * ```ts
 * import { Cause } from "effect"
 *
 * const error: Cause.ExceededCapacityError = new Cause.ExceededCapacityError(
 *   "Capacity exceeded"
 * )
 * console.log(error._tag) // "ExceededCapacityError"
 * console.log(error.message) // "Capacity exceeded"
 * console.log(Cause.isExceededCapacityError(error)) // true
 * ```
 *
 * @since 4.0.0
 * @category errors
 */
export interface ExceededCapacityError extends YieldableError {
  readonly [ExceededCapacityErrorTypeId]: typeof ExceededCapacityErrorTypeId
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
 * @category errors
 * @since 4.0.0
 */
export const UnknownErrorTypeId: "~effect/Cause/UnknownError" = effect.UnknownErrorTypeId

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
 * const error: Cause.UnknownError = new Cause.UnknownError(
 *   "original cause",
 *   "Unknown error occurred"
 * )
 * console.log(error._tag) // "UnknownError"
 * console.log(error.message) // "Unknown error occurred"
 * console.log(Cause.isUnknownError(error)) // true
 * ```
 *
 * @since 4.0.0
 * @category errors
 */
export interface UnknownError extends YieldableError {
  readonly [UnknownErrorTypeId]: typeof UnknownErrorTypeId
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
 * Adds annotations to a `Cause` using a `ServiceMap` to store metadata
 * that can be retrieved later for debugging or tracing purposes.
 *
 * @category Annotations
 * @since 4.0.0
 */
export const annotate: {
  (
    annotations: ServiceMap.ServiceMap<never>,
    options?: { readonly overwrite?: boolean | undefined }
  ): <E>(self: Cause<E>) => Cause<E>
  <E>(
    self: Cause<E>,
    annotations: ServiceMap.ServiceMap<never>,
    options?: { readonly overwrite?: boolean | undefined }
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
 * Represents the stack frame captured at the point of failure.
 *
 * @category Annotations
 * @since 4.0.0
 */
export class StackTrace extends ServiceMap.Service<StackTrace, StackFrame>()("effect/Cause/StackTrace") {}

/**
 * Represents the span captured at the point of interruption.
 *
 * @category Annotations
 * @since 4.0.0
 */
export class InterruptorStackTrace
  extends ServiceMap.Service<InterruptorStackTrace, StackFrame>()("effect/Cause/InterruptorStackTrace")
{}
