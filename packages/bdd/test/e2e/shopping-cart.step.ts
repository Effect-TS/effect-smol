import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"

type Cart = {
  readonly items: ReadonlyArray<{
    readonly sku: string
    readonly qty: number
    readonly price: number
  }>
}

const emptyCart: Cart = { items: [] }

const qty = Bdd.capture("qty", Schema.NumberFromString)
const sku = Bdd.capture("sku", Schema.String)
const price = Bdd.capture("price", Schema.NumberFromString)
const expected = Bdd.capture("expected", Schema.NumberFromString)

const Item = Schema.Struct({
  sku: Schema.String,
  qty: Schema.NumberFromString,
  price: Schema.NumberFromString
})

const addItem = (cart: Cart, sku: string, qty: number, price: number): Cart => ({
  items: [...cart.items, { sku, qty, price }]
})

const subtotal = (cart: Cart): number => cart.items.reduce((sum, item) => sum + item.qty * item.price, 0)

export const shoppingCart = Bdd.feature("CLI shopping cart", { initial: emptyCart }).pipe(
  Bdd.given`an empty cart`(() => Effect.succeed(emptyCart)),
  Bdd.when`${qty} ${sku} are added at ${price} each`(
    ({ qty, sku, price }, state) => Effect.succeed(addItem(state, sku, qty, price))
  ),
  Bdd.when`the following items are added:`(
    Bdd.table(Item),
    (_captures, items, state) =>
      Effect.succeed(items.reduce((cart, item) => addItem(cart, item.sku, item.qty, item.price), state))
  ),
  Bdd.then`subtotal is ${expected}`(({ expected }, state) =>
    subtotal(state) === expected
      ? Effect.succeed(state)
      : Effect.fail(`expected subtotal ${expected}, got ${subtotal(state)}` as const)
  )
)
