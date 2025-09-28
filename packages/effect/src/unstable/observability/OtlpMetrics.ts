/**
 * @since 4.0.0
 */
import * as Arr from "../../collections/Array.ts"
import * as Effect from "../../Effect.ts"
import * as Exporter from "../../internal/tracing/otlpExporter.ts"
import * as Layer from "../../Layer.ts"
import * as Metric from "../../Metric.ts"
import type * as Scope from "../../Scope.ts"
import { Clock } from "../../time/Clock.ts"
import * as Duration from "../../time/Duration.ts"
import type * as Headers from "../http/Headers.ts"
import type * as HttpClient from "../http/HttpClient.ts"
import type { Fixed64, KeyValue } from "./OtlpResource.ts"
import * as OtlpResource from "./OtlpResource.ts"

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make: (options: {
  readonly url: string
  readonly resource?: {
    readonly serviceName?: string | undefined
    readonly serviceVersion?: string | undefined
    readonly attributes?: Record<string, unknown>
  } | undefined
  readonly headers?: Headers.Input | undefined
  readonly exportInterval?: Duration.DurationInput | undefined
  readonly shutdownTimeout?: Duration.DurationInput | undefined
}) => Effect.Effect<
  void,
  never,
  HttpClient.HttpClient | Scope.Scope
> = Effect.fnUntraced(function*(options) {
  const clock = yield* Clock
  const startTime = String(clock.currentTimeNanosUnsafe())

  const resource = yield* OtlpResource.fromConfig(options.resource)
  const metricsScope: IInstrumentationScope = {
    name: OtlpResource.serviceNameUnsafe(resource)
  }

  const services = yield* Effect.services<never>()
  const snapshot = (): IExportMetricsServiceRequest => {
    const snapshot = Metric.snapshotUnsafe(services)
    const nowNanos = clock.currentTimeNanosUnsafe()
    const nowTime = String(nowNanos)
    const metricData: Array<IMetric> = []
    const metricDataByName = new Map<string, IMetric>()
    const addMetricData = (data: IMetric) => {
      metricData.push(data)
      metricDataByName.set(data.name, data)
    }

    for (let i = 0, len = snapshot.length; i < len; i++) {
      const state = snapshot[i]
      const unit = state.attributes?.unit ?? state.attributes?.time_unit ?? "1"
      const attributes = state.attributes ? OtlpResource.entriesToAttributes(Object.entries(state.attributes)) : []

      switch (state.type) {
        case "Counter": {
          const dataPoint: INumberDataPoint = {
            attributes,
            startTimeUnixNano: startTime,
            timeUnixNano: nowTime
          }
          if (typeof state.state.count === "bigint") {
            dataPoint.asInt = Number(state.state.count)
          } else {
            dataPoint.asDouble = state.state.count
          }
          if (metricDataByName.has(state.id)) {
            metricDataByName.get(state.id)!.sum!.dataPoints.push(dataPoint)
          } else {
            addMetricData({
              name: state.id,
              description: state.description!,
              unit,
              sum: {
                aggregationTemporality: EAggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
                isMonotonic: state.state.incremental,
                dataPoints: [dataPoint]
              }
            })
          }
          break
        }
        case "Gauge": {
          const dataPoint: INumberDataPoint = {
            attributes,
            startTimeUnixNano: startTime,
            timeUnixNano: nowTime
          }
          if (typeof state.state.value === "bigint") {
            dataPoint.asInt = Number(state.state.value)
          } else {
            dataPoint.asDouble = state.state.value
          }
          if (metricDataByName.has(state.id)) {
            metricDataByName.get(state.id)!.gauge!.dataPoints.push(dataPoint)
          } else {
            addMetricData({
              name: state.id,
              description: state.description!,
              unit,
              gauge: {
                dataPoints: [dataPoint]
              }
            })
          }
          break
        }
        case "Histogram": {
          const size = state.state.buckets.length
          const buckets = {
            boundaries: Arr.allocate(size - 1) as Array<number>,
            counts: Arr.allocate(size) as Array<number>
          }
          let i = 0
          let prev = 0
          for (const [boundary, value] of state.state.buckets) {
            if (i < size - 1) {
              buckets.boundaries[i] = boundary
            }
            buckets.counts[i] = value - prev
            prev = value
            i++
          }
          const dataPoint: IHistogramDataPoint = {
            attributes,
            startTimeUnixNano: startTime,
            timeUnixNano: nowTime,
            count: state.state.count,
            min: state.state.min,
            max: state.state.max,
            sum: state.state.sum,
            bucketCounts: buckets.counts,
            explicitBounds: buckets.boundaries
          }

          if (metricDataByName.has(state.id)) {
            metricDataByName.get(state.id)!.histogram!.dataPoints.push(dataPoint)
          } else {
            addMetricData({
              name: state.id,
              description: state.description!,
              unit,
              histogram: {
                aggregationTemporality: EAggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
                dataPoints: [dataPoint]
              }
            })
          }
          break
        }
        case "Frequency": {
          const dataPoints: Array<INumberDataPoint> = []
          for (const [freqKey, value] of state.state.occurrences) {
            dataPoints.push({
              attributes: [...attributes, { key: "key", value: { stringValue: freqKey } }],
              startTimeUnixNano: startTime,
              timeUnixNano: nowTime,
              asInt: value
            })
          }
          if (metricDataByName.has(state.id)) {
            // eslint-disable-next-line no-restricted-syntax
            metricDataByName.get(state.id)!.sum!.dataPoints.push(...dataPoints)
          } else {
            addMetricData({
              name: state.id,
              description: state.description!,
              unit,
              sum: {
                aggregationTemporality: EAggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
                isMonotonic: true,
                dataPoints
              }
            })
          }
          break
        }
        case "Summary": {
          const dataPoints: Array<INumberDataPoint> = [{
            attributes: [...attributes, { key: "quantile", value: { stringValue: "min" } }],
            startTimeUnixNano: startTime,
            timeUnixNano: nowTime,
            asDouble: state.state.min
          }]
          for (const [quantile, value] of state.state.quantiles) {
            dataPoints.push({
              attributes: [...attributes, { key: "quantile", value: { stringValue: quantile.toString() } }],
              startTimeUnixNano: startTime,
              timeUnixNano: nowTime,
              asDouble: value ?? 0
            })
          }
          dataPoints.push({
            attributes: [...attributes, { key: "quantile", value: { stringValue: "max" } }],
            startTimeUnixNano: startTime,
            timeUnixNano: nowTime,
            asDouble: state.state.max
          })
          const countDataPoint: INumberDataPoint = {
            attributes,
            startTimeUnixNano: startTime,
            timeUnixNano: nowTime,
            asInt: state.state.count
          }
          const sumDataPoint: INumberDataPoint = {
            attributes,
            startTimeUnixNano: startTime,
            timeUnixNano: nowTime,
            asDouble: state.state.sum
          }

          if (metricDataByName.has(`${state.id}_quantiles`)) {
            // eslint-disable-next-line no-restricted-syntax
            metricDataByName.get(`${state.id}_quantiles`)!.sum!.dataPoints.push(...dataPoints)
            metricDataByName.get(`${state.id}_count`)!.sum!.dataPoints.push(countDataPoint)
            metricDataByName.get(`${state.id}_sum`)!.sum!.dataPoints.push(sumDataPoint)
          } else {
            addMetricData({
              name: `${state.id}_quantiles`,
              description: state.description!,
              unit,
              sum: {
                aggregationTemporality: EAggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
                isMonotonic: false,
                dataPoints
              }
            })
            addMetricData({
              name: `${state.id}_count`,
              description: state.description!,
              unit: "1",
              sum: {
                aggregationTemporality: EAggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
                isMonotonic: true,
                dataPoints: [countDataPoint]
              }
            })
            addMetricData({
              name: `${state.id}_sum`,
              description: state.description!,
              unit: "1",
              sum: {
                aggregationTemporality: EAggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
                isMonotonic: true,
                dataPoints: [sumDataPoint]
              }
            })
          }
          break
        }
      }
    }

    return {
      resourceMetrics: [{
        resource,
        scopeMetrics: [{
          scope: metricsScope,
          metrics: metricData
        }]
      }]
    }
  }

  yield* Exporter.make({
    label: "OtlpMetrics",
    url: options.url,
    headers: options.headers,
    maxBatchSize: "disabled",
    exportInterval: options.exportInterval ?? Duration.seconds(10),
    body: snapshot,
    shutdownTimeout: options.shutdownTimeout ?? Duration.seconds(3)
  })
})

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer = (options: {
  readonly url: string
  readonly resource?: {
    readonly serviceName?: string | undefined
    readonly serviceVersion?: string | undefined
    readonly attributes?: Record<string, unknown>
  } | undefined
  readonly headers?: Headers.Input | undefined
  readonly exportInterval?: Duration.DurationInput | undefined
  readonly shutdownTimeout?: Duration.DurationInput | undefined
}): Layer.Layer<never, never, HttpClient.HttpClient> => Layer.effectDiscard(make(options))

// internal

/** Properties of an InstrumentationScope. */
interface IInstrumentationScope {
  /** InstrumentationScope name */
  name: string
  /** InstrumentationScope version */
  version?: string
  /** InstrumentationScope attributes */
  attributes?: Array<KeyValue>
  /** InstrumentationScope droppedAttributesCount */
  droppedAttributesCount?: number
}

/** Properties of an ExportMetricsServiceRequest. */
interface IExportMetricsServiceRequest {
  /** ExportMetricsServiceRequest resourceMetrics */
  resourceMetrics: Array<IResourceMetrics>
}
/** Properties of a ResourceMetrics. */
interface IResourceMetrics {
  /** ResourceMetrics resource */
  resource?: OtlpResource.Resource
  /** ResourceMetrics scopeMetrics */
  scopeMetrics: Array<IScopeMetrics>
  /** ResourceMetrics schemaUrl */
  schemaUrl?: string
}
/** Properties of an IScopeMetrics. */
interface IScopeMetrics {
  /** ScopeMetrics scope */
  scope?: IInstrumentationScope
  /** ScopeMetrics metrics */
  metrics: Array<IMetric>
  /** ScopeMetrics schemaUrl */
  schemaUrl?: string
}
/** Properties of a Metric. */
interface IMetric {
  /** Metric name */
  name: string
  /** Metric description */
  description?: string
  /** Metric unit */
  unit?: string
  /** Metric gauge */
  gauge?: IGauge
  /** Metric sum */
  sum?: ISum
  /** Metric histogram */
  histogram?: IHistogram
  /** Metric exponentialHistogram */
  exponentialHistogram?: IExponentialHistogram
  /** Metric summary */
  summary?: ISummary
}
/** Properties of a Gauge. */
interface IGauge {
  /** Gauge dataPoints */
  dataPoints: Array<INumberDataPoint>
}
/** Properties of a Sum. */
interface ISum {
  /** Sum dataPoints */
  dataPoints: Array<INumberDataPoint>
  /** Sum aggregationTemporality */
  aggregationTemporality: EAggregationTemporality
  /** Sum isMonotonic */
  isMonotonic: boolean
}
/** Properties of a Histogram. */
interface IHistogram {
  /** Histogram dataPoints */
  dataPoints: Array<IHistogramDataPoint>
  /** Histogram aggregationTemporality */
  aggregationTemporality?: EAggregationTemporality
}
/** Properties of an ExponentialHistogram. */
interface IExponentialHistogram {
  /** ExponentialHistogram dataPoints */
  dataPoints: Array<IExponentialHistogramDataPoint>
  /** ExponentialHistogram aggregationTemporality */
  aggregationTemporality?: EAggregationTemporality
}
/** Properties of a Summary. */
interface ISummary {
  /** Summary dataPoints */
  dataPoints: Array<ISummaryDataPoint>
}
/** Properties of a NumberDataPoint. */
interface INumberDataPoint {
  /** NumberDataPoint attributes */
  attributes: Array<KeyValue>
  /** NumberDataPoint startTimeUnixNano */
  startTimeUnixNano?: Fixed64
  /** NumberDataPoint timeUnixNano */
  timeUnixNano?: Fixed64
  /** NumberDataPoint asDouble */
  asDouble?: number | null
  /** NumberDataPoint asInt */
  asInt?: number
  /** NumberDataPoint exemplars */
  exemplars?: Array<IExemplar>
  /** NumberDataPoint flags */
  flags?: number
}
/** Properties of a HistogramDataPoint. */
interface IHistogramDataPoint {
  /** HistogramDataPoint attributes */
  attributes?: Array<KeyValue>
  /** HistogramDataPoint startTimeUnixNano */
  startTimeUnixNano?: Fixed64
  /** HistogramDataPoint timeUnixNano */
  timeUnixNano?: Fixed64
  /** HistogramDataPoint count */
  count?: number
  /** HistogramDataPoint sum */
  sum?: number
  /** HistogramDataPoint bucketCounts */
  bucketCounts?: Array<number>
  /** HistogramDataPoint explicitBounds */
  explicitBounds?: Array<number>
  /** HistogramDataPoint exemplars */
  exemplars?: Array<IExemplar>
  /** HistogramDataPoint flags */
  flags?: number
  /** HistogramDataPoint min */
  min?: number
  /** HistogramDataPoint max */
  max?: number
}
/** Properties of an ExponentialHistogramDataPoint. */
interface IExponentialHistogramDataPoint {
  /** ExponentialHistogramDataPoint attributes */
  attributes?: Array<KeyValue>
  /** ExponentialHistogramDataPoint startTimeUnixNano */
  startTimeUnixNano?: Fixed64
  /** ExponentialHistogramDataPoint timeUnixNano */
  timeUnixNano?: Fixed64
  /** ExponentialHistogramDataPoint count */
  count?: number
  /** ExponentialHistogramDataPoint sum */
  sum?: number
  /** ExponentialHistogramDataPoint scale */
  scale?: number
  /** ExponentialHistogramDataPoint zeroCount */
  zeroCount?: number
  /** ExponentialHistogramDataPoint positive */
  positive?: IBuckets
  /** ExponentialHistogramDataPoint negative */
  negative?: IBuckets
  /** ExponentialHistogramDataPoint flags */
  flags?: number
  /** ExponentialHistogramDataPoint exemplars */
  exemplars?: Array<IExemplar>
  /** ExponentialHistogramDataPoint min */
  min?: number
  /** ExponentialHistogramDataPoint max */
  max?: number
}
/** Properties of a SummaryDataPoint. */
interface ISummaryDataPoint {
  /** SummaryDataPoint attributes */
  attributes?: Array<KeyValue>
  /** SummaryDataPoint startTimeUnixNano */
  startTimeUnixNano?: number
  /** SummaryDataPoint timeUnixNano */
  timeUnixNano?: string
  /** SummaryDataPoint count */
  count?: number
  /** SummaryDataPoint sum */
  sum?: number
  /** SummaryDataPoint quantileValues */
  quantileValues?: Array<IValueAtQuantile>
  /** SummaryDataPoint flags */
  flags?: number
}
/** Properties of a ValueAtQuantile. */
interface IValueAtQuantile {
  /** ValueAtQuantile quantile */
  quantile?: number
  /** ValueAtQuantile value */
  value?: number
}
/** Properties of a Buckets. */
interface IBuckets {
  /** Buckets offset */
  offset?: number
  /** Buckets bucketCounts */
  bucketCounts?: Array<number>
}
/** Properties of an Exemplar. */
interface IExemplar {
  /** Exemplar filteredAttributes */
  filteredAttributes?: Array<KeyValue>
  /** Exemplar timeUnixNano */
  timeUnixNano?: string
  /** Exemplar asDouble */
  asDouble?: number
  /** Exemplar asInt */
  asInt?: number
  /** Exemplar spanId */
  spanId?: string | Uint8Array
  /** Exemplar traceId */
  traceId?: string | Uint8Array
}
/**
 * AggregationTemporality defines how a metric aggregator reports aggregated
 * values. It describes how those values relate to the time interval over
 * which they are aggregated.
 */
const EAggregationTemporality = {
  AGGREGATION_TEMPORALITY_UNSPECIFIED: 0,
  /** DELTA is an AggregationTemporality for a metric aggregator which reports
    changes since last report time. Successive metrics contain aggregation of
    values from continuous and non-overlapping intervals.

    The values for a DELTA metric are based only on the time interval
    associated with one measurement cycle. There is no dependency on
    previous measurements like is the case for CUMULATIVE metrics.

    For example, consider a system measuring the number of requests that
    it receives and reports the sum of these requests every second as a
    DELTA metric:

    1. The system starts receiving at time=t_0.
    2. A request is received, the system measures 1 request.
    3. A request is received, the system measures 1 request.
    4. A request is received, the system measures 1 request.
    5. The 1 second collection cycle ends. A metric is exported for the
        number of requests received over the interval of time t_0 to
        t_0+1 with a value of 3.
    6. A request is received, the system measures 1 request.
    7. A request is received, the system measures 1 request.
    8. The 1 second collection cycle ends. A metric is exported for the
        number of requests received over the interval of time t_0+1 to
        t_0+2 with a value of 2. */
  AGGREGATION_TEMPORALITY_DELTA: 1,
  /** CUMULATIVE is an AggregationTemporality for a metric aggregator which
    reports changes since a fixed start time. This means that current values
    of a CUMULATIVE metric depend on all previous measurements since the
    start time. Because of this, the sender is required to retain this state
    in some form. If this state is lost or invalidated, the CUMULATIVE metric
    values MUST be reset and a new fixed start time following the last
    reported measurement time sent MUST be used.

    For example, consider a system measuring the number of requests that
    it receives and reports the sum of these requests every second as a
    CUMULATIVE metric:

    1. The system starts receiving at time=t_0.
    2. A request is received, the system measures 1 request.
    3. A request is received, the system measures 1 request.
    4. A request is received, the system measures 1 request.
    5. The 1 second collection cycle ends. A metric is exported for the
        number of requests received over the interval of time t_0 to
        t_0+1 with a value of 3.
    6. A request is received, the system measures 1 request.
    7. A request is received, the system measures 1 request.
    8. The 1 second collection cycle ends. A metric is exported for the
        number of requests received over the interval of time t_0 to
        t_0+2 with a value of 5.
    9. The system experiences a fault and loses state.
    10. The system recovers and resumes receiving at time=t_1.
    11. A request is received, the system measures 1 request.
    12. The 1 second collection cycle ends. A metric is exported for the
        number of requests received over the interval of time t_1 to
        t_0+1 with a value of 1.

    Note: Even though, when reporting changes since last report time, using
    CUMULATIVE is valid, it is not recommended. This may cause problems for
    systems that do not use start_time to determine when the aggregation
    value was reset (e.g. Prometheus). */
  AGGREGATION_TEMPORALITY_CUMULATIVE: 2
} as const

type EAggregationTemporality = typeof EAggregationTemporality[keyof typeof EAggregationTemporality]
