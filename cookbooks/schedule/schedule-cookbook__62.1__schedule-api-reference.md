---
book: Effect `Schedule` Cookbook
section_number: "62.1"
section_title: "Schedule API reference"
part_title: "Part XIV — Reference Appendices"
chapter_title: "62. Further Reading"
status: "draft"
code_included: false
---

# 62.1 Schedule API reference

This reference entry maps cookbook recipes back to the `Schedule` API surface
in `packages/effect/src/Schedule.ts`.

## What this section is about

`Schedule<Output, Input, Error, Env>` is a stepwise policy: each step receives
an input and either produces an output plus delay, or halts with a final output.
Retry APIs usually feed failures into the schedule. Repeat APIs usually feed
successful values into the schedule. The same value can therefore describe
retry timing, repeat cadence, polling intervals, bounded loops, and custom
recurrence state.

The API falls into a few useful groups:

- constructors such as `spaced`, `fixed`, `exponential`, `fibonacci`, `recurs`, `during`, `cron`, `windowed`, `duration`, `forever`, `identity`, and `unfold`
- low-level constructors and destructors such as `fromStep`, `fromStepWithMetadata`, `toStep`, `toStepWithMetadata`, and `toStepWithSleep`
- timing modifiers such as `addDelay`, `modifyDelay`, `jittered`, and `delays`
- composition combinators such as `both`, `either`, `andThen`, and their output-selecting variants
- output, input, and state utilities such as `map`, `reduce`, `collectInputs`, `collectOutputs`, `collectWhile`, `passthrough`, `tapInput`, `tapOutput`, and `take`
- type-level helpers such as `satisfiesInputType`, `setInputType`, `satisfiesOutputType`, `satisfiesErrorType`, and `satisfiesServicesType`

## Why it matters

Most schedule code is small, but the semantics compound quickly. `both` and `either` do not merely combine outputs; they also choose different continuation and delay rules. `take` and `recurs` both bound recurrence, but they are applied at different points in a composed policy. `fixed`, `spaced`, and `windowed` all describe periodic work, but they answer different timing questions.

Reading the API by category prevents accidental policies. A retry schedule should make its backoff, limit, elapsed budget, and jitter visible. A polling schedule should make its cadence and stop condition visible. A custom schedule should usually start from `unfold`, `fromStepWithMetadata`, or a simple constructor plus `map` or `modifyDelay`, rather than hiding operational behavior in surrounding code.

## Core idea

Start with the constructor that names the recurrence shape:

- `Schedule.spaced(duration)` waits the same duration after each run completes.
- `Schedule.fixed(interval)` aligns to a constant rate and does not pile up missed runs when work takes longer than the interval.
- `Schedule.windowed(interval)` sleeps until the next interval boundary.
- `Schedule.exponential(base, factor)` and `Schedule.fibonacci(one)` produce increasing delay sequences.
- `Schedule.recurs(times)` limits the number of recurrences and outputs a zero-based count.
- `Schedule.during(duration)` keeps recurring while elapsed schedule time remains within the duration.
- `Schedule.cron(expression, tz?)` schedules from a cron expression or parsed cron value.
- `Schedule.duration(duration)` recurs once after the duration.
- `Schedule.forever` recurs forever with no delay.
- `Schedule.identity<A>()` recurs forever and emits each input as the output.
- `Schedule.unfold(initial, next)` keeps custom state, emitting the previous state and computing the next state with an effect.

Then add combinators for the production constraint. Use `both` when all constraints must continue; it uses the maximum delay from the two schedules. Use `either` when either side may continue; it uses the minimum delay while both sides are active. Use `andThen` when one phase should run to completion before the next begins. Use `bothLeft`, `bothRight`, `eitherLeft`, `eitherRight`, `bothWith`, `eitherWith`, and `andThenResult` when the output shape matters.

Use delay modifiers only when the base constructor is not enough. `addDelay` adds an effectfully computed duration to the existing delay. `modifyDelay` replaces or adjusts the computed delay with access to the current output and delay. `jittered` randomizes delays between 80% and 120% of the original delay. `delays` exposes each computed delay as the schedule output.

Use metadata when the decision needs runtime context. `InputMetadata` contains `input`, `attempt`, `start`, `now`, `elapsed`, and `elapsedSincePrevious`. `Metadata` adds `output` and `duration`. `fromStepWithMetadata`, `collectWhile`, and `while` are the main APIs for policies that depend on this information. `CurrentMetadata` is a context reference populated by scheduling operations so code running between schedule steps can inspect the current schedule metadata.

## Practical guidance

Prefer named constructors over custom steps whenever they express the policy directly. Reach for `fromStep` or `fromStepWithMetadata` when the schedule truly needs custom step semantics, custom halt behavior, or metadata-aware decisions that cannot be represented by existing combinators.

Keep output types intentional. Many constructors output counts or durations because those values are useful for logging, metrics, or later transformations. Use `map` for effectful output transformation, `tapOutput` for observation, `tapInput` for observing retry or repeat inputs, `reduce` for accumulated state, and `collectInputs` or `collectOutputs` only when retaining the whole history is acceptable.

Be explicit about limits. Infinite constructors such as `spaced`, `fixed`, `exponential`, `fibonacci`, `windowed`, `forever`, and `unfold` usually need `take`, `recurs`, `during`, `both`, or `collectWhile` before they are suitable for user-facing retries or bounded jobs.

Use the type helpers as compile-time documentation. `satisfiesInputType`, `setInputType`, `satisfiesOutputType`, `satisfiesErrorType`, and `satisfiesServicesType` do not change runtime behavior; they make the expected schedule shape clear to TypeScript and to readers.
