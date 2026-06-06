import { Bdd } from "@effect/bdd"
import { assert, describe, it } from "@effect/vitest"
import { Option, Schema } from "effect"

describe("expressions", () => {
  it("decodes named captures with Schema", () => {
    const qty = Bdd.capture("qty", Schema.NumberFromString)
    const sku = Bdd.capture("sku", Schema.String)

    const transition = Bdd.when`${qty} ${sku} are added`
    const match = transition.expression.match("2 book are added")

    assert.strictEqual(Option.isSome(match), true)
    if (Option.isSome(match)) {
      assert.deepStrictEqual(match.value, { qty: 2, sku: "book" })
    }
  })

  it("returns none when the literal text does not match", () => {
    const transition = Bdd.when`the cart is empty`

    assert.strictEqual(Option.isNone(transition.expression.match("the cart has items")), true)
  })

  it("returns none when a capture cannot be decoded", () => {
    const qty = Bdd.capture("qty", Schema.Literal("2"))
    const transition = Bdd.when`${qty} items are added`

    assert.strictEqual(Option.isNone(transition.expression.match("many items are added")), true)
  })

  it("escapes regular expression syntax in literal text", () => {
    const transition = Bdd.then`the total is $5.00?`

    assert.strictEqual(Option.isSome(transition.expression.match("the total is $5.00?")), true)
    assert.strictEqual(Option.isNone(transition.expression.match("the total is $5000")), true)
  })

  it("decodes adjacent captures", () => {
    const left = Bdd.capture("left", Schema.String)
    const right = Bdd.capture("right", Schema.String)
    const transition = Bdd.when`${left}${right} are joined`
    const match = transition.expression.match("ab are joined")

    assert.strictEqual(Option.isSome(match), true)
    if (Option.isSome(match)) {
      assert.deepStrictEqual(match.value, { left: "a", right: "b" })
    }
  })
})
