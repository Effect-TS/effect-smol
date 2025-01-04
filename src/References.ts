/**
 * @since 4.0.0
 */
import * as Context from "./Context.js"
import { constTrue } from "./Function.js"
import type { LogLevel } from "./LogLevel.js"
import type { ReadonlyRecord } from "./Record.js"
import type { Scheduler } from "./Scheduler.js"
import { MaxOpsBeforeYield, MixedScheduler } from "./Scheduler.js"
import type { SpanLink } from "./Tracer.js"

export {
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
export class CurrentConcurrency extends Context.Reference<CurrentConcurrency>()<
  "effect/References/CurrentConcurrency",
  "unbounded" | number
>("effect/References/CurrentConcurrency", { defaultValue: () => "unbounded" }) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentScheduler extends Context.Reference<CurrentScheduler>()<
  "effect/References/CurrentScheduler",
  Scheduler
>("effect/References/CurrentScheduler", {
  defaultValue: () => new MixedScheduler()
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class TracerEnabled extends Context.Reference<TracerEnabled>()<
  "effect/References/TracerEnabled",
  boolean
>("effect/References/TracerEnabled", {
  defaultValue: constTrue
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class TracerSpanAnnotations extends Context.Reference<TracerSpanAnnotations>()<
  "effect/References/TracerSpanAnnotations",
  ReadonlyRecord<string, unknown>
>("effect/References/TracerSpanAnnotations", {
  defaultValue: () => ({})
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class TracerSpanLinks extends Context.Reference<TracerSpanLinks>()<
  "effect/References/TracerSpanLinks",
  ReadonlyArray<SpanLink>
>("effect/References/TracerSpanLinks", {
  defaultValue: () => []
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentLogAnnotations extends Context.Reference<CurrentLogAnnotations>()<
  "effect/References/CurrentLogAnnotations",
  ReadonlyRecord<string, unknown>
>("effect/References/CurrentLogAnnotations", {
  defaultValue: () => ({})
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentLogLevel extends Context.Reference<CurrentLogLevel>()<
  "effect/References/CurrentLogLevel",
  LogLevel
>("effect/References/CurrentLogLevel", {
  defaultValue: () => "Info"
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentLogSpans extends Context.Reference<CurrentLogSpans>()<
  "effect/References/CurrentLogSpans",
  ReadonlyArray<[label: string, timestamp: number]>
>("effect/References/CurrentLogSpans", {
  defaultValue: () => []
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class MinimumLogLevel extends Context.Reference<MinimumLogLevel>()<
  "effect/References/MinimumLogLevel",
  LogLevel
>("effect/References/MinimumLogLevel", {
  defaultValue: () => "Info"
}) {}
