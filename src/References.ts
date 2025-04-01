/**
 * @since 4.0.0
 */
import * as Context from "./Context.ts"
import { constTrue } from "./Function.ts"
import type { LogLevel } from "./LogLevel.ts"
import type { ReadonlyRecord } from "./Record.ts"
import type { Scheduler } from "./Scheduler.ts"
import { MaxOpsBeforeYield, MixedScheduler } from "./Scheduler.ts"
import { CurrentTracer, DisablePropagation, type SpanLink } from "./Tracer.ts"

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
export class CurrentConcurrency extends Context.Reference<
  "effect/References/CurrentConcurrency",
  "unbounded" | number
>("effect/References/CurrentConcurrency", { defaultValue: () => "unbounded" }) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentScheduler extends Context.Reference<
  "effect/References/CurrentScheduler",
  Scheduler
>("effect/References/CurrentScheduler", {
  defaultValue: () => new MixedScheduler()
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class TracerEnabled extends Context.Reference<
  "effect/References/TracerEnabled",
  boolean
>("effect/References/TracerEnabled", {
  defaultValue: constTrue
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class TracerSpanAnnotations extends Context.Reference<
  "effect/References/TracerSpanAnnotations",
  ReadonlyRecord<string, unknown>
>("effect/References/TracerSpanAnnotations", {
  defaultValue: () => ({})
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class TracerSpanLinks extends Context.Reference<
  "effect/References/TracerSpanLinks",
  ReadonlyArray<SpanLink>
>("effect/References/TracerSpanLinks", {
  defaultValue: () => []
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentLogAnnotations extends Context.Reference<
  "effect/References/CurrentLogAnnotations",
  ReadonlyRecord<string, unknown>
>("effect/References/CurrentLogAnnotations", {
  defaultValue: () => ({})
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentLogLevel extends Context.Reference<
  "effect/References/CurrentLogLevel",
  LogLevel
>("effect/References/CurrentLogLevel", {
  defaultValue: () => "Info"
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentLogSpans extends Context.Reference<
  "effect/References/CurrentLogSpans",
  ReadonlyArray<[label: string, timestamp: number]>
>("effect/References/CurrentLogSpans", {
  defaultValue: () => []
}) {}

/**
 * @since 4.0.0
 * @category references
 */
export class MinimumLogLevel extends Context.Reference<
  "effect/References/MinimumLogLevel",
  LogLevel
>("effect/References/MinimumLogLevel", {
  defaultValue: () => "Info"
}) {}
