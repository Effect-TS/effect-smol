import { assert, describe, it } from "@effect/vitest"
import { Context, Duration, Effect, Layer, Reloadable, Schedule } from "effect"
import { TestClock } from "effect/testing"
import * as Counter from "./utils/counter.ts"

class DummyService extends Context.Service<DummyService, {
  readonly id: number
}>()("effect/test/Reloadable/DummyService") {}

class ReloadDelay extends Context.Service<ReloadDelay, number>()("effect/test/Reloadable/ReloadDelay") {}

const makeLayer = (counter: Effect.Success<ReturnType<typeof Counter.make>>) =>
  Layer.effect(DummyService)(Effect.map(counter.acquire(), (id) => ({ id })))

describe("Reloadable", () => {
  it.effect("initialization", () =>
    Effect.gen(function*() {
      const counter = yield* Counter.make()
      const layer = Reloadable.manual(DummyService, {
        layer: makeLayer(counter)
      })

      const service = yield* Reloadable.get(DummyService).pipe(Effect.provide(layer))

      assert.strictEqual(service.id, 1)
      assert.strictEqual(yield* counter.acquired(), 1)
      assert.strictEqual(yield* counter.released(), 1)
    }))

  it.effect("reload", () =>
    Effect.gen(function*() {
      const counter = yield* Counter.make()
      const layer = Reloadable.manual(DummyService, {
        layer: makeLayer(counter)
      })

      const result = yield* Effect.gen(function*() {
        const before = yield* Reloadable.get(DummyService)
        yield* Reloadable.reload(DummyService)
        const after = yield* Reloadable.get(DummyService)
        return [before.id, after.id] as const
      }).pipe(Effect.provide(layer))

      assert.deepStrictEqual(result, [1, 2])
      assert.strictEqual(yield* counter.acquired(), 2)
      assert.strictEqual(yield* counter.released(), 2)
    }))

  it.effect("auto", () =>
    Effect.gen(function*() {
      const counter = yield* Counter.make()
      const layer = Reloadable.auto(DummyService, {
        layer: makeLayer(counter),
        schedule: Schedule.spaced(Duration.millis(4))
      })

      const result = yield* Effect.gen(function*() {
        const before = yield* Reloadable.get(DummyService)
        yield* TestClock.adjust(Duration.millis(5))
        const after = yield* Reloadable.get(DummyService)
        return [before.id, after.id] as const
      }).pipe(Effect.provide(layer))

      assert.deepStrictEqual(result, [1, 2])
      assert.strictEqual(yield* counter.acquired(), 2)
    }))

  it.effect("autoFromConfig", () =>
    Effect.gen(function*() {
      const counter = yield* Counter.make()
      const serviceLayer = Layer.effect(DummyService)(Effect.gen(function*() {
        yield* ReloadDelay
        const id = yield* counter.acquire()
        return { id }
      }))
      const layer = Reloadable.autoFromConfig(DummyService, {
        layer: serviceLayer,
        scheduleFromConfig: (context) => Schedule.spaced(Duration.millis(Context.get(context, ReloadDelay)))
      }).pipe(Layer.provide(Layer.succeed(ReloadDelay, 4)))

      const result = yield* Effect.gen(function*() {
        const before = yield* Reloadable.get(DummyService)
        yield* TestClock.adjust(Duration.millis(5))
        const after = yield* Reloadable.get(DummyService)
        return [before.id, after.id] as const
      }).pipe(Effect.provide(layer))

      assert.deepStrictEqual(result, [1, 2])
      assert.strictEqual(yield* counter.acquired(), 2)
    }))
})
