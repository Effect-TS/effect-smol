/**
 * @since 2.0.0
 */
import type { Effect } from "./Effect.js"
import type { Exit } from "./Exit.js"
import * as effect from "./internal/effect.js"
import { version } from "./internal/version.js"
import type { Option } from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import type { Scheduler } from "./Scheduler.js"
import type * as ServiceMap from "./ServiceMap.js"
import type { AnySpan } from "./Tracer.js"
import type { Covariant } from "./Types.js"

/**
 * @since 2.0.0
 * @category type ids
 */
export const TypeId: TypeId = `~effect/Fiber/${version}`

/**
 * @since 2.0.0
 * @category type ids
 */
export type TypeId = `~effect/Fiber/${version}`

/**
 * @since 2.0.0
 * @category models
 */
export interface Fiber<out A, out E = never> extends Pipeable {
  readonly [TypeId]: Fiber.Variance<A, E>

  readonly id: number
  readonly currentOpCount: number
  readonly getRef: <A>(ref: ServiceMap.Reference<A>) => A
  readonly services: ServiceMap.ServiceMap<never>
  setServices(services: ServiceMap.ServiceMap<never>): void
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
export const interruptAs: {
  (fiberId: number): <A, E>(self: Fiber<A, E>) => Effect<void>
  <A, E>(self: Fiber<A, E>, fiberId: number): Effect<void>
} = effect.fiberInterruptAs

/**
 * @since 2.0.0
 * @category interruption
 */
export const interruptAll: <A extends Iterable<Fiber<any, any>>>(
  fibers: A
) => Effect<void> = effect.fiberInterruptAll

/**
 * @since 2.0.0
 * @category interruption
 */
export const interruptAllAs: {
  (fiberId: number): <A extends Iterable<Fiber<any, any>>>(fibers: A) => Effect<void>
  <A extends Iterable<Fiber<any, any>>>(fibers: A, fiberId: number): Effect<void>
} = effect.fiberInterruptAllAs

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
