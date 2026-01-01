import { describe, it } from "@effect/vitest"
import { assertInclude, assertNone, assertUndefined, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Cause, Duration, Effect, Fiber, Layer, ServiceMap, Tracer } from "effect"
import { TestClock } from "effect/testing"
import type { Span } from "effect/Tracer"

describe("Tracer", () => {
  describe("Effect.withSpan", () => {
    it.effect("should capture the stack trace", () =>
      Effect.gen(function*() {
        const cause = yield* Effect.die(new Error("boom")).pipe(
          Effect.withSpan("C", {
            services: Tracer.DisablePropagation.serviceMap(true)
          }),
          Effect.sandbox,
          Effect.flip
        )

        assertInclude(Cause.pretty(cause), "Tracer.test.ts:12:18")
      }))

    it.effect("should set the parent span", () =>
      Effect.gen(function*() {
        const span = yield* Effect.currentSpan.pipe(
          Effect.withSpan("A"),
          Effect.withSpan("B")
        )

        strictEqual(span.name, "A")
        strictEqual((span.parent as Span)?.name, "B")
      }))

    it.effect("should override the parent span when root is set to true", () =>
      Effect.gen(function*() {
        const span = yield* Effect.currentSpan.pipe(
          Effect.withSpan("A", { root: true }),
          Effect.withSpan("B")
        )

        strictEqual(span.name, "A")
        assertUndefined(span.parent)
      }))

    it.effect("should set an external parent span", () =>
      Effect.gen(function*() {
        const span = yield* Effect.currentSpan.pipe(
          Effect.withSpan("A", {
            parent: {
              _tag: "ExternalSpan",
              spanId: "000",
              traceId: "111",
              sampled: true,
              services: ServiceMap.empty()
            }
          })
        )

        strictEqual(span.name, "A")
        strictEqual(span.parent?.spanId, "000")
      }))

    it.effect("should not set the parent span when none exists", () =>
      Effect.gen(function*() {
        const span = yield* Effect.withSpan(Effect.currentSpan, "A")

        strictEqual(span.name, "A")
        assertUndefined(span.parent)
        strictEqual(span.attributes.get("code.stacktrace"), undefined)
      }))

    it.effect("should set the correct start and end time", () =>
      Effect.gen(function*() {
        const spanFiber = yield* Effect.currentSpan.pipe(
          Effect.delay("1 second"),
          Effect.withSpan("A"),
          Effect.forkChild
        )

        yield* TestClock.adjust("2 seconds")

        const span = yield* Fiber.join(spanFiber)

        strictEqual(span.name, "A")
        strictEqual(span.status.startTime, 0n)
        strictEqual((span.status as any)["endTime"], 1000000000n)
        strictEqual(span.status._tag, "Ended")
      }))

    it.effect("should capture logs as span events", () =>
      Effect.gen(function*() {
        yield* TestClock.adjust(Duration.millis(0.01))

        const [span, fiberId] = yield* Effect.log("event").pipe(
          Effect.andThen(Effect.all([Effect.currentSpan, Effect.fiberId])),
          Effect.withSpan("A")
        )

        strictEqual(span.name, "A")
        assertUndefined(span.parent)
        deepStrictEqual((span as Tracer.NativeSpan).events, [
          ["event", 10_000n, {
            "effect.fiberId": fiberId,
            "effect.logLevel": "INFO"
          }]
        ])
      }))
  })

  describe("Effect.annotateSpans", () => {
    it.effect("should allow adding span attributes as key/value pairs", () =>
      Effect.gen(function*() {
        const span = yield* Effect.currentSpan.pipe(
          Effect.withSpan("A"),
          Effect.annotateSpans("key", "value")
        )

        strictEqual(span.name, "A")
        assertUndefined(span.parent)
        strictEqual(span.attributes.get("key"), "value")
      }))

    it.effect("should allow adding span attributes as a record", () =>
      Effect.gen(function*() {
        const span = yield* Effect.currentSpan.pipe(
          Effect.withSpan("A"),
          Effect.annotateSpans({
            key: "value",
            key2: "value2"
          })
        )

        strictEqual(span.attributes.get("key"), "value")
        strictEqual(span.attributes.get("key2"), "value2")
      }))
  })

  describe("Effect.useSpanScoped", () => {
    it.effect("should control span lifetimes with a scope", () =>
      Effect.gen(function*() {
        const span = yield* Effect.scoped(Effect.makeSpanScoped("A"))
        strictEqual(span.status._tag, "Ended")
        strictEqual(span.attributes.get("code.stacktrace"), undefined)
      }))
  })

  describe("Effect.annotateCurrentSpan", () => {
    it.effect("should allow adding attributes to the current span", () =>
      Effect.gen(function*() {
        yield* Effect.annotateCurrentSpan("key", "value")
        const span = yield* Effect.currentSpan
        strictEqual(span.attributes.get("key"), "value")
      }).pipe(Effect.withSpan("A")))
  })

  describe("Effect.withParentSpan", () => {
    it.effect("should allow setting the parent span for the current span", () =>
      Effect.gen(function*() {
        const span = yield* Effect.currentSpan
        strictEqual(span.parent?.spanId, "456")
      }).pipe(
        Effect.withSpan("A"),
        Effect.withParentSpan({
          _tag: "ExternalSpan",
          traceId: "123",
          spanId: "456",
          sampled: true,
          services: ServiceMap.empty()
        })
      ))
  })

  describe("Effect.withTracerEnabled", () => {
    it.effect("should allow enabling/disabling the tracer", () =>
      Effect.gen(function*() {
        const span = yield* Effect.currentSpan.pipe(
          Effect.withSpan("A"),
          Effect.withTracerEnabled(false)
        )
        const spanB = yield* Effect.currentSpan.pipe(
          Effect.withSpan("B"),
          Effect.withTracerEnabled(true)
        )

        strictEqual(span.name, "A")
        strictEqual(span.spanId, "noop")
        strictEqual(spanB.name, "B")
      }))
  })

  // TODO
  //   it.effect("linkSpans", () =>
  //     Effect.gen(function*() {
  //       const childA = yield* (Effect.makeSpan("childA"))
  //       const childB = yield* (Effect.makeSpan("childB"))
  //       const currentSpan = yield* pipe(
  //         Effect.currentSpan,
  //         Effect.withSpan("A", { links: [{ _tag: "SpanLink", span: childB, attributes: {} }] }),
  //         Effect.linkSpans(childA)
  //       )
  //       deepStrictEqual(
  //         currentSpan.links.map((_) => _.span),
  //         [childA, childB]
  //       )
  //     }))
  //
  // })
  //
  // describe("functionWithSpan", () => {
  //   const getSpan = Effect.functionWithSpan({
  //     body: (_id: string) => Effect.currentSpan,
  //     options: (id) => ({
  //       name: `span-${id}`,
  //       attributes: { id }
  //     })
  //   })
  //
  //   it.effect("no parent", () =>
  //     Effect.gen(function*() {
  //       const span = yield* getSpan("A")
  //       deepStrictEqual(span.name, "span-A")
  //       assertNone(span.parent)
  //       strictEqual(span.attributes.get("code.stacktrace"), undefined)
  //     }))
  //
  //   it.effect("parent", () =>
  //     Effect.gen(function*() {
  //       const span = yield* Effect.withSpan("B")(getSpan("A"))
  //       deepStrictEqual(span.name, "span-A")
  //       deepStrictEqual(Option.map(span.parent, (span) => (span as Span).name), Option.some("B"))
  //     }))
  //
  // it.effect("includes trace when errored", () =>
  //   Effect.gen(function*() {
  //     let maybeSpan: undefined | Span
  //     const getSpan = Effect.functionWithSpan({
  //       body: (_id: string) =>
  //         Effect.currentSpan.pipe(Effect.flatMap((span) => {
  //           maybeSpan = span
  //           return Effect.fail("error")
  //         })),
  //       options: (id) => ({
  //         name: `span-${id}`,
  //         attributes: { id }
  //       })
  //     })
  //     yield* Effect.flip(getSpan("fail"))
  //     assertTrue(maybeSpan !== undefined)
  //     assertInclude(maybeSpan!.attributes.get("code.stacktrace") as string, "Tracer.test.ts:22:26")
  //   }))
  // })
  //
  // it.effect("withTracerTiming false", () =>
  //   Effect.gen(function*() {
  //     yield* (TestClock.adjust(Duration.millis(1)))
  //
  //     const span = yield* pipe(
  //       Effect.withSpan("A")(Effect.currentSpan),
  //       Effect.withTracerTiming(false)
  //     )
  //
  //     deepStrictEqual(span.status.startTime, 0n)
  //   }))

  describe("Layer.parentSpan", () => {
    it.effect("should set the parent trace span for the layer constructor", () =>
      Effect.gen(function*() {
        const span = yield* Effect.makeSpan("child")
        const parent = span.parent as Tracer.Span
        strictEqual(parent?.name, "parent")
        strictEqual(span.attributes.get("code.stacktrace"), undefined)
        strictEqual(parent?.attributes.get("code.stacktrace"), undefined)
      }).pipe(Effect.provide(Layer.unwrap(
        Effect.map(
          Effect.makeSpanScoped("parent"),
          (span) => Layer.parentSpan(span)
        )
      ))))
  })

  describe("Layer.span", () => {
    it.effect("should create a new parent trace span for the layer constructor", () =>
      Effect.gen(function*() {
        const span = yield* Effect.makeSpan("child")
        const parent = span.parent as Tracer.Span
        strictEqual(parent.name, "parent")
        strictEqual(parent.attributes.get("code.stacktrace"), undefined)
      }).pipe(Effect.provide(Layer.span("parent"))))

    it.effect("should call onEnd when the span is ending", () =>
      Effect.gen(function*() {
        let onEndCalled = false
        const span = yield* Effect.currentSpan.pipe(
          Effect.provide(Layer.span("span", {
            onEnd: (span, _exit) =>
              Effect.sync(() => {
                strictEqual(span.name, "span")
                onEndCalled = true
              })
          }))
        )
        strictEqual(span.name, "span")
        strictEqual(onEndCalled, true)
      }))
  })

  describe("Layer.withSpan", () => {
    it.effect("sets the trace span for the layer constructor", () =>
      Effect.gen(function*() {
        let onEndCalled = false
        const layer = Layer.effectDiscard(Effect.gen(function*() {
          const span = yield* Effect.currentSpan
          strictEqual(span.name, "span")
          strictEqual(span.attributes.get("code.stacktrace"), undefined)
        })).pipe(Layer.withSpan("span", {
          onEnd: (span, _exit) =>
            Effect.sync(() => {
              strictEqual(span.name, "span")
              onEndCalled = true
            })
        }))

        const span = yield* Effect.currentSpan.pipe(
          Effect.provide(layer),
          Effect.option
        )

        assertNone(span)
        strictEqual(onEndCalled, true)
      }))
  })

  describe("Tracer.DisablePropagation", () => {
    it.effect("should allow disabling span propagation via noop spans", () =>
      Effect.gen(function*() {
        const span = yield* Effect.currentSpan.pipe(
          Effect.withSpan("A", {
            services: Tracer.DisablePropagation.serviceMap(true)
          })
        )
        const spanB = yield* Effect.currentSpan.pipe(
          Effect.withSpan("B")
        )

        strictEqual(span.name, "A")
        strictEqual(span.spanId, "noop")
        strictEqual(spanB.name, "B")
      }))

    it.effect("should prevent a span from being used as a parent span", () =>
      Effect.gen(function*() {
        const span = yield* Effect.currentSpan.pipe(
          Effect.withSpan("child"),
          Effect.withSpan("disabled", {
            services: Tracer.DisablePropagation.serviceMap(true)
          }),
          Effect.withSpan("parent")
        )
        strictEqual(span.name, "child")
        strictEqual(span.parent?._tag, "Span")
        strictEqual((span.parent as Span)?.name, "parent")
      }))
  })
})
