import { Bdd } from "@effect/bdd"
import { Context, Effect, Schema } from "effect"

class TaxRate extends Context.Service<TaxRate, {
  readonly rate: number
}>()("TaxRate") {}

const Item = Schema.Struct({
  sku: Schema.String,
  qty: Schema.FiniteFromString,
  price: Schema.FiniteFromString
})

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
  readonly taxEnabled: boolean
}

const emptyCart: Cart = {
  items: [],
  taxEnabled: false
}

const qty = Bdd.capture("qty", Schema.FiniteFromString)
const sku = Bdd.capture("sku", Schema.String)
const price = Bdd.capture("price", Schema.FiniteFromString)
const expected = Bdd.capture("expected", Schema.FiniteFromString)

const addItem = (cart: Cart, sku: string, qty: number, price: number): Cart => ({
  ...cart,
  items: [...cart.items, { sku, qty, price }]
})

const subtotalOf = (cart: Cart): number => cart.items.reduce((sum, item) => sum + item.qty * item.price, 0)

export const kitchenSink = Bdd.feature("Effect BDD kitchen sink", { initial: emptyCart }).pipe(
  Bdd.step`the cart starts empty`(() => Effect.succeed(emptyCart)),
  Bdd.given`an empty cart`(() => Effect.succeed(emptyCart)),
  Bdd.given`tax is enabled`((_captures, state) => Effect.succeed({ ...state, taxEnabled: true })),
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
  Bdd.then`the subtotal is ${expected}`(({ expected }, state) =>
    subtotalOf(state) === expected
      ? Effect.succeed(state)
      : Effect.fail(`expected subtotal ${expected}, got ${subtotalOf(state)}` as const)
  ),
  Bdd.then`the taxed total is ${expected}`(({ expected }, state) =>
    Effect.gen(function*() {
      const taxRate = yield* TaxRate
      const actual = Math.round(subtotalOf(state) * (1 + taxRate.rate))
      return actual === expected
        ? state
        : yield* Effect.fail(`expected taxed total ${expected}, got ${actual}` as const)
    }).pipe(Effect.provideService(TaxRate, { rate: state.taxEnabled ? 0.1 : 0 }))
  ),
  Bdd.then`the payload is accepted`((_captures, state) => {
    if (state.payload?.sku === "book" && state.payload.qty === 2) {
      return Effect.succeed(state)
    }
    return Effect.fail("expected payload to be accepted" as const)
  }),
  Bdd.then`the scenario can finish with any keyword`((_captures, state) =>
    subtotalOf(state) === 0
      ? Effect.succeed(state)
      : Effect.fail(`expected empty cart, got ${subtotalOf(state)}` as const)
  )
)
