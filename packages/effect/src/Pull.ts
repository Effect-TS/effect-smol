/**
 * @since 4.0.0
 */
import * as Arr from "./Array.js"
import type * as Cause from "./Cause.js"
import type { Effect } from "./Effect.js"
import * as Exit from "./Exit.js"
import * as Filter from "./Filter.js"
import { dual } from "./Function.js"
import * as internalEffect from "./internal/effect.js"
import * as Option from "./Option.js"
import { hasProperty } from "./Predicate.js"
import * as Queue from "./Queue.js"

/**
 * @since 4.0.0
 * @category models
 */
export interface Pull<out A, out E = never, out Done = void, out R = never> extends Effect<A, E | Halt<Done>, R> {}

/**
 * @since 4.0.0
 * @category type extractors
 */
export type Success<P> = P extends Effect<infer _A, infer _E, infer _R> ? _A : never

/**
 * @since 4.0.0
 * @category type extractors
 */
export type Error<P> = P extends Effect<infer _A, infer _E, infer _R> ? _E extends Halt<infer _L> ? never : _E
  : never

/**
 * @since 4.0.0
 * @category type extractors
 */
export type Leftover<P> = P extends Effect<infer _A, infer _E, infer _R> ? _E extends Halt<infer _L> ? _L : never
  : never

/**
 * @since 4.0.0
 * @category type extractors
 */
export type Context<P> = P extends Effect<infer _A, infer _E, infer _R> ? _R : never

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
  internalEffect.catchFailure(effect, filterHaltLeftover, (l) => f(l)) as any)

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
export const filterHalt: Filter.Filter<unknown, Halt<unknown>> = Filter.fromPredicate(isHalt)

/**
 * @since 4.0.0
 * @category Halt
 */
export const filterHaltCause: <E>(input: Cause.Cause<E>) => Cause.Cause<E> | typeof Filter.absent = Filter
  .fromPredicate(isHaltCause)

/**
 * @since 4.0.0
 * @category Halt
 */
export const filterHaltError = <E>(
  failure: Cause.Failure<E>
): Halt.Only<E> | Filter.absent => isHaltFailure(failure) ? failure.error as any : Filter.absent

/**
 * @since 4.0.0
 * @category Halt
 */
export const filterHaltLeftover = <E>(
  failure: Cause.Failure<E>
): Halt.Extract<E> | Filter.absent => isHaltFailure(failure) ? failure.error.leftover : Filter.absent

/**
 * @since 4.0.0
 * @category Halt
 */
export const halt = <L>(leftover: L): Effect<never, Halt<L>> => internalEffect.fail(new Halt(leftover))

/**
 * @since 4.0.0
 * @category Halt
 */
export const haltVoid: Effect<never, Halt<void>> = internalEffect.fail(new Halt(void 0))

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
      const halt = haltFromCause(cause)
      return halt ? options.onHalt(halt.leftover as L) : options.onFailure(cause as Cause.Cause<E>)
    }
  }))

/**
 * @since 4.0.0
 * @category Queue
 */
export const fromQueue = <A, E, L>(queue: Queue.Dequeue<A, E>): Pull<A, E, L> =>
  internalEffect.catch_(
    Queue.take(queue),
    (o): Pull<never, E> => Option.isSome(o) ? internalEffect.fail(o.value) : haltVoid
  ) as any

/**
 * @since 4.0.0
 * @category Queue
 */
export const fromQueueArray = <A, E>(queue: Queue.Dequeue<A, E>): Pull<Arr.NonEmptyReadonlyArray<A>, E> =>
  internalEffect.flatMap(
    Queue.takeAll(queue),
    ([values]) => Arr.isNonEmptyReadonlyArray(values) ? internalEffect.succeed(values) : haltVoid
  )
