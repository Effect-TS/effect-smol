/**
 * @since 4.0.0
 */
import type * as Cause from "./Cause.ts"
import * as Effect from "./Effect.ts"
import type * as Fiber from "./Fiber.ts"
import * as effect from "./internal/effect.ts"
import * as Layer from "./Layer.ts"
import * as LogLevel from "./LogLevel.ts"
import type { Severity } from "./LogLevel.ts"
import type * as Scope from "./Scope.ts"
import type * as ServiceMap from "./ServiceMap.ts"

/**
 * @since 4.0.0
 * @category Type Identifiers
 */
export type TypeId = "~effect/ErrorReporter"

/**
 * @since 4.0.0
 * @category Type Identifiers
 */
export const TypeId: TypeId = "~effect/ErrorReporter"

/**
 * @since 4.0.0
 * @category Models
 */
export interface ErrorReporter {
  readonly [TypeId]: TypeId
  report(options: {
    readonly cause: Cause.Cause<unknown>
    readonly fiber: Fiber.Fiber<unknown, unknown>
    readonly timestamp: bigint
  }): void
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = (
  report: (options: {
    readonly cause: Cause.Cause<unknown>
    readonly error: Error
    readonly severity: Severity
    readonly fiber: Fiber.Fiber<unknown, unknown>
    readonly timestamp: bigint
  }) => void
): ErrorReporter => {
  const reported = new WeakSet<Cause.Cause<unknown>>()
  return {
    [TypeId]: TypeId,
    report(options) {
      if (reported.has(options.cause)) return
      reported.add(options.cause)
      for (let i = 0; i < options.cause.reasons.length; i++) {
        const reason = options.cause.reasons[i]
        if (reason._tag === "Interrupt") continue
        const original = reason._tag === "Fail" ? reason.error : reason.defect
        if (isIgnored(original)) continue
        const severity = getSeverity(original)
        const pretty = effect.causePrettyError(original as any, reason.annotations)
        report({
          ...options,
          error: pretty,
          severity
        })
      }
    }
  }
}

/**
 * @since 4.0.0
 * @category References
 */
export const CurrentErrorReporters: ServiceMap.Reference<ReadonlySet<ErrorReporter>> = effect.CurrentErrorReporters

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer = <
  const Reporters extends ReadonlyArray<ErrorReporter | Effect.Effect<ErrorReporter, any, any>>
>(
  reporters: Reporters,
  options?: { readonly mergeWithExisting?: boolean | undefined } | undefined
): Layer.Layer<
  never,
  Reporters extends readonly [] ? never : Effect.Error<Reporters[number]>,
  Exclude<
    Reporters extends readonly [] ? never : Effect.Services<Reporters[number]>,
    Scope.Scope
  >
> =>
  Layer.effect(
    CurrentErrorReporters,
    Effect.withFiber(Effect.fnUntraced(function*(fiber) {
      const currentReporters = new Set(
        options?.mergeWithExisting === true ? fiber.getRef(effect.CurrentErrorReporters) : []
      )
      for (const reporter of reporters) {
        currentReporters.add(Effect.isEffect(reporter) ? yield* reporter : reporter)
      }
      return currentReporters
    }))
  )

/**
 * @since 4.0.0
 * @category Reporting
 */
export const report = <E>(cause: Cause.Cause<E>): Effect.Effect<void> =>
  Effect.withFiber((fiber) => {
    effect.reportCauseUnsafe(fiber, cause)
    return Effect.void
  })

/**
 * @since 4.0.0
 * @category Annotations
 */
export interface Reportable {
  readonly [ignore]?: true
  readonly [severity]?: Severity
}

declare global {
  interface Error extends Reportable {}
}

/**
 * @since 4.0.0
 * @category Annotations
 */
export type ignore = "~effect/ErrorReporter/ignore"

/**
 * You can mark any error as unreportable by adding the `ignore` property to it.
 * This is useful for errors that are expected to happen and don't need to be
 * reported, such as a 404 Not Found error in an HTTP server.
 *
 * ```ts
 * import { Data, ErrorReporter } from "effect"
 *
 * class NotFoundError extends Data.TaggedError("NotFoundError") {
 *   readonly [ErrorReporter.ignore] = true
 * }
 * ```
 *
 * @since 4.0.0
 * @category Annotations
 */
export const ignore: ignore = "~effect/ErrorReporter/ignore"

/**
 * @since 4.0.0
 * @category Annotations
 */
export const isIgnored = (u: unknown): boolean => typeof u === "object" && u !== null && ignore in u

/**
 * @since 4.0.0
 * @category Annotations
 */
export type severity = "~effect/ErrorReporter/severity"

/**
 * You can specify the severity of an error by adding the `severity` property to
 * it.
 *
 * ```ts
 * import { Data, ErrorReporter } from "effect"
 *
 * class NotFoundError extends Data.TaggedError("NotFoundError") {
 *   readonly [ErrorReporter.severity] = "Warn"
 * }
 * ```
 *
 * @since 4.0.0
 * @category Annotations
 */
export const severity: severity = "~effect/ErrorReporter/severity"

/**
 * @since 4.0.0
 * @category Annotations
 */
export const getSeverity = (error: unknown): Severity => {
  if (
    typeof error === "object" && error !== null && severity in error &&
    LogLevel.values.includes(error[severity] as Severity)
  ) {
    return error[severity] as Severity
  }
  return "Error"
}
