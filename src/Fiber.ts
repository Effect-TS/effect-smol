/**
 * @since 2.0.0
 */
import type * as Context from "./Context.js"
import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import * as effect from "./internal/effect.js"
import type { Option } from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import type { Scheduler } from "./Scheduler.js"
import type { Covariant } from "./Types.js"

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
  readonly getRef: <I, A>(ref: Context.Reference<I, A>) => A
  readonly context: Context.Context<never>
  setContext(context: Context.Context<never>): void
  readonly currentScheduler: Scheduler
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
