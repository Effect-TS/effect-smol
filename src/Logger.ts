/**
 * @since 2.0.0
 */
import * as Array from "./Array.js"
import type * as Cause from "./Cause.js"
import type * as Context from "./Context.js"
import * as Inspectable from "./Inspectable.js"
import * as core from "./internal/core.js"
import type * as LogLevel from "./LogLevel.js"
import * as Predicate from "./Predicate.js"
import type { ReadonlyRecord } from "./Record.js"
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
 * @since 4.0.0
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
    readonly fiberId: number
    readonly message: Message
    readonly logLevel: LogLevel.LogLevel
    readonly cause: Cause.Cause<unknown>
    readonly context: Context.Context<never>
    readonly spans: ReadonlyArray<[label: string, timestamp: number]>
    readonly annotations: ReadonlyRecord<string, unknown>
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
 * @since 4.0.0
 * @category constructors
 */
export const make: <Message, Output>(
  log: (options: Logger.Options<Message>) => Output
) => Logger<Message, Output> = core.loggerMake

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
export const stringLogger: Logger<unknown, string> = core.stringLogger

/**
 * @since 2.0.0
 * @category constructors
 */
export const logFmtLogger = core.loggerMake<unknown, string>(
  ({ annotations, date, fiberId, logLevel, message, spans }) => {
    const outputArray = [
      `timestamp=${date.toISOString()}`,
      `level=${logLevel.toUpperCase()}`,
      `fiber=#${fiberId}`
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
export const logFmt: Logger<unknown, void> = core.loggerWithConsoleLog(logFmtLogger)

const textOnly = /^[^\s"=]+$/

const escapeDoubleQuotesLogfmt = (str: string) => JSON.stringify(str)

const appendQuotedLogfmt = (label: string, output: string): string =>
  output + (label.match(textOnly) ? label : escapeDoubleQuotesLogfmt(label))
