/**
 * @since 2.0.0
 */
import * as core from "./internal/core.js"
import type * as Ord from "./Order.js"

/**
 * @since 4.0.0
 * @category models
 */
export type LogLevel = "All" | "Fatal" | "Error" | "Warning" | "Info" | "Debug" | "Trace" | "None"

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
