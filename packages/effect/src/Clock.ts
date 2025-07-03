/**
 * @since 2.0.0
 */
import type * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import * as effect from "./internal/effect.js"
import type * as ServiceMap from "./ServiceMap.js"

/**
 * Represents a time-based clock which provides functionality related to time
 * and scheduling.
 *
 * @since 2.0.0
 * @category models
 */
export interface Clock {
  /**
   * Unsafely returns the current time in milliseconds.
   */
  unsafeCurrentTimeMillis(): number
  /**
   * Returns the current time in milliseconds.
   */
  readonly currentTimeMillis: Effect<number>
  /**
   * Unsafely returns the current time in nanoseconds.
   */
  unsafeCurrentTimeNanos(): bigint
  /**
   * Returns the current time in nanoseconds.
   */
  readonly currentTimeNanos: Effect<bigint>
  /**
   * Asynchronously sleeps for the specified duration.
   */
  sleep(duration: Duration.Duration): Effect<void>
}

/**
 * @since 4.0.0
 * @category references
 */
export const CurrentClock: ServiceMap.Reference<Clock> = effect.CurrentClock

/**
 * @since 2.0.0
 * @category constructors
 */
export const clockWith: <A, E, R>(f: (clock: Clock) => Effect<A, E, R>) => Effect<A, E, R> = effect.clockWith

/**
 * @since 2.0.0
 * @category constructors
 */
export const currentTimeMillis: Effect<number> = effect.currentTimeMillis

/**
 * @since 2.0.0
 * @category constructors
 */
export const currentTimeNanos: Effect<bigint> = effect.currentTimeNanos
