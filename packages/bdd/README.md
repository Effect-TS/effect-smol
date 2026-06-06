# @effect/bdd

An Effect-native core runner for testing Gherkin feature source with strongly typed step definitions.

`@effect/bdd` exposes a small `Bdd` module for building immutable feature definitions from tagged-template step definitions. Captures, DataTables, and DocStrings are decoded with `Schema`, and each step implementation returns an `Effect` that produces the next state.

The package also ships an `effect-bdd` CLI for discovering feature files and step definition modules from globs.

## Quick Start

```ts
import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"

const qty = Bdd.capture("qty", Schema.FiniteFromString)

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

Prefer strict schemas. `Schema.FiniteFromString` rejects `"abc"`, `""`, and `"Infinity"`, surfacing a `MatchError` when a Gherkin value is malformed. `Schema.NumberFromString` decodes those to `NaN`, `0`, and `Infinity` instead, so a typo silently runs the step against a non-finite number.

```ts
import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"

type Cart = {
  readonly total: number
}

const expected = Bdd.capture("expected", Schema.FiniteFromString)

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
  qty: Schema.FiniteFromString,
  price: Schema.FiniteFromString
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

const expected = Bdd.capture("expected", Schema.FiniteFromString)

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
- `Rule`
- tags on features, rules, and scenarios
- `Given`, `When`, `Then`
- `And` and `But` keyword inheritance
- DataTables
- DocStrings
- comments and descriptions

`Bdd.given`, `Bdd.when`, and `Bdd.then` are semantic, not decorative. They only match their corresponding concrete kind after `And` / `But` inheritance is resolved. `Bdd.step` is keyword-agnostic and can match any concrete step kind; use it sparingly for transitions that are truly valid as setup, action, or assertion.

## Running

`Bdd.run(feature, source)` parses the Gherkin source, matches every scenario step, runs each transition in order, and returns a report when all scenarios pass.

```ts
const program = Bdd.run(feature, source)
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
- `MatchError` when the feature definition name does not match the Gherkin `Feature:` name, a step cannot be matched, a step matches only transitions registered under the wrong keyword, a step matches multiple transitions, has a missing/unexpected argument, or a DataTable / DocString fails Schema decoding.
- `StepError` when a matched step implementation fails.

Schema decode failures are preserved on `MatchError.cause`. Step implementation failures are preserved on `StepError.cause`.

```ts
const program = Effect.exit(Bdd.run(feature, source))
```

## CLI

`@effect/bdd` publishes an `effect-bdd` bin for running `.feature` files from exported `Bdd.feature(...)` definitions.

Each matched step module should export one or more feature definitions. The feature definition name must match the Gherkin `Feature:` name.

```gherkin
# features/counter.feature
Feature: Counter

  Scenario: Increment
    Given zero
    When increment by 2
    Then the counter is 2
```

```ts
// features/counter.step.ts
import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"

const amount = Bdd.capture("amount", Schema.FiniteFromString)
const expected = Bdd.capture("expected", Schema.FiniteFromString)

export const counter = Bdd.feature("Counter", { initial: 0 }).pipe(
  Bdd.given`zero`(() => Effect.succeed(0)),
  Bdd.when`increment by ${amount}`(({ amount }, state) => Effect.succeed(state + amount)),
  Bdd.then`the counter is ${expected}`(({ expected }, state) =>
    state === expected
      ? Effect.succeed(state)
      : Effect.fail(`expected ${expected}, got ${state}` as const)
  )
)
```

Add a package script:

```json
{
  "scripts": {
    "bdd": "effect-bdd --features \"features/**/*.feature\" --steps \"features/**/*.step.ts\" --reporter text"
  }
}
```

Then run:

```sh
pnpm bdd
```

You can also invoke the bin directly:

```sh
effect-bdd \
  --features "features/**/*.feature" \
  --steps "features/**/*.step.ts" \
  --reporter text
```

The command exits with status `0` when every scenario passes and with a non-zero status when discovery, parsing, matching, reporting, diagnostics, or any scenario fails. Reports are emitted before the command fails.

### Globs

Both `--features` (`-f`) and `--steps` (`-s`) are required, repeatable, and support glob patterns:

```sh
effect-bdd \
  --features "features/cart/**/*.feature" \
  --features "features/checkout/**/*.feature" \
  --steps "features/**/*.step.ts" \
  --steps "test-support/**/*.step.ts"
```

Matched paths are deduplicated and sorted before execution so report order is stable.

### Reporters

Reporters are repeatable:

```sh
effect-bdd \
  --features "features/**/*.feature" \
  --steps "features/**/*.step.ts" \
  --reporter text \
  --reporter html \
  --output-file.html reports/bdd.html
```

The CLI supports:

- `text`: writes to stdout by default, or `--output-file.text <path>`.
- `html`: writes to `--output-file.html <path>`.
- `json`: writes to stdout by default, or `--output-file.json <path>`.
- `junit`: writes to `--output-file.junit <path>`.

The default text reporter is compact. It prints the summary, failed scenarios, and diagnostics. Add `--verbose` to print every passing scenario:

```sh
effect-bdd \
  --features "features/**/*.feature" \
  --steps "features/**/*.step.ts" \
  --reporter text \
  --verbose
```

For example, write human, HTML, and CI reports to files:

```sh
effect-bdd \
  --features "features/**/*.feature" \
  --steps "features/**/*.step.ts" \
  --reporter text \
  --output-file.text reports/bdd.txt \
  --reporter html \
  --output-file.html reports/bdd.html \
  --reporter json \
  --output-file.json reports/bdd.json \
  --reporter junit \
  --output-file.junit reports/bdd.xml
```

Diagnostics are reported separately from failed assertions. They include feature files with no matching `Bdd.feature(...)` export, scenarios that cannot run because their feature definition is missing, source steps with no or multiple matching transitions, exported feature definitions that were not matched by any feature file, and step definitions that were never matched.

### Filtering

Use `--tags <expression>` for Cucumber-style tag expressions:

```sh
effect-bdd \
  --features "features/**/*.feature" \
  --steps "features/**/*.step.ts" \
  --tags "@event-sourcing and not @slow"
```

Supported tag operators are `and`, `or`, `not`, and parentheses. Repeated `--tags` flags are combined with `and`.

Use `--name <text>` to run scenarios whose `Feature / Scenario` name contains the provided text:

```sh
effect-bdd \
  --features "features/**/*.feature" \
  --steps "features/**/*.step.ts" \
  --name "stale append"
```

Repeated `--name` flags are combined with `or`. If filters match no scenarios, the command fails with a clear user error.

### Parallel Scenario Execution

Use `--parallel <n>` to run scenarios concurrently:

```sh
effect-bdd \
  --features "features/**/*.feature" \
  --steps "features/**/*.step.ts" \
  --reporter text \
  --parallel 4
```

Every scenario starts from the feature definition's initial state. Reports preserve feature/scenario source order even when scenarios run concurrently.

Use `--fail-fast` to stop after the first failed scenario. When enabled, scenarios run sequentially so the stop point is deterministic.

### TypeScript Step Modules

Bun can load `.ts` step definition modules directly when the CLI is executed by Bun:

```sh
bunx --bun effect-bdd --features "features/**/*.feature" --steps "features/**/*.step.ts"
```

Node requires an explicit TypeScript loader. The CLI does not install or register one implicitly:

```sh
node --import tsx ./node_modules/.bin/effect-bdd \
  --features "features/**/*.feature" \
  --steps "features/**/*.step.ts"
```

This keeps runtime behavior visible and avoids hidden loader magic.

### Step Definition Services

Step definitions can require services when they are run with `Bdd.run` inside an Effect program. The CLI only provides the platform services it needs for file loading and reporting.

If a CLI-loaded step definition needs additional services, provide them inside the step module before exporting the feature, or run the feature programmatically with `Bdd.run(...).pipe(Effect.provide(...))`.

## Non-Goals

The current package deliberately does not include:

- Vitest adapter APIs
- hooks
- Scenario Outline
- i18n keywords
- user-pluggable reporter APIs

Those features can be added later as layers on top of the core runner.
