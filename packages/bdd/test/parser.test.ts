import { Bdd } from "@effect/bdd"
import { assert, describe, it } from "@effect/vitest"
import { Cause, Effect, Option, Schema } from "effect"

describe("parser", () => {
  it.effect("parses scenarios, steps, and data tables through run", () => {
    const Item = Schema.Struct({
      sku: Schema.String,
      qty: Schema.NumberFromString
    })

    const feature = Bdd.feature("Shopping cart", { initial: [] as ReadonlyArray<Schema.Schema.Type<typeof Item>> })
      .pipe(
        Bdd.given`an empty cart`(() => Effect.succeed([] as ReadonlyArray<Schema.Schema.Type<typeof Item>>)),
        Bdd.when`the following items are added:`(Bdd.table(Item), (_captures, items) => Effect.succeed(items)),
        Bdd.then`the cart has items`((_captures, items) =>
          Effect.sync(() => {
            assert.deepStrictEqual(items, [{ sku: "book", qty: 2 }])
            return items
          })
        )
      )

    return Effect.gen(function*() {
      const report = yield* Bdd.run(
        feature,
        `
Feature: Shopping cart

  Scenario: Adding items
    Given an empty cart
    When the following items are added:
      | sku  | qty |
      | book | 2   |
    Then the cart has items
`
      )

      assert.strictEqual(report.feature, "Shopping cart")
      assert.deepStrictEqual(report.scenarios, [{ name: "Adding items", steps: 3, tags: [] }])
    })
  })

  it.effect("rejects And before a concrete step", () =>
    Effect.gen(function*() {
      const feature = Bdd.feature("Shopping cart", { initial: 0 })
      const result = yield* Effect.exit(Bdd.run(
        feature,
        `
Feature: Shopping cart

  Scenario: Invalid
    And an empty cart
`
      ))

      assert.strictEqual(result._tag, "Failure")
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
        assert.strictEqual(error._tag, "ParseError")
        assert.strictEqual(error.line, 5)
      }
    }))

  it.effect("ignores comments and accepts descriptions", () => {
    const feature = Bdd.feature("Shopping cart", { initial: 0 }).pipe(
      Bdd.given`an empty cart`((_captures, state) => Effect.succeed(state))
    )

    return Effect.gen(function*() {
      const report = yield* Bdd.run(
        feature,
        `
# file comment
Feature: Shopping cart
  Customers should see totals.

  # scenario comment
  Scenario: Described scenario
    This scenario has prose.
    Given an empty cart
`
      )

      assert.deepStrictEqual(report.scenarios, [{ name: "Described scenario", steps: 1, tags: [] }])
    })
  })

  it.effect("rejects malformed tags", () =>
    Effect.gen(function*() {
      const feature = Bdd.feature("Shopping cart", { initial: 0 })
      const result = yield* Effect.exit(Bdd.run(
        feature,
        `
@valid @
Feature: Shopping cart

  Scenario: Invalid tags
    Given an empty cart
`
      ))

      assert.strictEqual(result._tag, "Failure")
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
        assert.strictEqual(error._tag, "ParseError")
        assert.strictEqual(error.line, 2)
      }
    }))

  it.effect("rejects unsupported Scenario Outline syntax", () =>
    Effect.gen(function*() {
      const feature = Bdd.feature("Shopping cart", { initial: 0 })
      const result = yield* Effect.exit(Bdd.run(
        feature,
        `
Feature: Shopping cart

  Scenario Outline: Adding items
    Given an empty cart
`
      ))

      assert.strictEqual(result._tag, "Failure")
      if (result._tag === "Failure") {
        const error = Option.getOrThrow(Cause.findErrorOption(result.cause)) as Bdd.RunError
        assert.strictEqual(error._tag, "ParseError")
        assert.strictEqual(error.line, 4)
      }
    }))
})
