import * as NodeSdk from "@effect/opentelemetry/NodeSdk"
import { assert, describe, it } from "@effect/vitest"
import { InMemoryLogRecordExporter, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs"
import * as Effect from "effect/Effect"

describe("Logger", () => {
  describe("provided", () => {
    const exporter = new InMemoryLogRecordExporter()

    const TracingLive = NodeSdk.layer(Effect.sync(() => ({
      resource: {
        serviceName: "test"
      },
      logRecordProcessor: [new SimpleLogRecordProcessor(exporter)]
    })))

    it.effect("emits log records", () =>
      Effect.gen(function*() {
        yield* Effect.log("test").pipe(
          Effect.repeat({ times: 9 })
        )
        assert.lengthOf(exporter.getFinishedLogRecords(), 10)
      }).pipe(Effect.provide(TracingLive)))
  })

  describe("not provided", () => {
    const exporter = new InMemoryLogRecordExporter()

    const TracingLive = NodeSdk.layer(Effect.sync(() => ({
      resource: {
        serviceName: "test"
      }
    })))

    it.effect("withSpan", () =>
      Effect.gen(function*() {
        yield* Effect.log("test")
        assert.lengthOf(exporter.getFinishedLogRecords(), 0)
      }).pipe(Effect.provide(TracingLive)))
  })
})
