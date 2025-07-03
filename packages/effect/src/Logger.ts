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
 * import { Effect, Logger } from "effect"
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
 * import { Effect, Logger, LogLevel } from "effect"
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
 * ## File Logging
 *
 * ```ts
 * import { Effect, Logger, Layer } from "effect"
 * import { NodeFileSystem } from "@effect/platform-node"
 *
 * const fileLogger = Logger.formatJson.pipe(
 *   Logger.toFile("/app/logs/application.log")
 * )
 *
 * const LoggerLive = Logger.layer([fileLogger]).pipe(
 *   Layer.provide(NodeFileSystem.layer)
 * )
 *
 * const program = Effect.log("Application event").pipe(
 *   Effect.provide(LoggerLive)
 * )
 * ```
 *
 * ## Batched Logging
 *
 * ```ts
 * import { Effect, Logger, Duration } from "effect"
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
import * as Array from "./Array.js"
import type * as Cause from "./Cause.js"
import type * as Duration from "./Duration.js"
import type * as Effect from "./Effect.js"
import type * as Fiber from "./Fiber.js"
import * as FileSystem from "./FileSystem.js"
import { dual } from "./Function.js"
import * as Inspectable from "./Inspectable.js"
import { isEffect, withFiber } from "./internal/core.js"
import * as effect from "./internal/effect.js"
import * as Layer from "./Layer.js"
import type * as LogLevel from "./LogLevel.js"
import type { Pipeable } from "./Pipeable.js"
import type { PlatformError } from "./PlatformError.js"
import * as Predicate from "./Predicate.js"
import { CurrentLogAnnotations, CurrentLogSpans } from "./References.js"
import type * as Scope from "./Scope.js"
import * as ServiceMap from "./ServiceMap.js"
import type * as Types from "./Types.js"

/**
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/Logger"

/**
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = "~effect/Logger"

/**
 * @since 2.0.0
 * @category models
 */
export interface Logger<in Message, out Output> extends Logger.Variance<Message, Output>, Pipeable {
  log: (options: Logger.Options<Message>) => Output
}

/**
 * @since 2.0.0
 */
export declare namespace Logger {
  /**
   * @since 2.0.0
   * @category models
   */
  export interface Variance<in Message, out Output> {
    readonly [TypeId]: VarianceStruct<Message, Output>
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface VarianceStruct<in Message, out Output> {
    _Message: Types.Contravariant<Message>
    _Output: Types.Covariant<Output>
  }

  /**
   * @since 2.0.0
   * @category models
   */
  export interface Options<out Message> {
    readonly message: Message
    readonly logLevel: LogLevel.LogLevel
    readonly cause: Cause.Cause<unknown>
    readonly fiber: Fiber.Fiber<unknown, unknown>
    readonly date: Date
  }
}

/**
 * Returns `true` if the specified value is a `Logger`, otherwise returns `false`.
 *
 * @example
 * ```ts
 * import { Logger } from "effect"
 *
 * const myLogger = Logger.make((options) => {
 *   console.log(options.message)
 * })
 *
 * console.log(Logger.isLogger(myLogger)) // true
 * console.log(Logger.isLogger("not a logger")) // false
 * console.log(Logger.isLogger({ log: () => {} })) // false
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isLogger = (u: unknown): u is Logger<unknown, unknown> => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category references
 */
export const CurrentLoggers: ServiceMap.Reference<ReadonlySet<Logger<unknown, any>>> = effect.CurrentLoggers

/**
 * Transforms the output of a `Logger` using the provided function.
 *
 * This allows you to modify, enhance, or completely change the output format
 * of an existing logger without recreating the entire logging logic.
 *
 * @example
 * ```ts
 * import { Logger } from "effect"
 *
 * // Create a logger that outputs objects
 * const structuredLogger = Logger.make((options) => ({
 *   level: options.logLevel,
 *   message: options.message,
 *   timestamp: options.date.toISOString()
 * }))
 *
 * // Transform the output to JSON strings
 * const jsonStringLogger = Logger.map(
 *   structuredLogger,
 *   (output) => JSON.stringify(output)
 * )
 *
 * // Transform to uppercase messages
 * const uppercaseLogger = Logger.map(
 *   structuredLogger,
 *   (output) => ({ ...output, message: String(output.message).toUpperCase() })
 * )
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const map = dual<
  <Output, Output2>(
    f: (output: Output) => Output2
  ) => <Message>(
    self: Logger<Message, Output>
  ) => Logger<Message, Output2>,
  <Message, Output, Output2>(
    self: Logger<Message, Output>,
    f: (output: Output) => Output2
  ) => Logger<Message, Output2>
>(2, (self, f) => effect.loggerMake((options) => f(self.log(options))))

/**
 * Returns a new `Logger` that writes all output of the specified `Logger` to
 * the console using `console.log`.
 *
 * This is useful for taking any logger that produces string or object output
 * and routing it to the console for development or debugging purposes.
 *
 * @example
 * ```ts
 * import { Logger, Effect } from "effect"
 *
 * // Create a custom formatter
 * const customFormatter = Logger.make((options) => 
 *   `[${options.date.toISOString()}] ${options.logLevel}: ${options.message}`
 * )
 *
 * // Route to console
 * const consoleLogger = Logger.withConsoleLog(customFormatter)
 *
 * const program = Effect.log("Hello World").pipe(
 *   Effect.provide(Logger.layer([consoleLogger]))
 * )
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const withConsoleLog = <Message, Output>(
  self: Logger<Message, Output>
): Logger<Message, void> =>
  effect.loggerMake((options) => {
    const console = options.fiber.getRef(effect.CurrentConsole)
    return console.log(self.log(options))
  })
/**
 * Returns a new `Logger` that writes all output of the specified `Logger` to
 * the console using `console.error`.
 *
 * This is particularly useful for error logging where you want to ensure
 * log messages appear in the error stream (stderr) rather than standard output.
 *
 * @example
 * ```ts
 * import { Logger, Effect } from "effect"
 *
 * // Create an error-specific formatter
 * const errorFormatter = Logger.make((options) => 
 *   `ERROR [${options.date.toISOString()}]: ${options.message}`
 * )
 *
 * // Route to console.error
 * const errorLogger = Logger.withConsoleError(errorFormatter)
 *
 * const program = Effect.logError("Database connection failed").pipe(
 *   Effect.provide(Logger.layer([errorLogger]))
 * )
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const withConsoleError = <Message, Output>(
  self: Logger<Message, Output>
): Logger<Message, void> =>
  effect.loggerMake((options) => {
    const console = options.fiber.getRef(effect.CurrentConsole)
    return console.error(self.log(options))
  })
/**
 * Returns a new `Logger` that writes all output of the specified `Logger` to
 * the console.
 *
 * Will use the appropriate console method (i.e. `console.log`, `console.error`,
 * etc.) based upon the current `LogLevel`.
 *
 * - `Debug` -> `console.debug`
 * - `Info` -> `console.info`
 * - `Trace` -> `console.trace`
 * - `Warn` -> `console.warn`
 * - `Error` and `Fatal` -> `console.error`
 * - Others -> `console.log`
 *
 * @example
 * ```ts
 * import { Logger, Effect } from "effect"
 *
 * const formatter = Logger.make((options) => 
 *   `[${options.logLevel}] ${options.message}`
 * )
 *
 * const leveledLogger = Logger.withLeveledConsole(formatter)
 *
 * const program = Effect.gen(function* () {
 *   yield* Effect.logInfo("Info message")     // -> console.info
 *   yield* Effect.logWarning("Warning")       // -> console.warn
 *   yield* Effect.logError("Error occurred")  // -> console.error
 *   yield* Effect.logDebug("Debug info")      // -> console.debug
 * }).pipe(
 *   Effect.provide(Logger.layer([leveledLogger]))
 * )
 * ```
 *
 * @since 2.0.0
 * @category utils
 */
export const withLeveledConsole = <Message, Output>(
  self: Logger<Message, Output>
): Logger<Message, void> =>
  effect.loggerMake((options) => {
    const console = options.fiber.getRef(effect.CurrentConsole)
    const output = self.log(options)
    switch (options.logLevel) {
      case "Debug":
        return console.debug(output)
      case "Info":
        return console.info(output)
      case "Trace":
        return console.trace(output)
      case "Warn":
        return console.warn(output)
      case "Error":
      case "Fatal":
        return console.error(output)
      default:
        return console.log(output)
    }
  })

/**
 * Match strings that do not contain any whitespace characters, double quotes,
 * or equal signs.
 */
const textOnly = /^[^\s"=]*$/

/**
 * Escapes double quotes in a string.
 */
const escapeDoubleQuotes = (s: string) => `"${s.replace(/\\([\s\S])|(")/g, "\\$1$2")}"`

/**
 * Formats the identifier of a `Fiber` by prefixing it with a hash tag.
 */
const formatFiberId = (fiberId: number) => `#${fiberId}`

/**
 * Used by both {@link formatSimple} and {@link formatLogFmt} to render a log
 * message.
 *
 * @internal
 */
const format = (
  quoteValue: (s: string) => string,
  whitespace?: number | string | undefined
) =>
({ date, fiber, logLevel, message }: Logger.Options<unknown>): string => {
  const formatValue = (value: string): string => value.match(textOnly) ? value : quoteValue(value)
  const format = (label: string, value: string): string => `${effect.formatLabel(label)}=${formatValue(value)}`
  const append = (label: string, value: string): string => " " + format(label, value)

  let out = format("timestamp", date.toISOString())
  out += append("level", logLevel)
  out += append("fiber", formatFiberId(fiber.id))

  const messages = Array.ensure(message)
  for (let i = 0; i < messages.length; i++) {
    out += append("message", Inspectable.toStringUnknown(messages[i], whitespace))
  }

  // TODO
  // if (!Cause.isEmptyType(cause)) {
  //   out += append("cause", Cause.pretty(cause, { renderErrorCause: true }))
  // }

  const now = date.getTime()
  const spans = fiber.getRef(CurrentLogSpans)
  for (const span of spans) {
    out += " " + effect.formatLogSpan(span, now)
  }

  const annotations = fiber.getRef(CurrentLogAnnotations)
  for (const [label, value] of Object.entries(annotations)) {
    out += append(label, Inspectable.toStringUnknown(value, whitespace))
  }

  return out
}

/**
 * Creates a new `Logger` from a log function.
 *
 * The log function receives an options object containing the message, log level,
 * cause, fiber information, and timestamp, and should return the desired output.
 *
 * @example
 * ```ts
 * import { Logger, Effect } from "effect"
 *
 * // Simple text logger
 * const textLogger = Logger.make((options) => 
 *   `${options.date.toISOString()} [${options.logLevel}] ${options.message}`
 * )
 *
 * // Structured object logger
 * const objectLogger = Logger.make((options) => ({
 *   timestamp: options.date.toISOString(),
 *   level: options.logLevel,
 *   message: options.message,
 *   fiberId: options.fiber.id,
 *   annotations: options.fiber.getRef(Logger.CurrentLogAnnotations)
 * }))
 *
 * // Custom filtering logger
 * const filteredLogger = Logger.make((options) => {
 *   if (options.logLevel === "Debug") {
 *     return // Skip debug messages
 *   }
 *   return `${options.logLevel}: ${options.message}`
 * })
 *
 * const program = Effect.log("Hello World").pipe(
 *   Effect.provide(Logger.layer([textLogger]))
 * )
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make: <Message, Output>(
  log: (options: Logger.Options<Message>) => Output
) => Logger<Message, Output> = effect.loggerMake

/**
 * The default logging implementation used by the Effect runtime.
 *
 * @since 4.0.0
 * @category constructors
 */
export const defaultLogger: Logger<unknown, void> = effect.defaultLogger

/**
 * A `Logger` which outputs logs as a string.
 *
 * For example:
 * ```
 * timestamp=2025-01-03T14:22:47.570Z level=INFO fiber=#1 message=hello
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const formatSimple = effect.loggerMake(format(escapeDoubleQuotes))

/**
 * A `Logger` which outputs logs using the [logfmt](https://brandur.org/logfmt)
 * style.
 *
 * For example:
 * ```
 * timestamp=2025-01-03T14:22:47.570Z level=INFO fiber=#1 message=hello
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const formatLogFmt = effect.loggerMake(format(JSON.stringify, 0))

/**
 * A `Logger` which outputs logs using a structured format.
 *
 * For example:
 * ```
 * {
 *   message: [ 'hello' ],
 *   level: 'INFO',
 *   timestamp: '2025-01-03T14:25:39.666Z',
 *   annotations: { key: 'value' },
 *   spans: { label: 0 },
 *   fiberId: '#1'
 * }
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const formatStructured: Logger<unknown, {
  readonly level: string
  readonly fiberId: string
  readonly timestamp: string
  readonly message: unknown
  // TODO
  // readonly cause: string | undefined
  readonly annotations: Record<string, unknown>
  readonly spans: Record<string, number>
}> = effect.loggerMake(({ date, fiber, logLevel, message }) => {
  const annotationsObj: Record<string, unknown> = {}
  const spansObj: Record<string, number> = {}

  const annotations = fiber.getRef(CurrentLogAnnotations)
  for (const [key, value] of Object.entries(annotations)) {
    annotationsObj[key] = effect.structuredMessage(value)
  }

  const now = date.getTime()
  const spans = fiber.getRef(CurrentLogSpans)
  for (const [label, timestamp] of spans) {
    spansObj[label] = now - timestamp
  }

  const messageArr = Array.ensure(message)
  return {
    message: messageArr.length === 1
      ? effect.structuredMessage(messageArr[0])
      : messageArr.map(effect.structuredMessage),
    level: logLevel.toUpperCase(),
    timestamp: date.toISOString(),
    // TODO
    // cause: Cause.isEmpty(cause) ? undefined : Cause.pretty(cause, { renderErrorCause: true }),
    annotations: annotationsObj,
    spans: spansObj,
    fiberId: formatFiberId(fiber.id)
  }
})

/**
 * A `Logger` which outputs logs using a structured format serialized as JSON
 * on a single line.
 *
 * For example:
 * ```
 * {"message":["hello"],"level":"INFO","timestamp":"2025-01-03T14:28:57.508Z","annotations":{"key":"value"},"spans":{"label":0},"fiberId":"#1"}
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const formatJson = map(formatStructured, Inspectable.stringifyCircular)

/**
 * Returns a new `Logger` which will aggregate logs output by the specified
 * `Logger` over the provided `window`. After the `window` has elapsed, the
 * provided `flush` function will be called with the logs aggregated during
 * the last `window`.
 *
 * This is useful for implementing efficient batch processing of logs, such as
 * writing multiple log entries to a database or file in a single operation.
 *
 * @example
 * ```ts
 * import { Logger, Effect, Duration } from "effect"
 *
 * // Create a batched logger that flushes every 5 seconds
 * const batchedLogger = Logger.batched(Logger.formatJson, {
 *   window: Duration.seconds(5),
 *   flush: (messages) => Effect.sync(() => {
 *     console.log(`Flushing ${messages.length} log entries:`)
 *     messages.forEach((msg, i) => console.log(`${i + 1}. ${msg}`))
 *   })
 * })
 *
 * const program = Effect.gen(function* () {
 *   const logger = yield* batchedLogger
 *   
 *   yield* Effect.provide(
 *     Effect.all([
 *       Effect.log("Event 1"),
 *       Effect.log("Event 2"),
 *       Effect.log("Event 3"),
 *       Effect.sleep(Duration.seconds(6)), // Trigger flush
 *       Effect.log("Event 4")
 *     ]),
 *     Logger.layer([logger])
 *   )
 * })
 *
 * // Database batch logging example
 * const dbBatchLogger = Logger.batched(Logger.formatStructured, {
 *   window: Duration.seconds(10),
 *   flush: (entries) => Effect.gen(function* () {
 *     const db = yield* Database
 *     yield* db.insertLogEntries(entries)
 *   })
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const batched = dual<
  <Output>(options: {
    readonly window: Duration.DurationInput
    readonly flush: (messages: Array<NoInfer<Output>>) => Effect.Effect<void>
  }) => <Message>(
    self: Logger<Message, Output>
  ) => Effect.Effect<Logger<Message, void>, never, Scope.Scope>,
  <Message, Output>(
    self: Logger<Message, Output>,
    options: {
      readonly window: Duration.DurationInput
      readonly flush: (messages: Array<NoInfer<Output>>) => Effect.Effect<void>
    }
  ) => Effect.Effect<Logger<Message, void>, never, Scope.Scope>
>(2, <Message, Output>(
  self: Logger<Message, Output>,
  options: {
    readonly window: Duration.DurationInput
    readonly flush: (messages: Array<NoInfer<Output>>) => Effect.Effect<void>
  }
): Effect.Effect<Logger<Message, void>, never, Scope.Scope> =>
  effect.flatMap(effect.scope, (scope) => {
    let buffer: Array<Output> = []
    const flush = effect.suspend(() => {
      if (buffer.length === 0) {
        return effect.void
      }
      const arr = buffer
      buffer = []
      return options.flush(arr)
    })

    return effect.uninterruptibleMask((restore) =>
      restore(
        effect.sleep(options.window).pipe(
          effect.andThen(flush),
          effect.forever
        )
      ).pipe(
        effect.forkDaemon,
        effect.flatMap((fiber) => effect.scopeAddFinalizerExit(scope, () => effect.fiberInterrupt(fiber))),
        effect.andThen(effect.addFinalizer(() => flush)),
        effect.as(
          effect.loggerMake((options) => {
            buffer.push(self.log(options))
          })
        )
      )
    )
  }))

/**
 * A `Logger` which outputs logs in a "pretty" format and writes them to the
 * console.
 *
 * For example:
 * ```
 * [09:37:17.579] INFO (#1) label=0ms: hello
 *   key: value
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const consolePretty: (
  options?: {
    readonly colors?: "auto" | boolean | undefined
    readonly stderr?: boolean | undefined
    readonly formatDate?: ((date: Date) => string) | undefined
    readonly mode?: "browser" | "tty" | "auto" | undefined
  }
) => Logger<unknown, void> = effect.consolePretty

/**
 * A `Logger` which outputs logs using the [logfmt](https://brandur.org/logfmt)
 * style and writes them to the console.
 *
 * For example:
 * ```
 * timestamp=2025-01-03T14:22:47.570Z level=INFO fiber=#1 message=info
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const consoleLogFmt: Logger<unknown, void> = withConsoleLog(formatLogFmt)

/**
 * A `Logger` which outputs logs using a strctured format and writes them to
 * the console.
 *
 * For example:
 * ```
 * {
 *   message: [ 'info', 'message' ],
 *   level: 'INFO',
 *   timestamp: '2025-01-03T14:25:39.666Z',
 *   annotations: { key: 'value' },
 *   spans: { label: 0 },
 *   fiberId: '#1'
 * }
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const consoleStructured: Logger<unknown, void> = withConsoleLog(formatStructured)

/**
 * A `Logger` which outputs logs using a structured format serialized as JSON
 * on a single line and writes them to the console.
 *
 * For example:
 * ```
 * {"message":["hello"],"level":"INFO","timestamp":"2025-01-03T14:28:57.508Z","annotations":{"key":"value"},"spans":{"label":0},"fiberId":"#1"}
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const consoleJson: Logger<unknown, void> = withConsoleLog(formatJson)

/**
 * Creates a `Layer` which will overwrite the current set of loggers with the
 * specified array of `loggers`.
 *
 * If the specified array of `loggers` should be _merged_ with the current set
 * of loggers (instead of overwriting them), set `mergeWithExisting` to `true`.
 *
 * @example
 * ```ts
 * import { Logger, Effect, Layer } from "effect"
 *
 * // Single logger layer
 * const JsonLoggerLive = Logger.layer([Logger.consoleJson])
 *
 * // Multiple loggers layer
 * const MultiLoggerLive = Logger.layer([
 *   Logger.consoleJson,
 *   Logger.consolePretty(),
 *   Logger.formatStructured
 * ])
 *
 * // Merge with existing loggers
 * const AdditionalLoggerLive = Logger.layer(
 *   [Logger.consoleJson],
 *   { mergeWithExisting: true }
 * )
 *
 * // Using Effect loggers in layer
 * const fileLogger = Logger.formatJson.pipe(
 *   Logger.toFile("/app/logs/app.log")
 * )
 * 
 * const FileLoggerLive = Logger.layer([fileLogger]).pipe(
 *   Layer.provide(NodeFileSystem.layer)
 * )
 *
 * const program = Effect.log("Application started").pipe(
 *   Effect.provide(JsonLoggerLive)
 * )
 * ```
 *
 * @since 4.0.0
 * @category context
 */
export const layer = <
  const Loggers extends ReadonlyArray<Logger<unknown, unknown> | Effect.Effect<Logger<unknown, unknown>, any, any>>
>(
  loggers: Loggers,
  options?: { mergeWithExisting: boolean }
): Layer.Layer<
  never,
  Loggers[number] extends Effect.Effect<infer _A, infer _E, infer _R> ? _E : never,
  Exclude<
    Loggers[number] extends Effect.Effect<infer _A, infer _E, infer _R> ? _R : never,
    Scope.Scope
  >
> =>
  Layer.effectServices(
    withFiber(effect.fnUntraced(function*(fiber) {
      const currentLoggers = new Set(options?.mergeWithExisting === true ? fiber.getRef(effect.CurrentLoggers) : [])
      for (const logger of loggers) {
        currentLoggers.add(isEffect(logger) ? yield* logger : logger)
      }
      return ServiceMap.make(effect.CurrentLoggers, currentLoggers)
    }))
  )

/**
 * Create a Logger from another string Logger that writes to the specified file.
 *
 * **Example**
 *
 * ```ts
 * import { NodeFileSystem, NodeRuntime } from "@effect/platform-node"
 * import { Effect, Layer, Logger } from "effect"
 *
 * const fileLogger = Logger.formatJson.pipe(
 *   Logger.toFile("/tmp/log.txt")
 * )
 * const LoggerLive = Logger.layer([fileLogger]).pipe(
 *   Layer.provide(NodeFileSystem.layer)
 * )
 *
 * Effect.log("a").pipe(
 *   Effect.andThen(Effect.log("b")),
 *   Effect.andThen(Effect.log("c")),
 *   Effect.provide(LoggerLive),
 *   NodeRuntime.runMain
 * )
 * ```
 *
 * @since 4.0.0
 */
export const toFile = dual<
  (
    path: string,
    options?:
      | FileSystem.OpenFileOptions & {
        readonly batchWindow?: Duration.DurationInput | undefined
      }
      | undefined
  ) => <Message>(
    self: Logger<Message, string>
  ) => Effect.Effect<Logger<Message, void>, PlatformError, Scope.Scope | FileSystem.FileSystem>,
  <Message>(
    self: Logger<Message, string>,
    path: string,
    options?:
      | FileSystem.OpenFileOptions & {
        readonly batchWindow?: Duration.DurationInput | undefined
      }
      | undefined
  ) => Effect.Effect<Logger<Message, void>, PlatformError, Scope.Scope | FileSystem.FileSystem>
>(
  (args) => isLogger(args[0]),
  (self, path, options) =>
    effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const logFile = yield* fs.open(path, { flag: "a+", ...options })
      const encoder = new TextEncoder()
      return yield* batched(self, {
        window: options?.batchWindow ?? 1000,
        flush: (output) => effect.ignore(logFile.write(encoder.encode(output.join("\n") + "\n")))
      })
    })
)
