/**
 * @since 4.0.0
 */
import * as Cause from "./Cause.js"
import type { Effect } from "./Effect.js"
import * as Exit from "./Exit.js"
import * as Filter from "./Filter.js"
import { dual } from "./Function.js"
import * as internalEffect from "./internal/effect.js"
import { hasProperty } from "./Predicate.js"

/**
 * A Pull is a specialized Effect that represents a pull-based stream operation.
 * It can either emit a value of type `A`, fail with an error of type `E`,
 * or halt with a value of type `Done`.
 *
 * @example
 * ```ts
 * import { Pull, Effect } from "effect"
 *
 * // A Pull that emits a single value
 * const pullValue: Pull.Pull<number> = Effect.succeed(42)
 *
 * // A Pull that fails with an error
 * const pullError: Pull.Pull<number, string> = Effect.fail("Error occurred")
 *
 * // A Pull that halts with a completion value
 * const pullHalt: Pull.Pull<number, never, string> = Pull.halt("completed")
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface Pull<out A, out E = never, out Done = void, out R = never> extends Effect<A, E | Halt<Done>, R> {}

/**
 * Extracts the success type from a Pull type.
 *
 * @example
 * ```ts
 * import { Pull, Effect } from "effect"
 *
 * type MyPull = Pull.Pull<number, string, void>
 * type SuccessType = Pull.Success<MyPull> // number
 * ```
 *
 * @since 4.0.0
 * @category type extractors
 */
export type Success<P> = P extends Effect<infer _A, infer _E, infer _R> ? _A : never

/**
 * Extracts the error type from a Pull type, excluding halt errors.
 *
 * @example
 * ```ts
 * import { Pull, Effect } from "effect"
 *
 * type MyPull = Pull.Pull<number, string, void>
 * type ErrorType = Pull.Error<MyPull> // string
 * ```
 *
 * @since 4.0.0
 * @category type extractors
 */
export type Error<P> = P extends Effect<infer _A, infer _E, infer _R> ? _E extends Halt<infer _L> ? never : _E
  : never

/**
 * Extracts the leftover/halt type from a Pull type.
 *
 * @example
 * ```ts
 * import { Pull, Effect } from "effect"
 *
 * type MyPull = Pull.Pull<number, string, number>
 * type LeftoverType = Pull.Leftover<MyPull> // number
 * ```
 *
 * @since 4.0.0
 * @category type extractors
 */
export type Leftover<P> = P extends Effect<infer _A, infer _E, infer _R> ? _E extends Halt<infer _L> ? _L : never
  : never

/**
 * Extracts the service requirements (context) type from a Pull type.
 *
 * @example
 * ```ts
 * import { Pull, Effect, ServiceMap } from "effect"
 *
 * interface MyService {
 *   readonly value: number
 * }
 * const MyService = ServiceMap.Key<MyService>("MyService")
 *
 * type MyPull = Pull.Pull<number, string, void, MyService>
 * type ServiceType = Pull.ServiceMap<MyPull> // MyService
 * ```
 *
 * @since 4.0.0
 * @category type extractors
 */
export type ServiceMap<P> = P extends Effect<infer _A, infer _E, infer _R> ? _R : never

/**
 * Excludes halt errors from an error type union.
 *
 * @example
 * ```ts
 * import { Pull } from "effect"
 *
 * type ErrorUnion = string | Pull.Halt<number> | Error
 * type WithoutHalt = Pull.ExcludeHalt<ErrorUnion> // string | Error
 * ```
 *
 * @since 4.0.0
 * @category type extractors
 */
export type ExcludeHalt<E> = Exclude<E, Halt<any>>

// -----------------------------------------------------------------------------
// Halt
// -----------------------------------------------------------------------------

/**
 * The type identifier for Halt errors.
 *
 * @example
 * ```ts
 * import { Pull } from "effect"
 *
 * console.log(Pull.HaltTypeId) // "~effect/Pull/Halt"
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export const HaltTypeId: HaltTypeId = "~effect/Pull/Halt"

/**
 * The type identifier for Halt errors.
 *
 * @example
 * ```ts
 * import { Pull } from "effect"
 *
 * type Id = Pull.HaltTypeId // "~effect/Pull/Halt"
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export type HaltTypeId = "~effect/Pull/Halt"

/**
 * Represents a halt error that carries a leftover value.
 * Used to signal the end of a Pull operation with a final value.
 *
 * @since 4.0.0
 * @category Halt
 */
export class Halt<out L> {
  /**
   * @since 4.0.0
   */
  readonly [HaltTypeId]: HaltTypeId = HaltTypeId

  constructor(readonly leftover: L) {}
}

/**
 * @since 4.0.0
 * @category Done
 */
export class Done extends Halt<void> {
  /**
   * @since 4.0.0
   */
  readonly _tag: "Done" = "Done" as const
  constructor() {
    super(void 0)
  }
}

/**
 * @since 4.0.0
 * @category Done
 */
export const done: Done = new Done()

/**
 * @since 4.0.0
 * @category Done
 */
export const isDone = (u: unknown): u is Done => isHalt(u) && (u as Done)._tag === "Done"

/**
 * @since 4.0.0
 * @category Done
 */
export const filterDone: Filter.Filter<unknown, Done> = Filter.fromPredicate(isDone)

/**
 * Namespace containing utility types for working with Halt errors.
 *
 * @example
 * ```ts
 * import { Pull } from "effect"
 *
 * // Extract leftover type from halt
 * type MyHalt = Pull.Halt<string>
 * type Leftover = Pull.Halt.Extract<MyHalt> // string
 *
 * // Filter only halt errors from union
 * type ErrorUnion = string | Pull.Halt<number>
 * type OnlyHalt = Pull.Halt.Only<ErrorUnion> // Pull.Halt<number>
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export declare namespace Halt {
  /**
   * Extracts the leftover type from a Halt error.
   *
   * @example
   * ```ts
   * import { Pull } from "effect"
   *
   * type MyHalt = Pull.Halt<string>
   * type Leftover = Pull.Halt.Extract<MyHalt> // string
   * ```
   *
   * @since 4.0.0
   * @category Halt
   */
  export type Extract<E> = E extends Halt<infer L> ? L : never

  /**
   * Filters a type union to only include Halt errors.
   *
   * @example
   * ```ts
   * import { Pull } from "effect"
   *
   * type ErrorUnion = string | Pull.Halt<number>
   * type OnlyHalt = Pull.Halt.Only<ErrorUnion> // Pull.Halt<number>
   * ```
   *
   * @since 4.0.0
   * @category Halt
   */
  export type Only<E> = E extends Halt<infer L> ? Halt<L> : never
}

/**
 * Catches halt errors and handles them with a recovery function.
 *
 * @example
 * ```ts
 * import { Pull, Effect } from "effect"
 *
 * const pullWithHalt = Pull.halt("stream ended")
 * const recovered = Pull.catchHalt(pullWithHalt, (leftover) =>
 *   Effect.succeed(`Recovered from: ${leftover}`)
 * )
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export const catchHalt: {
  <E, A2, E2, R2>(f: (leftover: Halt.Extract<E>) => Effect<A2, E2, R2>): <A, R>(
    self: Effect<A, E, R>
  ) => Effect<A | A2, ExcludeHalt<E> | E2, R | R2>
  <A, R, E, A2, E2, R2>(
    self: Effect<A, E, R>,
    f: (leftover: Halt.Extract<E>) => Effect<A2, E2, R2>
  ): Effect<A | A2, ExcludeHalt<E> | E2, R | R2>
} = dual(2, <A, R, E, A2, E2, R2>(
  effect: Effect<A, E, R>,
  f: (leftover: Halt.Extract<E>) => Effect<A2, E2, R2>
): Effect<A | A2, ExcludeHalt<E> | E2, R | R2> =>
  internalEffect.catchCauseIf(effect, filterHaltLeftover, (l) => f(l)) as any)

/**
 * Checks if a value is a Halt error.
 *
 * @example
 * ```ts
 * import { Pull } from "effect"
 *
 * const halt = new Pull.Halt("completed")
 * const regularError = new Error("failed")
 *
 * console.log(Pull.isHalt(halt)) // true
 * console.log(Pull.isHalt(regularError)) // false
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export const isHalt = (u: unknown): u is Halt<unknown> => hasProperty(u, HaltTypeId)

/**
 * Checks if a Cause contains any halt errors.
 *
 * @example
 * ```ts
 * import { Pull, Cause } from "effect"
 *
 * const halt = new Pull.Halt("completed")
 * const causeWithHalt = Cause.fail(halt)
 * const regularCause = Cause.fail("regular error")
 *
 * console.log(Pull.isHaltCause(causeWithHalt)) // true
 * console.log(Pull.isHaltCause(regularCause)) // false
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export const isHaltCause = <E>(cause: Cause.Cause<E>): boolean => cause.failures.some(isHaltFailure)

/**
 * Checks if a Cause failure is a halt error.
 *
 * @example
 * ```ts
 * import { Pull, Cause } from "effect"
 *
 * const halt = new Pull.Halt("completed")
 * const haltCause = Cause.fail(halt)
 * const regularCause = Cause.fail("regular error")
 *
 * const haltFailure = haltCause.failures[0]
 * const regularFailure = regularCause.failures[0]
 *
 * console.log(Pull.isHaltFailure(haltFailure)) // true
 * console.log(Pull.isHaltFailure(regularFailure)) // false
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export const isHaltFailure = <E>(
  failure: Cause.Failure<E>
): failure is Cause.Fail<E & Halt<any>> => failure._tag === "Fail" && isHalt(failure.error)

/**
 * Filters a Cause to extract only halt errors.
 *
 * @since 4.0.0
 * @category Halt
 */
export const filterHalt: <E>(input: Cause.Cause<E>) => Halt.Only<E> | Filter.fail<Cause.Cause<ExcludeHalt<E>>> = Filter
  .composePassthrough(
    Cause.filterError,
    (e) => isHalt(e) ? e : Filter.fail(e)
  ) as any

/**
 * @since 4.0.0
 * @category Halt
 */
export const filterNoHalt: <E>(
  input: Cause.Cause<E>
) => Cause.Cause<ExcludeHalt<E>> | Filter.fail<Cause.Cause<E>> = Filter
  .fromPredicate((cause: Cause.Cause<unknown>) => cause.failures.every((failure) => !isHaltFailure(failure))) as any

/**
 * Filters a Cause to extract the leftover value from halt errors.
 *
 * @example
 * ```ts
 * import { Pull, Cause } from "effect"
 *
 * const halt = new Pull.Halt("stream completed")
 * const causeWithHalt = Cause.fail(halt)
 * const leftover = Pull.filterHaltLeftover(causeWithHalt)
 *
 * // leftover will be "stream completed" if halt is present
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export const filterHaltLeftover: <E>(
  cause: Cause.Cause<E>
) => Halt.Extract<E> | Filter.fail<Cause.Cause<ExcludeHalt<E>>> = Filter.composePassthrough(
  Cause.filterError,
  (e) => isHalt(e) ? e.leftover : Filter.fail(e)
) as any

/**
 * Creates a Pull that halts with the specified leftover value.
 *
 * @example
 * ```ts
 * import { Pull, Effect } from "effect"
 *
 * // Create a halt with a string leftover
 * const haltWithMessage = Pull.halt("operation completed")
 *
 * // Create a halt with a number leftover
 * const haltWithCount = Pull.halt(42)
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export const halt = <L>(leftover: L): Effect<never, Halt<L>> => internalEffect.fail(new Halt(leftover))

/**
 * A pre-defined halt with void leftover, commonly used to signal completion.
 *
 * @example
 * ```ts
 * import { Pull, Effect } from "effect"
 *
 * // Use the pre-defined halt with void
 * const completePull = Pull.haltVoid
 *
 * // Equivalent to:
 * const samePull = Pull.halt(void 0)
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export const haltVoid: Effect<never, Halt<void>> = internalEffect.fail(new Halt(void 0))

/**
 * Converts a Cause into an Exit, extracting halt leftovers as success values.
 *
 * @example
 * ```ts
 * import { Pull, Cause, Exit } from "effect"
 *
 * const halt = new Pull.Halt("completed")
 * const causeWithHalt = Cause.fail(halt)
 * const exit = Pull.haltExitFromCause(causeWithHalt)
 *
 * // exit will be Exit.succeed("completed")
 * ```
 *
 * @since 4.0.0
 * @category Halt
 */
export const haltExitFromCause = <E>(cause: Cause.Cause<E>): Exit.Exit<Halt.Extract<E>, ExcludeHalt<E>> => {
  const halt = filterHalt(cause)
  return !Filter.isFail(halt) ? Exit.succeed(halt.leftover as any) : Exit.failCause(halt.fail)
}

/**
 * Pattern matches on a Pull, handling success, failure, and halt cases.
 *
 * @example
 * ```ts
 * import { Pull, Effect, Cause } from "effect"
 *
 * const pull = Pull.halt("stream ended")
 *
 * const result = Pull.matchEffect(pull, {
 *   onSuccess: (value) => Effect.succeed(`Got value: ${value}`),
 *   onFailure: (cause) => Effect.succeed(`Got error: ${cause}`),
 *   onHalt: (leftover) => Effect.succeed(`Stream halted with: ${leftover}`)
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
    readonly onHalt: (leftover: L) => Effect<AH, EH, RH>
  }): <R>(self: Pull<A, E, L, R>) => Effect<AS | AF | AH, ES | EF | EH, R | RS | RF | RH>
  <A, E, L, R, AS, ES, RS, AF, EF, RF, AH, EH, RH>(self: Pull<A, E, L, R>, options: {
    readonly onSuccess: (value: A) => Effect<AS, ES, RS>
    readonly onFailure: (failure: Cause.Cause<E>) => Effect<AF, EF, RF>
    readonly onHalt: (leftover: L) => Effect<AH, EH, RH>
  }): Effect<AS | AF | AH, ES | EF | EH, R | RS | RF | RH>
} = dual(2, <A, E, L, R, AS, ES, RS, AF, EF, RF, AH, EH, RH>(self: Pull<A, E, L, R>, options: {
  readonly onSuccess: (value: A) => Effect<AS, ES, RS>
  readonly onFailure: (failure: Cause.Cause<E>) => Effect<AF, EF, RF>
  readonly onHalt: (leftover: L) => Effect<AH, EH, RH>
}): Effect<AS | AF | AH, ES | EF | EH, R | RS | RF | RH> =>
  internalEffect.matchCauseEffect(self, {
    onSuccess: options.onSuccess,
    onFailure: (cause): Effect<AS | AF | AH, ES | EF | EH, RS | RF | RH> => {
      const halt = filterHalt(cause)
      return !Filter.isFail(halt) ? options.onHalt(halt.leftover as L) : options.onFailure(halt.fail)
    }
  }))
