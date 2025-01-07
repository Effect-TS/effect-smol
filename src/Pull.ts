/**
 * @since 4.0.0
 */
import type * as Cause from "./Cause.js"
import * as Effect from "./Effect.js"
import * as Exit from "./Exit.js"
import { dual } from "./Function.js"
import { hasProperty } from "./Predicate.js"
import type { NoInfer } from "./Types.js"

/**
 * @since 4.0.0
 * @category models
 */
export interface Pull<out A, out E = never, out Done = void, out R = never>
  extends Effect.Effect<A, E | Halt<Done>, R>
{}

/**
 * @since 4.0.0
 * @category type extractors
 */
export type Success<P> = P extends Effect.Effect<infer _A, infer _E, infer _R> ? _A : never

/**
 * @since 4.0.0
 * @category type extractors
 */
export type Error<P> = P extends Effect.Effect<infer _A, infer _E, infer _R> ? _E extends Halt<infer _L> ? never : _E
  : never

/**
 * @since 4.0.0
 * @category type extractors
 */
export type Leftover<P> = P extends Effect.Effect<infer _A, infer _E, infer _R> ? _E extends Halt<infer _L> ? _L : never
  : never

/**
 * @since 4.0.0
 * @category type extractors
 */
export type Context<P> = P extends Effect.Effect<infer _A, infer _E, infer _R> ? _R : never

/**
 * @since 4.0.0
 * @category type extractors
 */
export type ExcludeHalt<E> = Exclude<E, Halt<any>>

// -----------------------------------------------------------------------------
// Halt
// -----------------------------------------------------------------------------

/**
 * @since 4.0.0
 * @category Halt
 */
export const HaltTypeId: unique symbol = Symbol.for("effect/Pull/Halt")

/**
 * @since 4.0.0
 * @category Halt
 */
export type HaltTypeId = typeof HaltTypeId

/**
 * @since 4.0.0
 * @category Halt
 */
export class Halt<out L> {
  /**
   * @since 4.0.0
   */
  readonly [HaltTypeId]: HaltTypeId = HaltTypeId
  /**
   * @since 4.0.0
   */
  readonly _tag = "Halt"
  constructor(readonly leftover: L) {}
}

/**
 * @since 4.0.0
 * @category Halt
 */
export declare namespace Halt {
  /**
   * @since 4.0.0
   * @category Halt
   */
  export type Extract<E> = E extends Halt<infer L> ? L : never

  /**
   * @since 4.0.0
   * @category Halt
   */
  export type Only<E> = E extends Halt<infer L> ? Halt<L> : never
}

/**
 * @since 4.0.0
 * @category Halt
 */
export function catchHalt<A, R, E, A2, E2, R2>(
  effect: Effect.Effect<A, E, R>,
  f: (leftover: Halt.Extract<E>) => Effect.Effect<A2, E2, R2>
): Effect.Effect<A | A2, ExcludeHalt<E> | E2, R | R2> {
  return Effect.catchFailure(effect, isHaltFailure, (failure) => f(failure.error.leftover)) as any
}

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHalt = (u: unknown): u is Halt<unknown> => hasProperty(u, HaltTypeId)

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHaltCause = <E>(cause: Cause.Cause<E>): boolean => cause.failures.some(isHaltFailure)

/**
 * @since 4.0.0
 * @category Halt
 */
export const isHaltFailure = <E>(
  failure: Cause.Failure<E>
): failure is Cause.Fail<E & Halt<any>> => failure._tag === "Fail" && isHalt(failure.error)

/**
 * @since 4.0.0
 * @category Halt
 */
export const halt = <L>(leftover: L): Effect.Effect<never, Halt<L>> => Effect.fail(new Halt(leftover))

/**
 * @since 4.0.0
 * @category Halt
 */
export const haltVoid: Effect.Effect<never, Halt<void>> = Effect.fail(new Halt(void 0))

/**
 * @since 4.0.0
 * @category Halt
 */
export const haltFromCause = <E>(cause: Cause.Cause<E>): Halt<Halt.Extract<E>> | undefined =>
  cause.failures.find(isHaltFailure)?.error

/**
 * @since 4.0.0
 * @category Halt
 */
export const haltExitFromCause = <E>(cause: Cause.Cause<E>): Exit.Exit<Halt.Extract<E>, ExcludeHalt<E>> => {
  const halt = haltFromCause(cause)
  return halt ? Exit.succeed(halt.leftover) : Exit.failCause(cause) as any
}

/**
 * @since 4.0.0
 * @category pattern matching
 */
export const matchEffect: {
  <A, E, L, AS, ES, RS, AF, EF, RF, AH, EH, RH>(options: {
    readonly onSuccess: (value: NoInfer<A>) => Effect.Effect<AS, ES, RS>
    readonly onFailure: (failure: Cause.Cause<NoInfer<E>>) => Effect.Effect<AF, EF, RF>
    readonly onHalt: (leftover: NoInfer<L>) => Effect.Effect<AH, EH, RH>
  }): (self: Pull<A, E, L>) => Effect.Effect<AS | AF | AH, ES | EF | EH, RS | RF | RH>
  <A, E, L, AS, ES, RS, AF, EF, RF, AH, EH, RH>(self: Pull<A, E, L>, options: {
    readonly onSuccess: (value: NoInfer<A>) => Effect.Effect<AS, ES, RS>
    readonly onFailure: (failure: Cause.Cause<NoInfer<E>>) => Effect.Effect<AF, EF, RF>
    readonly onHalt: (leftover: NoInfer<L>) => Effect.Effect<AH, EH, RH>
  }): Effect.Effect<AS | AF | AH, ES | EF | EH, RS | RF | RH>
} = dual(2, <A, E, L, AS, ES, RS, AF, EF, RF, AH, EH, RH>(self: Pull<A, E, L>, options: {
  readonly onSuccess: (value: NoInfer<A>) => Effect.Effect<AS, ES, RS>
  readonly onFailure: (failure: Cause.Cause<NoInfer<E>>) => Effect.Effect<AF, EF, RF>
  readonly onHalt: (leftover: NoInfer<L>) => Effect.Effect<AH, EH, RH>
}): Effect.Effect<AS | AF | AH, ES | EF | EH, RS | RF | RH> =>
  Effect.matchCauseEffect(self, {
    onSuccess: options.onSuccess,
    onFailure: (cause): Effect.Effect<AS | AF | AH, ES | EF | EH, RS | RF | RH> => {
      const halt = haltFromCause(cause)
      return halt ? options.onHalt(halt.leftover as L) : options.onFailure(cause as Cause.Cause<E>)
    }
  }))
