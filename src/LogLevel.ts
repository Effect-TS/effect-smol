/**
 * @since 2.0.0
 */
import type * as Context from "./Context.js"
import * as core from "./internal/core.js"
import type * as Ord from "./Order.js"

/**
 * @since 4.0.0
 * @category models
 */
export type LogLevel = "All" | "Fatal" | "Error" | "Warning" | "Info" | "Debug" | "Trace" | "None"

/**
 * @since 4.0.0
 * @category references
 */
export interface CurrentLogLevel {
  readonly _: unique symbol
}

/**
 * @since 4.0.0
 * @category references
 */
export interface CurrentMinimumLogLevel {
  readonly _: unique symbol
}

/**
 * @since 4.0.0
 * @category references
 */
export const CurrentLogLevel: Context.Reference<
  CurrentLogLevel,
  LogLevel
> = core.CurrentLogLevel

/**
 * @since 4.0.0
 * @category references
 */
export const CurrentMinimumLogLevel: Context.Reference<
  CurrentMinimumLogLevel,
  LogLevel
> = core.CurrentMinimumLogLevel

/**
 * @since 2.0.0
 * @category ordering
 */
export const Order: Ord.Order<LogLevel> = core.LogLevelOrder

/**
 * @since 2.0.0
 * @category ordering
 */
export const greaterThan: {
  (that: LogLevel): (self: LogLevel) => boolean
  (self: LogLevel, that: LogLevel): boolean
} = core.logLevelGreaterThan
