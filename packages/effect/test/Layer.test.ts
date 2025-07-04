import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as ServiceMap from "effect/ServiceMap"

describe("Layer", () => {
  it.effect("layers can be acquired in parallel", () =>
    Effect.gen(function*() {
      const BoolTag = ServiceMap.Key<boolean>("boolean")
      const latch = Effect.unsafeMakeLatch()
      const layer1 = Layer.effectServices<never, never, never>(Effect.never)
      const layer2 = Layer.effectServices(
        Effect.acquireRelease(
          latch.open.pipe(
            Effect.map((bool) => ServiceMap.make(BoolTag, bool))
          ),
          () => Effect.void
        )
      )
      const env = layer1.pipe(Layer.merge(layer2), Layer.build)
      const fiber = yield* Effect.forkDaemon(Effect.scoped(env))
      yield* latch.await
      const result = yield* Fiber.interrupt(fiber)
      assert.isUndefined(result)
    }))

  it.effect("sharing with merge", () =>
    Effect.gen(function*() {
      const array: Array<string> = []
      const layer = makeLayer1(array)
      const env = layer.pipe(Layer.merge(layer), Layer.build)
      yield* Effect.scoped(env)
      assert.deepStrictEqual(array, [acquire1, release1])
    }))

  it.effect("sharing itself with merge", () =>
    Effect.gen(function*() {
      const service1 = new Service1()
      const layer = Layer.succeed(Service1Tag, service1)
      const env = layer.pipe(Layer.merge(layer), Layer.merge(layer), Layer.build)
      const result = yield* env.pipe(
        Effect.map((context) => ServiceMap.get(context, Service1Tag))
      )
      assert.strictEqual(result, service1)
    }))

  it.effect("finalizers", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer1 = makeLayer1(arr)
      const layer2 = makeLayer2(arr)
      const env = layer1.pipe(Layer.merge(layer2), Layer.build)
      yield* Effect.scoped(env)
      assert.isDefined(arr.slice(0, 2).find((s) => s === acquire1))
      assert.isDefined(arr.slice(0, 2).find((s) => s === acquire2))
      assert.isDefined(arr.slice(2, 4).find((s) => s === release1))
      assert.isDefined(arr.slice(2, 4).find((s) => s === release2))
    }))

  it.effect("catch - uses an alternative layer", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer1 = makeLayer1(arr)
      const layer2 = makeLayer2(arr)
      const env = Layer.discard(Effect.fail("failed!")).pipe(
        Layer.provideMerge(layer1),
        Layer.catch(() => layer2),
        Layer.build
      )
      yield* Effect.scoped(env)
      assert.deepStrictEqual(arr, [acquire1, release1, acquire2, release2])
    }))

  it.effect("fresh with merge", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer = makeLayer1(arr)
      const env = layer.pipe(Layer.merge(Layer.fresh(layer)), Layer.build)
      yield* Effect.scoped(env)
      assert.deepStrictEqual(arr, [acquire1, acquire1, release1, release1])
    }))

  it.effect("fresh with provide", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer = makeLayer1(arr)
      const env = Layer.fresh(layer).pipe(
        Layer.provide(layer),
        Layer.build
      )
      yield* Effect.scoped(env)
      assert.deepStrictEqual(arr, [acquire1, acquire1, release1, release1])
    }))

  it.effect("with multiple layers", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer = makeLayer1(arr)
      const env = layer.pipe(
        Layer.merge(layer),
        Layer.merge(layer.pipe(Layer.merge(layer), Layer.fresh)),
        Layer.build
      )
      yield* Effect.scoped(env)
      assert.deepStrictEqual(arr, [acquire1, acquire1, release1, release1])
    }))
  it.effect("with identical fresh layers", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer1 = makeLayer1(arr)
      const layer2 = makeLayer2(arr)
      const layer3 = makeLayer3(arr)
      const env = layer2.pipe(
        Layer.merge(
          layer3.pipe(
            Layer.provide(layer1),
            Layer.fresh
          )
        ),
        Layer.provide(Layer.fresh(layer1)),
        Layer.build
      )
      yield* Effect.scoped(env)
      assert.deepStrictEqual(arr, [
        acquire1,
        acquire2,
        acquire1,
        acquire3,
        release3,
        release1,
        release2,
        release1
      ])
    }))
  it.effect("interruption with merge", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer1 = makeLayer1(arr)
      const layer2 = makeLayer2(arr)
      const env = layer1.pipe(Layer.merge(layer2), Layer.build)
      const fiber = yield* Effect.fork(Effect.scoped(env))
      yield* Fiber.interrupt(fiber)
      if (arr.find((s) => s === acquire1) !== undefined) {
        assert.isTrue(arr.some((s) => s === release1))
      }
      if (arr.find((s) => s === acquire2) !== undefined) {
        assert.isTrue(arr.some((s) => s === release2))
      }
    }))
  it.effect("interruption with provide", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer1 = makeLayer1(arr)
      const layer2 = makeLayer2(arr)
      const env = layer2.pipe(Layer.provide(layer1), Layer.build)
      const fiber = yield* Effect.fork(Effect.scoped(env))
      yield* Fiber.interrupt(fiber)
      if (arr.find((s) => s === acquire1) !== undefined) {
        assert.isTrue(arr.some((s) => s === release1))
      }
      if (arr.find((s) => s === acquire2) !== undefined) {
        assert.isTrue(arr.some((s) => s === release2))
      }
    }))
  it.effect("interruption with multiple layers", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer1 = makeLayer1(arr)
      const layer2 = makeLayer2(arr)
      const layer3 = makeLayer3(arr)
      const env = layer3.pipe(
        Layer.provide(layer1),
        Layer.merge(layer2),
        Layer.provide(layer1),
        Layer.build
      )
      const fiber = yield* Effect.fork(Effect.scoped(env))
      yield* Fiber.interrupt(fiber)
      if (arr.find((s) => s === acquire1) !== undefined) {
        assert.isTrue(arr.some((s) => s === release1))
      }
      if (arr.find((s) => s === acquire2) !== undefined) {
        assert.isTrue(arr.some((s) => s === release2))
      }
      if (arr.find((s) => s === acquire3) !== undefined) {
        assert.isTrue(arr.some((s) => s === release3))
      }
    }))

  it.effect("finalizers with provide", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer1 = makeLayer1(arr)
      const layer2 = makeLayer2(arr)
      const env = layer2.pipe(Layer.provide(layer1), Layer.build)
      yield* Effect.scoped(env)
      assert.deepStrictEqual(arr, [acquire1, acquire2, release2, release1])
    }))

  it.effect("finalizers with multiple layers with provideTo", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer1 = makeLayer1(arr)
      const layer2 = makeLayer2(arr)
      const layer3 = makeLayer3(arr)
      const env = layer3.pipe(Layer.provide(layer2), Layer.provide(layer1), Layer.build)
      yield* Effect.scoped(env)
      assert.deepStrictEqual(arr, [acquire1, acquire2, acquire3, release3, release2, release1])
    }))

  it.effect("orDie does not interfere with sharing", () =>
    Effect.gen(function*() {
      const arr: Array<string> = []
      const layer1 = makeLayer1(arr)
      const layer2 = makeLayer2(arr)
      const layer3 = makeLayer3(arr)
      const env = layer3.pipe(
        Layer.provide(layer1),
        Layer.provide(layer2),
        Layer.provide(Layer.orDie(layer1)),
        Layer.build
      )
      yield* Effect.scoped(env)
      assert.strictEqual(arr[0], acquire1)
      assert.isTrue(arr.slice(1, 3).some((s) => s === acquire2))
      assert.isTrue(arr.slice(1, 3).some((s) => s === acquire3))
      assert.isTrue(arr.slice(3, 5).some((s) => s === release3))
      assert.isTrue(arr.slice(3, 5).some((s) => s === release2))
      assert.strictEqual(arr[5], release1)
    }))

  describe("mock", () => {
    it.effect("allows passing partial service", () =>
      Effect.gen(function*() {
        class Service1 extends Context.Tag<Service1, {
          one: Effect.Effect<number>
          two(): Effect.Effect<number>
        }>()("Service1") {}
        yield* Effect.gen(function*() {
          const service = yield* Service1
          assert.strictEqual(yield* service.one, 123)
          yield* service.two().pipe(
            Effect.catchDefect(Effect.fail),
            Effect.flip
          )
        }).pipe(
          Effect.provide(Layer.mock(Service1, {
            one: Effect.succeed(123)
          }))
        )
      }))
  })

  describe("MemoMap", () => {
    it.effect("memoizes layer across builds", () =>
      Effect.gen(function*() {
        const arr: Array<string> = []
        const layer1 = makeLayer1(arr)
        const layer2 = makeLayer2(arr).pipe(
          Layer.provide(layer1)
        )
        const memoMap = Layer.unsafeMakeMemoMap()
        const scope1 = yield* Scope.make()
        const scope2 = yield* Scope.make()

        yield* Layer.buildWithMemoMap(layer1, memoMap, scope1)
        yield* Layer.buildWithMemoMap(layer2, memoMap, scope2)
        yield* Scope.close(scope2, Exit.void)
        yield* Layer.buildWithMemoMap(layer2, memoMap, scope1)
        yield* Scope.close(scope1, Exit.void)

        assert.deepStrictEqual(arr, [acquire1, acquire2, release2, acquire2, release2, release1])
      }))

    it.effect("layers are not released early", () =>
      Effect.gen(function*() {
        const arr: Array<string> = []
        const layer1 = makeLayer1(arr)
        const layer2 = makeLayer2(arr).pipe(
          Layer.provide(layer1)
        )
        const memoMap = Layer.unsafeMakeMemoMap()
        const scope1 = yield* Scope.make()
        const scope2 = yield* Scope.make()

        yield* Layer.buildWithMemoMap(layer1, memoMap, scope1)
        yield* Layer.buildWithMemoMap(layer2, memoMap, scope2)
        yield* Scope.close(scope1, Exit.void)
        yield* Scope.close(scope2, Exit.void)

        assert.deepStrictEqual(arr, [acquire1, acquire2, release2, release1])
      }))
  })
})

const acquire1 = "Acquiring Module 1"
const acquire2 = "Acquiring Module 2"
const acquire3 = "Acquiring Module 3"
const release1 = "Releasing Module 1"
const release2 = "Releasing Module 2"
const release3 = "Releasing Module 3"

export class Service1 {
  one(): Effect.Effect<number> {
    return Effect.succeed(1)
  }
}
const Service1Tag = ServiceMap.Key<Service1>("Service1")
const makeLayer1 = (array: Array<string>): Layer.Layer<Service1> => {
  return Layer.effect(
    Service1Tag,
    Effect.acquireRelease(
      Effect.sync(() => {
        array.push(acquire1)
        return new Service1()
      }),
      () => Effect.sync(() => array.push(release1))
    )
  )
}
class Service2 {
  two(): Effect.Effect<number> {
    return Effect.succeed(2)
  }
}
const Service2Tag = ServiceMap.Key<Service2>("Service2")
const makeLayer2 = (array: Array<string>): Layer.Layer<Service2> => {
  return Layer.effect(
    Service2Tag,
    Effect.acquireRelease(
      Effect.sync(() => {
        array.push(acquire2)
        return new Service2()
      }),
      () => Effect.sync(() => array.push(release2))
    )
  )
}
class Service3 {
  three(): Effect.Effect<number> {
    return Effect.succeed(3)
  }
}
const Service3Tag = ServiceMap.Key<Service3>("Service3")
const makeLayer3 = (array: Array<string>): Layer.Layer<Service3> => {
  return Layer.effect(
    Service3Tag,
    Effect.acquireRelease(
      Effect.sync(() => {
        array.push(acquire3)
        return new Service3()
      }),
      () => Effect.sync(() => array.push(release3))
    )
  )
}
