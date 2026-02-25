/**
 * @title Setting up tracing with Otlp modules
 *
 * Configure Otlp tracing + log export with a reusable observability layer.
 */
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { OtlpLogger, OtlpSerialization, OtlpTracer } from "effect/unstable/observability"

// Configure OTLP span export.
export const OtlpTracingLive = OtlpTracer.layer({
  url: "http://localhost:4318/v1/traces",
  resource: {
    serviceName: "checkout-api",
    serviceVersion: "1.0.0",
    attributes: {
      "deployment.environment": "staging"
    }
  }
})

// Configure OTLP log export.
export const OtlpLoggingLive = OtlpLogger.layer({
  url: "http://localhost:4318/v1/logs",
  resource: {
    serviceName: "checkout-api",
    serviceVersion: "1.0.0"
  }
})

// Reusable app-wide observability layer.
//
// - OtlpTracer/OtlpLogger require an OTLP serializer and an HttpClient.
// - FetchHttpClient.layer provides the HttpClient used by the exporter.
export const ObservabilityLive = Layer.merge(OtlpTracingLive, OtlpLoggingLive).pipe(
  Layer.provide(OtlpSerialization.layerJson),
  Layer.provide(FetchHttpClient.layer)
)

export const processCheckout = Effect.fn("Checkout.processCheckout")(function*(orderId: string) {
  yield* Effect.logInfo("starting checkout", { orderId })

  yield* Effect.sleep("50 millis").pipe(
    Effect.withSpan("checkout.charge-card"),
    Effect.annotateSpans({
      "checkout.order_id": orderId,
      "checkout.provider": "acme-pay"
    })
  )

  yield* Effect.sleep("20 millis").pipe(
    Effect.withSpan("checkout.persist-order")
  )

  yield* Effect.logInfo("checkout completed", { orderId })
})

export const tracedProgram = processCheckout("ord_123").pipe(
  Effect.withSpan("checkout.operation"),
  Effect.provide(ObservabilityLive)
)
