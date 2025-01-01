/**
 * @since 2.0.0
 */
import type * as Cause from "./Cause.js"
import type * as Context from "./Context.js"
import type * as Effect from "./Effect.js"
import * as core from "./internal/core.js"
import type * as LogLevel from "./LogLevel.js"
import * as Predicate from "./Predicate.js"
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
  log: (options: Logger.Options<Message>) => Effect.Effect<Output>
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
    // readonly context: Context.Context<never>
    // readonly spans: List.List<LogSpan.LogSpan>
    // readonly annotations: HashMap.HashMap<string, unknown>
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
  log: (options: Logger.Options<Message>) => Effect.Effect<Output>
) => Logger<Message, Output> = core.loggerMake

/**
 * @since 2.0.0
 * @category constructors
 */
export const stringLogger: Logger<unknown, string> = core.stringLogger

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
