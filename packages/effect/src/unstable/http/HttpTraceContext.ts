/**
 * @since 4.0.0
 */
import * as Tracer from "../../Tracer.ts"
import * as Headers from "./Headers.ts"

/**
 * @since 4.0.0
 * @category models
 */
export interface FromHeaders {
  (headers: Headers.Headers): Tracer.ExternalSpan | undefined
}

/**
 * @since 4.0.0
 * @category encoding
 */
export const toHeaders = (span: Tracer.Span): Headers.Headers =>
  Headers.fromRecordUnsafe({
    b3: `${span.traceId}-${span.spanId}-${span.sampled ? "1" : "0"}${span.parent ? `-${span.parent.spanId}` : ""}`,
    traceparent: `00-${span.traceId}-${span.spanId}-${span.sampled ? "01" : "00"}`
  })

/**
 * @since 4.0.0
 * @category decoding
 */
export const fromHeaders = (headers: Headers.Headers): Tracer.ExternalSpan | undefined => {
  return w3c(headers) ?? b3(headers) ?? xb3(headers)
}

/**
 * @since 4.0.0
 * @category decoding
 */
export const b3: FromHeaders = (headers) => {
  if (!("b3" in headers)) {
    return undefined
  }
  const parts = headers["b3"].split("-")
  if (parts.length < 2) {
    return undefined
  }
  return Tracer.externalSpan({
    traceId: parts[0],
    spanId: parts[1],
    sampled: parts[2] ? parts[2] === "1" : true
  })
}

/**
 * @since 4.0.0
 * @category decoding
 */
export const xb3: FromHeaders = (headers) => {
  if (!(headers["x-b3-traceid"]) || !(headers["x-b3-spanid"])) {
    return undefined
  }
  return Tracer.externalSpan({
    traceId: headers["x-b3-traceid"],
    spanId: headers["x-b3-spanid"],
    sampled: headers["x-b3-sampled"] ? headers["x-b3-sampled"] === "1" : true
  })
}

const w3cTraceId = /^[0-9a-f]{32}$/i
const w3cSpanId = /^[0-9a-f]{16}$/i

/**
 * @since 4.0.0
 * @category decoding
 */
export const w3c: FromHeaders = (headers) => {
  if (!(headers["traceparent"])) {
    return undefined
  }
  const parts = headers["traceparent"].split("-")
  if (parts.length !== 4) {
    return undefined
  }
  const [version, traceId, spanId, flags] = parts
  switch (version) {
    case "00": {
      if (w3cTraceId.test(traceId) === false || w3cSpanId.test(spanId) === false) {
        return undefined
      }
      return Tracer.externalSpan({
        traceId,
        spanId,
        sampled: (parseInt(flags, 16) & 1) === 1
      })
    }
    default: {
      return undefined
    }
  }
}
