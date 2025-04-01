/**
 * @since 2.0.0
 */
import * as Context from "./Context.ts"
import type * as Exit from "./Exit.ts"
import type { Fiber } from "./Fiber.ts"
import { constFalse, type LazyArg } from "./Function.ts"
import type * as Option from "./Option.ts"

/**
 * @since 2.0.0
 */
export interface Tracer {
  readonly span: (
    name: string,
    parent: Option.Option<AnySpan>,
    context: Context.Context<never>,
    links: ReadonlyArray<SpanLink>,
    startTime: bigint,
    kind: SpanKind
  ) => Span
  readonly context?: <X>(
    f: () => X,
    fiber: Fiber<any, any>
  ) => X
}

/**
 * @since 2.0.0
 * @category models
 */
export type SpanStatus = {
  _tag: "Started"
  startTime: bigint
} | {
  _tag: "Ended"
  startTime: bigint
  endTime: bigint
  exit: Exit.Exit<unknown, unknown>
}

/**
 * @since 2.0.0
 * @category models
 */
export type AnySpan = Span | ExternalSpan

/**
 * @since 2.0.0
 * @category tags
 */
export const ParentSpanKey = "effect/Tracer/ParentSpan"

/**
 * @since 2.0.0
 * @category tags
 */
export class ParentSpan extends Context.Tag<ParentSpan, AnySpan>()(ParentSpanKey) {}

/**
 * @since 2.0.0
 * @category models
 */
export interface ExternalSpan {
  readonly _tag: "ExternalSpan"
  readonly spanId: string
  readonly traceId: string
  readonly sampled: boolean
  readonly context: Context.Context<never>
}

/**
 * @since 3.1.0
 * @category models
 */
export interface SpanOptions {
  readonly attributes?: Record<string, unknown> | undefined
  readonly links?: ReadonlyArray<SpanLink> | undefined
  readonly parent?: AnySpan | undefined
  readonly root?: boolean | undefined
  readonly context?: Context.Context<never> | undefined
  readonly kind?: SpanKind | undefined
  readonly captureStackTrace?: boolean | LazyArg<string | undefined> | undefined
}

/**
 * @since 3.1.0
 * @category models
 */
export type SpanKind = "internal" | "server" | "client" | "producer" | "consumer"

/**
 * @since 2.0.0
 * @category models
 */
export interface Span {
  readonly _tag: "Span"
  readonly name: string
  readonly spanId: string
  readonly traceId: string
  readonly parent: Option.Option<AnySpan>
  readonly context: Context.Context<never>
  readonly status: SpanStatus
  readonly attributes: ReadonlyMap<string, unknown>
  readonly links: ReadonlyArray<SpanLink>
  readonly sampled: boolean
  readonly kind: SpanKind
  end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void
  attribute(key: string, value: unknown): void
  event(name: string, startTime: bigint, attributes?: Record<string, unknown>): void
}

/**
 * @since 2.0.0
 * @category models
 */
export interface SpanLink {
  readonly span: AnySpan
  readonly attributes: Readonly<Record<string, unknown>>
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const make = (options: Tracer): Tracer => options

/**
 * @since 2.0.0
 * @category constructors
 */
export const externalSpan = (
  options: {
    readonly spanId: string
    readonly traceId: string
    readonly sampled?: boolean | undefined
    readonly context?: Context.Context<never> | undefined
  }
): ExternalSpan => ({
  _tag: "ExternalSpan",
  spanId: options.spanId,
  traceId: options.traceId,
  sampled: options.sampled ?? true,
  context: options.context ?? Context.empty()
})

/**
 * @since 3.12.0
 * @category references
 */
export class DisablePropagation extends Context.Reference<"effect/Tracer/DisablePropagation", boolean>(
  "effect/Tracer/DisablePropagation",
  { defaultValue: constFalse }
) {}

/**
 * @since 4.0.0
 * @category references
 */
export const CurrentTracerKey = "effect/Tracer/CurrentTracer"

/**
 * @since 4.0.0
 * @category references
 */
export class CurrentTracer extends Context.Reference(CurrentTracerKey, {
  defaultValue: () =>
    make({
      span: (name, parent, context, links, startTime, kind) =>
        new NativeSpan(
          name,
          parent,
          context,
          links,
          startTime,
          kind
        )
    })
}) {}

/**
 * @since 4.0.0
 * @category native tracer
 */
export class NativeSpan implements Span {
  readonly _tag = "Span"
  readonly spanId: string
  readonly traceId: string = "native"
  readonly sampled = true

  status: SpanStatus
  attributes: Map<string, unknown>
  events: Array<[name: string, startTime: bigint, attributes: Record<string, unknown>]> = []

  constructor(
    readonly name: string,
    readonly parent: Option.Option<AnySpan>,
    readonly context: Context.Context<never>,
    readonly links: ReadonlyArray<SpanLink>,
    readonly startTime: bigint,
    readonly kind: SpanKind
  ) {
    this.status = {
      _tag: "Started",
      startTime
    }
    this.attributes = new Map()
    this.traceId = parent._tag === "Some" ? parent.value.traceId : randomHexString(32)
    this.spanId = randomHexString(16)
  }

  end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
    this.status = {
      _tag: "Ended",
      endTime,
      exit,
      startTime: this.status.startTime
    }
  }

  attribute(key: string, value: unknown): void {
    this.attributes.set(key, value)
  }

  event(name: string, startTime: bigint, attributes?: Record<string, unknown>): void {
    this.events.push([name, startTime, attributes ?? {}])
  }
}

const randomHexString = (function() {
  const characters = "abcdef0123456789"
  const charactersLength = characters.length
  return function(length: number) {
    let result = ""
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
  }
})()
