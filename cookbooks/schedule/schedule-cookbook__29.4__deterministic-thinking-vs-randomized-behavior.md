---
book: Effect `Schedule` Cookbook
section_number: "29.4"
section_title: "Deterministic thinking vs randomized behavior"
part_title: "Part VI — Jitter Recipes"
chapter_title: "29. Jitter Tradeoffs"
status: "draft"
code_included: true
---

# 29.4 Deterministic thinking vs randomized behavior

Jitter is easiest to reason about when it is added to an explicit base schedule.
The cadence and stopping rule stay visible; only each computed delay becomes a
bounded random value.

## Problem

You want to spread retries from many clients, workers, or fibers without losing
the ability to explain the retry contract in code review. Operators still need
answers such as:

- How many times can this retry?
- What is the base backoff shape?
- What range can the next delay fall into?
- Does jitter change the stop condition?

The schedule should answer those questions directly. Randomness should be a
small, bounded modifier, not a hidden sleep inside the effect being retried.

## When to use it

Use this approach when a deterministic policy is easy to describe, but many
instances may run that policy at the same time. Common examples include service
reconnects, remote API retries, queue consumers, cache lookups, and polling
loops after a shared outage.

It is especially useful when you want predictable bounds rather than exact
timestamps. For example, a 500 millisecond base delay becomes a delay somewhere
from 400 to 600 milliseconds. The exact value is random, but the operational
range is deterministic.

## When not to use it

Do not add jitter when exact wall-clock timing is part of the requirement. A
cron-like job, a precisely timed heartbeat, or a test that asserts exact sleeps
should keep a deterministic schedule or assert delay bounds instead of exact
values.

Do not use jitter as a retry limit, a timeout, or a safety check for unsafe
operations. `Schedule.jittered` only adjusts delays. It does not decide whether
an operation is idempotent, which failures are retryable, or when the workflow
must stop.

## Schedule shape

Build the deterministic part first:

```ts
const basePolicy = Schedule.exponential("250 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

This says the retry waits are based on 250 milliseconds, then 500 milliseconds,
then 1 second, and so on, and that the policy permits at most five retries after
the original attempt.

Then add jitter to the delay-producing cadence:

```ts
const jitteredPolicy = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)
```

The recurrence limit remains deterministic. The base backoff remains
deterministic. Only each wait is randomized within Effect's fixed 80%-120%
range:

| Base delay | Possible jittered delay |
| ---------- | ----------------------- |
| 250 ms     | 200-300 ms              |
| 500 ms     | 400-600 ms              |
| 1 s        | 800 ms-1.2 s            |
| 2 s        | 1.6-2.4 s               |

That is the core reasoning model: deterministic policy shape, randomized delay
selection inside known bounds.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly status: number
}> {}

declare const refreshRemoteState: Effect.Effect<void, ServiceUnavailable>

const retryPolicy = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

export const program = refreshRemoteState.pipe(
  Effect.retry({
    schedule: retryPolicy,
    while: (error) => error.status === 429 || error.status >= 500
  })
)
```

`program` runs `refreshRemoteState` once immediately. If it fails with a
retryable `ServiceUnavailable`, the schedule decides whether another attempt is
allowed and how long to wait. The first retry waits somewhere from 200 to 300
milliseconds, because the base delay is 250 milliseconds. Later retries follow
the exponential sequence and jitter each delay within the same 80%-120% bounds.

If the error is not retryable, the `while` predicate stops retrying regardless
of the schedule. If all allowed retries fail, `Effect.retry` returns the last
typed failure.

## Variants

For user-facing work, keep the deterministic envelope small:

```ts
const interactivePolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)
```

This gives a quick answer while still avoiding perfectly synchronized retries.

For background work, pair jitter with an elapsed budget so the policy has both
a spread-out delay shape and a clear maximum retry window:

```ts
const backgroundPolicy = Schedule.exponential("1 second").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.during("2 minutes"))
)
```

The exact sleeps vary, but the policy still communicates its base backoff and
its total time budget.

## Notes and caveats

`Schedule.jittered` is not configurable in this API. It adjusts each recurrence
delay between 80% and 120% of the original delay.

Jitter preserves the wrapped schedule's output. If the wrapped schedule outputs
the exponential delay, the jittered schedule still has that output; the random
adjustment affects the sleep between recurrences.

Place jitter where you want the randomization to happen. If you want to jitter
the exponential backoff itself, apply `Schedule.jittered` after
`Schedule.exponential(...)` and before adding unrelated observation or naming
concerns. Keep count limits, elapsed budgets, and retry predicates explicit so
readers can separate deterministic decisions from randomized delay selection.
