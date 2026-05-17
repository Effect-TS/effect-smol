---
book: Effect `Schedule` Cookbook
section_number: "23.1"
section_title: "Increase delay gradually"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "23. Linear Backoff Recipes"
status: "draft"
code_included: true
---

# 23.1 Increase delay gradually

Gradual delay is a linear retry shape: each failure adds the same wait
increment. It sits between immediate retries and exponential backoff for
short-lived contention or warmup.

Effect does not expose a `Schedule.linear` constructor. Build this shape from a
stateful schedule with `Schedule.unfold`, then convert the state into a delay
with `Schedule.addDelay`.

## Problem

A dependency usually recovers within a few seconds, but immediate retries would
add avoidable pressure. Configure the retry policy so the waits grow by a fixed
step:

- first retry after 250 milliseconds
- second retry after 500 milliseconds
- third retry after 750 milliseconds
- later retries continue by the same step

The first evaluation of the effect still happens immediately. The schedule only
controls the waits before later retry attempts.

## Schedule shape

`Schedule.unfold(1, ...)` gives the schedule an integer step. On each decision,
the schedule outputs the current step and computes the next one.

`Schedule.addDelay` receives that output. Multiplying the step by a base interval
turns the sequence `1, 2, 3, ...` into `250ms, 500ms, 750ms, ...`.

Add a stopping rule, such as `Schedule.take`, so a transient policy does not
retry forever.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class SearchIndexUnavailable extends Data.TaggedError("SearchIndexUnavailable")<{
  readonly shard: string
}> {}

declare const updateSearchIndex: Effect.Effect<void, SearchIndexUnavailable>

const retryWithGradualDelay = Schedule.unfold(1, (step) =>
  Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 250))),
  Schedule.take(5)
)

const program = updateSearchIndex.pipe(
  Effect.retry(retryWithGradualDelay)
)
```

This policy starts with a 250 millisecond delay and adds another 250
milliseconds on each scheduled retry. The retry budget is still finite because
the schedule is capped with `Schedule.take(5)`.

## When to use it

Use gradual delay when the dependency is expected to recover soon, but repeated
immediate attempts would create avoidable pressure. It is easier to reason about
than a hand-written loop because the retry count, state progression, and delay
calculation are all visible in one `Schedule` value.

This is often a better first choice than exponential backoff for local
coordination problems, internal service warmup, and user-facing operations where
waiting several seconds after only a few failures would be too conservative.

## Variants

Change the base interval to tune the slope:

```ts
const slowerRamp = Schedule.unfold(1, (step) => Effect.succeed(step + 1)).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 500))),
  Schedule.take(5)
)
```

For a fleet-wide retry policy, apply `Schedule.jittered` after the base cadence
is correct so many callers do not retry at the same moments.

For a hard upper bound, combine the gradual delay with a time budget or a capped
delay recipe instead of letting the linear sequence grow without limit.

## Notes and caveats

`Schedule.addDelay` adds to the delay already produced by the base schedule.
`Schedule.unfold` produces zero delay by itself, so the added delay is the
effective wait in this recipe.

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. Use this pattern for retrying typed,
retryable failures; classify permanent failures before applying the policy.
