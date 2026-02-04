import { assert, describe, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import * as DevToolsSchema from "effect/unstable/devtools/DevToolsSchema"

describe("DevToolsSchema", () => {
  it.effect("Span roundtrip", () =>
    Effect.gen(function*() {
      const span: DevToolsSchema.Span = {
        _tag: "Span",
        spanId: "span-1",
        traceId: "trace-1",
        name: "test-span",
        sampled: true,
        attributes: new Map<string, unknown>([
          ["service", "devtools"],
          ["attempt", 1]
        ]),
        status: {
          _tag: "Started",
          startTime: 10n
        },
        parent: Option.none()
      }

      const encoded = yield* Schema.encodeEffect(DevToolsSchema.Span)(span)
      const decoded = yield* Schema.decodeEffect(DevToolsSchema.Span)(encoded)

      assert.strictEqual(decoded._tag, "Span")
      assert.strictEqual(decoded.spanId, span.spanId)
      assert.strictEqual(decoded.traceId, span.traceId)
      assert.strictEqual(decoded.name, span.name)
      assert.strictEqual(decoded.sampled, span.sampled)
      assert.deepStrictEqual([...decoded.attributes.entries()], [...span.attributes.entries()])
      assert.strictEqual(decoded.status._tag, "Started")
      assert.strictEqual(decoded.status.startTime, 10n)
      assert.strictEqual(decoded.parent._tag, "None")
    }))

  it.effect("SpanEvent roundtrip", () =>
    Effect.gen(function*() {
      const event: DevToolsSchema.SpanEvent = {
        _tag: "SpanEvent",
        traceId: "trace-1",
        spanId: "span-1",
        name: "event",
        startTime: 20n,
        attributes: {
          ok: true,
          count: 2
        }
      }

      const encoded = yield* Schema.encodeEffect(DevToolsSchema.SpanEvent)(event)
      const decoded = yield* Schema.decodeEffect(DevToolsSchema.SpanEvent)(encoded)

      assert.deepStrictEqual(decoded, event)
    }))

  it.effect("MetricsSnapshot roundtrip", () =>
    Effect.gen(function*() {
      const snapshot: DevToolsSchema.MetricsSnapshot = {
        _tag: "MetricsSnapshot",
        metrics: [
          {
            id: "counter-1",
            type: "Counter",
            description: "test counter",
            attributes: {
              unit: "requests"
            },
            state: {
              count: 2,
              incremental: true
            }
          },
          {
            id: "histogram-1",
            type: "Histogram",
            description: undefined,
            attributes: undefined,
            state: {
              buckets: [
                [0, 1],
                [Number.POSITIVE_INFINITY, 2]
              ],
              count: 3,
              min: 0,
              max: 2,
              sum: 3
            }
          }
        ]
      }

      const encoded = yield* Schema.encodeEffect(DevToolsSchema.MetricsSnapshot)(snapshot)
      const histogram = encoded.metrics[1]

      if (histogram.type !== "Histogram") {
        assert.fail(`Expected Histogram, got ${histogram.type}`)
      }
      assert.deepStrictEqual(histogram.state.buckets[1], [null, 2])

      const decoded = yield* Schema.decodeEffect(DevToolsSchema.MetricsSnapshot)(encoded)
      const decodedHistogram = decoded.metrics[1]

      if (decodedHistogram.type !== "Histogram") {
        assert.fail(`Expected Histogram, got ${decodedHistogram.type}`)
      }
      assert.deepStrictEqual(decodedHistogram.state.buckets[1], [Number.POSITIVE_INFINITY, 2])
      assert.strictEqual(decoded.metrics.length, snapshot.metrics.length)
    }))
})
