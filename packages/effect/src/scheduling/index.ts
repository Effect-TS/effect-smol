/**
 * @since 4.0.0
 */

/**
 * This module provides utilities for creating and composing schedules for retrying operations,
 * repeating effects, and implementing various timing strategies.
 *
 * A Schedule is a function that takes an input and returns a decision whether to continue or halt,
 * along with a delay duration. Schedules can be combined, transformed, and used to implement
 * sophisticated retry and repetition logic.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Schedule } from "effect/scheduling"
 * import { Duration } from "effect/time"
 *
 * // Retry with exponential backoff
 * const retryPolicy = Schedule.exponential("100 millis", 2.0)
 *   .pipe(Schedule.compose(Schedule.recurs(3)))
 *
 * const program = Effect.gen(function*() {
 *   // This will retry up to 3 times with exponential backoff
 *   const result = yield* Effect.retry(
 *     Effect.fail("Network error"),
 *     retryPolicy
 *   )
 * })
 *
 * // Repeat on a fixed schedule
 * const heartbeat = Effect.log("heartbeat")
 *   .pipe(Effect.repeat(Schedule.spaced("30 seconds")))
 * ```
 *
 * @since 2.0.0
 */
export * as Schedule from "./Schedule.ts"
