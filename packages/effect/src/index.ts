/**
 * @since 2.0.0
 */

export {
  /**
   * @since 2.0.0
   */
  absurd,
  /**
   * @since 2.0.0
   */
  coerceUnsafe,
  /**
   * @since 2.0.0
   */
  flow,
  /**
   * @since 2.0.0
   */
  hole,
  /**
   * @since 2.0.0
   */
  identity,
  /**
   * @since 2.0.0
   */
  pipe
} from "./Function.ts"

/**
 * This module provides utility functions and type class instances for working with the `BigDecimal` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for `Equivalence` and `Order`.
 *
 * A `BigDecimal` allows storing any real number to arbitrary precision; which avoids common floating point errors
 * (such as 0.1 + 0.2 ≠ 0.3) at the cost of complexity.
 *
 * Internally, `BigDecimal` uses a `BigInt` object, paired with a 64-bit integer which determines the position of the
 * decimal point. Therefore, the precision *is not* actually arbitrary, but limited to 2<sup>63</sup> decimal places.
 *
 * It is not recommended to convert a floating point number to a decimal directly, as the floating point representation
 * may be unexpected.
 *
 * @since 2.0.0
 */
export * as BigDecimal from "./BigDecimal.ts"

/**
 * This module provides utility functions and type class instances for working with the `bigint` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as BigInt from "./BigInt.ts"

/**
 * This module provides utility functions and type class instances for working with the `boolean` type in TypeScript.
 * It includes functions for basic boolean operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as Boolean from "./Boolean.ts"

/**
 * @since 4.0.0
 */
export * as Cache from "./Cache.ts"

/**
 * This module provides utilities for working with `Cause`, a data type that represents
 * the different ways an `Effect` can fail. It includes structured error handling with
 * typed errors, defects, and interruptions.
 *
 * A `Cause` can represent:
 * - **Fail**: A typed, expected error that can be handled
 * - **Die**: An unrecoverable defect (like a programming error)
 * - **Interrupt**: A fiber interruption
 *
 * @example
 * ```ts
 * import { Cause, Effect } from "effect"
 *
 * // Creating different types of causes
 * const failCause = Cause.fail("Something went wrong")
 * const dieCause = Cause.die(new Error("Unexpected error"))
 * const interruptCause = Cause.interrupt(123)
 *
 * // Working with effects that can fail
 * const program = Effect.fail("user error").pipe(
 *   Effect.catchCause((cause) => {
 *     if (Cause.hasFail(cause)) {
 *       const error = Cause.filterError(cause)
 *       console.log("Expected error:", error)
 *     }
 *     return Effect.succeed("handled")
 *   })
 * )
 *
 * // Analyzing failure types
 * const analyzeCause = (cause: Cause.Cause<string>) => {
 *   if (Cause.hasFail(cause)) return "Has user error"
 *   if (Cause.hasDie(cause)) return "Has defect"
 *   if (Cause.hasInterrupt(cause)) return "Was interrupted"
 *   return "Unknown cause"
 * }
 * ```
 *
 * @since 2.0.0
 */
export * as Cause from "./Cause.ts"

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
 * import { Clock, Effect } from "effect"
 *
 * // Get current time in milliseconds
 * const getCurrentTime = Clock.currentTimeMillis
 *
 * // Sleep for 1 second
 * const sleep1Second = Effect.sleep("1 seconds")
 *
 * // Measure execution time
 * const measureTime = Effect.gen(function*() {
 *   const start = yield* Clock.currentTimeMillis
 *   yield* Effect.sleep("100 millis")
 *   const end = yield* Clock.currentTimeMillis
 *   return end - start
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Clock, Effect } from "effect"
 *
 * // Using Clock service directly
 * const program = Effect.gen(function*() {
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
 * @since 4.0.0
 */
export * as Config from "./Config.ts"

/**
 * @since 4.0.0
 */
export * as ConfigProvider from "./ConfigProvider.ts"

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
 * import { Console, Effect } from "effect"
 *
 * // Basic logging
 * const program = Effect.gen(function*() {
 *   yield* Console.log("Hello, World!")
 *   yield* Console.error("Something went wrong")
 *   yield* Console.warn("This is a warning")
 *   yield* Console.info("Information message")
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 *
 * // Grouped logging with timing
 * const debugProgram = Console.withGroup(
 *   Effect.gen(function*() {
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
 * import { Console, Effect } from "effect"
 *
 * // Data visualization and debugging
 * const dataProgram = Effect.gen(function*() {
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
 */
export * as Cron from "./Cron.ts"

/**
 * @since 3.6.0
 */
export * as DateTime from "./DateTime.ts"

/**
 * This module provides utilities for working with `Deferred`, a powerful concurrency
 * primitive that represents an asynchronous variable that can be set exactly once.
 * Multiple fibers can await the same `Deferred` and will all be notified when it
 * completes.
 *
 * A `Deferred<A, E>` can be:
 * - **Completed successfully** with a value of type `A`
 * - **Failed** with an error of type `E`
 * - **Interrupted** if the fiber setting it is interrupted
 *
 * Key characteristics:
 * - **Single assignment**: Can only be completed once
 * - **Multiple waiters**: Many fibers can await the same `Deferred`
 * - **Fiber-safe**: Thread-safe operations across concurrent fibers
 * - **Composable**: Works seamlessly with other Effect operations
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Deferred } from "effect"
 * import { Fiber } from "effect"
 *
 * // Basic usage: coordinate between fibers
 * const program = Effect.gen(function* () {
 *   const deferred = yield* Deferred.make<string, never>()
 *
 *   // Fiber 1: waits for the value
 *   const waiter = yield* Effect.forkChild(
 *     Effect.gen(function* () {
 *       const value = yield* Deferred.await(deferred)
 *       console.log("Received:", value)
 *       return value
 *     })
 *   )
 *
 *   // Fiber 2: sets the value after a delay
 *   const setter = yield* Effect.forkChild(
 *     Effect.gen(function* () {
 *       yield* Effect.sleep("1 second")
 *       yield* Deferred.succeed(deferred, "Hello from setter!")
 *     })
 *   )
 *
 *   // Wait for both fibers
 *   yield* Fiber.join(waiter)
 *   yield* Fiber.join(setter)
 * })
 *
 * // Producer-consumer pattern
 * const producerConsumer = Effect.gen(function* () {
 *   const buffer = yield* Deferred.make<number[], never>()
 *
 *   const producer = Effect.gen(function* () {
 *     const data = [1, 2, 3, 4, 5]
 *     yield* Deferred.succeed(buffer, data)
 *   })
 *
 *   const consumer = Effect.gen(function* () {
 *     const data = yield* Deferred.await(buffer)
 *     return data.reduce((sum, n) => sum + n, 0)
 *   })
 *
 *   const [, result] = yield* Effect.all([producer, consumer])
 *   return result // 15
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Deferred from "./Deferred.ts"

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
 * @since 2.0.0
 */
export * as Duration from "./Duration.ts"

/**
 * The `Effect` module is the core of the Effect library, providing a powerful and expressive
 * way to model and compose asynchronous, concurrent, and effectful computations.
 *
 * An `Effect<A, E, R>` represents a computation that:
 * - May succeed with a value of type `A`
 * - May fail with an error of type `E`
 * - Requires a context/environment of type `R`
 *
 * Effects are lazy and immutable - they describe computations that can be executed later.
 * This allows for powerful composition, error handling, resource management, and concurrency
 * patterns.
 *
 * ## Key Features
 *
 * - **Type-safe error handling**: Errors are tracked in the type system
 * - **Resource management**: Automatic cleanup with scoped resources
 * - **Structured concurrency**: Safe parallel and concurrent execution
 * - **Composable**: Effects can be combined using operators like `flatMap`, `map`, `zip`
 * - **Testable**: Built-in support for testing with controlled environments
 * - **Interruptible**: Effects can be safely interrupted and cancelled
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Console } from "effect"
 *
 * // Creating a simple effect
 * const hello = Effect.succeed("Hello, World!")
 *
 * // Composing effects
 * const program = Effect.gen(function* () {
 *   const message = yield* hello
 *   yield* Console.log(message)
 *   return message.length
 * })
 *
 * // Running the effect
 * Effect.runPromise(program).then(console.log) // 13
 * ```
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * // Effect that may fail
 * const divide = (a: number, b: number) =>
 *   b === 0
 *     ? Effect.fail(new Error("Division by zero"))
 *     : Effect.succeed(a / b)
 *
 * // Error handling
 * const program = Effect.gen(function* () {
 *   const result = yield* divide(10, 2)
 *   console.log("Result:", result) // Result: 5
 *   return result
 * })
 *
 * // Handle errors
 * const safeProgram = program.pipe(
 *   Effect.match({
 *     onFailure: (error) => -1,
 *     onSuccess: (value) => value
 *   })
 * )
 * ```
 *
 * @since 2.0.0
 */
export * as Effect from "./Effect.ts"

/**
 * The `Exit` type represents the result of running an Effect computation.
 * An `Exit<A, E>` can either be:
 * - `Success`: Contains a value of type `A`
 * - `Failure`: Contains a `Cause<E>` describing why the effect failed
 *
 * `Exit` is used internally by the Effect runtime and can be useful for
 * handling the results of Effect computations in a more explicit way.
 *
 * @since 2.0.0
 */
export * as Exit from "./Exit.ts"

/**
 * This module provides utilities for working with `Fiber`, the fundamental unit of
 * concurrency in Effect. Fibers are lightweight, user-space threads that allow
 * multiple Effects to run concurrently with structured concurrency guarantees.
 *
 * Key characteristics of Fibers:
 * - **Lightweight**: Much lighter than OS threads, you can create millions
 * - **Structured concurrency**: Parent fibers manage child fiber lifecycles
 * - **Cancellation safety**: Proper resource cleanup when interrupted
 * - **Cooperative**: Fibers yield control at effect boundaries
 * - **Traceable**: Each fiber has an ID for debugging and monitoring
 *
 * Common patterns:
 * - **Fork and join**: Start concurrent work and wait for results
 * - **Race conditions**: Run multiple effects, take the first to complete
 * - **Supervision**: Monitor and restart failed fibers
 * - **Resource management**: Ensure proper cleanup on interruption
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Console } from "effect"
 * import { Fiber } from "effect"
 *
 * // Basic fiber operations
 * const basicExample = Effect.gen(function* () {
 *   // Fork an effect to run concurrently
 *   const fiber = yield* Effect.forkChild(
 *     Effect.gen(function* () {
 *       yield* Effect.sleep("2 seconds")
 *       yield* Console.log("Background task completed")
 *       return "background result"
 *     })
 *   )
 *
 *   // Do other work while the fiber runs
 *   yield* Console.log("Doing other work...")
 *   yield* Effect.sleep("1 second")
 *
 *   // Wait for the fiber to complete
 *   const result = yield* Fiber.join(fiber)
 *   yield* Console.log(`Fiber result: ${result}`)
 * })
 *
 * // Joining multiple fibers
 * const joinExample = Effect.gen(function* () {
 *   const task1 = Effect.delay(Effect.succeed("task1"), "1 second")
 *   const task2 = Effect.delay(Effect.succeed("task2"), "2 seconds")
 *
 *   // Start both effects as fibers
 *   const fiber1 = yield* Effect.forkChild(task1)
 *   const fiber2 = yield* Effect.forkChild(task2)
 *
 *   // Wait for both to complete
 *   const result1 = yield* Fiber.join(fiber1)
 *   const result2 = yield* Fiber.join(fiber2)
 *   return [result1, result2] // ["task1", "task2"]
 * })
 *
 * // Parallel execution with structured concurrency
 * const parallelExample = Effect.gen(function* () {
 *   const tasks = [1, 2, 3, 4, 5].map(n =>
 *     Effect.gen(function* () {
 *       yield* Effect.sleep(`${n * 100} millis`)
 *       return n * n
 *     })
 *   )
 *
 *   // Run all tasks in parallel, wait for all to complete
 *   const results = yield* Effect.all(tasks, { concurrency: "unbounded" })
 *   return results // [1, 4, 9, 16, 25]
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Fiber from "./Fiber.ts"

/**
 * @since 2.0.0
 */
export * as FiberHandle from "./FiberHandle.ts"

/**
 * @since 2.0.0
 */
export * as FiberMap from "./FiberMap.ts"

/**
 * @since 2.0.0
 */
export * as FiberSet from "./FiberSet.ts"

/**
 * @since 2.0.0
 */
export * as Function from "./Function.ts"

/**
 * A `Layer<ROut, E, RIn>` describes how to build one or more services in your
 * application. Services can be injected into effects via
 * `Effect.provideService`. Effects can require services via `Effect.service`.
 *
 * Layer can be thought of as recipes for producing bundles of services, given
 * their dependencies (other services).
 *
 * Construction of services can be effectful and utilize resources that must be
 * acquired and safely released when the services are done being utilized.
 *
 * By default layers are shared, meaning that if the same layer is used twice
 * the layer will only be allocated a single time.
 *
 * Because of their excellent composition properties, layers are the idiomatic
 * way in Effect-TS to create services that depend on other services.
 *
 * @since 2.0.0
 */
export * as Layer from "./Layer.ts"

/**
 * @since 3.14.0
 */
export * as LayerMap from "./LayerMap.ts"

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
 *
 * // Basic logging
 * const program = Effect.gen(function*() {
 *   yield* Effect.log("Application started")
 *   yield* Effect.logInfo("Processing user request")
 *   yield* Effect.logWarning("Resource limit approaching")
 *   yield* Effect.logError("Database connection failed")
 * })
 *
 * // With structured data
 * const structuredLog = Effect.gen(function*() {
 *   yield* Effect.log("User action", { userId: 123, action: "login" })
 *   yield* Effect.logInfo("Request processed", { duration: 150, statusCode: 200 })
 * })
 * ```
 *
 * ## Custom Loggers
 *
 * ```ts
 * import { Effect, Logger } from "effect"
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
 * import { Effect, Logger } from "effect"
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
 * import { Effect, Logger } from "effect"
 * import { Duration } from "effect"
 *
 * const batchedLogger = Logger.batched(Logger.formatJson, {
 *   window: Duration.seconds(5),
 *   flush: (messages) =>
 *     Effect.sync(() => {
 *       // Process batch of log messages
 *       console.log("Flushing", messages.length, "log entries")
 *     })
 * })
 *
 * const program = Effect.gen(function*() {
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
 *
 * // Basic log level usage
 * const program = Effect.gen(function*() {
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
 * import { LogLevel } from "effect"
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
 * import { Logger, LogLevel } from "effect"
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
 *     console.log(
 *       `${options.date.toISOString()} [${options.logLevel}] ${options.message}`
 *     )
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
 * import { Config, Effect, Logger, LogLevel } from "effect"
 *
 * // Configure log level from environment
 * const logLevelConfig = Config.string("LOG_LEVEL").pipe(
 *   Config.withDefault("Info")
 * )
 *
 * const configurableLogger = Effect.gen(function*() {
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

/**
 * @since 2.0.0
 */
export * as ManagedRuntime from "./ManagedRuntime.ts"

/**
 * The `effect/match` module provides a type-safe pattern matching system for
 * TypeScript. Inspired by functional programming, it simplifies conditional
 * logic by replacing verbose if/else or switch statements with a structured and
 * expressive API.
 *
 * This module supports matching against types, values, and discriminated unions
 * while enforcing exhaustiveness checking to ensure all cases are handled.
 *
 * Although pattern matching is not yet a native JavaScript feature,
 * `effect/match` offers a reliable implementation that is available today.
 *
 * **How Pattern Matching Works**
 *
 * Pattern matching follows a structured process:
 *
 * - **Creating a matcher**: Define a `Matcher` that operates on either a
 *   specific `Match.type` or `Match.value`.
 *
 * - **Defining patterns**: Use combinators such as `Match.when`, `Match.not`,
 *   and `Match.tag` to specify matching conditions.
 *
 * - **Completing the match**: Apply a finalizer such as `Match.exhaustive`,
 *   `Match.orElse`, or `Match.option` to determine how unmatched cases should
 *   be handled.
 *
 * @since 4.0.0
 */
export * as Match from "./Match.ts"

/**
 * @since 2.0.0
 *
 * The `Metric` module provides a comprehensive system for collecting, aggregating, and observing
 * application metrics in Effect applications. It offers type-safe, concurrent metrics that can
 * be used to monitor performance, track business metrics, and gain insights into application behavior.
 *
 * ## Key Features
 *
 * - **Five Metric Types**: Counters, Gauges, Frequencies, Histograms, and Summaries
 * - **Type Safety**: Fully typed metrics with compile-time guarantees
 * - **Concurrency Safe**: Thread-safe metrics that work with Effect's concurrency model
 * - **Attributes**: Tag metrics with key-value attributes for filtering and grouping
 * - **Snapshots**: Take point-in-time snapshots of all metrics for reporting
 * - **Runtime Integration**: Automatic fiber runtime metrics collection
 *
 * ## Metric Types
 *
 * ### Counter
 * Tracks cumulative values that only increase or can be reset to zero.
 * Perfect for counting events, requests, errors, etc.
 *
 * ### Gauge
 * Represents a single numerical value that can go up or down.
 * Ideal for current resource usage, temperature, queue sizes, etc.
 *
 * ### Frequency
 * Counts occurrences of discrete string values.
 * Useful for tracking categorical data like HTTP status codes, user actions, etc.
 *
 * ### Histogram
 * Records observations in configurable buckets to analyze distribution.
 * Great for response times, request sizes, and other measured values.
 *
 * ### Summary
 * Calculates quantiles over a sliding time window.
 * Provides statistical insights into value distributions over time.
 *
 * ## Basic Usage
 *
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * // Create metrics
 * const requestCount = Metric.counter("http_requests_total", {
 *   description: "Total number of HTTP requests"
 * })
 *
 * const responseTime = Metric.histogram("http_response_time", {
 *   description: "HTTP response time in milliseconds",
 *   boundaries: Metric.linearBoundaries({ start: 0, width: 50, count: 20 })
 * })
 *
 * // Use metrics in your application
 * const handleRequest = Effect.gen(function*() {
 *   yield* Metric.update(requestCount, 1)
 *
 *   const startTime = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
 *
 *   // Process request...
 *   yield* Effect.sleep("100 millis")
 *
 *   const endTime = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
 *   yield* Metric.update(responseTime, endTime - startTime)
 * })
 * ```
 *
 * ## Attributes and Tagging
 *
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * const requestCount = Metric.counter("requests", {
 *   description: "Number of requests by endpoint and method"
 * })
 *
 * const program = Effect.gen(function*() {
 *   // Add attributes to metrics
 *   yield* Metric.update(
 *     Metric.withAttributes(requestCount, {
 *       endpoint: "/api/users",
 *       method: "GET"
 *     }),
 *     1
 *   )
 *
 *   // Or use withAttributes for compile-time attributes
 *   const taggedCounter = Metric.withAttributes(requestCount, {
 *     endpoint: "/api/posts",
 *     method: "POST"
 *   })
 *   yield* Metric.update(taggedCounter, 1)
 * })
 * ```
 *
 * ## Advanced Examples
 *
 * ```ts
 * import { Effect, Metric } from "effect"
 *
 * // Business metrics
 * const userSignups = Metric.counter("user_signups_total")
 * const activeUsers = Metric.gauge("active_users_current")
 * const featureUsage = Metric.frequency("feature_usage")
 *
 * // Performance metrics
 * const dbQueryTime = Metric.summary("db_query_duration", {
 *   maxAge: "5 minutes",
 *   maxSize: 1000,
 *   quantiles: [0.5, 0.9, 0.95, 0.99]
 * })
 *
 * const program = Effect.gen(function*() {
 *   // Track user signup
 *   yield* Metric.update(userSignups, 1)
 *
 *   // Update active user count
 *   yield* Metric.update(activeUsers, 1250)
 *
 *   // Record feature usage
 *   yield* Metric.update(featureUsage, "dashboard_view")
 *
 *   // Measure database query time
 *   yield* Effect.timed(performDatabaseQuery).pipe(
 *     Effect.tap(([duration]) => Metric.update(dbQueryTime, duration))
 *   )
 * })
 *
 * // Get metric snapshots
 * const getMetrics = Effect.gen(function*() {
 *   const snapshots = yield* Metric.snapshot
 *
 *   for (const metric of snapshots) {
 *     console.log(`${metric.id}: ${JSON.stringify(metric.state)}`)
 *   }
 * })
 * ```
 */
export * as Metric from "./Metric.ts"

/**
 * @fileoverview
 * MutableRef provides a mutable reference container that allows safe mutation of values
 * in functional programming contexts. It serves as a bridge between functional and imperative
 * programming paradigms, offering atomic operations for state management.
 *
 * Unlike regular variables, MutableRef encapsulates mutable state and provides controlled
 * access through a standardized API. It supports atomic compare-and-set operations for
 * thread-safe updates and integrates seamlessly with Effect's ecosystem.
 *
 * Key Features:
 * - Mutable reference semantics with functional API
 * - Atomic compare-and-set operations for safe concurrent updates
 * - Specialized operations for numeric and boolean values
 * - Chainable operations that return the reference or the value
 * - Integration with Effect's Equal interface for value comparison
 *
 * Common Use Cases:
 * - State containers in functional applications
 * - Counters and accumulators
 * - Configuration that needs to be updated at runtime
 * - Caching and memoization scenarios
 * - Inter-module communication via shared references
 *
 * Performance Characteristics:
 * - Get/Set: O(1)
 * - Compare-and-set: O(1)
 * - All operations: O(1)
 *
 * @since 2.0.0
 * @category data-structures
 */
export * as MutableRef from "./MutableRef.ts"

/**
 * This module provides utility functions and type class instances for working with the `number` type in TypeScript.
 * It includes functions for basic arithmetic operations, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as Number from "./Number.ts"

/**
 * @since 2.0.0
 */
export * as Pool from "./Pool.ts"

/**
 * This module provides utilities for working with publish-subscribe (PubSub) systems.
 *
 * A PubSub is an asynchronous message hub where publishers can publish messages and subscribers
 * can subscribe to receive those messages. PubSub supports various backpressure strategies,
 * message replay, and concurrent access from multiple producers and consumers.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Scope } from "effect"
 * import { PubSub } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const pubsub = yield* PubSub.bounded<string>(10)
 *
 *   // Publisher
 *   yield* PubSub.publish(pubsub, "Hello")
 *   yield* PubSub.publish(pubsub, "World")
 *
 *   // Subscriber
 *   yield* Effect.scoped(Effect.gen(function*() {
 *     const subscription = yield* PubSub.subscribe(pubsub)
 *     const message1 = yield* PubSub.take(subscription)
 *     const message2 = yield* PubSub.take(subscription)
 *     console.log(message1, message2) // "Hello", "World"
 *   }))
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as PubSub from "./PubSub.ts"

/**
 * This module provides utilities for working with asynchronous queues that support various backpressure strategies.
 *
 * A Queue is a data structure that allows producers to add elements and consumers to take elements
 * in a thread-safe manner. The queue supports different strategies for handling backpressure when
 * the queue reaches capacity.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Queue } from "effect"
 *
 * // Creating a bounded queue with capacity 10
 * const program = Effect.gen(function*() {
 *   const queue = yield* Queue.bounded<number, Queue.Done>(10)
 *
 *   // Producer: add items to queue
 *   yield* Queue.offer(queue, 1)
 *   yield* Queue.offer(queue, 2)
 *   yield* Queue.offerAll(queue, [3, 4, 5])
 *
 *   // Consumer: take items from queue
 *   const item1 = yield* Queue.take(queue)
 *   const item2 = yield* Queue.take(queue)
 *   const remaining = yield* Queue.takeAll(queue)
 *
 *   console.log({ item1, item2, remaining }) // { item1: 1, item2: 2, remaining: [3, 4, 5] }
 *
 *   // Signal completion
 *   yield* Queue.end(queue)
 * })
 * ```
 *
 * @since 3.8.0
 */
export * as Queue from "./Queue.ts"

/**
 * @since 3.5.0
 */
export * as RcMap from "./RcMap.ts"

/**
 * @since 3.5.0
 */
export * as RcRef from "./RcRef.ts"

/**
 * This module provides utilities for working with mutable references in a functional context.
 *
 * A Ref is a mutable reference that can be read, written, and atomically modified. Unlike plain
 * mutable variables, Refs are thread-safe and work seamlessly with Effect's concurrency model.
 * They provide atomic operations for safe state management in concurrent programs.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Ref } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create a ref with initial value
 *   const counter = yield* Ref.make(0)
 *
 *   // Atomic operations
 *   yield* Ref.update(counter, n => n + 1)
 *   yield* Ref.update(counter, n => n * 2)
 *
 *   const value = yield* Ref.get(counter)
 *   console.log(value) // 2
 *
 *   // Atomic modify with return value
 *   const previous = yield* Ref.getAndSet(counter, 100)
 *   console.log(previous) // 2
 * })
 * ```
 *
 * @since 2.0.0
 */
export * as Ref from "./Ref.ts"

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
export * as References from "./References.ts"

/**
 * This module provides utility functions for working with RegExp in TypeScript.
 *
 * @since 2.0.0
 */
export * as RegExp from "./RegExp.ts"

/**
 * The `Request` module provides a way to model requests to external data sources
 * in a functional and composable manner. Requests represent descriptions of
 * operations that can be batched, cached, and executed efficiently.
 *
 * A `Request<A, E, R>` represents a request that:
 * - Yields a value of type `A` on success
 * - Can fail with an error of type `E`
 * - Requires services of type `R`
 *
 * Requests are primarily used with RequestResolver to implement efficient
 * data fetching patterns, including automatic batching and caching.
 *
 * @since 2.0.0
 */
export * as Request from "./Request.ts"

/**
 * @since 2.0.0
 */
export * as RequestResolver from "./RequestResolver.ts"

/**
 * This module provides utilities for running Effect programs and managing their execution lifecycle.
 *
 * The Runtime module contains functions for creating main program runners that handle process
 * teardown, error reporting, and exit code management. These utilities are particularly useful
 * for creating CLI applications and server processes that need to manage their lifecycle properly.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Runtime } from "effect"
 * import { Fiber } from "effect"
 *
 * // Create a main runner for Node.js
 * const runMain = Runtime.makeRunMain((options) => {
 *   process.on('SIGINT', () => Effect.runFork(Fiber.interrupt(options.fiber)))
 *   process.on('SIGTERM', () => Effect.runFork(Fiber.interrupt(options.fiber)))
 *
 *   options.fiber.addObserver((exit) => {
 *     options.teardown(exit, (code) => process.exit(code))
 *   })
 * })
 *
 * // Use the runner
 * const program = Effect.log("Hello, World!")
 * runMain(program)
 * ```
 *
 * @since 4.0.0
 */
export * as Runtime from "./Runtime.ts"

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
 * import { Schedule } from "effect"
 * import { Duration } from "effect"
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

/**
 * @since 2.0.0
 */
export * as Scheduler from "./Scheduler.ts"

/**
 * The `Scope` module provides functionality for managing resource lifecycles
 * and cleanup operations in a functional and composable manner.
 *
 * A `Scope` represents a context where resources can be acquired and automatically
 * cleaned up when the scope is closed. This is essential for managing resources
 * like file handles, database connections, or any other resources that need
 * proper cleanup.
 *
 * Scopes support both sequential and parallel finalization strategies:
 * - Sequential: Finalizers run one after another in reverse order of registration
 * - Parallel: Finalizers run concurrently for better performance
 *
 * @since 2.0.0
 */
export * as Scope from "./Scope.ts"

/**
 * @since 4.0.0
 */
export * as ScopedCache from "./ScopedCache.ts"

/**
 * @since 2.0.0
 */
export * as ScopedRef from "./ScopedRef.ts"

/**
 * This module provides a data structure called `ServiceMap` that can be used for dependency injection in effectful
 * programs. It is essentially a table mapping `Keys`s to their implementations (called `Service`s), and can be used to
 * manage dependencies in a type-safe way. The `ServiceMap` data structure is essentially a way of providing access to a set
 * of related services that can be passed around as a single unit. This module provides functions to create, modify, and
 * query the contents of a `ServiceMap`, as well as a number of utility types for working with keys and services.
 *
 * @since 4.0.0
 */
export * as ServiceMap from "./ServiceMap.ts"

/**
 * This module provides utility functions and type class instances for working with the `string` type in TypeScript.
 * It includes functions for basic string manipulation, as well as type class instances for
 * `Equivalence` and `Order`.
 *
 * @since 2.0.0
 */
export * as String from "./String.ts"

/**
 * @since 2.0.0
 */
export * as Symbol from "./Symbol.ts"

/**
 * @since 2.0.0
 */
export * as SynchronizedRef from "./SynchronizedRef.ts"

/**
 * @since 2.0.0
 */
export * as Tracer from "./Tracer.ts"

/**
 * @since 2.0.0
 */
export * as Utils from "./Utils.ts"
