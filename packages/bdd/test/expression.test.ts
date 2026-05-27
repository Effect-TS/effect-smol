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
})
