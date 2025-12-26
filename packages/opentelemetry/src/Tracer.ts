/**
 * @since 1.0.0
 */
import * as Otel from "@opentelemetry/api"
import * as OtelSemConv from "@opentelemetry/semantic-conventions"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import type * as Exit from "effect/Exit"
import { dual } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import * as ServiceMap from "effect/ServiceMap"
import * as Tracer from "effect/Tracer"
import { recordToAttributes, unknownToAttributeValue } from "./internal/attributes.ts"
import { Resource } from "./Resource.ts"

// TODO:
//   - Need to figure out implementation for Tracer.currentOtelSpan
//     - https://github.com/Effect-TS/effect/blob/ba9e7908a80a55f24217c88af4f7d89a4f7bc0e4/packages/opentelemetry/src/Tracer.ts#L44

// =============================================================================
// Service Definitions
// =============================================================================

/**
 * @since 1.0.0
 * @category Services
 */
export class OtelTracer extends ServiceMap.Service<
  OtelTracer,
  Otel.Tracer
>()("@effect/opentelemetry/Tracer") {}

/**
 * @since 1.0.0
 * @category Services
 */
export class OtelTracerProvider extends ServiceMap.Service<
  OtelTracerProvider,
  Otel.TracerProvider
>()("@effect/opentelemetry/Tracer/OtelTracerProvider") {}

/**
 * @since 1.0.0
 * @category Services
 */
export class OtelTraceFlags extends ServiceMap.Service<
  OtelTraceFlags,
  Otel.TraceFlags
>()("@effect/opentelemetry/Tracer/OtelTraceFlags") {}

/**
 * @since 1.0.0
 * @category Services
 */
export class OtelTraceState extends ServiceMap.Service<
  OtelTraceState,
  Otel.TraceState
>()("@effect/opentelemetry/Tracer/OtelTraceState") {}

// =============================================================================
// Constructors
// =============================================================================

/**
 * @since 1.0.0
 * @category Constructors
 */
export const make: Effect.Effect<Tracer.Tracer, never, OtelTracer> = Effect.map(
  Effect.service(OtelTracer),
  (tracer) =>
    Tracer.make({
      span(name, parent, services, links, startTime, kind, options) {
        return new OtelSpan(
          Otel.context,
          Otel.trace,
          tracer,
          name,
          parent,
          services,
          links.slice(),
          startTime,
          kind,
          options
        )
      },
      context(execution, fiber) {
        const currentSpan = fiber.currentSpan

        if (currentSpan === undefined) {
          return execution()
        }

        return Otel.context.with(
          populateContext(Otel.context.active(), currentSpan),
          execution
        )
      }
    })
)

/**
 * @since 1.0.0
 * @category Constructors
 */
export const makeExternalSpan = (options: {
  readonly traceId: string
  readonly spanId: string
  readonly traceFlags?: number | undefined
  readonly traceState?: string | Otel.TraceState | undefined
}): Tracer.ExternalSpan => {
  let services = ServiceMap.empty()

  if (options.traceFlags !== undefined) {
    services = ServiceMap.add(services, OtelTraceFlags, options.traceFlags)
  }

  if (typeof options.traceState === "string") {
    try {
      const traceState = Otel.createTraceState(options.traceState)
      services = ServiceMap.add(services, OtelTraceState, traceState)
    } catch {
      //
    }
  } else if (options.traceState) {
    services = ServiceMap.add(services, OtelTraceState, options.traceState)
  }

  return {
    _tag: "ExternalSpan",
    traceId: options.traceId,
    spanId: options.spanId,
    sampled: Predicate.isNotUndefined(options.traceFlags) ? isSampled(options.traceFlags) : true,
    services
  }
}

// =============================================================================
// Layers
// =============================================================================

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerGlobalProvider: Layer.Layer<OtelTracerProvider> = Layer.sync(
  OtelTracerProvider,
  () => Otel.trace.getTracerProvider()
)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerTracer: Layer.Layer<OtelTracer, never, OtelTracerProvider | Resource> = Layer.effect(
  OtelTracer,
  Effect.gen(function*() {
    const resource = yield* Resource
    const provider = yield* OtelTracerProvider
    return provider.getTracer(
      resource.attributes[OtelSemConv.ATTR_SERVICE_NAME] as string,
      resource.attributes[OtelSemConv.ATTR_SERVICE_VERSION] as string
    )
  })
)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerGlobalTracer: Layer.Layer<OtelTracer, never, Resource> = layerTracer.pipe(
  Layer.provide(layerGlobalProvider)
)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerGlobal: Layer.Layer<OtelTracer, never, Resource> = Layer.effect(Tracer.Tracer, make).pipe(
  Layer.provideMerge(layerGlobalTracer)
)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerWithoutOtelTracer: Layer.Layer<never, never, OtelTracer> = Layer.effect(Tracer.Tracer, make)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer: Layer.Layer<OtelTracer, never, OtelTracerProvider | Resource> = layerWithoutOtelTracer.pipe(
  Layer.provideMerge(layerTracer)
)

/**
 * Set the effect's parent span from the given opentelemetry `SpanContext`.
 *
 * This is handy when you set up OpenTelemetry outside of Effect and want to
 * attach to a parent span.
 *
 * @since 1.0.0
 * @category Propagation
 */
export const withSpanContext: {
  (
    spanContext: Otel.SpanContext
  ): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, Tracer.ParentSpan>>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    spanContext: Otel.SpanContext
  ): Effect.Effect<A, E, Exclude<R, Tracer.ParentSpan>>
} = dual(2, <A, E, R>(
  self: Effect.Effect<A, E, R>,
  spanContext: Otel.SpanContext
) => Effect.withParentSpan(self, makeExternalSpan(spanContext)))

// =============================================================================
// Internals
// =============================================================================

const OtelSpanTypeId = "~@effect/opentelemetry/Tracer/OtelSpan"

const kindMap = {
  "internal": Otel.SpanKind.INTERNAL,
  "client": Otel.SpanKind.CLIENT,
  "server": Otel.SpanKind.SERVER,
  "producer": Otel.SpanKind.PRODUCER,
  "consumer": Otel.SpanKind.CONSUMER
}

/** @internal */
export class OtelSpan implements Tracer.Span {
  readonly [OtelSpanTypeId]: typeof OtelSpanTypeId
  readonly _tag = "Span"

  readonly name: string
  readonly kind: Tracer.SpanKind
  readonly services: ServiceMap.ServiceMap<never>
  readonly links: Array<Tracer.SpanLink>
  readonly span: Otel.Span
  readonly spanId: string
  readonly traceId: string
  readonly attributes = new Map<string, unknown>()
  readonly sampled: boolean
  readonly parent: Tracer.AnySpan | undefined
  status: Tracer.SpanStatus

  constructor(
    contextApi: Otel.ContextAPI,
    traceApi: Otel.TraceAPI,
    tracer: Otel.Tracer,
    name: string,
    effectParent: Tracer.AnySpan | undefined,
    services: ServiceMap.ServiceMap<never>,
    links: Array<Tracer.SpanLink>,
    startTime: bigint,
    kind: Tracer.SpanKind,
    options: Tracer.SpanOptions | undefined
  ) {
    this[OtelSpanTypeId] = OtelSpanTypeId
    this.name = name
    this.services = services
    this.links = links
    this.kind = kind
    const active = contextApi.active()
    this.parent = Predicate.isNotUndefined(effectParent)
      ? effectParent
      : (options?.root !== true)
      ? getOtelParent(traceApi, active, services)
      : undefined
    this.span = tracer.startSpan(
      name,
      {
        startTime: nanosToHrTime(startTime),
        links: links.length > 0
          ? links.map((link) => ({
            context: makeSpanContext(link.span),
            attributes: recordToAttributes(link.attributes)
          }))
          : undefined as any,
        kind: kindMap[this.kind]
      },
      Predicate.isNotUndefined(this.parent)
        ? populateContext(active, this.parent, services)
        : Otel.trace.deleteSpan(active)
    )
    const spanContext = this.span.spanContext()
    this.spanId = spanContext.spanId
    this.traceId = spanContext.traceId
    this.status = {
      _tag: "Started",
      startTime
    }
    this.sampled = isSampled(spanContext.traceFlags)
  }

  attribute(key: string, value: unknown) {
    this.span.setAttribute(key, unknownToAttributeValue(value))
    this.attributes.set(key, value)
  }

  addLinks(links: ReadonlyArray<Tracer.SpanLink>): void {
    // eslint-disable-next-line no-restricted-syntax
    this.links.push(...links)
    this.span.addLinks(links.map((link) => ({
      context: makeSpanContext(link.span),
      attributes: recordToAttributes(link.attributes)
    })))
  }

  end(endTime: bigint, exit: Exit.Exit<unknown, unknown>) {
    const hrTime = nanosToHrTime(endTime)
    this.status = {
      _tag: "Ended",
      endTime,
      exit,
      startTime: this.status.startTime
    }

    if (exit._tag === "Success") {
      this.span.setStatus({ code: Otel.SpanStatusCode.OK })
    } else {
      if (Cause.isInterruptedOnly(exit.cause)) {
        this.span.setStatus({
          code: Otel.SpanStatusCode.OK,
          message: Cause.pretty(exit.cause)
        })
        this.span.setAttribute("span.label", "⚠︎ Interrupted")
        this.span.setAttribute("status.interrupted", true)
      } else {
        const firstError = Cause.prettyErrors(exit.cause)[0]
        if (firstError) {
          firstError.stack = Cause.pretty(exit.cause)
          this.span.recordException(firstError, hrTime)
          this.span.setStatus({
            code: Otel.SpanStatusCode.ERROR,
            message: firstError.message
          })
        } else {
          // empty cause means no error
          this.span.setStatus({ code: Otel.SpanStatusCode.OK })
        }
      }
    }
    this.span.end(hrTime)
  }

  event(name: string, startTime: bigint, attributes?: Record<string, unknown>) {
    this.span.addEvent(
      name,
      attributes ? recordToAttributes(attributes) : undefined,
      nanosToHrTime(startTime)
    )
  }
}

const isSampled = (traceFlags: Otel.TraceFlags): boolean =>
  (traceFlags & Otel.TraceFlags.SAMPLED) === Otel.TraceFlags.SAMPLED

const bigint1e9 = 1_000_000_000n

const nanosToHrTime = (timestamp: bigint): Otel.HrTime => {
  return [Number(timestamp / bigint1e9), Number(timestamp % bigint1e9)]
}

const getOtelParent = (
  tracer: Otel.TraceAPI,
  context: Otel.Context,
  services: ServiceMap.ServiceMap<never>
): Tracer.AnySpan | undefined => {
  const active = tracer.getSpan(context)
  const otelParent = active ? active.spanContext() : undefined
  return otelParent
    ? Tracer.externalSpan({
      spanId: otelParent.spanId,
      traceId: otelParent.traceId,
      sampled: (otelParent.traceFlags & 1) === 1,
      services
    })
    : undefined
}

const makeSpanContext = (
  span: Tracer.AnySpan,
  services?: ServiceMap.ServiceMap<never>
): Otel.SpanContext => {
  const traceFlags = makeTraceFlags(span, services)
  const traceState = makeTraceState(span, services)!
  return ({
    spanId: span.spanId,
    traceId: span.traceId,
    isRemote: span._tag === "ExternalSpan",
    traceFlags,
    traceState
  })
}

const makeTraceFlags = (
  span: Tracer.AnySpan,
  services: ServiceMap.ServiceMap<never> | undefined
): Otel.TraceFlags => {
  let traceFlags: Otel.TraceFlags | undefined
  if (Predicate.isNotUndefined(services)) {
    traceFlags = extractTraceService(span, services, OtelTraceFlags)
    if (Predicate.isUndefined(traceFlags)) {
      traceFlags = ServiceMap.getOrUndefined(span.services, OtelTraceFlags)
    }
  }
  return traceFlags ?? Otel.TraceFlags.SAMPLED
}

const makeTraceState = (
  span: Tracer.AnySpan,
  services: ServiceMap.ServiceMap<never> | undefined
): Otel.TraceState | undefined => {
  let traceState: Otel.TraceState | undefined
  if (Predicate.isNotUndefined(services)) {
    traceState = extractTraceService(span, services, OtelTraceState)
    if (Predicate.isUndefined(traceState)) {
      traceState = ServiceMap.getOrUndefined(span.services, OtelTraceState)
    }
  }
  return traceState
}

const extractTraceService = <I, S>(
  parent: Tracer.AnySpan,
  services: ServiceMap.ServiceMap<never>,
  service: ServiceMap.Service<I, S>
) => {
  const instance = ServiceMap.getOrUndefined(services, service)
  if (Predicate.isNotUndefined(instance)) {
    return instance
  }
  return ServiceMap.getOrUndefined(parent.services, service)
}

const populateContext = (
  context: Otel.Context,
  span: Tracer.AnySpan,
  services?: ServiceMap.ServiceMap<never>
): Otel.Context =>
  span instanceof OtelSpan ?
    Otel.trace.setSpan(context, span.span) :
    Otel.trace.setSpanContext(context, makeSpanContext(span, services))
