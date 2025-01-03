/**
 * @since 2.0.0
 */
import * as Array from "./Array.js"
import type * as Cause from "./Cause.js"
import type * as Context from "./Context.js"
import type * as Duration from "./Duration.js"
import type * as Effect from "./Effect.js"
import type * as Fiber from "./Fiber.js"
import { dual } from "./Function.js"
import * as Inspectable from "./Inspectable.js"
import * as core from "./internal/core.js"
import type * as LogLevel from "./LogLevel.js"
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
export interface Logger<in Message, out Output> {
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
 * @since 2.0.0
 * @category utils
 */
export const withConsoleLog: <Message, Output>(self: Logger<Message, Output>) => Logger<Message, void> =
  core.loggerWithConsoleLog

/**
 * @since 2.0.0
 * @category utils
 */
export const withConsoleError: <Message, Output>(self: Logger<Message, Output>) => Logger<Message, void> =
  core.loggerWithConsoleError

/**
 * @since 2.0.0
 * @category utils
 */
export const withLeveledConsole: <Message, Output>(self: Logger<Message, Output>) => Logger<Message, void> =
  core.loggerWithLeveledConsole

/**
 * @since 2.0.0
 * @category constructors
 */
export const defaultLogger: Logger<unknown, void> = core.defaultLogger

/**
 * @since 2.0.0
 * @category constructors
 */
export const stringLogger = core.loggerMake<unknown, string>(
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
 * @since 2.0.0
 * @category constructors
 */
export const logFmtLogger = core.loggerMake<unknown, string>(
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
 * @since 2.0.0
 * @category constructors
 */
export const structuredLogger = core.loggerMake<unknown, {
  readonly level: string
  readonly fiberId: string
  readonly timestamp: string
  readonly message: unknown
  // TODO
  // readonly cause: string | undefined
  readonly annotations: Record<string, unknown>
  readonly spans: Record<string, number>
}>(({ date, fiber, logLevel, message }) => {
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
 * @since 2.0.0
 * @category constructors
 */
export const jsonLogger = map(structuredLogger, Inspectable.stringifyCircular)

/**
 * @since 2.0.0
 * @category constructors
 */
export const batchedLogger = dual<
  <Output>(
    window: Duration.DurationInput,
    f: (messages: Array<NoInfer<Output>>) => Effect.Effect<void>
  ) => <Message>(
    self: Logger<Message, Output>
  ) => Effect.Effect<Logger<Message, void>, never, Scope.Scope>,
  <Message, Output>(
    self: Logger<Message, Output>,
    window: Duration.DurationInput,
    f: (messages: Array<NoInfer<Output>>) => Effect.Effect<void>
  ) => Effect.Effect<Logger<Message, void>, never, Scope.Scope>
>(3, <Message, Output>(
  self: Logger<Message, Output>,
  window: Duration.DurationInput,
  f: (messages: Array<NoInfer<Output>>) => Effect.Effect<void>
): Effect.Effect<Logger<Message, void>, never, Scope.Scope> =>
  core.flatMap(core.scope, (scope) => {
    let buffer: Array<Output> = []
    const flush = core.suspend(() => {
      if (buffer.length === 0) {
        return core.void
      }
      const arr = buffer
      buffer = []
      return f(arr)
    })

    return core.uninterruptibleMask((restore) =>
      restore(
        core.sleep(window).pipe(
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
 * @since 2.0.0
 * @category constructors
 */
export const prettyLogger: (
  options?: {
    readonly colors?: "auto" | boolean | undefined
    readonly stderr?: boolean | undefined
    readonly formatDate?: ((date: Date) => string) | undefined
    readonly mode?: "browser" | "tty" | "auto" | undefined
  }
) => Logger<unknown, void> = core.prettyLogger

/**
 * @since 2.0.0
 * @category constructors
 */
export const logFmt: Logger<unknown, void> = core.loggerWithConsoleLog(logFmtLogger)

/**
 * @since 2.0.0
 * @category constructors
 */
export const structured: Logger<unknown, void> = core.loggerWithConsoleLog(structuredLogger)

/**
 * @since 2.0.0
 * @category constructors
 */
export const json: Logger<unknown, void> = core.loggerWithConsoleLog(jsonLogger)

const textOnly = /^[^\s"=]+$/

const escapeDoubleQuotes = (str: string) => `"${str.replace(/\\([\s\S])|(")/g, "\\$1$2")}"`

const escapeDoubleQuotesLogfmt = (str: string) => JSON.stringify(str)

const appendQuoted = (label: string, output: string): string =>
  output + (label.match(textOnly) ? label : escapeDoubleQuotes(label))

const appendQuotedLogfmt = (label: string, output: string): string =>
  output + (label.match(textOnly) ? label : escapeDoubleQuotesLogfmt(label))
