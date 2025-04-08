import * as Effect from "effect/Effect"
import * as Metric from "effect/Metric"
import * as String from "effect/String"
import { assert, describe, it } from "./utils/extend.js"

const attributes = { x: "a", y: "b" }

describe("Metric", () => {
  it.effect("should be referentially transparent", () =>
    Effect.gen(function*() {
      const id = nextId()
      const counter1 = Metric.counter(id).pipe(
        Metric.withAttributes(attributes),
        Metric.withConstantInput(1)
      )
      const counter2 = Metric.counter(id).pipe(
        Metric.withAttributes(attributes),
        Metric.withConstantInput(1)
      )
      const counter3 = Metric.counter(id).pipe(
        Metric.withAttributes({ z: "c" }),
        Metric.withConstantInput(1)
      )
      yield* counter1(Effect.void)
      yield* counter2(Effect.void)
      yield* counter3(Effect.void)
      const result1 = yield* Metric.value(counter1)
      const result2 = yield* Metric.value(counter2)
      const result3 = yield* Metric.value(counter3)
      assert.deepStrictEqual(result1, { count: 2 })
      assert.deepStrictEqual(result2, { count: 2 })
      assert.deepStrictEqual(result3, { count: 1 })
    }))

  it.effect("should dump the current state of all metrics", () =>
    Effect.gen(function*() {
      const counter1 = Metric.counter("counter").pipe(
        Metric.withAttributes(attributes),
        Metric.withConstantInput(1)
      )
      const counter2 = Metric.counter("counter").pipe(
        Metric.withAttributes(attributes),
        Metric.withConstantInput(1)
      )
      const counter3 = Metric.counter("counter").pipe(
        Metric.withAttributes({ z: "c" }),
        Metric.withConstantInput(1)
      )
      yield* counter1(Effect.void)
      yield* counter2(Effect.void)
      yield* counter3(Effect.void)

      const result = yield* Metric.dump
      const expected = String.stripMargin(
        `|name=counter  type=Counter  attributes=[x: a, y: b]  state=[count: [2]]
         |name=counter  type=Counter  attributes=[z: c]        state=[count: [1]]`
      )

      assert.strictEqual(result, expected)
    }).pipe(Effect.provideService(Metric.CurrentMetricRegistry, new Map())))

  describe("Counter", () => {
    it.effect("custom increment with value", () =>
      Effect.gen(function*() {
        const id = nextId()
        const counter = Metric.counter(id).pipe(
          Metric.withAttributes(attributes)
        )
        yield* counter(Effect.succeed(1))
        yield* counter(Effect.succeed(2))
        const result = yield* Metric.value(counter)
        assert.deepStrictEqual(result, { count: 3 })
      }))

    it.effect("custom increment with constant", () =>
      Effect.gen(function*() {
        const id = nextId()
        const counter = Metric.counter(id).pipe(
          Metric.withAttributes(attributes),
          Metric.withConstantInput(1)
        )
        yield* counter(Effect.succeed(1))
        yield* counter(Effect.succeed(2))
        const result = yield* Metric.value(counter)
        assert.deepStrictEqual(result, { count: 2 })
      }))

    it.effect("custom decrement with value", () =>
      Effect.gen(function*() {
        const id = nextId()
        const counter = Metric.counter(id).pipe(
          Metric.withAttributes(attributes)
        )
        yield* counter(Effect.succeed(-1))
        yield* counter(Effect.succeed(-2))
        const result = yield* Metric.value(counter)
        assert.deepStrictEqual(result, { count: -3 })
      }))

    it.effect("custom decrement with constant", () =>
      Effect.gen(function*() {
        const id = nextId()
        const counter = Metric.counter(id).pipe(
          Metric.withAttributes(attributes),
          Metric.withConstantInput(-1)
        )
        yield* counter(Effect.succeed(1))
        yield* counter(Effect.succeed(2))
        const result = yield* Metric.value(counter)
        assert.deepStrictEqual(result, { count: -2 })
      }))

    it.effect("custom increment with bigint value", () =>
      Effect.gen(function*() {
        const id = nextId()
        const counter = Metric.counter(id, { bigint: true }).pipe(
          Metric.withAttributes(attributes)
        )
        yield* counter(Effect.succeed(BigInt(1)))
        yield* counter(Effect.succeed(BigInt(2)))
        const result = yield* Metric.value(counter)
        assert.deepStrictEqual(result, { count: BigInt(3) })
      }))

    it.effect("custom increment with bigint constant", () =>
      Effect.gen(function*() {
        const id = nextId()
        const counter = Metric.counter(id, { bigint: true }).pipe(
          Metric.withAttributes(attributes),
          Metric.withConstantInput(BigInt(1))
        )
        yield* counter(Effect.succeed(BigInt(1)))
        yield* counter(Effect.succeed(BigInt(2)))
        const result = yield* Metric.value(counter)
        assert.deepStrictEqual(result, { count: BigInt(2) })
      }))

    it.effect("custom decrement with bigint value", () =>
      Effect.gen(function*() {
        const id = nextId()
        const counter = Metric.counter(id, { bigint: true }).pipe(
          Metric.withAttributes(attributes)
        )
        yield* counter(Effect.succeed(BigInt(-1)))
        yield* counter(Effect.succeed(BigInt(-2)))
        const result = yield* Metric.value(counter)
        assert.deepStrictEqual(result, { count: BigInt(-3) })
      }))

    it.effect("custom decrement with bigint constant", () =>
      Effect.gen(function*() {
        const id = nextId()
        const counter = Metric.counter(id, { bigint: true }).pipe(
          Metric.withAttributes(attributes),
          Metric.withConstantInput(BigInt(-1))
        )
        yield* counter(Effect.succeed(BigInt(-1)))
        yield* counter(Effect.succeed(BigInt(-2)))
        const result = yield* Metric.value(counter)
        assert.deepStrictEqual(result, { count: BigInt(-2) })
      }))

    it.effect("fails to decrement incremental counter", () =>
      Effect.gen(function*() {
        const id = nextId()
        const counter = Metric.counter(id, { incremental: true }).pipe(
          Metric.withAttributes(attributes),
          Metric.withConstantInput(-1)
        )
        yield* counter(Effect.succeed(-1))
        yield* counter(Effect.succeed(-2))
        const result = yield* Metric.value(counter)
        assert.deepStrictEqual(result, { count: 0 })
      }))

    it.effect("fails to decrement incremental bigint counter", () =>
      Effect.gen(function*() {
        const id = nextId()
        const counter = Metric.counter(id, { bigint: true, incremental: true }).pipe(
          Metric.withAttributes(attributes),
          Metric.withConstantInput(BigInt(-1))
        )
        yield* counter(Effect.succeed(BigInt(-1)))
        yield* counter(Effect.succeed(BigInt(-2)))
        const result = yield* Metric.value(counter)
        assert.deepStrictEqual(result, { count: BigInt(0) })
      }))
  })
})

let idCounter = 0
function nextId() {
  return `metric-${++idCounter}`
}
