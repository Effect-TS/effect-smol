/**
 * @since 2.0.0
 */
import * as effect from "./internal/effect.js"
import * as Ord from "./Order.js"

/**
 * @since 4.0.0
 * @category models
 */
export type LogLevel = "All" | "Fatal" | "Error" | "Warn" | "Info" | "Debug" | "Trace" | "None"

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

/**
 * @since 2.0.0
 * @category ordering
 */
export const greaterThanOrEqualTo: {
  (that: LogLevel): (self: LogLevel) => boolean
  (self: LogLevel, that: LogLevel): boolean
} = Ord.greaterThanOrEqualTo(Order)

/**
 * @since 2.0.0
 * @category ordering
 */
export const lessThan: {
  (that: LogLevel): (self: LogLevel) => boolean
  (self: LogLevel, that: LogLevel): boolean
} = Ord.lessThan(Order)

/**
 * @since 2.0.0
 * @category ordering
 */
export const lessThanOrEqualTo: {
  (that: LogLevel): (self: LogLevel) => boolean
  (self: LogLevel, that: LogLevel): boolean
} = Ord.lessThanOrEqualTo(Order)
