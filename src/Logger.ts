/**
 * @since 2.0.0
 */
import * as Array from "./Array.js"
import type * as Cause from "./Cause.js"
import * as Context from "./Context.js"
import type * as Duration from "./Duration.js"
import type * as Effect from "./Effect.js"
import type * as Fiber from "./Fiber.js"
import { dual } from "./Function.js"
import * as Inspectable from "./Inspectable.js"
import * as core from "./internal/core.js"
import * as Layer from "./Layer.js"
import type * as LogLevel from "./LogLevel.js"
import type { Pipeable } from "./Pipeable.js"
import * as Predicate from "./Predicate.js"
import { CurrentLogAnnotations, CurrentLogSpans } from "./References.js"
import type * as Scope from "./Scope.js"
import type * as Types from "./Types.js"

/**
 * @since 4.0.0
 * @category symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/Logger")

/**
 * @since 4.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface Logger<in Message, out Output> extends Logger.Variance<Message, Output>, Pipeable {
  log: (options: Logger.Options<Message>) => Output
}

/**
 * @since 4.0.0
 * @category references
 */
export interface CurrentLoggers {
  readonly _: unique symbol
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
    readonly fiber: Fiber.Fiber<unknown>
    readonly date: Date
  }
}

/**
 * Returns `true` if the specified value is a `Logger`, otherwise returns `false`.
 *
 * @since 2.0.0
 * @category guards
 */
export const isLogger = (u: unknown): u is Logger<unknown, unknown> => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category references
 */
export const CurrentLoggers: Context.Reference<
  CurrentLoggers,
  ReadonlySet<Logger<unknown, any>>
> = core.CurrentLoggers

/**
 * @since 2.0.0
 * @category constructors
 */
export const make: <Message, Output>(
  log: (options: Logger.Options<Message>) => Output
) => Logger<Message, Output> = core.loggerMake

/**
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
>(2, (self, f) => core.loggerMake((options) => f(self.log(options))))

/**
 * Returns a new `Logger` that writes all output of the specified `Logger` to
 * the console using `console.log`.
 *
 * @since 2.0.0
 * @category utils
 */
export const withConsoleLog: <Message, Output>(self: Logger<Message, Output>) => Logger<Message, void> =
  core.loggerWithConsoleLog

/**
 * Returns a new `Logger` that writes all output of the specified `Logger` to
 * the console using `console.error`.
 *
 * @since 2.0.0
 * @category utils
 */
export const withConsoleError: <Message, Output>(self: Logger<Message, Output>) => Logger<Message, void> =
  core.loggerWithConsoleError

/**
 * Returns a new `Logger` that writes all output of the specified `Logger` to
 * the console.
 *
 * Will use the appropriate console method (i.e. `console.log`, `console.error`,
 * etc.) based upon the current `LogLevel`.
 *
 * @since 2.0.0
 * @category utils
 */
export const withLeveledConsole: <Message, Output>(self: Logger<Message, Output>) => Logger<Message, void> =
  core.loggerWithLeveledConsole

/**
 * The default logging implementation used by the Effect runtime.
 *
 * By default, the Effect runtime uses the {@link consolePretty} logger.
 *
 * @since 4.0.0
 * @category constructors
 */
export const defaultLogger: Logger<unknown, void> = core.defaultLogger

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
export const formatSimple = core.loggerMake<unknown, string>(
  ({ date, fiber, logLevel, message }) => {
    const annotations = fiber.getRef(CurrentLogAnnotations)
    const spans = fiber.getRef(CurrentLogSpans)

    const outputArray = [
      `timestamp=${date.toISOString()}`,
      `level=${logLevel.toUpperCase()}`,
      `fiber=#${fiber.id}`
    ]

    let output = outputArray.join(" ")

    const messageArray = Array.ensure(message)
    for (let i = 0; i < messageArray.length; i++) {
      const stringMessage = Inspectable.toStringUnknown(messageArray[i])
      if (stringMessage.length > 0) {
        output = output + " message="
        output = appendQuoted(stringMessage, output)
      }
    }

    // TODO
    // if (cause != null && cause._tag !== "Empty") {
    //   output = output + " cause="
    //   output = appendQuotedLogfmt(Cause.pretty(cause, { renderErrorCause: true }), output)
    // }

    const now = date.getTime()
    if (spans.length > 0) {
      output = output + " "
      let first = true
      for (let i = 0; i < spans.length; i++) {
        const [label, timestamp] = spans[i]
        if (first) {
          first = false
        } else {
          output = output + " "
        }
        output = output + core.renderLogSpanLogfmt(label, timestamp, now)
      }
    }

    const entries = Object.entries(annotations)
    if (entries.length > 0) {
      output = output + " "
      let first = true
      for (let i = 0; i < entries.length; i++) {
        const key = entries[i][0]
        const value = entries[i][1]
        if (first) {
          first = false
        } else {
          output = output + " "
        }
        output = output + core.filterKeyName(key)
        output = output + "="
        output = appendQuoted(Inspectable.toStringUnknown(value), output)
      }
    }

    return output
  }
)

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
export const formatLogFmt = core.loggerMake<unknown, string>(
  ({ date, fiber, logLevel, message }) => {
    const annotations = fiber.getRef(CurrentLogAnnotations)
    const spans = fiber.getRef(CurrentLogSpans)

    const outputArray = [
      `timestamp=${date.toISOString()}`,
      `level=${logLevel.toUpperCase()}`,
      `fiber=#${fiber.id}`
    ]

    let output = outputArray.join(" ")

    const messageArr = Array.ensure(message)
    for (let i = 0; i < messageArr.length; i++) {
      const stringMessage = Inspectable.toStringUnknown(messageArr[i], 0)
      if (stringMessage.length > 0) {
        output = output + " message="
        output = appendQuotedLogfmt(stringMessage, output)
      }
    }

    // TODO
    // if (cause != null && cause._tag !== "Empty") {
    //   output = output + " cause="
    //   output = appendQuotedLogfmt(Cause.pretty(cause, { renderErrorCause: true }), output)
    // }

    const now = date.getTime()
    if (spans.length > 0) {
      output = output + " "
      let first = true
      for (let i = 0; i < spans.length; i++) {
        const [label, timestamp] = spans[i]
        if (first) {
          first = false
        } else {
          output = output + " "
        }
        output = output + core.renderLogSpanLogfmt(label, timestamp, now)
      }
    }

    const entries = Object.entries(annotations)
    if (entries.length > 0) {
      output = output + " "
      let first = true
      for (let i = 0; i < entries.length; i++) {
        const key = entries[i][0]
        const value = entries[i][1]
        if (first) {
          first = false
        } else {
          output = output + " "
        }
        output = output + core.filterKeyName(key)
        output = output + "="
        output = appendQuotedLogfmt(Inspectable.toStringUnknown(value, 0), output)
      }
    }

    return output
  }
)

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
}> = core.loggerMake(({ date, fiber, logLevel, message }) => {
  const annotations = fiber.getRef(CurrentLogAnnotations)
  const spans = fiber.getRef(CurrentLogSpans)

  const annotationsObj: Record<string, unknown> = {}
  const spansObj: Record<string, number> = {}

  const entries = Object.entries(annotations)
  if (entries.length > 0) {
    for (let i = 0; i < entries.length; i++) {
      const key = entries[i][0]
      const value = entries[i][1]
      annotationsObj[key] = core.structuredMessage(value)
    }
  }

  const now = date.getTime()
  if (spans.length > 0) {
    for (let i = 0; i < spans.length; i++) {
      const label = spans[i][0]
      const timestamp = spans[i][1]
      spansObj[label] = now - timestamp
    }
  }

  const messageArr = Array.ensure(message)
  return {
    message: messageArr.length === 1
      ? core.structuredMessage(messageArr[0])
      : messageArr.map((_) => core.structuredMessage(_)),
    level: logLevel.toUpperCase(),
    timestamp: date.toISOString(),
    // TODO
    // cause: Cause.isEmpty(cause) ? undefined : Cause.pretty(cause, { renderErrorCause: true }),
    annotations: annotationsObj,
    spans: spansObj,
    fiberId: `#${fiber.id}`
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
  core.flatMap(core.scope, (scope) => {
    let buffer: Array<Output> = []
    const flush = core.suspend(() => {
      if (buffer.length === 0) {
        return core.void
      }
      const arr = buffer
      buffer = []
      return options.flush(arr)
    })

    return core.uninterruptibleMask((restore) =>
      restore(
        core.sleep(options.window).pipe(
          core.andThen(flush),
          core.forever
        )
      ).pipe(
        core.forkDaemon,
        core.flatMap((fiber) => scope.addFinalizer(() => core.fiberInterrupt(fiber))),
        core.andThen(core.addFinalizer(() => flush)),
        core.as(
          core.loggerMake((options) => {
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
) => Logger<unknown, void> = core.consolePretty

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
export const consoleLogFmt: Logger<unknown, void> = core.loggerWithConsoleLog(formatLogFmt)

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
export const consoleStructured: Logger<unknown, void> = core.loggerWithConsoleLog(formatStructured)

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
export const consoleJson: Logger<unknown, void> = core.loggerWithConsoleLog(formatJson)

// export const layerLogFmt = Layer.effectDiscard(
//   core.updateServiceScoped(
//     core.CurrentLoggers,
//     (loggers) => new Set([...loggers, consoleLogFmt])
//   )
// )

const textOnly = /^[^\s"=]+$/

const escapeDoubleQuotes = (str: string) => `"${str.replace(/\\([\s\S])|(")/g, "\\$1$2")}"`

const escapeDoubleQuotesLogfmt = (str: string) => JSON.stringify(str)

const appendQuoted = (label: string, output: string): string =>
  output + (label.match(textOnly) ? label : escapeDoubleQuotes(label))

const appendQuotedLogfmt = (label: string, output: string): string =>
  output + (label.match(textOnly) ? label : escapeDoubleQuotesLogfmt(label))

//
// Layers
//

export const layer = (loggers: Array<Logger<unknown, unknown>>, options?: { mergeWithExisting: boolean }) =>
  Layer.effectContext(core.withFiber<Context.Context<never>>((fiber) => {
    const currentLoggers = options?.mergeWithExisting === true ? fiber.getRef(core.CurrentLoggers) : []
    return core.succeed(Context.merge(
      fiber.context,
      Context.make(core.CurrentLoggers, new Set([...currentLoggers, ...loggers]))
    ))
  }))
