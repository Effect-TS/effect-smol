/**
 * @since 4.0.0
 */

/**
 * The `Console` module provides a functional interface for console operations within
 * the Effect ecosystem. It offers type-safe logging, debugging, and console manipulation
 * capabilities with built-in support for testing and environment isolation.
 *
 * ## Key Features
 *
 * - **Type-safe logging**: All console operations return Effects for composability
 * - **Testable**: Mock console output for testing scenarios
 * - **Service-based**: Integrated with Effect's dependency injection system
 * - **Environment isolation**: Different console implementations per environment
 * - **Rich API**: Support for all standard console methods (log, error, debug, etc.)
 * - **Performance tracking**: Built-in timing and profiling capabilities
 *
 * ## Core Operations
 *
 * - **Basic logging**: `log`, `error`, `warn`, `info`, `debug`
 * - **Assertions**: `assert` for conditional logging
 * - **Grouping**: `group`, `groupCollapsed`, `groupEnd` for organized output
 * - **Timing**: `time`, `timeEnd`, `timeLog` for performance measurement
 * - **Data display**: `table`, `dir`, `dirxml` for structured data visualization
 * - **Utilities**: `clear`, `count`, `countReset`, `trace`
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 *
 * // Basic logging
 * const program = Effect.gen(function* () {
 *   yield* Console.log("Hello, World!")
 *   yield* Console.error("Something went wrong")
 *   yield* Console.warn("This is a warning")
 *   yield* Console.info("Information message")
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 *
 * // Grouped logging with timing
 * const debugProgram = Console.withGroup(
 *   Effect.gen(function* () {
 *     yield* Console.log("Step 1: Loading...")
 *     yield* Effect.sleep("100 millis")
 *
 *     yield* Console.log("Step 2: Processing...")
 *     yield* Effect.sleep("200 millis")
 *   }),
 *   { label: "Processing Data" }
 * )
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Console } from "effect/logging"
 *
 * // Data visualization and debugging
 * const dataProgram = Effect.gen(function* () {
 *   const users = [
 *     { id: 1, name: "Alice", age: 30 },
 *     { id: 2, name: "Bob", age: 25 }
 *   ]
 *
 *   yield* Console.table(users)
 *   yield* Console.dir(users[0], { depth: 2 })
 *   yield* Console.assert(users.length > 0, "Users array should not be empty")
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Console from "./Console.ts"

/**
 * @since 2.0.0
 *
 * The `Logger` module provides a robust and flexible logging system for Effect applications.
 * It offers structured logging, multiple output formats, and seamless integration with the
 * Effect runtime's tracing and context management.
 *
 * ## Key Features
 *
 * - **Structured Logging**: Built-in support for structured log messages with metadata
 * - **Multiple Formats**: JSON, LogFmt, Pretty, and custom formatting options
 * - **Context Integration**: Automatic capture of fiber context, spans, and annotations
 * - **Batching**: Efficient log aggregation and batch processing
 * - **File Output**: Direct file writing with configurable batch windows
 * - **Composable**: Transform and compose loggers using functional patterns
 *
 * ## Basic Usage
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Logger } from "effect/logging"
 *
 * // Basic logging
 * const program = Effect.gen(function* () {
 *   yield* Effect.log("Application started")
 *   yield* Effect.logInfo("Processing user request")
 *   yield* Effect.logWarning("Resource limit approaching")
 *   yield* Effect.logError("Database connection failed")
 * })
 *
 * // With structured data
 * const structuredLog = Effect.gen(function* () {
 *   yield* Effect.log("User action", { userId: 123, action: "login" })
 *   yield* Effect.logInfo("Request processed", { duration: 150, statusCode: 200 })
 * })
 * ```
 *
 * ## Custom Loggers
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Logger } from "effect/logging"
 *
 * // Create a custom logger
 * const customLogger = Logger.make((options) => {
 *   console.log(`[${options.logLevel}] ${options.message}`)
 * })
 *
 * // Use JSON format for production
 * const jsonLogger = Logger.consoleJson
 *
 * // Pretty format for development
 * const prettyLogger = Logger.consolePretty()
 *
 * const program = Effect.log("Hello World").pipe(
 *   Effect.provide(Logger.layer([jsonLogger]))
 * )
 * ```
 *
 * ## Multiple Loggers
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Layer } from "effect"
 * import { Logger } from "effect/logging"
 *
 * // Combine multiple loggers
 * const CombinedLoggerLive = Logger.layer([
 *   Logger.consoleJson,
 *   Logger.consolePretty()
 * ])
 *
 * const program = Effect.log("Application event").pipe(
 *   Effect.provide(CombinedLoggerLive)
 * )
 * ```
 *
 * ## Batched Logging
 *
 * ```ts
 * import { Logger } from "effect/logging"
 * import { Effect } from "effect"
 * import { Duration } from "effect/time"
 *
 * const batchedLogger = Logger.batched(Logger.formatJson, {
 *   window: Duration.seconds(5),
 *   flush: (messages) => Effect.sync(() => {
 *     // Process batch of log messages
 *     console.log("Flushing", messages.length, "log entries")
 *   })
 * })
 *
 * const program = Effect.gen(function* () {
 *   const logger = yield* batchedLogger
 *   yield* Effect.provide(
 *     Effect.all([
 *       Effect.log("Event 1"),
 *       Effect.log("Event 2"),
 *       Effect.log("Event 3")
 *     ]),
 *     Logger.layer([logger])
 *   )
 * })
 * ```
 */
export * as Logger from "./Logger.ts"

/**
 * @since 2.0.0
 *
 * The `LogLevel` module provides utilities for managing log levels in Effect applications.
 * It defines a hierarchy of log levels and provides functions for comparing and filtering logs
 * based on their severity.
 *
 * ## Log Level Hierarchy
 *
 * The log levels are ordered from most severe to least severe:
 *
 * 1. **All** - Special level that allows all messages
 * 2. **Fatal** - System is unusable, immediate attention required
 * 3. **Error** - Error conditions that should be investigated
 * 4. **Warn** - Warning conditions that may indicate problems
 * 5. **Info** - Informational messages about normal operation
 * 6. **Debug** - Debug information useful during development
 * 7. **Trace** - Very detailed trace information
 * 8. **None** - Special level that suppresses all messages
 *
 * ## Basic Usage
 *
 * ```ts
 * import { Effect } from "effect"
 * import { LogLevel } from "effect/logging"
 *
 * // Basic log level usage
 * const program = Effect.gen(function* () {
 *   yield* Effect.logFatal("System is shutting down")
 *   yield* Effect.logError("Database connection failed")
 *   yield* Effect.logWarning("Memory usage is high")
 *   yield* Effect.logInfo("User logged in")
 *   yield* Effect.logDebug("Processing request")
 *   yield* Effect.logTrace("Variable value: xyz")
 * })
 * ```
 *
 * ## Level Comparison
 *
 * ```ts
 * import { LogLevel } from "effect/logging"
 *
 * // Check if one level is more severe than another
 * console.log(LogLevel.greaterThan("Error", "Info")) // true
 * console.log(LogLevel.greaterThan("Debug", "Error")) // false
 *
 * // Check if level meets minimum threshold
 * console.log(LogLevel.greaterThanOrEqualTo("Info", "Debug")) // true
 * console.log(LogLevel.lessThan("Trace", "Info")) // true
 * ```
 *
 * ## Filtering by Level
 *
 * ```ts
 * import { Effect } from "effect"
 * import { LogLevel } from "effect/logging"
 * import { Logger } from "effect/logging"
 *
 * // Create a logger that only logs Error and above
 * const errorLogger = Logger.make((options) => {
 *   if (LogLevel.greaterThanOrEqualTo(options.logLevel, "Error")) {
 *     console.log(`[${options.logLevel}] ${options.message}`)
 *   }
 * })
 *
 * // Production logger - Info and above
 * const productionLogger = Logger.make((options) => {
 *   if (LogLevel.greaterThanOrEqualTo(options.logLevel, "Info")) {
 *     console.log(`${options.date.toISOString()} [${options.logLevel}] ${options.message}`)
 *   }
 * })
 *
 * // Development logger - Debug and above
 * const devLogger = Logger.make((options) => {
 *   if (LogLevel.greaterThanOrEqualTo(options.logLevel, "Debug")) {
 *     console.log(`[${options.logLevel}] ${options.message}`)
 *   }
 * })
 * ```
 *
 * ## Runtime Configuration
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Config } from "effect/config"
 * import { LogLevel } from "effect/logging"
 * import { Logger } from "effect/logging"
 *
 * // Configure log level from environment
 * const logLevelConfig = Config.string("LOG_LEVEL").pipe(
 *   Config.withDefault("Info")
 * )
 *
 * const configurableLogger = Effect.gen(function* () {
 *   const minLevel = yield* logLevelConfig
 *
 *   return Logger.make((options) => {
 *     if (LogLevel.greaterThanOrEqualTo(options.logLevel, minLevel)) {
 *       console.log(`[${options.logLevel}] ${options.message}`)
 *     }
 *   })
 * })
 * ```
 */
export * as LogLevel from "./LogLevel.ts"
