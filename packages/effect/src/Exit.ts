/**
 * The `Exit` type represents the result of running an Effect computation.
 * An `Exit<A, E>` can either be:
 * - `Success`: Contains a value of type `A`
 * - `Failure`: Contains a `Cause<E>` describing why the effect failed
 *
 * `Exit` is used internally by the Effect runtime and can be useful for
 * handling the results of Effect computations in a more explicit way.
 *
 * @since 2.0.0
 */
import type * as Cause from "./Cause.ts"
import type * as Effect from "./Effect.ts"
import type * as Filter from "./Filter.ts"
import * as core from "./internal/core.ts"
import * as effect from "./internal/effect.ts"
import type { Option } from "./Option.ts"
import type { NoInfer } from "./Types.ts"

const TypeId = core.ExitTypeId

/**
 * The `Exit` type is used to represent the result of a `Effect` computation. It
 * can either be successful, containing a value of type `A`, or it can fail,
 * containing an error of type `E` wrapped in a `EffectCause`.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * // A successful exit
 * const success: Exit.Exit<number> = Exit.succeed(42)
 *
 * // A failed exit
 * const failure: Exit.Exit<number, string> = Exit.fail("error")
 *
 * // Pattern matching on the exit
 * const result = Exit.match(success, {
 *   onSuccess: (value) => `Got value: ${value}`,
 *   onFailure: (cause) => `Got error: ${cause}`
 * })
 * ```
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
    readonly [TypeId]: typeof TypeId
  }
}

/**
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const success = Exit.succeed(42)
 *
 * if (Exit.isSuccess(success)) {
 *   console.log(success._tag) // "Success"
 *   console.log(success.value) // 42
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Success<out A, out E = never> extends Exit.Proto<A, E> {
  readonly _tag: "Success"
  readonly value: A
}

/**
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const failure = Exit.fail("something went wrong")
 *
 * if (Exit.isFailure(failure)) {
 *   console.log(failure._tag) // "Failure"
 *   console.log(failure.cause) // Cause representing the error
 * }
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Failure<out A, out E> extends Exit.Proto<A, E> {
  readonly _tag: "Failure"
  readonly cause: Cause.Cause<E>
}

/**
 * Tests if a value is an `Exit`.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const success = Exit.succeed(42)
 * const failure = Exit.fail("error")
 *
 * console.log(Exit.isExit(success)) // true
 * console.log(Exit.isExit(failure)) // true
 * console.log(Exit.isExit("not an exit")) // false
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isExit: (u: unknown) => u is Exit<unknown, unknown> = core.isExit

/**
 * Creates a successful `Exit` containing the provided value.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const exit = Exit.succeed(42)
 * console.log(exit._tag) // "Success"
 * console.log(Exit.isSuccess(exit) ? exit.value : null) // 42
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const succeed: <A>(a: A) => Exit<A> = core.exitSucceed

/**
 * Creates a failed `Exit` from a `Cause`.
 *
 * @example
 * ```ts
 * import { Cause, Exit } from "effect"
 *
 * const cause = Cause.fail("Something went wrong")
 * const exit = Exit.failCause(cause)
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const failCause: <E>(cause: Cause.Cause<E>) => Exit<never, E> = core.exitFailCause

/**
 * Creates a failed `Exit` from an error value.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const exit = Exit.fail("Something went wrong")
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const fail: <E>(e: E) => Exit<never, E> = core.exitFail

/**
 * Creates a failed `Exit` from a defect (unexpected error).
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const exit = Exit.die(new Error("Unexpected error"))
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const die: (defect: unknown) => Exit<never> = core.exitDie

/**
 * Creates a failed `Exit` from fiber interruption.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const exit = Exit.interrupt(123)
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const interrupt: (fiberId?: number | undefined) => Exit<never> = effect.exitInterrupt

const void_: Exit<void> = effect.exitVoid
export {
  /**
   * A successful `Exit` with a void value.
   *
   * @example
   * ```ts
   * import { Exit } from "effect"
   *
   * const exit = Exit.void
   * console.log(exit._tag) // "Success"
   * console.log(Exit.isSuccess(exit) ? exit.value : null) // undefined
   * ```
   *
   * @category constructors
   * @since 2.0.0
   */
  void_ as void
}

/**
 * Tests if an `Exit` is successful.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const success = Exit.succeed(42)
 * const failure = Exit.fail("error")
 *
 * console.log(Exit.isSuccess(success)) // true
 * console.log(Exit.isSuccess(failure)) // false
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isSuccess: <A, E>(self: Exit<A, E>) => self is Success<A, E> = effect.exitIsSuccess

/**
 * Tests if an `Exit` is a failure.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const success = Exit.succeed(42)
 * const failure = Exit.fail("error")
 *
 * console.log(Exit.isFailure(success)) // false
 * console.log(Exit.isFailure(failure)) // true
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isFailure: <A, E>(self: Exit<A, E>) => self is Failure<A, E> = effect.exitIsFailure

/**
 * Tests if an `Exit` contains a typed error (as opposed to a defect or interruption).
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const failure = Exit.fail("error")
 * const defect = Exit.die(new Error("defect"))
 *
 * console.log(Exit.hasFail(failure)) // true
 * console.log(Exit.hasFail(defect)) // false
 * ```
 *
 * @category guards
 * @since 4.0.0
 */
export const hasFail: <A, E>(self: Exit<A, E>) => self is Failure<A, E> = effect.exitHasFail

/**
 * Tests if an `Exit` contains a defect (unexpected error).
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const failure = Exit.fail("error")
 * const defect = Exit.die(new Error("defect"))
 *
 * console.log(Exit.hasDie(failure)) // false
 * console.log(Exit.hasDie(defect)) // true
 * ```
 *
 * @category guards
 * @since 4.0.0
 */
export const hasDie: <A, E>(self: Exit<A, E>) => self is Failure<A, E> = effect.exitHasDie

/**
 * Tests if an `Exit` contains an interruption.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const failure = Exit.fail("error")
 * const interruption = Exit.interrupt(123)
 *
 * console.log(Exit.hasInterrupt(failure)) // false
 * console.log(Exit.hasInterrupt(interruption)) // true
 * ```
 *
 * @category guards
 * @since 4.0.0
 */
export const hasInterrupt: <A, E>(self: Exit<A, E>) => self is Failure<A, E> = effect.exitHasInterrupt

/**
 * @category filters
 * @since 4.0.0
 */
export const filterSuccess: <A, E>(
  self: Exit<A, E>
) => Success<A> | Filter.fail<Failure<never, E>> = effect.exitFilterSuccess

/**
 * @category filters
 * @since 4.0.0
 */
export const filterValue: <A, E>(self: Exit<A, E>) => A | Filter.fail<Failure<never, E>> = effect.exitFilterValue

/**
 * @category filters
 * @since 4.0.0
 */
export const filterFailure: <A, E>(self: Exit<A, E>) => Failure<never, E> | Filter.fail<Success<A>> =
  effect.exitFilterFailure

/**
 * @category filters
 * @since 4.0.0
 */
export const filterCause: <A, E>(self: Exit<A, E>) => Cause.Cause<E> | Filter.fail<Success<A>> = effect.exitFilterCause

/**
 * @category filters
 * @since 4.0.0
 */
export const filterError: <A, E>(input: Exit<A, E>) => E | Filter.fail<Exit<A, E>> = effect.exitFilterError

/**
 * @category filters
 * @since 4.0.0
 */
export const filterDefect: <A, E>(input: Exit<A, E>) => {} | Filter.fail<Exit<A, E>> = effect.exitFilterDefect

/**
 * Pattern matches on an `Exit` value, handling both success and failure cases.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const success = Exit.succeed(42)
 * const failure = Exit.fail("error")
 *
 * const result1 = Exit.match(success, {
 *   onSuccess: (value) => `Success: ${value}`,
 *   onFailure: (cause) => `Failure: ${cause}`
 * })
 * console.log(result1) // "Success: 42"
 *
 * const result2 = Exit.match(failure, {
 *   onSuccess: (value) => `Success: ${value}`,
 *   onFailure: (cause) => `Failure: ${cause}`
 * })
 * console.log(result2) // "Failure: [object Object]"
 * ```
 *
 * @category pattern matching
 * @since 2.0.0
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
 * Transforms the success value of an `Exit` using the provided function.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const success = Exit.succeed(42)
 * const failure = Exit.fail("error")
 *
 * const doubled = Exit.map(success, (x) => x * 2)
 * console.log(doubled) // Exit.succeed(84)
 *
 * const stillFailure = Exit.map(failure, (x) => x * 2)
 * console.log(stillFailure) // Exit.fail("error")
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const map: {
  <A, B>(f: (a: A) => B): <E>(self: Exit<A, E>) => Exit<B, E>
  <A, E, B>(self: Exit<A, E>, f: (a: A) => B): Exit<B, E>
} = effect.exitMap

/**
 * Transforms the error value of a failed `Exit` using the provided function.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const success = Exit.succeed(42)
 * const failure = Exit.fail("error")
 *
 * const stillSuccess = Exit.mapError(success, (e: string) => e.toUpperCase())
 * console.log(stillSuccess) // Exit.succeed(42)
 *
 * const mappedFailure = Exit.mapError(failure, (e: string) => e.toUpperCase())
 * console.log(mappedFailure) // Exit.fail("ERROR")
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const mapError: {
  <E, E2>(f: (a: NoInfer<E>) => E2): <A>(self: Exit<A, E>) => Exit<A, E2>
  <A, E, E2>(self: Exit<A, E>, f: (a: NoInfer<E>) => E2): Exit<A, E2>
} = effect.exitMapError

/**
 * Transforms both the success and error values of an `Exit`.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const success = Exit.succeed(42)
 * const failure = Exit.fail("error")
 *
 * const mappedSuccess = Exit.mapBoth(success, {
 *   onSuccess: (x: number) => x.toString(),
 *   onFailure: (e: string) => e.toUpperCase()
 * })
 * console.log(mappedSuccess) // Exit.succeed("42")
 *
 * const mappedFailure = Exit.mapBoth(failure, {
 *   onSuccess: (x: number) => x.toString(),
 *   onFailure: (e: string) => e.toUpperCase()
 * })
 * console.log(mappedFailure) // Exit.fail("ERROR")
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const mapBoth: {
  <E, E2, A, A2>(
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): (self: Exit<A, E>) => Exit<A2, E2>
  <A, E, E2, A2>(
    self: Exit<A, E>,
    options: { readonly onFailure: (e: E) => E2; readonly onSuccess: (a: A) => A2 }
  ): Exit<A2, E2>
} = effect.exitMapBoth

/**
 * Discards the success value of an `Exit`, replacing it with `void`.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const success = Exit.succeed(42)
 * const failure = Exit.fail("error")
 *
 * const voidSuccess = Exit.asVoid(success)
 * console.log(voidSuccess) // Exit.succeed(undefined)
 *
 * const stillFailure = Exit.asVoid(failure)
 * console.log(stillFailure) // Exit.fail("error")
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const asVoid: <A, E>(self: Exit<A, E>) => Exit<void, E> = effect.exitAsVoid

/**
 * Combines multiple `Exit` values into a single `Exit<void, E>`. If all are successful,
 * the result is a success. If any fail, the result is a failure with the combined errors.
 *
 * @example
 * ```ts
 * import { Exit } from "effect"
 *
 * const exits1 = [Exit.succeed(1), Exit.succeed(2), Exit.succeed(3)]
 * const result1 = Exit.asVoidAll(exits1)
 * console.log(result1) // Exit.succeed(undefined)
 *
 * const exits2 = [Exit.succeed(1), Exit.fail("error"), Exit.succeed(3)]
 * const result2 = Exit.asVoidAll(exits2)
 * console.log(result2) // Exit.fail(...)
 * ```
 *
 * @category combinators
 * @since 4.0.0
 */
export const asVoidAll: <I extends Iterable<Exit<any, any>>>(
  exits: I
) => Exit<void, I extends Iterable<Exit<infer _A, infer _E>> ? _E : never> = effect.exitAsVoidAll

/**
 * @category Accessors
 * @since 4.0.0
 */
export const getSuccess: <A, E>(self: Exit<A, E>) => Option<A> = effect.exitGetSuccess

/**
 * @category Accessors
 * @since 4.0.0
 */
export const getCause: <A, E>(self: Exit<A, E>) => Option<Cause.Cause<E>> = effect.exitGetCause

/**
 * @category Accessors
 * @since 4.0.0
 */
export const getError: <A, E>(self: Exit<A, E>) => Option<E> = effect.exitGetError
