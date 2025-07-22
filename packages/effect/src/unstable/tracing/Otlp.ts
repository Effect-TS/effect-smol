/**
 * @since 4.0.0
 */
import type * as Tracer from "../../observability/Tracer.ts"
import * as Layer from "../../services/Layer.ts"
import type * as Duration from "../../time/Duration.ts"
import type * as Headers from "../http/Headers.ts"
import type * as HttpClient from "../http/HttpClient.ts"
import * as OtlpLogger from "./OtlpLogger.ts"
import * as OtlpMetrics from "./OtlpMetrics.ts"
import * as OtlpTracer from "./OtlpTracer.ts"

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer = (options: {
  readonly baseUrl: string
  readonly resource?: {
    readonly serviceName?: string | undefined
    readonly serviceVersion?: string | undefined
    readonly attributes?: Record<string, unknown>
  } | undefined
  readonly headers?: Headers.Input | undefined
  readonly maxBatchSize?: number | undefined
  readonly tracerContext?: (<X>(f: () => X, span: Tracer.AnySpan) => X) | undefined
  readonly loggerExportInterval?: Duration.DurationInput | undefined
  readonly loggerExcludeLogSpans?: boolean | undefined
  readonly metricsExportInterval?: Duration.DurationInput | undefined
  readonly tracerExportInterval?: Duration.DurationInput | undefined
  readonly shutdownTimeout?: Duration.DurationInput | undefined
}): Layer.Layer<never, never, HttpClient.HttpClient> =>
  Layer.mergeAll(
    OtlpLogger.layer({
      url: new URL("/v1/logs", options.baseUrl).toString(),
      resource: options.resource,
      headers: options.headers,
      exportInterval: options.loggerExportInterval,
      maxBatchSize: options.maxBatchSize,
      shutdownTimeout: options.shutdownTimeout,
      excludeLogSpans: options.loggerExcludeLogSpans
    }),
    OtlpMetrics.layer({
      url: new URL("/v1/metrics", options.baseUrl).toString(),
      resource: options.resource,
      headers: options.headers,
      exportInterval: options.metricsExportInterval,
      shutdownTimeout: options.shutdownTimeout
    }),
    OtlpTracer.layer({
      url: new URL("/v1/traces", options.baseUrl).toString(),
      resource: options.resource,
      headers: options.headers,
      exportInterval: options.tracerExportInterval,
      maxBatchSize: options.maxBatchSize,
      context: options.tracerContext,
      shutdownTimeout: options.shutdownTimeout
    })
  )
