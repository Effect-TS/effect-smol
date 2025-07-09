/**
 * @since 4.0.0
 */
import type * as Duration from "../../Duration.js"
import * as Layer from "../../Layer.js"
import type * as Tracer from "../../Tracer.js"
import type * as Headers from "../http/Headers.js"
import type * as HttpClient from "../http/HttpClient.js"
import * as OtlpLogger from "./OtlpLogger.js"
import * as OtlpMetrics from "./OtlpMetrics.js"
import * as OtlpTracer from "./OtlpTracer.js"

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
      url: `${options.baseUrl}/v1/logs`,
      resource: options.resource,
      headers: options.headers,
      exportInterval: options.loggerExportInterval,
      maxBatchSize: options.maxBatchSize,
      shutdownTimeout: options.shutdownTimeout,
      excludeLogSpans: options.loggerExcludeLogSpans
    }),
    OtlpMetrics.layer({
      url: `${options.baseUrl}/v1/metrics`,
      resource: options.resource,
      headers: options.headers,
      exportInterval: options.metricsExportInterval,
      shutdownTimeout: options.shutdownTimeout
    }),
    OtlpTracer.layer({
      url: `${options.baseUrl}/v1/traces`,
      resource: options.resource,
      headers: options.headers,
      exportInterval: options.tracerExportInterval,
      maxBatchSize: options.maxBatchSize,
      context: options.tracerContext,
      shutdownTimeout: options.shutdownTimeout
    })
  )
