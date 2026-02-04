/**
 * @since 4.0.0
 */
import type * as Option from "../../Option.ts"
import * as Schema from "../../Schema.ts"
import * as Transformation from "../../SchemaTransformation.ts"

// Encode +Infinity histogram bounds as null (v3 wire compatibility).
const numberOrInfinity = Schema.Union([Schema.Number, Schema.Null]).pipe(
  Schema.decodeTo(
    Schema.Number,
    Transformation.transform({
      decode: (value) => value === null ? Number.POSITIVE_INFINITY : value,
      encode: (value) => Number.isFinite(value) ? value : null
    })
  )
)

/**
 * @since 4.0.0
 * @category schemas
 */
export const SpanStatusStarted = Schema.Struct({
  _tag: Schema.Literal("Started"),
  startTime: Schema.BigInt
})

/**
 * @since 4.0.0
 * @category schemas
 */
export type SpanStatusStarted = Schema.Schema.Type<typeof SpanStatusStarted>

/**
 * @since 4.0.0
 * @category schemas
 */
export type SpanStatusStartedEncoded = Schema.Codec.Encoded<typeof SpanStatusStarted>

/**
 * @since 4.0.0
 * @category schemas
 */
export const SpanStatusEnded = Schema.Struct({
  _tag: Schema.Literal("Ended"),
  startTime: Schema.BigInt,
  endTime: Schema.BigInt
})

/**
 * @since 4.0.0
 * @category schemas
 */
export type SpanStatusEnded = Schema.Schema.Type<typeof SpanStatusEnded>

/**
 * @since 4.0.0
 * @category schemas
 */
export type SpanStatusEndedEncoded = Schema.Codec.Encoded<typeof SpanStatusEnded>

/**
 * @since 4.0.0
 * @category schemas
 */
export const SpanStatus = Schema.Union([SpanStatusStarted, SpanStatusEnded])

/**
 * @since 4.0.0
 * @category schemas
 */
export type SpanStatus = Schema.Schema.Type<typeof SpanStatus>

/**
 * @since 4.0.0
 * @category schemas
 */
export type SpanStatusEncoded = Schema.Codec.Encoded<typeof SpanStatus>

/**
 * @since 4.0.0
 * @category schemas
 */
export const ExternalSpan = Schema.Struct({
  _tag: Schema.Literal("ExternalSpan"),
  spanId: Schema.String,
  traceId: Schema.String,
  sampled: Schema.Boolean
})

/**
 * @since 4.0.0
 * @category schemas
 */
export type ExternalSpan = Schema.Schema.Type<typeof ExternalSpan>

/**
 * @since 4.0.0
 * @category schemas
 */
export type ExternalSpanEncoded = Schema.Codec.Encoded<typeof ExternalSpan>

type SpanStatusType = Schema.Schema.Type<typeof SpanStatus>
type ExternalSpanType = Schema.Schema.Type<typeof ExternalSpan>

interface SpanType {
  readonly _tag: "Span"
  readonly spanId: string
  readonly traceId: string
  readonly name: string
  readonly sampled: boolean
  readonly attributes: ReadonlyMap<string, unknown>
  readonly status: SpanStatusType
  readonly parent: Option.Option<ParentSpanType>
}

type ParentSpanType = SpanType | ExternalSpanType

/**
 * @since 4.0.0
 * @category schemas
 */
export const Span: Schema.Codec<SpanType> = Schema.Struct({
  _tag: Schema.Literal("Span"),
  spanId: Schema.String,
  traceId: Schema.String,
  name: Schema.String,
  sampled: Schema.Boolean,
  attributes: Schema.ReadonlyMap(Schema.String, Schema.Unknown),
  status: SpanStatus,
  parent: Schema.Option(
    Schema.suspend(() => ParentSpan).annotate({ title: "ParentSpan" })
  )
})

/**
 * @since 4.0.0
 * @category schemas
 */
export type Span = Schema.Schema.Type<typeof Span>

/**
 * @since 4.0.0
 * @category schemas
 */
export type SpanEncoded = Schema.Codec.Encoded<typeof Span>

/**
 * @since 4.0.0
 * @category schemas
 */
export const SpanEvent = Schema.Struct({
  _tag: Schema.Literal("SpanEvent"),
  traceId: Schema.String,
  spanId: Schema.String,
  name: Schema.String,
  startTime: Schema.BigInt,
  attributes: Schema.Record(Schema.String, Schema.Unknown)
})

/**
 * @since 4.0.0
 * @category schemas
 */
export type SpanEvent = Schema.Schema.Type<typeof SpanEvent>

/**
 * @since 4.0.0
 * @category schemas
 */
export type SpanEventEncoded = Schema.Codec.Encoded<typeof SpanEvent>

/**
 * @since 4.0.0
 * @category schemas
 */
export const ParentSpan: Schema.Codec<ParentSpanType> = Schema.Union([Span, ExternalSpan])

/**
 * @since 4.0.0
 * @category schemas
 */
export type ParentSpan = Schema.Schema.Type<typeof ParentSpan>

/**
 * @since 4.0.0
 * @category schemas
 */
export type ParentSpanEncoded = Schema.Codec.Encoded<typeof ParentSpan>

/**
 * @since 4.0.0
 * @category schemas
 */
export const Ping = Schema.Struct({
  _tag: Schema.Literal("Ping")
})

/**
 * @since 4.0.0
 * @category schemas
 */
export type Ping = Schema.Schema.Type<typeof Ping>

/**
 * @since 4.0.0
 * @category schemas
 */
export type PingEncoded = Schema.Codec.Encoded<typeof Ping>

/**
 * @since 4.0.0
 * @category schemas
 */
export const Pong = Schema.Struct({
  _tag: Schema.Literal("Pong")
})

/**
 * @since 4.0.0
 * @category schemas
 */
export type Pong = Schema.Schema.Type<typeof Pong>

/**
 * @since 4.0.0
 * @category schemas
 */
export type PongEncoded = Schema.Codec.Encoded<typeof Pong>

/**
 * @since 4.0.0
 * @category schemas
 */
export const MetricsRequest = Schema.Struct({
  _tag: Schema.Literal("MetricsRequest")
})

/**
 * @since 4.0.0
 * @category schemas
 */
export type MetricsRequest = Schema.Schema.Type<typeof MetricsRequest>

/**
 * @since 4.0.0
 * @category schemas
 */
export type MetricsRequestEncoded = Schema.Codec.Encoded<typeof MetricsRequest>

/**
 * @since 4.0.0
 * @category schemas
 */
export const MetricLabel = Schema.Struct({
  key: Schema.String,
  value: Schema.String
})

/**
 * @since 4.0.0
 * @category schemas
 */
export type MetricLabel = Schema.Schema.Type<typeof MetricLabel>

/**
 * @since 4.0.0
 * @category schemas
 */
export type MetricLabelEncoded = Schema.Codec.Encoded<typeof MetricLabel>

const metric = <Tag extends string, State extends Schema.Top>(tag: Tag, state: State) =>
  Schema.Struct({
    _tag: Schema.Literal(tag),
    name: Schema.String,
    description: Schema.OptionFromOptional(Schema.String),
    tags: Schema.Array(MetricLabel),
    state
  })

/**
 * @since 4.0.0
 * @category schemas
 */
export const Counter = metric(
  "Counter",
  Schema.Struct({
    count: Schema.Union([Schema.Number, Schema.BigInt])
  })
)

/**
 * @since 4.0.0
 * @category schemas
 */
export type Counter = Schema.Schema.Type<typeof Counter>

/**
 * @since 4.0.0
 * @category schemas
 */
export type CounterEncoded = Schema.Codec.Encoded<typeof Counter>

/**
 * @since 4.0.0
 * @category schemas
 */
export const Frequency = metric(
  "Frequency",
  Schema.Struct({
    occurrences: Schema.Record(Schema.String, Schema.Number)
  })
)

/**
 * @since 4.0.0
 * @category schemas
 */
export type Frequency = Schema.Schema.Type<typeof Frequency>

/**
 * @since 4.0.0
 * @category schemas
 */
export type FrequencyEncoded = Schema.Codec.Encoded<typeof Frequency>

/**
 * @since 4.0.0
 * @category schemas
 */
export const Gauge = metric(
  "Gauge",
  Schema.Struct({
    value: Schema.Union([Schema.Number, Schema.BigInt])
  })
)

/**
 * @since 4.0.0
 * @category schemas
 */
export type Gauge = Schema.Schema.Type<typeof Gauge>

/**
 * @since 4.0.0
 * @category schemas
 */
export type GaugeEncoded = Schema.Codec.Encoded<typeof Gauge>

/**
 * @since 4.0.0
 * @category schemas
 */
export const Histogram = metric(
  "Histogram",
  Schema.Struct({
    buckets: Schema.Array(Schema.Tuple([numberOrInfinity, Schema.Number])),
    count: Schema.Number,
    min: Schema.Number,
    max: Schema.Number,
    sum: Schema.Number
  })
)

/**
 * @since 4.0.0
 * @category schemas
 */
export type Histogram = Schema.Schema.Type<typeof Histogram>

/**
 * @since 4.0.0
 * @category schemas
 */
export type HistogramEncoded = Schema.Codec.Encoded<typeof Histogram>

/**
 * @since 4.0.0
 * @category schemas
 */
export const Summary = metric(
  "Summary",
  Schema.Struct({
    error: Schema.Number,
    quantiles: Schema.Array(Schema.Tuple([Schema.Number, Schema.Option(Schema.Number)])),
    count: Schema.Number,
    min: Schema.Number,
    max: Schema.Number,
    sum: Schema.Number
  })
)

/**
 * @since 4.0.0
 * @category schemas
 */
export type Summary = Schema.Schema.Type<typeof Summary>

/**
 * @since 4.0.0
 * @category schemas
 */
export type SummaryEncoded = Schema.Codec.Encoded<typeof Summary>

/**
 * @since 4.0.0
 * @category schemas
 */
export const Metric = Schema.Union([Counter, Frequency, Gauge, Histogram, Summary])

/**
 * @since 4.0.0
 * @category schemas
 */
export type Metric = Schema.Schema.Type<typeof Metric>

/**
 * @since 4.0.0
 * @category schemas
 */
export type MetricEncoded = Schema.Codec.Encoded<typeof Metric>

/**
 * @since 4.0.0
 * @category schemas
 */
export const MetricsSnapshot = Schema.Struct({
  _tag: Schema.Literal("MetricsSnapshot"),
  metrics: Schema.Array(Metric)
})

/**
 * @since 4.0.0
 * @category schemas
 */
export type MetricsSnapshot = Schema.Schema.Type<typeof MetricsSnapshot>

/**
 * @since 4.0.0
 * @category schemas
 */
export type MetricsSnapshotEncoded = Schema.Codec.Encoded<typeof MetricsSnapshot>

/**
 * @since 4.0.0
 * @category schemas
 */
export const Request = Schema.Union([Ping, Span, SpanEvent, MetricsSnapshot])

/**
 * @since 4.0.0
 * @category schemas
 */
export type Request = Schema.Schema.Type<typeof Request>

/**
 * @since 4.0.0
 * @category schemas
 */
export type RequestEncoded = Schema.Codec.Encoded<typeof Request>

/**
 * @since 4.0.0
 * @category schemas
 */
export declare namespace Request {
  /**
   * @since 4.0.0
   * @category schemas
   */
  export type WithoutPing = Exclude<Request, { readonly _tag: "Ping" }>
}

/**
 * @since 4.0.0
 * @category schemas
 */
export const Response = Schema.Union([Pong, MetricsRequest])

/**
 * @since 4.0.0
 * @category schemas
 */
export type Response = Schema.Schema.Type<typeof Response>

/**
 * @since 4.0.0
 * @category schemas
 */
export type ResponseEncoded = Schema.Codec.Encoded<typeof Response>

/**
 * @since 4.0.0
 * @category schemas
 */
export declare namespace Response {
  /**
   * @since 4.0.0
   * @category schemas
   */
  export type WithoutPong = Exclude<Response, { readonly _tag: "Pong" }>
}
