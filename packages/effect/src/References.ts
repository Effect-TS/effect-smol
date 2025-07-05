/**
 * This module provides a collection of reference implementations for commonly used
 * Effect runtime configuration values. These references allow you to access and
 * modify runtime behavior such as concurrency limits, scheduling policies,
 * tracing configuration, and logging settings.
 *
 * References are special service instances that can be dynamically updated
 * during runtime, making them ideal for configuration that may need to change
 * based on application state or external conditions.
 *
 * @since 4.0.0
 */
import { constTrue } from "./Function.js"
import type { LogLevel } from "./LogLevel.js"
import type { ReadonlyRecord } from "./Record.js"
import type { Scheduler } from "./Scheduler.js"
import { MaxOpsBeforeYield, MixedScheduler } from "./Scheduler.js"
import * as ServiceMap from "./ServiceMap.js"
import { CurrentTracer, DisablePropagation, type SpanLink } from "./Tracer.js"

export {
  /**
   * @since 4.0.0
   * @category references
   */
  CurrentTracer,
  /**
   * @since 4.0.0
   * @category references
   */
  DisablePropagation,
  /**
   * @since 4.0.0
   * @category references
   */
  MaxOpsBeforeYield
}

/**
 * Reference for controlling the current concurrency limit. Can be set to "unbounded"
 * for unlimited concurrency or a specific number to limit concurrent operations.
 *
 * @example
 * ```ts
 * import { References, Effect } from "effect"
 *
 * const limitConcurrency = Effect.gen(function* () {
 *   // Limit to 10 concurrent operations
 *   yield* References.CurrentConcurrency.set(10)
 *
 *   // Or remove the limit
 *   yield* References.CurrentConcurrency.set("unbounded")
 *
 *   // Get current setting
 *   const current = yield* References.CurrentConcurrency
 *   console.log(current) // 10 or "unbounded"
 * })
 * ```
 *
 * @category references
 * @since 4.0.0
 */
export class CurrentConcurrency extends ServiceMap.Reference<
  "effect/References/CurrentConcurrency",
  "unbounded" | number
>("effect/References/CurrentConcurrency", { defaultValue: () => "unbounded" }) {}

/**
 * Reference for the current scheduler implementation used by the Effect runtime.
 * Controls how Effects are scheduled and executed.
 *
 * @example
 * ```ts
 * import { References, Effect, Scheduler } from "effect"
 *
 * const customScheduling = Effect.gen(function* () {
 *   // Get current scheduler
 *   const scheduler = yield* References.CurrentScheduler
 *
 *   // Reset to default
 *   yield* References.CurrentScheduler.set(new Scheduler.MixedScheduler())
 * })
 * ```
 *
 * @category references
 * @since 4.0.0
 */
export class CurrentScheduler extends ServiceMap.Reference<
  "effect/References/CurrentScheduler",
  Scheduler
>("effect/References/CurrentScheduler", {
  defaultValue: () => new MixedScheduler()
}) {}

/**
 * Reference for controlling whether tracing is enabled globally. When set to false,
 * spans will not be registered with the tracer and tracing overhead is minimized.
 *
 * @example
 * ```ts
 * import { References, Effect } from "effect"
 *
 * const tracingControl = Effect.gen(function* () {
 *   // Disable tracing globally
 *   yield* References.TracerEnabled.set(false)
 *
 *   // Check if tracing is enabled
 *   const isEnabled = yield* References.TracerEnabled
 *   console.log(isEnabled) // false
 *
 *   // Re-enable tracing
 *   yield* References.TracerEnabled.set(true)
 *
 *   // All subsequent spans will be traced
 *   yield* Effect.withSpan("my-span", Effect.log("This will be traced"))
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export class TracerEnabled extends ServiceMap.Reference<
  "effect/References/TracerEnabled",
  boolean
>("effect/References/TracerEnabled", {
  defaultValue: constTrue
}) {}

/**
 * Reference for managing span annotations that are automatically added to all new spans.
 * These annotations provide context and metadata that applies across multiple spans.
 *
 * @example
 * ```ts
 * import { References, Effect } from "effect"
 *
 * const spanAnnotationExample = Effect.gen(function* () {
 *   // Set global span annotations
 *   yield* References.TracerSpanAnnotations.set({
 *     service: "user-service",
 *     version: "1.2.3",
 *     environment: "production"
 *   })
 *
 *   // All spans created will include these annotations
 *   yield* Effect.withSpan("process-user", Effect.gen(function* () {
 *     // Get current annotations
 *     const annotations = yield* References.TracerSpanAnnotations
 *     console.log(annotations) // { service: "user-service", version: "1.2.3", environment: "production" }
 *
 *     // Add more specific annotations for this span
 *     yield* Effect.annotateCurrentSpan("userId", "123")
 *   }))
 *
 *   // Clear annotations
 *   yield* References.TracerSpanAnnotations.set({})
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export class TracerSpanAnnotations extends ServiceMap.Reference<
  "effect/References/TracerSpanAnnotations",
  ReadonlyRecord<string, unknown>
>("effect/References/TracerSpanAnnotations", {
  defaultValue: () => ({})
}) {}

/**
 * Reference for managing span links that are automatically added to all new spans.
 * Span links connect related spans that are not in a parent-child relationship.
 *
 * @example
 * ```ts
 * import { References, Effect, Tracer } from "effect"
 *
 * const spanLinksExample = Effect.gen(function* () {
 *   // Create some spans to link to
 *   const parentSpan = yield* Effect.withSpan("parent-operation", Effect.succeed("parent-result"))
 *
 *   // Create span links
 *   const spanLink: Tracer.SpanLink = {
 *     span: parentSpan,
 *     attributes: {
 *       relationship: "follows-from",
 *       priority: "high"
 *     }
 *   }
 *
 *   // Set global span links
 *   yield* References.TracerSpanLinks.set([spanLink])
 *
 *   // All new spans will include these links
 *   yield* Effect.withSpan("linked-operation", Effect.gen(function* () {
 *     // Get current links
 *     const links = yield* References.TracerSpanLinks
 *     console.log(links.length) // 1
 *
 *     return "operation complete"
 *   }))
 *
 *   // Clear links
 *   yield* References.TracerSpanLinks.set([])
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export class TracerSpanLinks extends ServiceMap.Reference<
  "effect/References/TracerSpanLinks",
  ReadonlyArray<SpanLink>
>("effect/References/TracerSpanLinks", {
  defaultValue: () => []
}) {}

/**
 * Reference for managing log annotations that are automatically added to all log entries.
 * These annotations provide contextual metadata that appears in every log message.
 *
 * @example
 * ```ts
 * import { References, Effect, Console } from "effect"
 *
 * const logAnnotationExample = Effect.gen(function* () {
 *   // Set global log annotations
 *   yield* References.CurrentLogAnnotations.set({
 *     requestId: "req-123",
 *     userId: "user-456",
 *     version: "1.0.0"
 *   })
 *
 *   // All log entries will include these annotations
 *   yield* Console.log("Starting operation")
 *   yield* Console.info("Processing data")
 *
 *   // Get current annotations
 *   const annotations = yield* References.CurrentLogAnnotations
 *   console.log(annotations) // { requestId: "req-123", userId: "user-456", version: "1.0.0" }
 *
 *   // Add more annotations
 *   yield* References.CurrentLogAnnotations.set({
 *     ...annotations,
 *     operation: "data-sync",
 *     timestamp: Date.now()
 *   })
 *
 *   yield* Console.log("Operation completed with extended context")
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export class CurrentLogAnnotations extends ServiceMap.Reference<
  "effect/References/CurrentLogAnnotations",
  ReadonlyRecord<string, unknown>
>("effect/References/CurrentLogAnnotations", {
  defaultValue: () => ({})
}) {}

/**
 * Reference for controlling the current log level for dynamic filtering.
 *
 * @example
 * ```ts
 * import { References, Effect, Console } from "effect"
 *
 * const dynamicLogging = Effect.gen(function* () {
 *   // Set log level to Debug for detailed logging
 *   yield* References.CurrentLogLevel.set("Debug")
 *   yield* Console.debug("This debug message will be shown")
 *
 *   // Change to Error level to reduce noise
 *   yield* References.CurrentLogLevel.set("Error")
 *   yield* Console.info("This info message will be filtered out")
 *   yield* Console.error("This error message will be shown")
 *
 *   // Get current level
 *   const level = yield* References.CurrentLogLevel
 *   console.log(level) // "Error"
 * })
 * ```
 *
 * @category references
 * @since 4.0.0
 */
export class CurrentLogLevel extends ServiceMap.Reference<
  "effect/References/CurrentLogLevel",
  LogLevel
>("effect/References/CurrentLogLevel", {
  defaultValue: () => "Info"
}) {}

/**
 * Reference for managing log spans that track the duration and hierarchy of operations.
 * Each span represents a labeled time period for performance analysis and debugging.
 *
 * @example
 * ```ts
 * import { References, Effect, Console } from "effect"
 *
 * const logSpanExample = Effect.gen(function* () {
 *   // Start with empty spans
 *   yield* References.CurrentLogSpans.set([])
 *
 *   // Add a log span manually
 *   const startTime = Date.now()
 *   yield* References.CurrentLogSpans.set([
 *     ["database-connection", startTime]
 *   ])
 *
 *   // Simulate some work
 *   yield* Effect.sleep("100 millis")
 *   yield* Console.log("Database operation in progress")
 *
 *   // Add another span
 *   const currentSpans = yield* References.CurrentLogSpans
 *   yield* References.CurrentLogSpans.set([
 *     ...currentSpans,
 *     ["data-processing", Date.now()]
 *   ])
 *
 *   // View current spans
 *   const spans = yield* References.CurrentLogSpans
 *   console.log("Active spans:", spans.map(([label]) => label)) // ["database-connection", "data-processing"]
 *
 *   // Clear spans when operations complete
 *   yield* References.CurrentLogSpans.set([])
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export class CurrentLogSpans extends ServiceMap.Reference<
  "effect/References/CurrentLogSpans",
  ReadonlyArray<[label: string, timestamp: number]>
>("effect/References/CurrentLogSpans", {
  defaultValue: () => []
}) {}

/**
 * Reference for setting the minimum log level threshold. Log entries below this
 * level will be filtered out completely.
 *
 * @example
 * ```ts
 * import { References, Effect, Console } from "effect"
 *
 * const configureMinimumLogging = Effect.gen(function* () {
 *   // Set minimum level to Warning - Debug and Info will be filtered
 *   yield* References.MinimumLogLevel.set("Warning")
 *
 *   // These won't be processed at all
 *   yield* Console.debug("Debug message") // Filtered out
 *   yield* Console.info("Info message")   // Filtered out
 *
 *   // These will be processed
 *   yield* Console.warn("Warning message") // Shown
 *   yield* Console.error("Error message") // Shown
 *
 *   // Get current minimum level
 *   const minLevel = yield* References.MinimumLogLevel
 *   console.log(minLevel) // "Warning"
 * })
 * ```
 *
 * @category references
 * @since 4.0.0
 */
export class MinimumLogLevel extends ServiceMap.Reference<
  "effect/References/MinimumLogLevel",
  LogLevel
>("effect/References/MinimumLogLevel", {
  defaultValue: () => "Info"
}) {}
