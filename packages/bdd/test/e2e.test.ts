import { Bdd } from "@effect/bdd"
import { assert, describe, it } from "@effect/vitest"
import { Cause, Context, Effect, Exit, Option, Schema } from "effect"

class TaxRate extends Context.Service<TaxRate, {
  readonly rate: number
}>()("TaxRate") {}

const Payload = Schema.Struct({
  sku: Schema.String,
  qty: Schema.Number
})

type LineItem = {
  readonly sku: string
  readonly qty: number
  readonly price: number
}

type Cart = {
  readonly items: ReadonlyArray<LineItem>
  readonly payload?: Schema.Schema.Type<typeof Payload>
}

const emptyCart: Cart = { items: [] }

const addItem = (cart: Cart, sku: string, qty: number, price: number): Cart => ({
  items: [...cart.items, { sku, qty, price }]
})

const subtotalOf = (cart: Cart): number => cart.items.reduce((sum, item) => sum + item.qty * item.price, 0)

const qty = Bdd.capture("qty", Schema.NumberFromString)
const sku = Bdd.capture("sku", Schema.String)
const price = Bdd.capture("price", Schema.NumberFromString)
const expected = Bdd.capture("expected", Schema.NumberFromString)

const Item = Schema.Struct({
  sku: Schema.String,
  qty: Schema.NumberFromString,
  price: Schema.NumberFromString
})

const shoppingCart = Bdd.feature("Shopping cart", { initial: emptyCart }).pipe(
  Bdd.step`the cart starts empty`(() => Effect.succeed(emptyCart)),
  Bdd.given`an empty cart`(() => Effect.succeed(emptyCart)),
  Bdd.when`${qty} ${sku} are added at ${price} each`(
    ({ qty, sku, price }, state) => Effect.succeed(addItem(state, sku, qty, price))
  ),
  Bdd.when`the following items are added:`(
    Bdd.table(Item),
    (_captures, items, state) =>
      Effect.succeed(items.reduce((cart, item) => addItem(cart, item.sku, item.qty, item.price), state))
  ),
  Bdd.when`the request body is:`(
    Bdd.docString(Schema.fromJsonString(Payload)),
    (_captures, payload, state) => Effect.succeed({ ...state, payload })
  ),
  Bdd.then`the subtotal is ${expected}`(({ expected }, state) => {
    const actual = subtotalOf(state)
    return actual === expected
      ? Effect.succeed(state)
      : Effect.fail(`expected subtotal ${expected}, got ${actual}` as const)
  }),
  Bdd.then`the taxed total is ${expected}`(({ expected }, state) =>
    Effect.gen(function*() {
      const taxRate = yield* TaxRate
      const actual = Math.round(subtotalOf(state) * (1 + taxRate.rate))
      return actual === expected
        ? state
        : yield* Effect.fail(`expected taxed total ${expected}, got ${actual}` as const)
    })
  ),
  Bdd.then`the payload is accepted`((_captures, state) => {
    assert.deepStrictEqual(state.payload, { sku: "book", qty: 2 })
    return Effect.succeed(state)
  }),
  Bdd.then`no duplicate charge is made`((_captures, state) => Effect.succeed(state)),
  Bdd.then`the scenario can finish with any keyword`((_captures, state) => {
    assert.strictEqual(subtotalOf(state), 0)
    return Effect.succeed(state)
  })
)

const runShoppingCart = (source: string) =>
  Bdd.run(shoppingCart, source).pipe(
    Effect.provideService(TaxRate, { rate: 0.1 })
  )

const feature = `
@checkout
Feature: Shopping cart
  This file is the source of truth for the behavior.

  Background:
    Given an empty cart

  Scenario: Capture based item with a service-backed assertion
    When 2 book are added at 21 each
    Then the subtotal is 42
    And the taxed total is 46

  @happy-path
  Scenario: DataTable plus And / But keyword inheritance
    When the following items are added:
      | sku      | qty | price |
      | book     | 2   | 21    |
      | notebook | 3   | 5     |
    And 1 pen are added at 15 each
    Then the subtotal is 72
    But no duplicate charge is made

  @json
  Scenario: DocString JSON payload
    When the request body is:
      """json
      { "sku": "book", "qty": 2 }
      """
    Then the payload is accepted

  @keyword-agnostic
  Scenario: Bdd.step can match any concrete keyword
    Given the cart starts empty
    Then the scenario can finish with any keyword
`

const stepFailureFeature = `
Feature: Shopping cart

  Scenario: Wrong total triggers a StepError
    Given an empty cart
    When 2 book are added at 21 each
    Then the subtotal is 99
`

const matchFailureFeature = `
Feature: Shopping cart

  Scenario: Missing transition triggers a MatchError
    Given an empty cart
    When 1 pencil is added
`

const parseFailureFeature = `
Feature: Shopping cart

  Scenario: Invalid Gherkin triggers a ParseError
    And an empty cart
`

const runError = (source: string) =>
  Effect.gen(function*() {
    const exit = yield* Effect.exit(runShoppingCart(source))
    assert.strictEqual(Exit.isFailure(exit), true)

    if (Exit.isFailure(exit)) {
      return Option.getOrThrow(Cause.findErrorOption(exit.cause)) as Bdd.RunError
    }

    return yield* Effect.fail("expected Bdd.run to fail" as const)
  })

describe("developer experience", () => {
  it.effect("runs a feature as a readable executable specification", () =>
    Effect.gen(function*() {
      const report = yield* runShoppingCart(feature)

      assert.deepStrictEqual(report, {
        feature: "Shopping cart",
        scenarios: [
          { name: "Capture based item with a service-backed assertion", steps: 4, tags: ["@checkout"] },
          { name: "DataTable plus And / But keyword inheritance", steps: 5, tags: ["@checkout", "@happy-path"] },
          { name: "DocString JSON payload", steps: 3, tags: ["@checkout", "@json"] },
          { name: "Bdd.step can match any concrete keyword", steps: 3, tags: ["@checkout", "@keyword-agnostic"] }
        ]
      })
    }))

  it.effect("surfaces ParseError, MatchError, and StepError as typed failures", () =>
    Effect.gen(function*() {
      const stepError = yield* runError(stepFailureFeature)
      assert.strictEqual(stepError._tag, "StepError")
      assert.strictEqual((stepError as { readonly cause: unknown }).cause, "expected subtotal 99, got 42")

      const matchError = yield* runError(matchFailureFeature)
      assert.strictEqual(matchError._tag, "MatchError")
      assert.deepStrictEqual((matchError as { readonly candidates: ReadonlyArray<string> }).candidates, [
        "the cart starts empty",
        "an empty cart",
        "{qty} {sku} are added at {price} each",
        "the following items are added:",
        "the request body is:",
        "the subtotal is {expected}",
        "the taxed total is {expected}",
        "the payload is accepted",
        "no duplicate charge is made",
        "the scenario can finish with any keyword"
      ])

      const parseError = yield* runError(parseFailureFeature)
      assert.strictEqual(parseError._tag, "ParseError")
      assert.strictEqual(
        (parseError as { readonly message: string }).message,
        "And found before a Given, When, or Then step"
      )
    }))
})
