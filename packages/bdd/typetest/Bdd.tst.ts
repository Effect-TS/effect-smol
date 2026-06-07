import { Bdd } from "@effect/bdd"
import type { AnyTransition, Transition } from "@effect/bdd/Bdd"
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

  test("captures require string encoded schemas", () => {
    expect(Bdd.capture).type.not.toBeCallableWith("qty", Schema.Number)
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
    expect(feature.transitions).type.toBe<ReadonlyArray<AnyTransition<number, never, never>>>()
  })

  test("features can contain transitions with different capture and argument shapes", () => {
    const qty = Bdd.capture("qty", Schema.NumberFromString)
    const Payload = Schema.Struct({
      sku: Schema.String
    })
    const Item = Schema.Struct({
      sku: Schema.String,
      qty: Schema.NumberFromString
    })

    const feature = Bdd.feature("Mixed", { initial: 0 }).pipe(
      Bdd.given`zero`((_captures, state) => Effect.succeed(state)),
      Bdd.when`add ${qty}`(({ qty }, state) => {
        expect(qty).type.toBe<number>()
        return Effect.succeed(state + qty)
      }),
      Bdd.when`the request body is:`(
        Bdd.docString(Schema.fromJsonString(Payload)),
        (_captures, payload, state) => {
          expect(payload).type.toBe<{ readonly sku: string }>()
          return Effect.succeed(state)
        }
      ),
      Bdd.when`the following items are added:`(
        Bdd.table(Item),
        (_captures, items, state) => {
          expect(items).type.toBe<ReadonlyArray<{ readonly sku: string; readonly qty: number }>>()
          return Effect.succeed(state + items.length)
        }
      )
    )

    expect(feature).type.toBe<Bdd.Feature<number, never, never>>()
    expect(feature.transitions).type.toBe<ReadonlyArray<AnyTransition<number, never, never>>>()
  })

  test("transition tracks capture and step argument types", () => {
    const qty = Bdd.capture("qty", Schema.NumberFromString)
    const Item = Schema.Struct({
      sku: Schema.String,
      qty: Schema.NumberFromString
    })

    const transition: Transition<
      number,
      never,
      never,
      { readonly qty: number },
      ReadonlyArray<{ readonly sku: string; readonly qty: number }>
    > = {
      kind: "When",
      expression: Bdd.when`add ${qty} items`.expression,
      argument: Bdd.table(Item),
      run: (captures, items, state) => {
        expect(captures.qty).type.toBe<number>()
        expect(items).type.toBe<ReadonlyArray<{ readonly sku: string; readonly qty: number }>>()
        expect(state).type.toBe<number>()
        return Effect.succeed(state + captures.qty + items.length)
      }
    }

    expect(transition).type.toBe<
      Transition<
        number,
        never,
        never,
        { readonly qty: number },
        ReadonlyArray<{ readonly sku: string; readonly qty: number }>
      >
    >()
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

  test("feature accumulates errors and services across given, when, and then", () => {
    interface Inventory {
      readonly _: unique symbol
    }
    interface Pricing {
      readonly _: unique symbol
    }

    const feature = Bdd.feature("Counter", { initial: 0 }).pipe(
      Bdd.given`zero`((_captures, state) => Effect.succeed(state) as Effect.Effect<number, "given failed", Inventory>),
      Bdd.when`increment`((_captures, state) =>
        Effect.succeed(state + 1) as Effect.Effect<number, "when failed", Pricing>
      ),
      Bdd.then`one`((_captures, state) => Effect.succeed(state) as Effect.Effect<number, "then failed">)
    )

    expect(feature).type.toBe<
      Bdd.Feature<number, "given failed" | "when failed" | "then failed", Inventory | Pricing>
    >()
  })

  test("run returns a report with run errors and feature services", () => {
    interface Inventory {
      readonly _: unique symbol
    }

    const feature = Bdd.feature("Counter", { initial: 0 }).pipe(
      Bdd.when`needs inventory`((_captures, state) => Effect.succeed(state) as Effect.Effect<number, never, Inventory>)
    )

    expect(Bdd.run(feature, "Feature: Counter")).type.toBe<
      Effect.Effect<Bdd.Report, Bdd.RunError, Inventory | Bdd.GherkinCompiler>
    >()
  })

  test("step argument handlers reject the wrong decoded argument type", () => {
    const Payload = Schema.Struct({
      sku: Schema.String
    })
    const Item = Schema.Struct({
      sku: Schema.String,
      qty: Schema.NumberFromString
    })

    expect(Bdd.when`the request body is:`).type.not.toBeCallableWith(
      Bdd.docString(Schema.fromJsonString(Payload)),
      (_captures: {}, _payload: { readonly sku: number }, state: number) => Effect.succeed(state)
    )

    expect(Bdd.when`the following items are added:`).type.not.toBeCallableWith(
      Bdd.table(Item),
      (_captures: {}, _items: ReadonlyArray<{ readonly sku: string; readonly qty: string }>, state: number) =>
        Effect.succeed(state)
    )
  })

  test("no-argument step handlers reject accidental step arguments", () => {
    expect(Bdd.when`increment`).type.not.toBeCallableWith(
      (_captures: {}, _argument: string, state: number) => Effect.succeed(state)
    )
  })
})
