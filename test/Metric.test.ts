import * as Effect from "effect/Effect"
import * as Metric from "effect/Metric"
import { assert, describe, it } from "./utils/extend.js"

describe("Metric", () => {
  describe("Counter", () => {
    it.effect("testing", () =>
      Effect.gen(function*() {
        const counter = Metric.counter("hello").pipe(
          Metric.withConstantInput(1)
        )
        yield* counter(Effect.void)
        yield* Metric.withAttributes(counter, { foo: "bar" })(Effect.void)
        console.log(yield* Metric.value(counter))
        console.log(yield* Metric.value(Metric.withAttributes(counter, { foo: "bar" })))
        console.log(Metric.globalMetricRegistry)
      }))
  })
})
