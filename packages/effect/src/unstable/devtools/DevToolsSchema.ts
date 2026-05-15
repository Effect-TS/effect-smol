/**
 * @since 4.0.0
 */
import * as Exit from "../../Exit.ts"
import { identity } from "../../Function.ts"
import type * as Option from "../../Option.ts"
import * as Schema from "../../Schema.ts"
import * as SchemaTransformation from "../../SchemaTransformation.ts"

/**
 * @category schemas
 * @since 4.0.0
 */
export const SpanStatusStarted = Schema.Struct({
  _tag: Schema.tag("Started"),
  startTime: Schema.BigInt
})

/**
 * @category schemas
 * @since 4.0.0
 */
export type SpanStatusStarted = Schema.Schema.Type<typeof SpanStatusStarted>

/**
 * @category schemas
 * @since 4.0.0
 */
export const SpanStatusEnded = Schema.Struct({
  _tag: Schema.tag("Ended"),
  startTime: Schema.BigInt,
  endTime: Schema.BigInt,
  exit: Schema.Exit(Schema.Void, Schema.DefectWithStack, Schema.DefectWithStack).pipe(
    Schema.decodeTo(
      Schema.Exit(Schema.Unknown, Schema.Unknown, Schema.Unknown),
      SchemaTransformation.transform({
        decode: identity,
        encode: Exit.asVoid
      })
    )
  )
})

/**
 * @category schemas
 * @since 4.0.0
 */
export type SpanStatusEnded = Schema.Schema.Type<typeof SpanStatusEnded>

/**
 * @category schemas
 * @since 4.0.0
 */
export const SpanStatus = Schema.Union([SpanStatusStarted, SpanStatusEnded])

/**
 * @category schemas
 * @since 4.0.0
 */
export type SpanStatus = Schema.Schema.Type<typeof SpanStatus>

/**
 * @category schemas
 * @since 4.0.0
 */
export interface ExternalSpan {
  readonly _tag: "ExternalSpan"
  readonly spanId: string
  readonly traceId: string
  readonly sampled: boolean
}

/**
 * @category schemas
 * @since 4.0.0
 */
export const ExternalSpan: Schema.Codec<ExternalSpan> = Schema.Struct({
  _tag: Schema.tag("ExternalSpan"),
  spanId: Schema.String,
  traceId: Schema.String,
  sampled: Schema.Boolean
})

/**
 * @category schemas
 * @since 4.0.0
 */
export interface Span {
  readonly _tag: "Span"
  readonly spanId: string
  readonly traceId: string
  readonly name: string
  readonly sampled: boolean
  readonly attributes: ReadonlyMap<string, unknown>
  readonly status: SpanStatus
  readonly parent: Option.Option<ParentSpan>
}

/**
 * @category schemas
 * @since 4.0.0
 */
export const Span: Schema.Codec<Span> = Schema.Struct({
  _tag: Schema.tag("Span"),
  spanId: Schema.String,
  traceId: Schema.String,
  name: Schema.String,
  sampled: Schema.Boolean,
  attributes: Schema.ReadonlyMap(Schema.String, Schema.Any),
  status: SpanStatus,
  parent: Schema.Option(Schema.suspend(() => ParentSpan))
})

/**
 * @category schemas
 * @since 4.0.0
 */
export const SpanEvent = Schema.Struct({
  _tag: Schema.tag("SpanEvent"),
  traceId: Schema.String,
  spanId: Schema.String,
  name: Schema.String,
  startTime: Schema.BigInt,
  attributes: Schema.UndefinedOr(Schema.Record(Schema.String, Schema.Any))
})

/**
 * @category schemas
 * @since 4.0.0
 */
export type SpanEvent = Schema.Schema.Type<typeof SpanEvent>

/**
 * @category schemas
 * @since 4.0.0
 */
export type ParentSpan = Span | ExternalSpan

/**
 * @category schemas
 * @since 4.0.0
 */
export const ParentSpan = Schema.Union([Span, ExternalSpan])

/**
 * @category schemas
 * @since 4.0.0
 */
export const Ping = Schema.Struct({
  _tag: Schema.tag("Ping")
})

/**
 * @category schemas
 * @since 4.0.0
 */
export type Ping = Schema.Schema.Type<typeof Ping>

/**
 * @category schemas
 * @since 4.0.0
 */
export const Pong = Schema.Struct({
  _tag: Schema.tag("Pong")
})

/**
 * @category schemas
 * @since 4.0.0
 */
export type Pong = Schema.Schema.Type<typeof Pong>

/**
 * @category schemas
 * @since 4.0.0
 */
export const MetricsRequest = Schema.Struct({
  _tag: Schema.tag("MetricsRequest")
})

/**
 * @category schemas
 * @since 4.0.0
 */
export type MetricsRequest = Schema.Schema.Type<typeof MetricsRequest>

/**
 * @category schemas
 * @since 4.0.0
 */
export const MetricLabel = Schema.Struct({
  key: Schema.String,
  value: Schema.String
})

/**
 * @category schemas
 * @since 4.0.0
 */
export type MetricLabel = Schema.Schema.Type<typeof MetricLabel>

const metric = <Type extends string, State extends Schema.Top>(type: Type, state: State) =>
  Schema.Struct({
    id: Schema.String,
    type: Schema.tag(type),
    description: Schema.UndefinedOr(Schema.String),
    attributes: Schema.UndefinedOr(Schema.Record(Schema.String, Schema.String)),
    state
  })

/**
 * @category schemas
 * @since 4.0.0
 */
export const Counter = metric(
  "Counter",
  Schema.Struct({
    count: Schema.Union([Schema.Number, Schema.BigInt]),
    incremental: Schema.Boolean
  })
)

/**
 * @category schemas
 * @since 4.0.0
 */
export type Counter = Schema.Schema.Type<typeof Counter>

/**
 * @category schemas
 * @since 4.0.0
 */
export const Frequency = metric(
  "Frequency",
  Schema.Struct({
    occurrences: Schema.ReadonlyMap(Schema.String, Schema.Number)
  })
)

/**
 * @category schemas
 * @since 4.0.0
 */
export type Frequency = Schema.Schema.Type<typeof Frequency>

/**
 * @category schemas
 * @since 4.0.0
 */
export const Gauge = metric(
  "Gauge",
  Schema.Struct({
    value: Schema.Union([Schema.Number, Schema.BigInt])
  })
)

/**
 * @category schemas
 * @since 4.0.0
 */
export type Gauge = Schema.Schema.Type<typeof Gauge>

/**
 * @category schemas
 * @since 4.0.0
 */
export const Histogram = metric(
  "Histogram",
  Schema.Struct({
    buckets: Schema.Array(Schema.Tuple([Schema.Number, Schema.Number])),
    count: Schema.Number,
    min: Schema.Number,
    max: Schema.Number,
    sum: Schema.Number
  })
)

/**
 * @category schemas
 * @since 4.0.0
 */
export type Histogram = Schema.Schema.Type<typeof Histogram>

/**
 * @category schemas
 * @since 4.0.0
 */
export const Summary = metric(
  "Summary",
  Schema.Struct({
    quantiles: Schema.Array(Schema.Tuple([Schema.Number, Schema.UndefinedOr(Schema.Number)])),
    count: Schema.Number,
    min: Schema.Number,
    max: Schema.Number,
    sum: Schema.Number
  })
)

/**
 * @category schemas
 * @since 4.0.0
 */
export type Summary = Schema.Schema.Type<typeof Summary>

/**
 * @category schemas
 * @since 4.0.0
 */
export const Metric = Schema.Union([Counter, Frequency, Gauge, Histogram, Summary])

/**
 * @category schemas
 * @since 4.0.0
 */
export type Metric = Schema.Schema.Type<typeof Metric>

/**
 * @category schemas
 * @since 4.0.0
 */
export const MetricsSnapshot = Schema.Struct({
  _tag: Schema.tag("MetricsSnapshot"),
  metrics: Schema.Array(Metric)
})

/**
 * @category schemas
 * @since 4.0.0
 */
export type MetricsSnapshot = Schema.Schema.Type<typeof MetricsSnapshot>

/**
 * @category schemas
 * @since 4.0.0
 */
export const Request = Schema.Union([Ping, Span, SpanEvent, MetricsSnapshot])

/**
 * @category schemas
 * @since 4.0.0
 */
export type Request = Schema.Schema.Type<typeof Request>

/**
 * @category schemas
 * @since 4.0.0
 */
export declare namespace Request {
  /**
   * @category schemas
   * @since 4.0.0
   */
  export type WithoutPing = Exclude<Request, { readonly _tag: "Ping" }>
}

/**
 * @category schemas
 * @since 4.0.0
 */
export const Response = Schema.Union([Pong, MetricsRequest])

/**
 * @category schemas
 * @since 4.0.0
 */
export type Response = Schema.Schema.Type<typeof Response>

/**
 * @category schemas
 * @since 4.0.0
 */
export declare namespace Response {
  /**
   * @category schemas
   * @since 4.0.0
   */
  export type WithoutPong = Exclude<Response, { readonly _tag: "Pong" }>
}
