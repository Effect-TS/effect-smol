/**
 * @since 4.0.0
 */
import * as Cause from "./Cause.ts"
import type { Effect } from "./Effect.ts"
import * as Exit from "./Exit.ts"
import * as Filter from "./Filter.ts"
import { dual } from "./Function.ts"
import * as internalEffect from "./internal/effect.ts"
import * as Result from "./Result.ts"

/**
 * @category models
 * @since 4.0.0
 */
export interface Pull<out A, out E = never, out Done = void, out R = never>
  extends Effect<A, E | Cause.Done<Done>, R>
{}

/**
 * Extracts the success type from a Pull type.
 *
 * @category type extractors
 * @since 4.0.0
 */
export type Success<P> = P extends Effect<infer _A, infer _E, infer _R> ? _A : never

/**
 * Extracts the error type from a Pull type, excluding Done errors.
 *
 * @category type extractors
 * @since 4.0.0
 */
export type Error<P> = P extends Effect<infer _A, infer _E, infer _R> ? _E extends Cause.Done<infer _L> ? never : _E
  : never

/**
 * Extracts the leftover type from a Pull type.
 *
 * @category type extractors
 * @since 4.0.0
 */
export type Leftover<P> = P extends Effect<infer _A, infer _E, infer _R> ? _E extends Cause.Done<infer _L> ? _L : never
  : never

/**
 * Extracts the service requirements (context) type from a Pull type.
 *
 * @category type extractors
 * @since 4.0.0
 */
export type Services<P> = P extends Effect<infer _A, infer _E, infer _R> ? _R : never

/**
 * Excludes done errors from an error type union.
 *
 * @category type extractors
 * @since 4.0.0
 */
export type ExcludeDone<E> = Exclude<E, Cause.Done<any>>

// -----------------------------------------------------------------------------
// Done
// -----------------------------------------------------------------------------

/**
 * @category Done
 * @since 4.0.0
 */
export const catchDone: {
  <E, A2, E2, R2>(f: (leftover: Cause.Done.Extract<E>) => Effect<A2, E2, R2>): <A, R>(
    self: Effect<A, E, R>
  ) => Effect<A | A2, ExcludeDone<E> | E2, R | R2>
  <A, R, E, A2, E2, R2>(
    self: Effect<A, E, R>,
    f: (leftover: Cause.Done.Extract<E>) => Effect<A2, E2, R2>
  ): Effect<A | A2, ExcludeDone<E> | E2, R | R2>
} = dual(2, <A, R, E, A2, E2, R2>(
  effect: Effect<A, E, R>,
  f: (leftover: Cause.Done.Extract<E>) => Effect<A2, E2, R2>
): Effect<A | A2, ExcludeDone<E> | E2, R | R2> =>
  internalEffect.catchCauseFilter(effect, filterDoneLeftover as any, (l: any) => f(l)) as any)

/**
 * Checks if a Cause contains any done errors.
 *
 * @category Done
 * @since 4.0.0
 */
export const isDoneCause = <E>(cause: Cause.Cause<E>): boolean => cause.reasons.some(isDoneFailure)

/**
 * Checks if a Cause failure is a done error.
 *
 * @category Done
 * @since 4.0.0
 */
export const isDoneFailure = <E>(
  failure: Cause.Reason<E>
): failure is Cause.Fail<E & Cause.Done<any>> => failure._tag === "Fail" && Cause.isDone(failure.error)

/**
 * Filters a Cause to extract only halt errors.
 *
 * @category Done
 * @since 4.0.0
 */
export const filterDone: <E>(
  input: Cause.Cause<E>
) => Result.Result<Cause.Done.Only<E>, Cause.Cause<ExcludeDone<E>>> = Filter
  .composePassthrough(
    Cause.findError,
    (e) => Cause.isDone(e) ? Result.succeed(e) : Result.fail(e)
  ) as any

/**
 * Filters a Cause to extract only halt errors.
 *
 * @category Done
 * @since 4.0.0
 */
export const filterDoneVoid: <E extends Cause.Done>(
  input: Cause.Cause<E>
) => Result.Result<Cause.Done, Cause.Cause<Exclude<E, Cause.Done>>> = Filter.composePassthrough(
  Cause.findError,
  (e) => Cause.isDone(e) ? Result.succeed(e) : Result.fail(e)
) as any

/**
 * @category Done
 * @since 4.0.0
 */
export const filterNoDone: <E>(
  input: Cause.Cause<E>
) => Result.Result<
  Cause.Cause<ExcludeDone<E>>,
  Cause.Cause<E>
> = Filter.fromPredicate((cause: Cause.Cause<unknown>) =>
  cause.reasons.every((failure) => !isDoneFailure(failure))
) as any

/**
 * Filters a Cause to extract the leftover value from done errors.
 *
 * @category Done
 * @since 4.0.0
 */
export const filterDoneLeftover: <E>(
  cause: Cause.Cause<E>
) => Result.Result<Cause.Done.Extract<E>, Cause.Cause<ExcludeDone<E>>> = Filter.composePassthrough(
  Cause.findError,
  (e) => Cause.isDone(e) ? Result.succeed(e.value) : Result.fail(e)
) as any

/**
 * Converts a Cause into an Exit, extracting halt leftovers as success values.
 *
 * @category Done
 * @since 4.0.0
 */
export const doneExitFromCause = <E>(cause: Cause.Cause<E>): Exit.Exit<Cause.Done.Extract<E>, ExcludeDone<E>> => {
  const halt = filterDone(cause)
  return !Result.isFailure(halt) ? Exit.succeed(halt.success.value as any) : Exit.failCause(halt.failure)
}

/**
 * Pattern matches on a Pull, handling success, failure, and done cases.
 *
 * **Example** (Matching Pull outcomes)
 *
 * ```ts
 * import { Cause, Effect, Pull } from "effect"
 *
 * const pull = Cause.done("stream ended")
 *
 * const result = Pull.matchEffect(pull, {
 *   onSuccess: (value) => Effect.succeed(`Got value: ${value}`),
 *   onFailure: (cause) => Effect.succeed(`Got error: ${cause}`),
 *   onDone: (leftover) => Effect.succeed(`Stream halted with: ${leftover}`)
 * })
 * ```
 *
 * @category pattern matching
 * @since 4.0.0
 */
export const matchEffect: {
  <A, E, L, AS, ES, RS, AF, EF, RF, AH, EH, RH>(options: {
    readonly onSuccess: (value: A) => Effect<AS, ES, RS>
    readonly onFailure: (failure: Cause.Cause<E>) => Effect<AF, EF, RF>
    readonly onDone: (leftover: L) => Effect<AH, EH, RH>
  }): <R>(self: Pull<A, E, L, R>) => Effect<AS | AF | AH, ES | EF | EH, R | RS | RF | RH>
  <A, E, L, R, AS, ES, RS, AF, EF, RF, AH, EH, RH>(self: Pull<A, E, L, R>, options: {
    readonly onSuccess: (value: A) => Effect<AS, ES, RS>
    readonly onFailure: (failure: Cause.Cause<E>) => Effect<AF, EF, RF>
    readonly onDone: (leftover: L) => Effect<AH, EH, RH>
  }): Effect<AS | AF | AH, ES | EF | EH, R | RS | RF | RH>
} = dual(2, <A, E, L, R, AS, ES, RS, AF, EF, RF, AH, EH, RH>(self: Pull<A, E, L, R>, options: {
  readonly onSuccess: (value: A) => Effect<AS, ES, RS>
  readonly onFailure: (failure: Cause.Cause<E>) => Effect<AF, EF, RF>
  readonly onDone: (leftover: L) => Effect<AH, EH, RH>
}): Effect<AS | AF | AH, ES | EF | EH, R | RS | RF | RH> =>
  internalEffect.matchCauseEffect(self, {
    onSuccess: options.onSuccess,
    onFailure: (cause): Effect<AS | AF | AH, ES | EF | EH, RS | RF | RH> => {
      const halt = filterDone(cause)
      return !Result.isFailure(halt) ? options.onDone(halt.success.value as L) : options.onFailure(halt.failure)
    }
  }))
