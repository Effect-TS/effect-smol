---
book: Effect `Schedule` Cookbook
section_number: "9.2"
section_title: "Retry for at most 1 minute"
part_title: "Part II — Core Retry Recipes"
chapter_title: "9. Retry with Deadlines and Budgets"
status: "draft"
code_included: true
---

# 9.2 Retry for at most 1 minute

Use this recipe when a dependency deserves a brief recovery window but the
caller must not wait indefinitely. The schedule controls the bounded retry
window; surrounding code still decides retry safety and failure handling.

## Problem

Build a policy that runs the operation once immediately, retries typed failures
on a one-second cadence inside a one-minute window, and returns the last failure
if the window closes.

Combine the retry cadence with a one-minute elapsed window:

```ts
const retryForAtMost1Minute = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("1 minute"))
)
```

`Schedule.spaced("1 second")` controls the delay between retries.
`Schedule.during("1 minute")` supplies the elapsed retry budget.
`Schedule.both` requires both schedules to continue.

## When to use it

Use this recipe when a caller can afford a bounded wait and the operation is
safe to run more than once. It fits idempotent reads, service discovery,
startup dependency checks, short reconnect loops, and other cases where a
temporary outage may clear within a minute.

The one-minute window is useful when the time budget is more important than an
exact retry count. A slow dependency may allow fewer retries during the same
window, while a fast failing dependency may allow more.

This shape also keeps the retry limit visible at the schedule boundary. The
cadence says how often to try; the duration says when to stop trying.

## When not to use it

Do not use this recipe as a hard timeout for an individual attempt.
`Schedule.during("1 minute")` is consulted at retry decision points; it does not
interrupt an effect that is currently running.

Do not use it for non-idempotent writes unless the operation has a
deduplication key, transaction boundary, or another guarantee that repeated
execution is safe.

Do not use a fixed one-second cadence for large fleets of clients that may all
retry at the same time. A one-minute budget limits each caller, but it does not
spread synchronized retries by itself. Add jitter or backoff when many callers
can fail together.

## Schedule shape

`Schedule.spaced("1 second")` is unbounded. Every time the retried effect fails
with a typed error, it allows another retry after a one-second delay.

`Schedule.during("1 minute")` recurs while the elapsed schedule window is open.
By itself, it does not add spacing; a fast failing effect could retry very
quickly until the window closes.

`Schedule.both(left, right)` continues only while both schedules want to
continue and uses the maximum of their delays. In this recipe, the one-second
spaced schedule supplies the delay, and the one-minute `during` schedule
supplies the stopping condition.

With `Effect.retry`, the first attempt runs immediately. The schedule is stepped
only after a typed failure:

- attempt 1: run immediately
- if attempt 1 fails: the schedule starts its elapsed window and waits 1 second
- later failures: retry every 1 second while the one-minute window is open
- once the elapsed window is exhausted: stop retrying and return the last typed
  failure

The elapsed budget is a retry-window budget, not a deadline that interrupts
work in progress. Time spent inside failed attempts contributes to the elapsed
window before the next retry decision, but a currently running attempt is not
cancelled by the schedule.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class RegistryUnavailable extends Data.TaggedError("RegistryUnavailable")<{
  readonly service: string
}> {}

interface Endpoint {
  readonly host: string
  readonly port: number
}

declare const discoverEndpoint: Effect.Effect<Endpoint, RegistryUnavailable>

const retryForAtMost1Minute = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("1 minute"))
)

const program = discoverEndpoint.pipe(
  Effect.retry(retryForAtMost1Minute)
)
```

`program` calls `discoverEndpoint` once immediately. If it fails with a typed
`RegistryUnavailable`, it waits one second and tries again. Retrying continues
while the one-minute retry window is open.

If an attempt succeeds, `program` succeeds with the discovered `Endpoint`. If
the retry window is exhausted while the operation is still failing,
`Effect.retry` propagates the last `RegistryUnavailable`.

## Variants

Use the same one-minute budget with exponential backoff when retries should
slow down over time:

```ts
const retryWithBackoffForAtMost1Minute = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.during("1 minute"))
)

const program = discoverEndpoint.pipe(
  Effect.retry(retryWithBackoffForAtMost1Minute)
)
```

This keeps the one-minute elapsed window, but the delay between retries grows
instead of staying fixed at one second.

Keep the same schedule and add an error predicate when only some typed failures
should consume the one-minute retry budget:

```ts
const program = discoverEndpoint.pipe(
  Effect.retry({
    schedule: retryForAtMost1Minute,
    while: (error) => error.service === "registry"
  })
)
```

The predicate decides whether a typed failure is retryable. The schedule still
controls the one-second cadence and the one-minute retry window.

## Notes and caveats

`Schedule.during("1 minute")` starts measuring when the schedule is first
stepped, which happens after the original attempt fails. The original attempt
still runs before the retry schedule is consulted.

Because `Schedule.both` uses the maximum delay, combining
`Schedule.spaced("1 second")` with `Schedule.during("1 minute")` preserves the
one-second delay. The `during` side contributes the elapsed stopping condition,
not an additional wait.

The one-minute budget is checked at recurrence boundaries. If a failure arrives
while the window is still open, the schedule may allow the next delayed retry.
Use timeout operators around the effect when an individual attempt or the whole
operation needs a hard wall-clock deadline.

Plain `Effect.retry` uses the schedule for timing and stopping. The successful
result, if any attempt succeeds, is still the value produced by the retried
effect.
