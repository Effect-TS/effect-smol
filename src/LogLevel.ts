/**
 * @since 2.0.0
 */
import * as effect from "./internal/effect.ts"
import type * as Ord from "./Order.ts"

/**
 * @since 4.0.0
 * @category models
 */
export type LogLevel = "All" | "Fatal" | "Error" | "Warning" | "Info" | "Debug" | "Trace" | "None"

/**
 * @since 2.0.0
 * @category ordering
 */
export const Order: Ord.Order<LogLevel> = effect.LogLevelOrder

/**
 * @since 2.0.0
 * @category ordering
 */
export const greaterThan: {
  (that: LogLevel): (self: LogLevel) => boolean
  (self: LogLevel, that: LogLevel): boolean
} = effect.logLevelGreaterThan
