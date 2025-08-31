/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Effect from "../../Effect.ts"
import type * as Exit from "../../Exit.ts"
import * as Exporter from "../../internal/tracing/otlpExporter.ts"
import * as Layer from "../../Layer.ts"
import * as Tracer from "../../observability/Tracer.ts"
import type * as Scope from "../../Scope.ts"
import type * as ServiceMap from "../../ServiceMap.ts"
import * as Duration from "../../time/Duration.ts"
import type { ExtractTag } from "../../types/Types.ts"
import type * as Headers from "../http/Headers.ts"
import type * as HttpClient from "../http/HttpClient.ts"
import type { KeyValue, Resource } from "./OtlpResource.ts"
import { entriesToAttributes } from "./OtlpResource.ts"
import * as OtlpResource from "./OtlpResource.ts"

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make: (
  options: {
    readonly url: string
    readonly resource?: {
      readonly serviceName?: string | undefined
      readonly serviceVersion?: string | undefined
      readonly attributes?: Record<string, unknown>
    } | undefined
    readonly headers?: Headers.Input | undefined
    readonly exportInterval?: Duration.DurationInput | undefined
    readonly maxBatchSize?: number | undefined
    readonly context?: (<X>(f: () => X, span: Tracer.AnySpan) => X) | undefined
    readonly shutdownTimeout?: Duration.DurationInput | undefined
  }
) => Effect.Effect<
  Tracer.Tracer,
  never,
  HttpClient.HttpClient | Scope.Scope
> = Effect.fnUntraced(function*(options) {
  const otelResource = yield* OtlpResource.fromConfig(options.resource)
  const scope: Scope = {
    name: OtlpResource.serviceNameUnsafe(otelResource)
  }

  const exporter = yield* Exporter.make({
    label: "OtlpTracer",
    url: options.url,
    headers: options.headers,
    exportInterval: options.exportInterval ?? Duration.seconds(5),
    maxBatchSize: options.maxBatchSize ?? 1000,
    body(spans) {
      const data: TraceData = {
        resourceSpans: [{
          resource: otelResource,
          scopeSpans: [{
            scope,
            spans
          }]
        }]
      }
      return data
    },
    shutdownTimeout: options.shutdownTimeout ?? Duration.seconds(3)
  })

  return Tracer.make({
    span(name, parent, context, links, startTime, kind) {
      return makeSpan({
        name,
        parent,
        context,
        status: {
          _tag: "Started",
          startTime
        },
        attributes: new Map(),
        links,
        sampled: true,
        kind,
        export(span) {
          exporter.push(makeOtlpSpan(span))
        }
      })
    },
    context: options.context ?
      function(f, fiber) {
        if (fiber.currentSpan === undefined) {
          return f()
        }
        return options.context!(f, fiber.currentSpan)
      } :
      undefined
  })
})

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer: (options: {
  readonly url: string
  readonly resource?: {
    readonly serviceName?: string | undefined
    readonly serviceVersion?: string | undefined
    readonly attributes?: Record<string, unknown>
  } | undefined
  readonly headers?: Headers.Input | undefined
  readonly exportInterval?: Duration.DurationInput | undefined
  readonly maxBatchSize?: number | undefined
  readonly context?: (<X>(f: () => X, span: Tracer.AnySpan) => X) | undefined
  readonly shutdownTimeout?: Duration.DurationInput | undefined
}) => Layer.Layer<never, never, HttpClient.HttpClient> = Layer.effect(Tracer.Tracer)(make)

// internal

interface SpanImpl extends Tracer.Span {
  readonly export: (span: SpanImpl) => void
  readonly attributes: Map<string, unknown>
  readonly links: Array<Tracer.SpanLink>
  readonly events: Array<[name: string, startTime: bigint, attributes: Record<string, unknown> | undefined]>
  status: Tracer.SpanStatus
}

const SpanProto = {
  _tag: "Span",
  end(this: SpanImpl, endTime: bigint, exit: Exit.Exit<unknown, unknown>) {
    this.status = {
      _tag: "Ended",
      startTime: this.status.startTime,
      endTime,
      exit
    }
    this.export(this)
  },
  attribute(this: SpanImpl, key: string, value: unknown) {
    this.attributes.set(key, value)
  },
  event(this: SpanImpl, name: string, startTime: bigint, attributes?: Record<string, unknown>) {
    this.events.push([name, startTime, attributes])
  },
  addLinks(this: SpanImpl, links: ReadonlyArray<Tracer.SpanLink>) {
    // eslint-disable-next-line no-restricted-syntax
    this.links.push(...links)
  }
}

const makeSpan = (options: {
  readonly name: string
  readonly parent: Tracer.AnySpan | undefined
  readonly context: ServiceMap.ServiceMap<never>
  readonly status: Tracer.SpanStatus
  readonly attributes: ReadonlyMap<string, unknown>
  readonly links: ReadonlyArray<Tracer.SpanLink>
  readonly sampled: boolean
  readonly kind: Tracer.SpanKind
  readonly export: (span: SpanImpl) => void
}): SpanImpl => {
  const self = Object.assign(Object.create(SpanProto), options)
  if (self.parent) {
    self.traceId = self.parent.value.traceId
  } else {
    self.traceId = generateId(32)
  }
  self.spanId = generateId(16)
  self.events = []
  return self
}

const generateId = (len: number): string => {
  const chars = "0123456789abcdef"
  let result = ""
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

const makeOtlpSpan = (self: SpanImpl): OtlpSpan => {
  const status = self.status as ExtractTag<Tracer.SpanStatus, "Ended">
  const attributes = entriesToAttributes(self.attributes.entries())
  const events = self.events.map(([name, startTime, attributes]) => ({
    name,
    timeUnixNano: String(startTime),
    attributes: attributes
      ? entriesToAttributes(Object.entries(attributes))
      : [],
    droppedAttributesCount: 0
  }))
  let otelStatus: Status

  if (status.exit._tag === "Success") {
    otelStatus = constOtelStatusSuccess
  } else if (Cause.isInterruptedOnly(status.exit.cause)) {
    otelStatus = {
      code: StatusCode.Ok,
      message: "Interrupted"
    }
    attributes.push({
      key: "span.label",
      value: { stringValue: "⚠︎ Interrupted" }
    }, {
      key: "status.interrupted",
      value: { boolValue: true }
    })
  } else {
    const errors = Cause.prettyErrors(status.exit.cause)
    otelStatus = {
      code: StatusCode.Error
    }
    if (errors.length > 0) {
      otelStatus.message = errors[0].message
      for (const error of errors) {
        events.push({
          name: "exception",
          timeUnixNano: String(status.endTime),
          droppedAttributesCount: 0,
          attributes: [
            {
              "key": "exception.type",
              "value": {
                "stringValue": error.name
              }
            },
            {
              "key": "exception.message",
              "value": {
                "stringValue": error.message
              }
            },
            {
              "key": "exception.stacktrace",
              "value": {
                "stringValue": error.stack ?? "No stack trace available"
              }
            }
          ]
        })
      }
    }
  }

  return {
    traceId: self.traceId,
    spanId: self.spanId,
    parentSpanId: self.parent ? self.parent.spanId : undefined,
    name: self.name,
    kind: SpanKind[self.kind],
    startTimeUnixNano: String(status.startTime),
    endTimeUnixNano: String(status.endTime),
    attributes,
    droppedAttributesCount: 0,
    events,
    droppedEventsCount: 0,
    status: otelStatus,
    links: self.links.map((link) => ({
      traceId: link.span.traceId,
      spanId: link.span.spanId,
      attributes: entriesToAttributes(Object.entries(link.attributes)),
      droppedAttributesCount: 0
    })),
    droppedLinksCount: 0
  }
}

interface TraceData {
  readonly resourceSpans: Array<ResourceSpan>
}

interface ResourceSpan {
  readonly resource: Resource
  readonly scopeSpans: Array<ScopeSpan>
}

interface ScopeSpan {
  readonly scope: Scope
  readonly spans: Array<OtlpSpan>
}

interface Scope {
  readonly name: string
}

interface OtlpSpan {
  readonly traceId: string
  readonly spanId: string
  readonly parentSpanId: string | undefined
  readonly name: string
  readonly kind: number
  readonly startTimeUnixNano: string
  readonly endTimeUnixNano: string
  readonly attributes: Array<KeyValue>
  readonly droppedAttributesCount: number
  readonly events: Array<Event>
  readonly droppedEventsCount: number
  readonly status: Status
  readonly links: Array<Link>
  readonly droppedLinksCount: number
}

interface Event {
  readonly attributes: Array<KeyValue>
  readonly name: string
  readonly timeUnixNano: string
  readonly droppedAttributesCount: number
}

interface Link {
  readonly attributes: Array<KeyValue>
  readonly spanId: string
  readonly traceId: string
  readonly droppedAttributesCount: number
}

interface Status {
  readonly code: StatusCode
  message?: string
}

const StatusCode = {
  Unset: 0,
  Ok: 1,
  Error: 2
} as const

type StatusCode = typeof StatusCode[keyof typeof StatusCode]

const SpanKind = {
  unspecified: 0,
  internal: 1,
  server: 2,
  client: 3,
  producer: 4,
  consumer: 5
} as const

const constOtelStatusSuccess: Status = {
  code: StatusCode.Ok
}
