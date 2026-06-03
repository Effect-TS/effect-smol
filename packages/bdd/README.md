# @effect/bdd

An Effect-native core runner for testing Gherkin feature source with strongly typed step definitions.

`@effect/bdd` exposes a small `Bdd` module for building immutable feature definitions from tagged-template step definitions. Captures, DataTables, and DocStrings are decoded with `Schema`, and each step implementation returns an `Effect` that produces the next state.

This package is intentionally the core API only. It does not discover `.feature` files, integrate with Vitest, filter by tags, or provide a CLI yet. Those can be layered on top without changing the state-machine model.

## Quick Start

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

## Model

A `Bdd.Feature` is an immutable state machine:

- `Bdd.feature(name, { initial })` creates the feature definition.
- `Bdd.given`, `Bdd.when`, `Bdd.then`, and `Bdd.step` register transitions.
- Each transition receives decoded captures and the current state.
- Each transition returns an `Effect` containing the next state.
- Each scenario starts from the feature's initial state.
- `Background` steps run before each scenario.

This keeps step code pure and explicit. Mutable "world" objects are not required; shared capabilities come from normal Effect services.

## Captures

Captures are named values inside a tagged-template step expression. The source text is always a string, and the capture's `Schema` decides how to decode it before the step implementation runs.

```ts
import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"

type Cart = {
  readonly total: number
}

const expected = Bdd.capture("expected", Schema.NumberFromString)

const feature = Bdd.feature("Cart", { initial: { total: 0 } as Cart }).pipe(
  Bdd.then`the cart total is ${expected}`(({ expected }, state) =>
    state.total === expected
      ? Effect.succeed(state)
      : Effect.fail(`expected ${expected}, got ${state.total}` as const)
  )
)
```

The implementation receives `{ expected: number }`, not raw strings.

## DataTables

Use `Bdd.table(schema)` when a step has a Gherkin DataTable. The first table row is treated as headers. Each following row is converted into an object and decoded with the supplied row schema.

```ts
import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"

const Item = Schema.Struct({
  sku: Schema.String,
  qty: Schema.NumberFromString,
  price: Schema.NumberFromString
})

const feature = Bdd.feature("Cart", { initial: [] as ReadonlyArray<typeof Item.Type> }).pipe(
  Bdd.when`the following items are added:`(
    Bdd.table(Item),
    (_captures, items) => Effect.succeed(items)
  )
)
```

```gherkin
When the following items are added:
  | sku  | qty | price |
  | book | 2   | 21    |
```

## DocStrings

Use `Bdd.docString(schema)` when a step has a Gherkin DocString. This is useful for JSON payloads or larger text blocks.

```ts
import { Bdd } from "@effect/bdd"
import { Effect, Option, Schema } from "effect"

const Payload = Schema.Struct({
  sku: Schema.String,
  qty: Schema.Number
})

const feature = Bdd.feature("Payload", { initial: Option.none<typeof Payload.Type>() }).pipe(
  Bdd.when`the request body is:`(
    Bdd.docString(Schema.fromJsonString(Payload)),
    (_captures, payload) => Effect.succeed(Option.some(payload))
  )
)
```

```gherkin
When the request body is:
  """json
  { "sku": "book", "qty": 2 }
  """
```

## Services

Step implementations return normal `Effect` values, so they can require services in `R` and fail with typed errors in `E`.

```ts
import { Bdd } from "@effect/bdd"
import { Context, Effect, Schema } from "effect"

class TaxRate extends Context.Service<TaxRate, {
  readonly rate: number
}>()("TaxRate") {}

const expected = Bdd.capture("expected", Schema.NumberFromString)

const feature = Bdd.feature("Cart", { initial: 100 }).pipe(
  Bdd.then`the taxed total is ${expected}`(({ expected }, subtotal) =>
    Effect.gen(function*() {
      const taxRate = yield* TaxRate
      const actual = Math.round(subtotal * (1 + taxRate.rate))
      return actual === expected
        ? subtotal
        : yield* Effect.fail(`expected ${expected}, got ${actual}` as const)
    })
  )
)

const program = Bdd.run(feature, source).pipe(
  Effect.provideService(TaxRate, { rate: 0.1 })
)
```

## Supported Gherkin

The core parser currently supports:

- `Feature`
- `Scenario`
- `Background`
- tags on features and scenarios
- `Given`, `When`, `Then`
- `And` and `But` keyword inheritance
- DataTables
- DocStrings
- comments and descriptions

`Bdd.step` is keyword-agnostic and can match any concrete step kind. `Bdd.given`, `Bdd.when`, and `Bdd.then` only match their corresponding kind after `And` / `But` inheritance is resolved.

## Running

`Bdd.run(feature, source)` parses the Gherkin source, matches every scenario step, runs each transition in order, and returns a report when all scenarios pass.

```ts
const report = yield * Bdd.run(feature, source)
```

Reports include the feature name, scenario names, step counts, and inherited tags:

```ts
{
  feature: "Shopping cart",
  scenarios: [
    { name: "Adding items", steps: 3, tags: ["@checkout"] }
  ]
}
```

## Failures

`Bdd.run` fails with `Bdd.RunError`:

- `ParseError` when Gherkin source is invalid or uses unsupported syntax.
- `MatchError` when a step cannot be matched, matches multiple transitions, has a missing/unexpected argument, or a DataTable / DocString fails Schema decoding.
- `StepError` when a matched step implementation fails.

Schema decode failures are preserved on `MatchError.cause`. Step implementation failures are preserved on `StepError.cause`.

```ts
const exit = yield * Effect.exit(Bdd.run(feature, source))
```

## Non-Goals For The Core Package

The current package deliberately does not include:

- CLI commands
- automatic file discovery
- Vitest adapter APIs
- hooks
- tag filtering
- Scenario Outline
- i18n keywords
- custom reporters

Those features can be added later as layers on top of the core runner.
