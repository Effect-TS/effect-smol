import { Bdd } from "@effect/bdd"
import { assert, describe, it } from "@effect/vitest"
import { Cause, Effect, Option, Schema } from "effect"

const runBdd = <State, E, R>(feature: Bdd.Feature<State, E, R>, source: string) =>
  Bdd.run(feature, source).pipe(Effect.provide(Bdd.GherkinCompiler.Cucumber))

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
      const report = yield* runBdd(
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
      const result = yield* Effect.exit(runBdd(
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
      const report = yield* runBdd(
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

  it.effect("dedents docstrings and preserves their content type", () => {
    const feature = Bdd.feature("Payload", { initial: "" }).pipe(
      Bdd.when`the payload is:`(
        Bdd.docString(Schema.String),
        (_captures, payload) => Effect.succeed(payload)
      ),
      Bdd.then`the payload is dedented`((_captures, payload) =>
        Effect.sync(() => {
          assert.strictEqual(payload, "line one\n  line two")
          return payload
        })
      )
    )

    return runBdd(
      feature,
      `
Feature: Payload

  Scenario: Dedented docstring
    When the payload is:
      """text/plain
      line one
        line two
      """
    Then the payload is dedented
`
    )
  })

  it.effect("accepts CRLF line endings", () => {
    const feature = Bdd.feature("Shopping cart", { initial: 0 }).pipe(
      Bdd.given`an empty cart`((_captures, state) => Effect.succeed(state))
    )

    return Effect.gen(function*() {
      const report = yield* runBdd(
        feature,
        "Feature: Shopping cart\r\n\r\n  Scenario: CRLF\r\n    Given an empty cart\r\n"
      )

      assert.deepStrictEqual(report.scenarios, [{ name: "CRLF", steps: 1, tags: [] }])
    })
  })

  it.effect("rejects invalid Gherkin syntax", () =>
    Effect.gen(function*() {
      const feature = Bdd.feature("Shopping cart", { initial: 0 })
      const result = yield* Effect.exit(runBdd(
        feature,
        `
Given a step before the feature
Feature: Shopping cart

  Scenario: Invalid syntax
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

  it.effect("expands Scenario Outline examples into executable scenarios", () =>
    Effect.gen(function*() {
      const qty = Bdd.capture("qty", Schema.FiniteFromString)
      const feature = Bdd.feature("Shopping cart", { initial: 0 }).pipe(
        Bdd.when`${qty} items are added`(({ qty }) => Effect.succeed(qty)),
        Bdd.then`the cart has ${qty} items`(({ qty }, state) =>
          Effect.sync(() => {
            assert.strictEqual(state, qty)
            return state
          })
        )
      )
      const report = yield* runBdd(
        feature,
        `
Feature: Shopping cart

  Scenario Outline: Adding <qty> items
    When <qty> items are added
    Then the cart has <qty> items

    Examples:
      | qty |
      | 2   |
      | 3   |
`
      )

      assert.deepStrictEqual(report.scenarios, [
        { name: "Adding 2 items", steps: 2, tags: [] },
        { name: "Adding 3 items", steps: 2, tags: [] }
      ])
    }))

  it.effect("accepts Rule syntax and inherits rule tags", () =>
    Effect.gen(function*() {
      const feature = Bdd.feature("Shopping cart", { initial: 0 }).pipe(
        Bdd.given`an empty cart`((_captures, state) => Effect.succeed(state))
      )
      const report = yield* runBdd(
        feature,
        `
@feature
Feature: Shopping cart

  @rule
  Rule: Checkout
    Checkout scenarios.

  @scenario
  Scenario: Rule scenario
    Given an empty cart
`
      )

      assert.deepStrictEqual(report.scenarios, [{
        name: "Rule scenario",
        steps: 1,
        tags: ["@feature", "@rule", "@scenario"]
      }])
    }))
})
