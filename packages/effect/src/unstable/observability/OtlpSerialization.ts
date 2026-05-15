/**
 * @since 4.0.0
 */
import * as Context from "../../Context.ts"
import * as Layer from "../../Layer.ts"
import * as HttpBody from "../http/HttpBody.ts"
import * as otlpProtobuf from "./internal/otlpProtobuf.ts"
import type { LogsData } from "./OtlpLogger.ts"
import type { MetricsData } from "./OtlpMetrics.ts"
import type { TraceData } from "./OtlpTracer.ts"

/**
 * @category Services
 * @since 4.0.0
 */
export class OtlpSerialization extends Context.Service<OtlpSerialization, {
  readonly traces: (data: TraceData) => HttpBody.HttpBody
  readonly metrics: (data: MetricsData) => HttpBody.HttpBody
  readonly logs: (data: LogsData) => HttpBody.HttpBody
}>()("effect/observability/OtlpSerialization") {}

/**
 * @category Layers
 * @since 4.0.0
 */
export const layerJson = Layer.succeed(OtlpSerialization, {
  traces: (spans) => HttpBody.jsonUnsafe(spans),
  metrics: (metrics) => HttpBody.jsonUnsafe(metrics),
  logs: (logs) => HttpBody.jsonUnsafe(logs)
})

/**
 * @category Layers
 * @since 4.0.0
 */
export const layerProtobuf = Layer.succeed(OtlpSerialization, {
  traces: (spans) =>
    HttpBody.uint8Array(
      otlpProtobuf.encodeTracesData(spans as any),
      "application/x-protobuf"
    ),
  metrics: (metrics) =>
    HttpBody.uint8Array(
      otlpProtobuf.encodeMetricsData(metrics as any),
      "application/x-protobuf"
    ),
  logs: (logs) =>
    HttpBody.uint8Array(
      otlpProtobuf.encodeLogsData(logs as any),
      "application/x-protobuf"
    )
})
