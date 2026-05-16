---
book: Effect `Schedule` Cookbook
section_number: "23.4"
section_title: "Linear backoff when exponential is too aggressive"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "23. Linear Backoff Recipes"
status: "draft"
code_included: true
---

# 23.4 Linear backoff when exponential is too aggressive

Exponential backoff is a good default when repeated failures mean the caller
should quickly get out of the way. Sometimes that curve is too steep. A
dependency may recover in a few seconds, an interactive caller may still need a
prompt answer, or a worker may need to reduce pressure without going quiet for
long stretches.

Use linear backoff when you want each failure to add the same amount of extra
waiting time. Effect does not provide a `Schedule.linear` constructor; build the
shape explicitly from `Schedule.unfold` and `Schedule.addDelay`.

## Problem

You have a retryable operation, but doubling the delay after each failure would
push later retries too far away. For example, with a 250 millisecond base:

| Retry decision | Linear delay | Exponential delay |
| -------------- | ------------ | ----------------- |
| 1              | 250 ms       | 250 ms            |
| 2              | 500 ms       | 500 ms            |
| 3              | 750 ms       | 1000 ms           |
| 4              | 1000 ms      | 2000 ms           |
| 5              | 1250 ms      | 4000 ms           |

Both policies slow the caller down. The difference is the curve. Linear backoff
keeps adding one fixed increment, while `Schedule.exponential("250 millis")`
multiplies each later delay by the exponential factor, `2` by default.

## When to use it

Use linear backoff when repeated failures should reduce pressure gradually, but
later retries still need to stay close enough to catch a quick recovery. It
fits short-lived internal service disruption, local resource contention,
connection re-establishment, and background jobs where an exponential curve
would make the workflow appear stalled.

It is also useful when operators need a policy they can read at a glance:
"wait 250 milliseconds more after each failure, up to five retries" is easier
to reason about than a curve that grows by multiplication.

## When not to use it

Do not use linear backoff for failures that are not safe to retry. Validation
errors, authorization failures, malformed requests, and non-idempotent writes
without duplicate protection should be handled before the schedule is applied.

Do not use it when the dependency needs aggressive load shedding from each
caller. For overload that may last longer or affect many clients at once,
exponential backoff, a cap, jitter, and admission control are usually more
appropriate.

Do not leave a linear policy unbounded unless the operation is meant to retry
forever under external supervision. Linear growth is gentle, so an unbounded
schedule can keep work alive for a long time.

## Schedule shape

Start with a schedule that outputs the current retry step:

```ts
Schedule.unfold(1, (step) => Effect.succeed(step + 1))
```

`Schedule.unfold` outputs the current state and computes the next state for the
following decision. Starting at `1` makes the first retry delay one increment
instead of zero.

Then turn that step into an added delay:

```ts
Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 250)))
```

Because the unfold schedule has no delay of its own, the delay added here is
the retry delay. The resulting sequence is 250 milliseconds, 500 milliseconds,
750 milliseconds, 1 second, and so on.

Finally, add a stopping condition such as `Schedule.take(5)` so one operation
cannot retry forever.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class SearchIndexUnavailable extends Data.TaggedError("SearchIndexUnavailable")<{
  readonly shard: string
}> {}

declare const refreshSearchIndex: Effect.Effect<void, SearchIndexUnavailable>

const refreshBackoff = Schedule.unfold(1, (step) => Effect.succeed(step + 1)).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 250))),
  Schedule.take(5)
)

export const program = refreshSearchIndex.pipe(
  Effect.retry(refreshBackoff)
)
```

`program` runs `refreshSearchIndex` once immediately. If it fails with
`SearchIndexUnavailable`, the first retry waits 250 milliseconds. Later
failures wait 500 milliseconds, 750 milliseconds, 1 second, and 1250
milliseconds before the next retry, up to the limit.

If any attempt succeeds, the whole program succeeds with `void`. If the
original attempt and all five retries fail, `Effect.retry` propagates the last
`SearchIndexUnavailable`.

## Variants

Use a smaller increment when the caller is waiting for an answer:

```ts
const interactiveBackoff = Schedule.unfold(
  1,
  (step) => Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 100))),
  Schedule.take(3)
)
```

Use exponential backoff with a gentler factor when you still want a curve, but
the default doubling behavior is too abrupt:

```ts
const gentleExponentialBackoff = Schedule.exponential("250 millis", 1.5).pipe(
  Schedule.take(5)
)
```

This produces 250 milliseconds, 375 milliseconds, 562.5 milliseconds, and so
on. It is still exponential; the multiplier is just smaller than the default
factor of `2`.

If many fibers or processes may fail together, add jitter after the base
linear shape is correct:

```ts
const jitteredLinearBackoff = refreshBackoff.pipe(
  Schedule.jittered
)
```

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. The linear policy above
ignores the failure value and uses only schedule state, so classify retryable
and non-retryable failures at the retry boundary.

`Schedule.exponential(base)` returns the current duration between recurrences
and is unbounded by itself. The hand-built linear policy is also unbounded
until you add `Schedule.take`, `Schedule.recurs`, a time budget, or another
stopping condition.

Changing the initial state changes the first delay. Starting the unfold at `0`
would make the first added delay zero, which means the first retry would happen
immediately. Start at `1` when the first retry should wait one full increment.
