import { assert, describe, it } from "@effect/vitest"
import { Effect, MutableRef } from "effect"
import * as DevToolsClient from "effect/unstable/devtools/DevToolsClient"
import type * as DevToolsSchema from "effect/unstable/devtools/DevToolsSchema"

describe("DevToolsClient", () => {
  it.effect("makeTracer forwards span lifecycle", () =>
    Effect.gen(function*() {
      const captured = MutableRef.make<ReadonlyArray<DevToolsSchema.Span | DevToolsSchema.SpanEvent>>([])
      const client = DevToolsClient.DevToolsClient.of({
        unsafeAddSpan: (span) => {
          MutableRef.update(captured, (spans) => [...spans, span])
        }
      })

      const tracer = yield* DevToolsClient.makeTracer.pipe(
        Effect.provideService(DevToolsClient.DevToolsClient, client)
      )

      yield* Effect.gen(function*() {
        const span = yield* Effect.currentSpan
        span.event("event", span.status.startTime, { ok: true })
      }).pipe(
        Effect.withSpan("test-span"),
        Effect.withTracer(tracer)
      )

      const spans = MutableRef.get(captured)
      assert.strictEqual(spans.length, 3)

      const [started, event, ended] = spans
      if (started._tag !== "Span") {
        assert.fail(`Expected Span, got ${started._tag}`)
      }
      assert.strictEqual(started.status._tag, "Started")

      assert.strictEqual(event._tag, "SpanEvent")
      assert.strictEqual(event.name, "event")

      if (ended._tag !== "Span") {
        assert.fail(`Expected Span, got ${ended._tag}`)
      }
      assert.strictEqual(ended.status._tag, "Ended")
      assert.strictEqual(ended.spanId, started.spanId)
    }))
})
