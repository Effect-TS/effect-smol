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
import { MaxOpsBeforeYield } from "./Scheduler.js"
import * as ServiceMap from "./ServiceMap.js"
import { DisablePropagation, type SpanLink, Tracer } from "./Tracer.js"

export {
  /**
   * @since 4.0.0
   * @category references
   */
  DisablePropagation,
  /**
   * @since 4.0.0
   * @category references
   */
  MaxOpsBeforeYield,
  /**
   * @since 4.0.0
   * @category references
   */
  Tracer
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
 *   // Get current setting
 *   const current = yield* References.CurrentConcurrency
 *   console.log(current) // "unbounded" (default)
 *
 *   // Run with limited concurrency
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const limited = yield* References.CurrentConcurrency
 *       console.log(limited) // 10
 *     }),
 *     References.CurrentConcurrency,
 *     10
 *   )
 *
 *   // Run with unlimited concurrency
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const unlimited = yield* References.CurrentConcurrency
 *       console.log(unlimited) // "unbounded"
 *     }),
 *     References.CurrentConcurrency,
 *     "unbounded"
 *   )
 * })
 * ```
 *
 * @category references
 * @since 4.0.0
 */
export const CurrentConcurrency = ServiceMap.Reference<"unbounded" | number>("effect/References/CurrentConcurrency", {
  defaultValue: () => "unbounded"
})

/**
 * Reference for the current scheduler implementation used by the Effect runtime.
 * Controls how Effects are scheduled and executed.
 *
 * @example
 * ```ts
 * import { References, Effect, Scheduler } from "effect"
 *
 * const customScheduling = Effect.gen(function* () {
 *   // Get current scheduler (default is MixedScheduler)
 *   const current = yield* References.CurrentScheduler
 *   console.log(current) // MixedScheduler instance
 *
 *   // Use a custom scheduler
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const scheduler = yield* References.CurrentScheduler
 *       console.log(scheduler) // Custom scheduler instance
 *
 *       // Effects will use the custom scheduler in this context
 *       yield* Effect.log("Using custom scheduler")
 *     }),
 *     References.CurrentScheduler,
 *     new Scheduler.MixedScheduler()
 *   )
 * })
 * ```
 *
 * @category references
 * @since 4.0.0
 */
  Scheduler
} from "./Scheduler.js"

/**
 * Reference for controlling whether tracing is enabled globally. When set to false,
 * spans will not be registered with the tracer and tracing overhead is minimized.
 *
 * @example
 * ```ts
 * import { References, Effect } from "effect"
 *
 * const tracingControl = Effect.gen(function* () {
 *   // Check if tracing is enabled (default is true)
 *   const current = yield* References.TracerEnabled
 *   console.log(current) // true
 *
 *   // Disable tracing globally
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const isEnabled = yield* References.TracerEnabled
 *       console.log(isEnabled) // false
 *
 *       // Spans will not be traced in this context
 *       yield* Effect.log("This will not be traced")
 *     }),
 *     References.TracerEnabled,
 *     false
 *   )
 *
 *   // Re-enable tracing
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const isEnabled = yield* References.TracerEnabled
 *       console.log(isEnabled) // true
 *
 *       // All subsequent spans will be traced
 *       yield* Effect.log("This will be traced")
 *     }),
 *     References.TracerEnabled,
 *     true
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export const TracerEnabled = ServiceMap.Reference<boolean>("effect/References/TracerEnabled", {
  defaultValue: constTrue
})

/**
 * Reference for managing span annotations that are automatically added to all new spans.
 * These annotations provide context and metadata that applies across multiple spans.
 *
 * @example
 * ```ts
 * import { References, Effect } from "effect"
 *
 * const spanAnnotationExample = Effect.gen(function* () {
 *   // Get current annotations (empty by default)
 *   const current = yield* References.TracerSpanAnnotations
 *   console.log(current) // {}
 *
 *   // Set global span annotations
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       // Get current annotations
 *       const annotations = yield* References.TracerSpanAnnotations
 *       console.log(annotations) // { service: "user-service", version: "1.2.3", environment: "production" }
 *
 *       // All spans created will include these annotations
 *       yield* Effect.gen(function* () {
 *         // Add more specific annotations for this span
 *         yield* Effect.annotateCurrentSpan("userId", "123")
 *         yield* Effect.log("Processing user")
 *       })
 *     }),
 *     References.TracerSpanAnnotations,
 *     {
 *       service: "user-service",
 *       version: "1.2.3",
 *       environment: "production"
 *     }
 *   )
 *
 *   // Clear annotations
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const annotations = yield* References.TracerSpanAnnotations
 *       console.log(annotations) // {}
 *     }),
 *     References.TracerSpanAnnotations,
 *     {}
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export const TracerSpanAnnotations = ServiceMap.Reference<ReadonlyRecord<string, unknown>>(
  "effect/References/TracerSpanAnnotations",
  { defaultValue: () => ({}) }
)

/**
 * Reference for managing span links that are automatically added to all new spans.
 * Span links connect related spans that are not in a parent-child relationship.
 *
 * @example
 * ```ts
 * import { References, Effect, Tracer } from "effect"
 *
 * const spanLinksExample = Effect.gen(function* () {
 *   // Get current links (empty by default)
 *   const current = yield* References.TracerSpanLinks
 *   console.log(current.length) // 0
 *
 *   // Create an external span for the example
 *   const externalSpan = Tracer.externalSpan({
 *     spanId: "external-span-123",
 *     traceId: "trace-456"
 *   })
 *
 *   // Create span links
 *   const spanLink: Tracer.SpanLink = {
 *     span: externalSpan,
 *     attributes: {
 *       relationship: "follows-from",
 *       priority: "high"
 *     }
 *   }
 *
 *   // Set global span links
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       // Get current links
 *       const links = yield* References.TracerSpanLinks
 *       console.log(links.length) // 1
 *
 *       // All new spans will include these links
 *       yield* Effect.gen(function* () {
 *         yield* Effect.log("This span will have linked spans")
 *         return "operation complete"
 *       })
 *     }),
 *     References.TracerSpanLinks,
 *     [spanLink]
 *   )
 *
 *   // Clear links
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const links = yield* References.TracerSpanLinks
 *       console.log(links.length) // 0
 *     }),
 *     References.TracerSpanLinks,
 *     []
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export const TracerSpanLinks = ServiceMap.Reference<ReadonlyArray<SpanLink>>("effect/References/TracerSpanLinks", {
  defaultValue: () => []
})

/**
 * Reference for managing log annotations that are automatically added to all log entries.
 * These annotations provide contextual metadata that appears in every log message.
 *
 * @example
 * ```ts
 * import { References, Effect, Console } from "effect"
 *
 * const logAnnotationExample = Effect.gen(function* () {
 *   // Get current annotations (empty by default)
 *   const current = yield* References.CurrentLogAnnotations
 *   console.log(current) // {}
 *
 *   // Run with custom log annotations
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const annotations = yield* References.CurrentLogAnnotations
 *       console.log(annotations) // { requestId: "req-123", userId: "user-456", version: "1.0.0" }
 *
 *       // All log entries will include these annotations
 *       yield* Console.log("Starting operation")
 *       yield* Console.info("Processing data")
 *     }),
 *     References.CurrentLogAnnotations,
 *     {
 *       requestId: "req-123",
 *       userId: "user-456",
 *       version: "1.0.0"
 *     }
 *   )
 *
 *   // Run with extended annotations
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const extended = yield* References.CurrentLogAnnotations
 *       console.log(extended) // { requestId: "req-123", userId: "user-456", version: "1.0.0", operation: "data-sync", timestamp: 1234567890 }
 *
 *       yield* Console.log("Operation completed with extended context")
 *     }),
 *     References.CurrentLogAnnotations,
 *     {
 *       requestId: "req-123",
 *       userId: "user-456",
 *       version: "1.0.0",
 *       operation: "data-sync",
 *       timestamp: 1234567890
 *     }
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export const CurrentLogAnnotations = ServiceMap.Reference<ReadonlyRecord<string, unknown>>(
  "effect/References/CurrentLogAnnotations",
  { defaultValue: () => ({}) }
)

/**
 * Reference for controlling the current log level for dynamic filtering.
 *
 * @example
 * ```ts
 * import { References, Effect, Console } from "effect"
 *
 * const dynamicLogging = Effect.gen(function* () {
 *   // Get current log level (default is "Info")
 *   const current = yield* References.CurrentLogLevel
 *   console.log(current) // "Info"
 *
 *   // Set log level to Debug for detailed logging
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const level = yield* References.CurrentLogLevel
 *       console.log(level) // "Debug"
 *       yield* Console.debug("This debug message will be shown")
 *     }),
 *     References.CurrentLogLevel,
 *     "Debug"
 *   )
 *
 *   // Change to Error level to reduce noise
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const level = yield* References.CurrentLogLevel
 *       console.log(level) // "Error"
 *       yield* Console.info("This info message will be filtered out")
 *       yield* Console.error("This error message will be shown")
 *     }),
 *     References.CurrentLogLevel,
 *     "Error"
 *   )
 * })
 * ```
 *
 * @category references
 * @since 4.0.0
 */
export const CurrentLogLevel: ServiceMap.Reference<LogLevel> = ServiceMap.Reference<LogLevel>(
  "effect/References/CurrentLogLevel",
  { defaultValue: () => "Info" }
)

/**
 * Reference for managing log spans that track the duration and hierarchy of operations.
 * Each span represents a labeled time period for performance analysis and debugging.
 *
 * @example
 * ```ts
 * import { References, Effect, Console } from "effect"
 *
 * const logSpanExample = Effect.gen(function* () {
 *   // Get current spans (empty by default)
 *   const current = yield* References.CurrentLogSpans
 *   console.log(current.length) // 0
 *
 *   // Add a log span manually
 *   const startTime = Date.now()
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       // Simulate some work
 *       yield* Effect.sleep("100 millis")
 *       yield* Console.log("Database operation in progress")
 *
 *       const spans = yield* References.CurrentLogSpans
 *       console.log("Active spans:", spans.map(([label]) => label)) // ["database-connection"]
 *     }),
 *     References.CurrentLogSpans,
 *     [["database-connection", startTime]]
 *   )
 *
 *   // Add another span
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const spans = yield* References.CurrentLogSpans
 *       console.log("Active spans:", spans.map(([label]) => label)) // ["database-connection", "data-processing"]
 *
 *       yield* Console.log("Multiple operations in progress")
 *     }),
 *     References.CurrentLogSpans,
 *     [
 *       ["database-connection", startTime],
 *       ["data-processing", Date.now()]
 *     ]
 *   )
 *
 *   // Clear spans when operations complete
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const spans = yield* References.CurrentLogSpans
 *       console.log("Active spans:", spans.length) // 0
 *     }),
 *     References.CurrentLogSpans,
 *     []
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export const CurrentLogSpans = ServiceMap.Reference<
  ReadonlyArray<[label: string, timestamp: number]>
>("effect/References/CurrentLogSpans", { defaultValue: () => [] })

/**
 * Reference for setting the minimum log level threshold. Log entries below this
 * level will be filtered out completely.
 *
 * @example
 * ```ts
 * import { References, Effect, Console } from "effect"
 *
 * const configureMinimumLogging = Effect.gen(function* () {
 *   // Get current minimum level (default is "Info")
 *   const current = yield* References.MinimumLogLevel
 *   console.log(current) // "Info"
 *
 *   // Set minimum level to Warn - Debug and Info will be filtered
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const minLevel = yield* References.MinimumLogLevel
 *       console.log(minLevel) // "Warn"
 *
 *       // These won't be processed at all
 *       yield* Console.debug("Debug message") // Filtered out
 *       yield* Console.info("Info message")   // Filtered out
 *
 *       // These will be processed
 *       yield* Console.warn("Warning message") // Shown
 *       yield* Console.error("Error message") // Shown
 *     }),
 *     References.MinimumLogLevel,
 *     "Warn"
 *   )
 *
 *   // Reset to default Info level
 *   yield* Effect.provideService(
 *     Effect.gen(function* () {
 *       const minLevel = yield* References.MinimumLogLevel
 *       console.log(minLevel) // "Info"
 *
 *       // Now info messages will be processed
 *       yield* Console.info("Info message") // Shown
 *     }),
 *     References.MinimumLogLevel,
 *     "Info"
 *   )
 * })
 * ```
 *
 * @category references
 * @since 4.0.0
 */
export const MinimumLogLevel = ServiceMap.Reference<
  LogLevel
>("effect/References/MinimumLogLevel", { defaultValue: () => "Info" })
