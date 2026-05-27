import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"
import { describe, expect, test } from "tstyche"

describe("Bdd", () => {
  test("captures infer a named struct", () => {
    const qty = Bdd.capture("qty", Schema.NumberFromString)
    const sku = Bdd.capture("sku", Schema.String)

    Bdd.when`${qty} ${sku} are added`(({ qty, sku }, state: number) => {
      expect(qty).type.toBe<number>()
      expect(sku).type.toBe<string>()
      expect(state).type.toBe<number>()
      return Effect.succeed(state)
    })

    expect(Bdd.when`${qty} ${sku} are added`).type.not.toBeCallableWith(
      (_captures: { readonly qty: number; readonly missing: never }, state: number) => Effect.succeed(state)
    )

    Bdd.then`${qty} are added`((captures, state: number) => {
      expect(captures).type.not.toHaveProperty("missing")
      return Effect.succeed(state)
    })
  })

  test("feature state is stable across transitions", () => {
    const feature = Bdd.feature("Counter", { initial: 0 }).pipe(
      Bdd.given`zero`((_captures, state) => Effect.succeed(state)),
      Bdd.when`increment once`((_captures, state) => Effect.succeed(state + 1)),
      Bdd.when`increment twice`((_captures, state) => Effect.succeed(state + 1)),
      Bdd.when`increment three times`((_captures, state) => Effect.succeed(state + 1)),
      Bdd.when`increment four times`((_captures, state) => {
        expect(state).type.toBe<number>()
        return Effect.succeed(state + 1)
      })
    )

    expect(feature).type.toBe<Bdd.Feature<number, never, never>>()
  })

  test("docstrings infer the decoded schema type", () => {
    const Payload = Schema.Struct({
      sku: Schema.String,
      qty: Schema.Number
    })

    Bdd.when`the request body is:`(
      Bdd.docString(Schema.fromJsonString(Payload)),
      (_captures, payload, state: number) => {
        expect(payload).type.toBe<{ readonly sku: string; readonly qty: number }>()
        expect(state).type.toBe<number>()
        return Effect.succeed(state)
      }
    )
  })

  test("data tables infer readonly decoded row arrays", () => {
    const Item = Schema.Struct({
      sku: Schema.String,
      qty: Schema.NumberFromString
    })

    Bdd.when`the following items are added:`(
      Bdd.table(Item),
      (_captures, items, state: number) => {
        expect(items).type.toBe<ReadonlyArray<{ readonly sku: string; readonly qty: number }>>()
        expect(state).type.toBe<number>()
        return Effect.succeed(state)
      }
    )
  })

  test("step is keyword agnostic and feature accumulates errors and services", () => {
    interface Inventory {
      readonly _: unique symbol
    }

    const feature = Bdd.feature("Counter", { initial: 0 }).pipe(
      Bdd.step`zero`((_captures, state) => Effect.succeed(state)),
      Bdd.when`fail with service`((_captures, state) =>
        Effect.succeed(state) as Effect.Effect<number, "boom", Inventory>
      )
    )

    expect(feature).type.toBe<Bdd.Feature<number, "boom", Inventory>>()
  })

  test("step argument handlers reject the wrong decoded argument type", () => {
    const Payload = Schema.Struct({
      sku: Schema.String
    })

    expect(Bdd.when`the request body is:`).type.not.toBeCallableWith(
      Bdd.docString(Schema.fromJsonString(Payload)),
      (_captures: {}, _payload: { readonly sku: number }, state: number) => Effect.succeed(state)
    )
  })
})
