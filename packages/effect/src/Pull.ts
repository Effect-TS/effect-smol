/**
 * @since 4.0.0
 */
import * as Cause from "./Cause.ts"
import type { Effect } from "./Effect.ts"
import * as Exit from "./Exit.ts"
import * as Filter from "./Filter.ts"
import { dual } from "./Function.ts"
import * as internalEffect from "./internal/effect.ts"

/**
 * @since 4.0.0
 * @category models
 */
export interface Pull<out A, out E = never, out Done = void, out R = never>
  extends Effect<A, E | Cause.Done<Done>, R>
{}

/**
 * Extracts the success type from a Pull type.
 *
 * @since 4.0.0
 * @category type extractors
 */
export type Success<P> = P extends Effect<infer _A, infer _E, infer _R> ? _A : never

/**
 * Extracts the error type from a Pull type, excluding Done errors.
 *
 * @since 4.0.0
 * @category type extractors
 */
export type Error<P> = P extends Effect<infer _A, infer _E, infer _R> ? _E extends Cause.Done<infer _L> ? never : _E
  : never

/**
 * Extracts the leftover type from a Pull type.
 *
 * @since 4.0.0
 * @category type extractors
 */
export type Leftover<P> = P extends Effect<infer _A, infer _E, infer _R> ? _E extends Cause.Done<infer _L> ? _L : never
  : never

/**
 * Extracts the service requirements (context) type from a Pull type.
 *
 * @since 4.0.0
 * @category type extractors
 */
export type Services<P> = P extends Effect<infer _A, infer _E, infer _R> ? _R : never

/**
 * Excludes done errors from an error type union.
 *
 * @since 4.0.0
 * @category type extractors
 */
export type ExcludeDone<E> = Exclude<E, Cause.Done<any>>

// -----------------------------------------------------------------------------
// Done
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 * @category Done
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
  internalEffect.catchCauseFilter(effect, filterDoneLeftover, (l) => f(l)) as any)

/**
 * Checks if a Cause contains any done errors.
 *
 * @since 4.0.0
 * @category Done
 */
export const isDoneCause = <E>(cause: Cause.Cause<E>): boolean => cause.failures.some(isDoneFailure)

/**
 * Checks if a Cause failure is a done error.
 *
 * @since 4.0.0
 * @category Done
 */
export const isDoneFailure = <E>(
  failure: Cause.Failure<E>
): failure is Cause.Fail<E & Cause.Done<any>> => failure._tag === "Fail" && Cause.isDone(failure.error)

/**
 * Filters a Cause to extract only halt errors.
 *
 * @since 4.0.0
 * @category Done
 */
export const filterDone: <E>(input: Cause.Cause<E>) => Cause.Done.Only<E> | Filter.fail<Cause.Cause<ExcludeDone<E>>> =
  Filter
    .composePassthrough(
      Cause.filterError,
      (e) => Cause.isDone(e) ? e : Filter.fail(e)
    ) as any

/**
 * Filters a Cause to extract only halt errors.
 *
 * @since 4.0.0
 * @category Done
 */
export const filterDoneVoid: <E extends Cause.Done>(
  input: Cause.Cause<E>
) => Cause.Done | Filter.fail<Cause.Cause<Exclude<E, Cause.Done>>> = Filter.composePassthrough(
  Cause.filterError,
  (e) => Cause.isDone(e) ? e : Filter.fail(e)
) as any

/**
 * @since 4.0.0
 * @category Done
 */
export const filterNoDone: <E>(
  input: Cause.Cause<E>
) => Cause.Cause<ExcludeDone<E>> | Filter.fail<Cause.Cause<E>> = Filter
  .fromPredicate((cause: Cause.Cause<unknown>) => cause.failures.every((failure) => !isDoneFailure(failure))) as any

/**
 * Filters a Cause to extract the leftover value from done errors.
 *
 * @since 4.0.0
 * @category Done
 */
export const filterDoneLeftover: <E>(
  cause: Cause.Cause<E>
) => Cause.Done.Extract<E> | Filter.fail<Cause.Cause<ExcludeDone<E>>> = Filter.composePassthrough(
  Cause.filterError,
  (e) => Cause.isDone(e) ? e.value : Filter.fail(e)
) as any

/**
 * Converts a Cause into an Exit, extracting halt leftovers as success values.
 *
 * @since 4.0.0
 * @category Done
 */
export const doneExitFromCause = <E>(cause: Cause.Cause<E>): Exit.Exit<Cause.Done.Extract<E>, ExcludeDone<E>> => {
  const halt = filterDone(cause)
  return !Filter.isFail(halt) ? Exit.succeed(halt.value as any) : Exit.failCause(halt.fail)
}

/**
 * Pattern matches on a Pull, handling success, failure, and done cases.
 *
 * @example
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
 * @since 4.0.0
 * @category pattern matching
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
      return !Filter.isFail(halt) ? options.onDone(halt.value as L) : options.onFailure(halt.fail)
    }
  }))
