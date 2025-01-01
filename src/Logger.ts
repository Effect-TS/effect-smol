/**
 * @since 2.0.0
 */
import * as Array from "./Array.js"
import type * as Cause from "./Cause.js"
import type * as Context from "./Context.js"
import { dual } from "./Function.js"
import * as Inspectable from "./Inspectable.js"
import * as InternalContext from "./internal/context.js"
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
export const structuredLogger = core.loggerMake<unknown, {
  readonly logLevel: string
  readonly fiberId: string
  readonly timestamp: string
  readonly message: unknown
  // TODO
  // readonly cause: string | undefined
  readonly annotations: Record<string, unknown>
  readonly spans: Record<string, number>
}>(({ annotations, date, fiberId, logLevel, message, spans }) => {
  const annotationsObj: Record<string, unknown> = {}
  const spansObj: Record<string, number> = {}

  const entries = Object.entries(annotations)
  if (entries.length > 0) {
    for (let i = 0; i < entries.length; i++) {
      const key = entries[i][0]
      const value = entries[i][1]
      annotationsObj[key] = structuredMessage(value)
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
    message: messageArr.length === 1 ? structuredMessage(messageArr[0]) : messageArr.map(structuredMessage),
    logLevel: logLevel.toUpperCase(),
    timestamp: date.toISOString(),
    // TODO
    // cause: Cause.isEmpty(cause) ? undefined : Cause.pretty(cause, { renderErrorCause: true }),
    annotations: annotationsObj,
    spans: spansObj,
    fiberId: `#${fiberId}`
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
export const prettyLogger = (options?: {
  readonly colors?: "auto" | boolean | undefined
  readonly stderr?: boolean | undefined
  readonly formatDate?: ((date: Date) => string) | undefined
  readonly mode?: "browser" | "tty" | "auto" | undefined
}) => {
  const mode_ = options?.mode ?? "auto"
  const mode = mode_ === "auto" ? (hasProcessStdoutOrDeno ? "tty" : "browser") : mode_
  const isBrowser = mode === "browser"
  const showColors = typeof options?.colors === "boolean" ? options.colors : processStdoutIsTTY || isBrowser
  const formatDate = options?.formatDate ?? defaultDateFormat
  return isBrowser
    ? prettyLoggerBrowser({ colors: showColors, formatDate })
    : prettyLoggerTty({ colors: showColors, formatDate, stderr: options?.stderr === true })
}

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

const escapeDoubleQuotesLogfmt = (str: string) => JSON.stringify(str)

const appendQuotedLogfmt = (label: string, output: string): string =>
  output + (label.match(textOnly) ? label : escapeDoubleQuotesLogfmt(label))

const structuredMessage = (u: unknown): unknown => {
  switch (typeof u) {
    case "bigint":
    case "function":
    case "symbol": {
      return String(u)
    }
    default: {
      return Inspectable.toJSON(u)
    }
  }
}

const withColor = (text: string, ...colors: ReadonlyArray<string>) => {
  let out = ""
  for (let i = 0; i < colors.length; i++) {
    out += `\x1b[${colors[i]}m`
  }
  return out + text + "\x1b[0m"
}
const withColorNoop = (text: string, ..._colors: ReadonlyArray<string>) => text
const colors = {
  bold: "1",
  red: "31",
  green: "32",
  yellow: "33",
  blue: "34",
  cyan: "36",
  white: "37",
  gray: "90",
  black: "30",
  bgBrightRed: "101"
} as const

const logLevelColors: Record<LogLevel.LogLevel, ReadonlyArray<string>> = {
  None: [],
  All: [],
  Trace: [colors.gray],
  Debug: [colors.blue],
  Info: [colors.green],
  Warning: [colors.yellow],
  Error: [colors.red],
  Fatal: [colors.bgBrightRed, colors.black]
}
const logLevelStyle: Record<LogLevel.LogLevel, string> = {
  None: "",
  All: "",
  Trace: "color:gray",
  Debug: "color:blue",
  Info: "color:green",
  Warning: "color:orange",
  Error: "color:red",
  Fatal: "background-color:red;color:white"
}

const defaultDateFormat = (date: Date): string =>
  `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${
    date.getSeconds().toString().padStart(2, "0")
  }.${date.getMilliseconds().toString().padStart(3, "0")}`

const hasProcessStdout = typeof process === "object" &&
  process !== null &&
  typeof process.stdout === "object" &&
  process.stdout !== null
const processStdoutIsTTY = hasProcessStdout &&
  process.stdout.isTTY === true
const hasProcessStdoutOrDeno = hasProcessStdout || "Deno" in globalThis

const prettyLoggerTty = (options: {
  readonly colors: boolean
  readonly stderr: boolean
  readonly formatDate: (date: Date) => string
}) => {
  const processIsBun = typeof process === "object" && "isBun" in process && process.isBun === true
  const color = options.colors && processStdoutIsTTY ? withColor : withColorNoop
  return core.loggerMake<unknown, void>(
    ({ annotations, context, date, fiberId, logLevel, message: message_, spans }) => {
      const console = InternalContext.unsafeGetReference(context, core.CurrentConsole).unsafe
      const log = options.stderr === true ? console.error : console.log

      const message = Array.ensure(message_)

      let firstLine = color(`[${options.formatDate(date)}]`, colors.white)
        + ` ${color(logLevel.toUpperCase(), ...logLevelColors[logLevel])}`
        + ` (#${fiberId})`

      if (spans.length > 0) {
        const now = date.getTime()
        for (const span of spans) {
          firstLine += " " + core.renderLogSpanLogfmt(span[0], span[1], now)
        }
      }

      firstLine += ":"
      let messageIndex = 0
      if (message.length > 0) {
        const firstMaybeString = structuredMessage(message[0])
        if (typeof firstMaybeString === "string") {
          firstLine += " " + color(firstMaybeString, colors.bold, colors.cyan)
          messageIndex++
        }
      }

      log(firstLine)
      if (!processIsBun) console.group()

      // TODO
      // if (!Cause.isEmpty(cause)) {
      //   log(Cause.pretty(cause, { renderErrorCause: true }))
      // }

      if (messageIndex < message.length) {
        for (; messageIndex < message.length; messageIndex++) {
          log(Inspectable.redact(message[messageIndex]))
        }
      }

      const entries = Object.entries(annotations)
      if (entries.length > 0) {
        for (let i = 0; i < entries.length; i++) {
          const key = entries[i][0]
          const value = entries[i][1]
          log(color(`${key}:`, colors.bold, colors.white), Inspectable.redact(value))
        }
      }

      if (!processIsBun) console.groupEnd()
    }
  )
}

const prettyLoggerBrowser = (options: {
  readonly colors: boolean
  readonly formatDate: (date: Date) => string
}) => {
  const color = options.colors ? "%c" : ""
  return core.loggerMake<unknown, void>(
    ({ annotations, context, date, fiberId, logLevel, message: message_, spans }) => {
      const console = InternalContext.unsafeGetReference(context, core.CurrentConsole).unsafe
      const message = Array.ensure(message_)

      let firstLine = `${color}[${options.formatDate(date)}]`
      const firstParams = []
      if (options.colors) {
        firstParams.push("color:gray")
      }
      firstLine += ` ${color}${logLevel.toUpperCase()}${color} (#${fiberId})`
      if (options.colors) {
        firstParams.push(logLevelStyle[logLevel], "")
      }
      if (spans.length > 0) {
        const now = date.getTime()
        for (const span of spans) {
          firstLine += " " + core.renderLogSpanLogfmt(span[0], span[1], now)
        }
      }

      firstLine += ":"

      let messageIndex = 0
      if (message.length > 0) {
        const firstMaybeString = structuredMessage(message[0])
        if (typeof firstMaybeString === "string") {
          firstLine += ` ${color}${firstMaybeString}`
          if (options.colors) {
            firstParams.push("color:deepskyblue")
          }
          messageIndex++
        }
      }

      console.groupCollapsed(firstLine, ...firstParams)

      // TODO
      // if (!Cause.isEmpty(cause)) {
      //   console.error(Cause.pretty(cause, { renderErrorCause: true }))
      // }

      if (messageIndex < message.length) {
        for (; messageIndex < message.length; messageIndex++) {
          console.log(Inspectable.redact(message[messageIndex]))
        }
      }

      const entries = Object.entries(annotations)
      if (entries.length > 0) {
        for (let i = 0; i < entries.length; i++) {
          const key = entries[i][0]
          const value = entries[i][1]
          const redacted = Inspectable.redact(value)
          if (options.colors) {
            console.log(`%c${key}:`, "color:gray", redacted)
          } else {
            console.log(`${key}:`, redacted)
          }
        }
      }

      console.groupEnd()
    }
  )
}

/**
 * A default version of the pretty logger.
 *
 * @since 3.8.0
 * @category constructors
 */
export const prettyLoggerDefault: Logger<unknown, void> = prettyLogger()
