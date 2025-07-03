/**
 * @since 4.0.0
 */
import { constTrue } from "./Function.js"
import type { LogLevel } from "./LogLevel.js"
import type { ReadonlyRecord } from "./Record.js"
import type { Scheduler } from "./Scheduler.js"
import { MaxOpsBeforeYield, MixedScheduler } from "./Scheduler.js"
import * as ServiceMap from "./ServiceMap.js"
import { CurrentTracer, DisablePropagation, type SpanLink } from "./Tracer.js"

export {
  /**
   * @since 4.0.0
   * @category references
   */
  CurrentTracer,
  /**
   * @since 4.0.0
   * @category references
   */
  DisablePropagation,
  /**
   * @since 4.0.0
   * @category references
   */
  MaxOpsBeforeYield
}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentConcurrency extends ServiceMap.Reference<
  "effect/References/CurrentConcurrency",
  "unbounded" | number
>("effect/References/CurrentConcurrency", { defaultValue: () => "unbounded" }) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentScheduler extends ServiceMap.Reference<
  "effect/References/CurrentScheduler",
  Scheduler
>("effect/References/CurrentScheduler", {
  defaultValue: () => new MixedScheduler()
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class TracerEnabled extends ServiceMap.Reference<
  "effect/References/TracerEnabled",
  boolean
>("effect/References/TracerEnabled", {
  defaultValue: constTrue
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class TracerSpanAnnotations extends ServiceMap.Reference<
  "effect/References/TracerSpanAnnotations",
  ReadonlyRecord<string, unknown>
>("effect/References/TracerSpanAnnotations", {
  defaultValue: () => ({})
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class TracerSpanLinks extends ServiceMap.Reference<
  "effect/References/TracerSpanLinks",
  ReadonlyArray<SpanLink>
>("effect/References/TracerSpanLinks", {
  defaultValue: () => []
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentLogAnnotations extends ServiceMap.Reference<
  "effect/References/CurrentLogAnnotations",
  ReadonlyRecord<string, unknown>
>("effect/References/CurrentLogAnnotations", {
  defaultValue: () => ({})
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentLogLevel extends ServiceMap.Reference<
  "effect/References/CurrentLogLevel",
  LogLevel
>("effect/References/CurrentLogLevel", {
  defaultValue: () => "Info"
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentLogSpans extends ServiceMap.Reference<
  "effect/References/CurrentLogSpans",
  ReadonlyArray<[label: string, timestamp: number]>
>("effect/References/CurrentLogSpans", {
  defaultValue: () => []
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class MinimumLogLevel extends ServiceMap.Reference<
  "effect/References/MinimumLogLevel",
  LogLevel
>("effect/References/MinimumLogLevel", {
  defaultValue: () => "Info"
}) {}
