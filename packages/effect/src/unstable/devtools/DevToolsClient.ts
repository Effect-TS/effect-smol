/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Deferred from "../../Deferred.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as Metric from "../../Metric.ts"
import * as Option from "../../Option.ts"
import * as Queue from "../../Queue.ts"
import * as Schedule from "../../Schedule.ts"
import * as Schema from "../../Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../Stream.ts"
import * as Tracer from "../../Tracer.ts"
import * as Ndjson from "../encoding/Ndjson.ts"
import * as Socket from "../socket/Socket.ts"
import * as DevToolsSchema from "./DevToolsSchema.ts"

const RequestSchema = Schema.toCodecJson(DevToolsSchema.Request)
const ResponseSchema = Schema.toCodecJson(DevToolsSchema.Response)

/**
 * @since 4.0.0
 * @category models
 */
export interface DevToolsClientImpl {
  readonly unsafeAddSpan: (_: DevToolsSchema.Span | DevToolsSchema.SpanEvent) => void
}

/**
 * @since 4.0.0
 * @category tags
 */
export class DevToolsClient extends ServiceMap.Service<DevToolsClient, DevToolsClientImpl>()(
  "effect/devtools/DevToolsClient"
) {}

const toSpanStatus = (status: Tracer.SpanStatus): DevToolsSchema.SpanStatus =>
  status._tag === "Started"
    ? {
      _tag: "Started",
      startTime: status.startTime
    }
    : {
      _tag: "Ended",
      startTime: status.startTime,
      endTime: status.endTime
    }

const toExternalSpan = (span: Tracer.ExternalSpan): DevToolsSchema.ExternalSpan => ({
  _tag: "ExternalSpan",
  spanId: span.spanId,
  traceId: span.traceId,
  sampled: span.sampled
})

const toParentSpan = (span: Tracer.AnySpan | undefined): Option.Option<DevToolsSchema.ParentSpan> => {
  if (!span) {
    return Option.none()
  }
  if (span._tag === "ExternalSpan") {
    return Option.some(toExternalSpan(span))
  }
  return Option.some(toSpan(span))
}

const toSpan = (span: Tracer.Span): DevToolsSchema.Span => ({
  _tag: "Span",
  spanId: span.spanId,
  traceId: span.traceId,
  name: span.name,
  sampled: span.sampled,
  attributes: span.attributes,
  status: toSpanStatus(span.status),
  parent: toParentSpan(span.parent)
})

const toAttributes = (attributes: Metric.Metric.AttributeSet | undefined): Record<string, string> =>
  attributes ? { ...attributes } : {}

const toMetricsSnapshot = (services: ServiceMap.ServiceMap<never>): DevToolsSchema.MetricsSnapshot => {
  const snapshot = Metric.snapshotUnsafe(services)
  const metrics: Array<DevToolsSchema.Metric> = []

  for (let i = 0; i < snapshot.length; i++) {
    const metric = snapshot[i]
    const attributes = toAttributes(metric.attributes)
    const description = Option.fromNullishOr(metric.description)

    switch (metric.type) {
      case "Counter": {
        metrics.push({
          _tag: "Counter",
          name: metric.id,
          description,
          attributes,
          state: {
            count: metric.state.count
          }
        })
        break
      }
      case "Gauge": {
        metrics.push({
          _tag: "Gauge",
          name: metric.id,
          description,
          attributes,
          state: {
            value: metric.state.value
          }
        })
        break
      }
      case "Frequency": {
        metrics.push({
          _tag: "Frequency",
          name: metric.id,
          description,
          attributes,
          state: {
            occurrences: Object.fromEntries(metric.state.occurrences)
          }
        })
        break
      }
      case "Histogram": {
        metrics.push({
          _tag: "Histogram",
          name: metric.id,
          description,
          attributes,
          state: {
            buckets: metric.state.buckets.map(([boundary, count]) => [boundary, count] as const),
            count: metric.state.count,
            min: metric.state.min,
            max: metric.state.max,
            sum: metric.state.sum
          }
        })
        break
      }
      case "Summary": {
        metrics.push({
          _tag: "Summary",
          name: metric.id,
          description,
          attributes,
          state: {
            quantiles: metric.state.quantiles.map(([quantile, value]) =>
              [
                quantile,
                Option.fromNullishOr(value)
              ] as const
            ),
            count: metric.state.count,
            min: metric.state.min,
            max: metric.state.max,
            sum: metric.state.sum
          }
        })
        break
      }
    }
  }

  return {
    _tag: "MetricsSnapshot",
    metrics
  }
}

const makeEffect = Effect.fnUntraced(function*() {
  const socket = yield* Socket.Socket
  const services = yield* Effect.services<never>()
  const requests = yield* Queue.unbounded<DevToolsSchema.Request>()
  const connected = yield* Deferred.make<void>()

  const metricsSnapshot = () => toMetricsSnapshot(services)
  const offerMetricsSnapshot = () => Queue.offer(requests, metricsSnapshot()).pipe(Effect.asVoid)

  const handleResponse = (response: DevToolsSchema.Response): Effect.Effect<void> => {
    switch (response._tag) {
      case "MetricsRequest": {
        return offerMetricsSnapshot()
      }
      case "Pong": {
        return Effect.void
      }
    }
  }

  yield* Stream.fromQueue(requests).pipe(
    Stream.pipeThroughChannel(
      Ndjson.duplexSchemaString(Socket.toChannelString(socket), {
        inputSchema: RequestSchema,
        outputSchema: ResponseSchema
      })
    ),
    Stream.runForEach((response) =>
      Deferred.succeed(connected, undefined).pipe(
        Effect.asVoid,
        Effect.andThen(handleResponse(response))
      )
    ),
    Effect.tapCause(Effect.logDebug),
    Effect.retry({ schedule: Schedule.spaced("1 seconds") }),
    Effect.forkScoped,
    Effect.uninterruptible
  )

  yield* Effect.addFinalizer(() =>
    offerMetricsSnapshot().pipe(
      Effect.andThen(Effect.flatMap(Effect.fiberId, (id) => Queue.failCause(requests, Cause.interrupt(id))))
    )
  )

  yield* Effect.suspend(() => Queue.offer(requests, { _tag: "Ping" })).pipe(
    Effect.delay("3 seconds"),
    Effect.forever,
    Effect.forkScoped,
    Effect.interruptible
  )

  yield* Deferred.await(connected).pipe(
    Effect.timeoutOption("1 second"),
    Effect.asVoid
  )

  return {
    unsafeAddSpan: (request: DevToolsSchema.Span | DevToolsSchema.SpanEvent) => {
      Queue.offerUnsafe(requests, request)
    }
  }
})

/**
 * @since 4.0.0
 * @category constructors
 */
export const make: Effect.Effect<DevToolsClient["Service"], never, Scope.Scope | Socket.Socket> = makeEffect().pipe(
  Effect.annotateLogs({
    module: "DevTools",
    service: "Client"
  })
)

/**
 * @since 4.0.0
 * @category layers
 */
export const layer: Layer.Layer<DevToolsClient, never, Socket.Socket> = Layer.effect(DevToolsClient)(make)

const makeTracerEffect = Effect.fnUntraced(function*() {
  const client = yield* DevToolsClient
  const currentTracer = yield* Effect.tracer

  return Tracer.make({
    span(name, parent, annotations, links, startTime, kind, options) {
      const span = currentTracer.span(name, parent, annotations, links, startTime, kind, options)
      client.unsafeAddSpan(toSpan(span))

      const oldEvent = span.event
      span.event = function(this: Tracer.Span, name, startTime, attributes) {
        client.unsafeAddSpan({
          _tag: "SpanEvent",
          traceId: span.traceId,
          spanId: span.spanId,
          name,
          startTime,
          attributes: attributes ?? {}
        })
        return oldEvent.call(this, name, startTime, attributes)
      }

      const oldEnd = span.end
      span.end = function(this: Tracer.Span, endTime, exit) {
        oldEnd.call(this, endTime, exit)
        client.unsafeAddSpan(toSpan(span))
      }

      return span
    },
    context: currentTracer.context
  })
})

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeTracer: Effect.Effect<Tracer.Tracer, never, DevToolsClient> = makeTracerEffect().pipe(
  Effect.annotateLogs({
    module: "DevTools",
    service: "Tracer"
  })
)

/**
 * @since 4.0.0
 * @category layers
 */
export const layerTracer: Layer.Layer<never, never, Socket.Socket> = Layer.effect(Tracer.Tracer)(makeTracer).pipe(
  Layer.provide(layer)
)
