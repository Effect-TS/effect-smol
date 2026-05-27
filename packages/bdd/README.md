# @effect/bdd

An Effect-native API for testing Gherkin feature files.

The package exposes a small `Bdd` module for building immutable feature definitions from tagged-template step definitions, decoding captures with `Schema`, and running `.feature` source text against those transitions.

```ts
import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"

const qty = Bdd.capture("qty", Schema.NumberFromString)

const feature = Bdd.feature("Counter", { initial: 0 }).pipe(
  Bdd.given`zero`(() => Effect.succeed(0)),
  Bdd.when`increment by ${qty}`(({ qty }, state) => Effect.succeed(state + qty))
)

const program = Bdd.run(
  feature,
  `
Feature: Counter

  Scenario: Increment
    Given zero
    When increment by 2
`
)
```
