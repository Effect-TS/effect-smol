import { Bdd } from "@effect/bdd"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

type Cart = {
  readonly items: ReadonlyArray<{
    readonly sku: string
    readonly qty: number
    readonly price: number
  }>
}

const emptyCart: Cart = { items: [] }

const addItem = (cart: Cart, sku: string, qty: number, price: number): Cart => ({
  items: [...cart.items, { sku, qty, price }]
})

const totalOf = (cart: Cart): number => cart.items.reduce((sum, item) => sum + item.qty * item.price, 0)

describe("runner", () => {
  it.effect("runs a feature definition with immutable state", () => {
    const qty = Bdd.capture("qty", Schema.NumberFromString)
    const sku = Bdd.capture("sku", Schema.String)
    const price = Bdd.capture("price", Schema.NumberFromString)
    const expected = Bdd.capture("expected", Schema.NumberFromString)

    const cart = Bdd.feature("Shopping cart", { initial: emptyCart }).pipe(
      Bdd.given`an empty cart`(() => Effect.succeed(emptyCart)),
      Bdd.when`${qty} ${sku} are added at ${price} each`(
        ({ qty, sku, price }, state) => Effect.succeed(addItem(state, sku, qty, price))
      ),
      Bdd.then`the cart total is ${expected}`(({ expected }, state) =>
        Effect.sync(() => {
          assert.strictEqual(totalOf(state), expected)
          return state
        })
      )
    )

    return Effect.gen(function*() {
      const report = yield* Bdd.run(
        cart,
        `
Feature: Shopping cart

  Scenario: Adding items computes the total
    Given an empty cart
    When 2 book are added at 21 each
    Then the cart total is 42
`
      )

      assert.strictEqual(report.feature, "Shopping cart")
      assert.deepStrictEqual(report.scenarios, [{ name: "Adding items computes the total", steps: 3, tags: [] }])
    })
  })

  it.effect("decodes data tables", () => {
    const Item = Schema.Struct({
      sku: Schema.String,
      qty: Schema.NumberFromString,
      price: Schema.NumberFromString
    })
    const expected = Bdd.capture("expected", Schema.NumberFromString)

    const cart = Bdd.feature("Shopping cart", { initial: emptyCart }).pipe(
      Bdd.given`an empty cart`(() => Effect.succeed(emptyCart)),
      Bdd.when`the following items are added:`(
        Bdd.table(Item),
        (_captures, items, state) =>
          Effect.succeed(items.reduce((cart, item) => addItem(cart, item.sku, item.qty, item.price), state))
      ),
      Bdd.then`the cart total is ${expected}`(({ expected }, state) =>
        Effect.sync(() => {
          assert.strictEqual(totalOf(state), expected)
          return state
        })
      )
    )

    return Bdd.run(
      cart,
      `
Feature: Shopping cart

  Scenario: Adding multiple items computes the total
    Given an empty cart
    When the following items are added:
      | sku      | qty | price |
      | book     | 2   | 21    |
      | notebook | 3   | 5     |
    Then the cart total is 57
`
    )
  })

  it.effect("fails when a step is missing", () => {
    const cart = Bdd.feature("Shopping cart", { initial: emptyCart }).pipe(
      Bdd.given`an empty cart`(() => Effect.succeed(emptyCart))
    )

    return Effect.gen(function*() {
      const result = yield* Effect.exit(Bdd.run(
        cart,
        `
Feature: Shopping cart

  Scenario: Missing transition
    Given an empty cart
    Then the cart total is 0
`
      ))

      assert.strictEqual(result._tag, "Failure")
    })
  })

  it.effect("runs background steps and inherits And / But keywords", () => {
    const qty = Bdd.capture("qty", Schema.NumberFromString)
    const sku = Bdd.capture("sku", Schema.String)
    const price = Bdd.capture("price", Schema.NumberFromString)
    const expected = Bdd.capture("expected", Schema.NumberFromString)

    const cart = Bdd.feature("Shopping cart", { initial: emptyCart }).pipe(
      Bdd.given`an empty cart`(() => Effect.succeed(emptyCart)),
      Bdd.when`${qty} ${sku} are added at ${price} each`(
        ({ qty, sku, price }, state) => Effect.succeed(addItem(state, sku, qty, price))
      ),
      Bdd.then`the cart total is ${expected}`(({ expected }, state) =>
        Effect.sync(() => {
          assert.strictEqual(totalOf(state), expected)
          return state
        })
      ),
      Bdd.then`no duplicate charge is made`((_captures, state) => Effect.succeed(state))
    )

    return Effect.gen(function*() {
      const report = yield* Bdd.run(
        cart,
        `
@checkout
Feature: Shopping cart

  Background:
    Given an empty cart

  @happy-path
  Scenario: Adding items computes the total
    When 2 book are added at 21 each
    And 1 pen are added at 15 each
    Then the cart total is 57
    But no duplicate charge is made
`
      )

      assert.deepStrictEqual(report.scenarios, [{
        name: "Adding items computes the total",
        steps: 5,
        tags: ["@checkout", "@happy-path"]
      }])
    })
  })

  it.effect("decodes docstrings", () => {
    const Payload = Schema.Struct({
      sku: Schema.String,
      qty: Schema.Number
    })
    type State = {
      readonly payload?: Schema.Schema.Type<typeof Payload>
    }

    const feature = Bdd.feature("Payload", { initial: {} as State }).pipe(
      Bdd.when`the request body is:`(
        Bdd.docString(Schema.fromJsonString(Payload)),
        (_captures, payload, state) => Effect.succeed({ ...state, payload })
      ),
      Bdd.then`the payload is accepted`((_captures, state) =>
        Effect.sync(() => {
          assert.deepStrictEqual(state.payload, { sku: "book", qty: 2 })
          return state
        })
      )
    )

    return Bdd.run(
      feature,
      `
Feature: Payload

  Scenario: JSON payload
    When the request body is:
      """json
      { "sku": "book", "qty": 2 }
      """
    Then the payload is accepted
`
    )
  })
})
