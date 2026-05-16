---
book: Effect `Schedule` Cookbook
section_number: "23.5"
section_title: "Linear backoff with a max bound"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "23. Linear Backoff Recipes"
status: "draft"
code_included: true
---

# 23.5 Linear backoff with a max bound

Linear backoff is useful when you want each retry to wait a little longer than
the previous one, but you do not want the curve to grow aggressively. The max
bound keeps that policy operationally predictable: after the delay reaches the
cap, later retries keep using the capped delay instead of growing forever.

Effect does not need a dedicated "linear backoff" constructor for this. Build a
small schedule that outputs a step number, turn that step into a delay, and cap
the computed duration before returning it.

## Problem

You want retry delays like 250 milliseconds, 500 milliseconds, 750
milliseconds, and 1 second, but never more than 1 second between attempts.

Scattered sleeps make that hard to review. A single `Schedule` value makes the
timing policy explicit and lets you add the retry limit, cap, logging, or jitter
at the same composition point.

## When to use it

Use linear backoff when repeated failures should slow the caller down gradually,
but exponential backoff would grow too quickly for the workflow.

This is a good fit for local worker retries, lightweight reconnect loops, and
background maintenance tasks where an unhealthy dependency needs relief but the
operation should still make steady progress.

## When not to use it

Do not use a schedule to make permanent failures look transient. Validation
errors, authorization failures, malformed requests, and unsafe non-idempotent
writes should be classified before applying retry.

Do not confuse the maximum delay with a total time budget. A policy capped at 1
second can still run for much longer overall if it allows many retries.

## Schedule shape

Use `Schedule.unfold` to emit a retry step, then use `Schedule.addDelay` to add
the delay derived from that step. Because `Schedule.unfold` has a zero base
delay, the delay returned from `Schedule.addDelay` is the delay between retry
attempts.

```ts
const maxDelay = Duration.seconds(1)

const linearDelay = (step: number) =>
  Duration.min(Duration.millis(step * 250), maxDelay)

const linearBackoff = Schedule.unfold(1, (step) =>
  Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(linearDelay(step)))
)
```

The first schedule output is `1`, so the first retry waits 250 milliseconds. The
next outputs produce 500 milliseconds, 750 milliseconds, and then 1 second. Once
the computed delay would exceed the cap, `Duration.min` keeps the delay at 1
second.

Add the retry limit separately. That keeps "how long to wait" independent from
"how many times to try".

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class SearchIndexUnavailable extends Data.TaggedError(
  "SearchIndexUnavailable"
)<{
  readonly shard: string
}> {}

declare const refreshSearchIndex: Effect.Effect<
  void,
  SearchIndexUnavailable
>

const maxDelay = Duration.seconds(1)

const delayForStep = (step: number) =>
  Duration.min(Duration.millis(step * 250), maxDelay)

const linearBackoff = Schedule.unfold(1, (step) =>
  Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(delayForStep(step))),
  Schedule.both(Schedule.recurs(8))
)

export const program = refreshSearchIndex.pipe(
  Effect.retry(linearBackoff)
)
```

The original `refreshSearchIndex` attempt runs immediately. If it fails with
`SearchIndexUnavailable`, retries use capped linear delays:

```text
250ms, 500ms, 750ms, 1000ms, 1000ms, ...
```

`Schedule.recurs(8)` allows at most eight retries after the original attempt.
If all retries fail, `Effect.retry` returns the last typed failure.

## Variants

For an interactive request, use a smaller cap and fewer retries:

```ts
const interactiveBackoff = Schedule.unfold(1, (step) =>
  Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) =>
    Effect.succeed(
      Duration.min(Duration.millis(step * 100), Duration.millis(500))
    )
  ),
  Schedule.both(Schedule.recurs(3))
)
```

For a background worker, increase the step size, cap, and retry limit:

```ts
const workerBackoff = Schedule.unfold(1, (step) =>
  Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) =>
    Effect.succeed(
      Duration.min(Duration.seconds(step), Duration.seconds(10))
    )
  ),
  Schedule.both(Schedule.recurs(20))
)
```

If many processes can fail at the same time, add jitter after the capped delay
is correct:

```ts
const fleetBackoff = linearBackoff.pipe(
  Schedule.jittered
)
```

## Notes and caveats

`Schedule.addDelay` adds to the schedule's existing delay. In this recipe the
base schedule is `Schedule.unfold`, whose own delay is zero, so the added
duration is the full retry delay. If you start from a schedule that already has
a delay, use `Schedule.modifyDelay` when you want to replace or clamp that
existing delay instead.

The schedule output is the step number, not the duration. If you need to observe
the actual delays for tests or logging, wrap the finished policy with
`Schedule.delays`.
