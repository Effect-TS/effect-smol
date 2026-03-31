import { it, layer, type TestContext } from "@effect/vitest"
import { Effect, Layer, Scope, ServiceMap } from "effect"
import { describe, expect, it as test } from "tstyche"

class Foo extends ServiceMap.Service<Foo, "foo">()("Foo") {}
class Bar extends ServiceMap.Service<Bar, "bar">()("Bar") {}

describe("layer", () => {
  test("top-level export accepts full options", () => {
    expect(layer).type.toBeCallableWith(Layer.succeed(Foo, "foo"), {
      timeout: "5 seconds",
      excludeTestServices: true,
      memoMap: undefined as any
    })
  })

  test("top-level export accepts no options", () => {
    expect(layer).type.toBeCallableWith(Layer.succeed(Foo, "foo"))
  })

  test("it.layer accepts full options", () => {
    expect(it.layer).type.toBeCallableWith(Layer.succeed(Foo, "foo"), {
      timeout: "5 seconds",
      excludeTestServices: true,
      memoMap: undefined as any
    })
  })

  test("it.layer accepts no options", () => {
    expect(it.layer).type.toBeCallableWith(Layer.succeed(Foo, "foo"))
  })

  test("nested it.layer accepts timeout", () => {
    layer(Layer.succeed(Foo, "foo"))((it) => {
      expect(it.layer).type.toBeCallableWith(Layer.succeed(Bar, "bar"), {
        timeout: "3 seconds"
      })
    })
  })

  test("nested it.layer rejects excludeTestServices", () => {
    layer(Layer.succeed(Foo, "foo"))((it) => {
      expect(it.layer).type.not.toBeCallableWith(Layer.succeed(Bar, "bar"), {
        excludeTestServices: true
      })
    })
  })

  test("nested it.layer rejects memoMap", () => {
    layer(Layer.succeed(Foo, "foo"))((it) => {
      expect(it.layer).type.not.toBeCallableWith(Layer.succeed(Bar, "bar"), {
        memoMap: undefined as any
      })
    })
  })

  test("layer helper exposes effectful hooks", () => {
    layer(Layer.succeed(Foo, "foo"))((it) => {
      expect(it.beforeEach).type.toBeCallableWith(
        (_ctx: TestContext) => Effect.succeed("ok"),
        "1 second"
      )
      expect(it.afterEach).type.toBeCallableWith(
        (_ctx: TestContext) => Effect.void,
        1_000
      )
      expect(it.beforeAll).type.toBeCallableWith(
        Scope.make(),
        "1 second"
      )
      expect(it.afterAll).type.toBeCallableWith(
        Effect.succeed(1)
      )
    })
  })
})
