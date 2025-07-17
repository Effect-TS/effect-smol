/**
 * @since 4.0.0
 */

/**
 * The `Clock` module provides functionality for time-based operations in Effect applications.
 * It offers precise time measurements, scheduling capabilities, and controlled time management
 * for testing scenarios.
 *
 * The Clock service is a core component of the Effect runtime, providing:
 * - Current time access in milliseconds and nanoseconds
 * - Sleep operations for delaying execution
 * - Time-based scheduling primitives
 * - Testable time control through `TestClock`
 *
 * ## Key Features
 *
 * - **Precise timing**: Access to both millisecond and nanosecond precision
 * - **Sleep operations**: Non-blocking sleep with proper interruption handling
 * - **Service integration**: Seamless integration with Effect's dependency injection
 * - **Testable**: Mock time control for deterministic testing
 * - **Resource-safe**: Automatic cleanup of time-based resources
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Clock } from "effect/time"
 *
 * // Get current time in milliseconds
 * const getCurrentTime = Clock.currentTimeMillis
 *
 * // Sleep for 1 second
 * const sleep1Second = Effect.sleep("1 seconds")
 *
 * // Measure execution time
 * const measureTime = Effect.gen(function* () {
 *   const start = yield* Clock.currentTimeMillis
 *   yield* Effect.sleep("100 millis")
 *   const end = yield* Clock.currentTimeMillis
 *   return end - start
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Clock } from "effect/time"
 *
 * // Using Clock service directly
 * const program = Effect.gen(function* () {
 *   const clock = yield* Clock.Clock
 *   const currentTime = yield* clock.currentTimeMillis
 *   console.log(`Current time: ${currentTime}`)
 *
 *   // Sleep for 500ms
 *   yield* Effect.sleep("500 millis")
 *
 *   const afterSleep = yield* clock.currentTimeMillis
 *   console.log(`After sleep: ${afterSleep}`)
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Clock from "./Clock.ts"

/**
 * @since 2.0.0
 */
export * as Cron from "./Cron.ts"

/**
 * @since 3.6.0
 */
export * as DateTime from "./DateTime.ts"

/**
 * This module provides utilities for working with durations of time. A `Duration`
 * is an immutable data type that represents a span of time with high precision,
 * supporting operations from nanoseconds to weeks.
 *
 * Durations support:
 * - **High precision**: Nanosecond-level accuracy using BigInt
 * - **Multiple formats**: Numbers (millis), BigInt (nanos), tuples, strings
 * - **Arithmetic operations**: Add, subtract, multiply, divide
 * - **Comparisons**: Equal, less than, greater than
 * - **Conversions**: Between different time units
 * - **Human-readable formatting**: Pretty printing and parsing
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Duration } from "effect/time"
 *
 * // Creating durations
 * const oneSecond = Duration.seconds(1)
 * const fiveMinutes = Duration.minutes(5)
 * const oneHour = Duration.decode("1 hour")
 * const precise = Duration.nanos(BigInt(123456789))
 *
 * // Arithmetic operations
 * const total = Duration.sum(Duration.sum(oneSecond, fiveMinutes), oneHour)
 * const double = Duration.times(oneSecond, 2)
 * const half = Duration.divide(oneSecond, 2)
 *
 * // Comparisons
 * const isLonger = Duration.greaterThan(fiveMinutes, oneSecond) // true
 * const isEqual = Duration.equals(oneSecond, Duration.millis(1000)) // true
 *
 * // Converting and formatting
 * console.log(Duration.toMillis(oneSecond)) // 1000
 * console.log(Duration.format(fiveMinutes)) // "5m"
 *
 * // Using with Effects
 * const program = Effect.gen(function* () {
 *   console.log("Starting...")
 *   yield* Effect.sleep(Duration.seconds(2))
 *   console.log("Done!")
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Duration from "./Duration.ts"
