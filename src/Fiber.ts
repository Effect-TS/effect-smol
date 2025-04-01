/**
 * @since 2.0.0
 */
import type * as Context from "./Context.ts"
import type { Effect } from "./Effect.ts"
import type { Exit } from "./Exit.ts"
import * as effect from "./internal/effect.ts"
import type { Option } from "./Option.ts"
import type { Pipeable } from "./Pipeable.ts"
import { hasProperty } from "./Predicate.ts"
import type { Scheduler } from "./Scheduler.ts"
import type { AnySpan } from "./Tracer.ts"
import type { Covariant } from "./Types.ts"

/**
 * @since 2.0.0
 * @category type ids
 */
export const TypeId: unique symbol = effect.FiberTypeId

/**
 * @since 2.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface Fiber<out A, out E = never> extends Pipeable {
  readonly [TypeId]: Fiber.Variance<A, E>

  readonly id: number
  readonly currentOpCount: number
  readonly getRef: <A>(ref: Context.Reference<A>) => A
  readonly context: Context.Context<never>
  setContext(context: Context.Context<never>): void
  readonly currentScheduler: Scheduler
  readonly currentSpan?: AnySpan | undefined
  readonly maxOpsBeforeYield: number
  readonly addObserver: (cb: (exit: Exit<A, E>) => void) => () => void
  readonly unsafeInterrupt: (fiberId?: number | undefined) => void
  readonly unsafePoll: () => Exit<A, E> | undefined
}

/**
 * @since 2.0.0
 * @category models
 */
export declare namespace Fiber {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<out A, out E = never> {
    readonly _A: Covariant<A>
    readonly _E: Covariant<E>
  }
}

const await_: <A, E>(self: Fiber<A, E>) => Effect<Exit<A, E>> = effect.fiberAwait
export {
  /**
   * @since 2.0.0
   * @category combinators
   */
  await_ as await
}
/**
 * @since 2.0.0
 * @category combinators
 */
export const awaitAll: <A extends Fiber<any, any>>(
  self: Iterable<A>
) => Effect<
  Array<
    Exit<
      A extends Fiber<infer _A, infer _E> ? _A : never,
      A extends Fiber<infer _A, infer _E> ? _E : never
    >
  >
> = effect.fiberAwaitAll

/**
 * @since 2.0.0
 * @category combinators
 */
export const join: <A, E>(self: Fiber<A, E>) => Effect<A, E> = effect.fiberJoin

/**
 * @since 2.0.0
 * @category interruption
 */
export const interrupt: <A, E>(self: Fiber<A, E>) => Effect<void> = effect.fiberInterrupt

/**
 * @since 2.0.0
 * @category interruption
 */
export const interruptAll: <A extends Iterable<Fiber<any, any>>>(
  fibers: A
) => Effect<void> = effect.fiberInterruptAll

/**
 * @since 2.0.0
 * @category guards
 */
export const isFiber = (
  u: unknown
): u is Fiber<unknown, unknown> => hasProperty(u, effect.FiberTypeId)

/**
 * @since 2.0.0
 * @category accessors
 */
export const getCurrent: () => Option<Fiber<any, any>> = effect.getCurrentFiber
