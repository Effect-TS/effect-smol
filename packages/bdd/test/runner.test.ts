import { Bdd } from "@effect/bdd"
import { assert, describe, it } from "@effect/vitest"
import { Cause, Effect, Option, Schema } from "effect"

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
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
        assert.strictEqual(error._tag, "MatchError")
        assert.strictEqual((error as { readonly scenario: string }).scenario, "Missing transition")
      }
    })
  })

  it.effect("fails with MatchError when multiple transitions match", () => {
    const cart = Bdd.feature("Shopping cart", { initial: emptyCart }).pipe(
      Bdd.step`an empty cart`(() => Effect.succeed(emptyCart)),
      Bdd.given`an empty cart`(() => Effect.succeed(emptyCart))
    )

    return Effect.gen(function*() {
      const result = yield* Effect.exit(Bdd.run(
        cart,
        `
Feature: Shopping cart

  Scenario: Ambiguous transition
    Given an empty cart
`
      ))

      assert.strictEqual(result._tag, "Failure")
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
        assert.strictEqual(error._tag, "MatchError")
        assert.strictEqual((error as { readonly candidates: ReadonlyArray<string> }).candidates.length, 2)
      }
    })
  })

  it.effect("preserves DataTable decode causes on MatchError", () => {
    const Item = Schema.Struct({
      sku: Schema.String,
      qty: Schema.Literal("2")
    })

    const cart = Bdd.feature("Shopping cart", { initial: emptyCart }).pipe(
      Bdd.when`the following items are added:`(
        Bdd.table(Item),
        (_captures, _items, state) => Effect.succeed(state)
      )
    )

    return Effect.gen(function*() {
      const result = yield* Effect.exit(Bdd.run(
        cart,
        `
Feature: Shopping cart

  Scenario: Invalid table
    When the following items are added:
      | sku  | qty |
      | book | nope |
`
      ))

      assert.strictEqual(result._tag, "Failure")
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
        assert.strictEqual(error._tag, "MatchError")
        assert.notStrictEqual(error.cause, undefined)
      }
    })
  })

  it.effect("fails when a step requires a DataTable but source omits it", () => {
    const Item = Schema.Struct({
      sku: Schema.String
    })
    const cart = Bdd.feature("Shopping cart", { initial: emptyCart }).pipe(
      Bdd.when`the following items are added:`(
        Bdd.table(Item),
        (_captures, _items, state) => Effect.succeed(state)
      )
    )

    return Effect.gen(function*() {
      const result = yield* Effect.exit(Bdd.run(
        cart,
        `
Feature: Shopping cart

  Scenario: Missing table
    When the following items are added:
`
      ))

      assert.strictEqual(result._tag, "Failure")
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
        assert.strictEqual(error._tag, "MatchError")
        assert.strictEqual(error.message, `Step "the following items are added:" requires a DataTable`)
      }
    })
  })

  it.effect("fails when source supplies an unexpected DocString", () => {
    const cart = Bdd.feature("Payload", { initial: emptyCart }).pipe(
      Bdd.when`the request body is:`((_captures, state) => Effect.succeed(state))
    )

    return Effect.gen(function*() {
      const result = yield* Effect.exit(Bdd.run(
        cart,
        `
Feature: Payload

  Scenario: Unexpected docstring
    When the request body is:
      """
      text
      """
`
      ))

      assert.strictEqual(result._tag, "Failure")
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
        assert.strictEqual(error._tag, "MatchError")
        assert.strictEqual(error.message, `Step "the request body is:" has an unexpected argument`)
      }
    })
  })

  it.effect("preserves DocString decode causes on MatchError", () => {
    const Payload = Schema.Struct({
      sku: Schema.String
    })
    const feature = Bdd.feature("Payload", { initial: emptyCart }).pipe(
      Bdd.when`the request body is:`(
        Bdd.docString(Schema.fromJsonString(Payload)),
        (_captures, _payload, state) => Effect.succeed(state)
      )
    )

    return Effect.gen(function*() {
      const result = yield* Effect.exit(Bdd.run(
        feature,
        `
Feature: Payload

  Scenario: Invalid payload
    When the request body is:
      """json
      { bad json
      """
`
      ))

      assert.strictEqual(result._tag, "Failure")
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
        assert.strictEqual(error._tag, "MatchError")
        assert.notStrictEqual(error.cause, undefined)
      }
    })
  })

  it.effect("fails with StepError when a step implementation fails", () => {
    const cart = Bdd.feature("Shopping cart", { initial: emptyCart }).pipe(
      Bdd.then`the cart total is wrong`((_captures, _state) =>
        Effect.fail("wrong total" as const) as Effect.Effect<Cart, "wrong total">
      )
    )

    return Effect.gen(function*() {
      const result = yield* Effect.exit(Bdd.run(
        cart,
        `
Feature: Shopping cart

  Scenario: Failed assertion
    Then the cart total is wrong
`
      ))

      assert.strictEqual(result._tag, "Failure")
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
        assert.strictEqual(error._tag, "StepError")
        assert.strictEqual(error.cause, "wrong total")
      }
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
