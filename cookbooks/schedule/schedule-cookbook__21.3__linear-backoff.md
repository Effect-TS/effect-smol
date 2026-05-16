---
book: Effect `Schedule` Cookbook
section_number: "21.3"
section_title: "Linear backoff"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "21. Choosing a Delay Strategy"
status: "draft"
code_included: true
---

# 21.3 Linear backoff

Linear backoff slows a retry loop by adding the same amount of extra delay at
each decision point. It is a gradual pressure-reduction strategy: the caller
backs away from an unhealthy dependency, but the delay curve stays easy to
explain and does not grow as quickly as exponential backoff.

Effect does not provide a dedicated `Schedule.linear` constructor. Build this
policy from a stateful schedule that counts retry decisions, then add a delay
derived from that count.

## Problem

You need retries to become less aggressive after repeated failures, but
doubling delays would be too steep. For example, a worker may call a dependency
that usually recovers within a few seconds, and you want delays such as 250
milliseconds, 500 milliseconds, 750 milliseconds, and 1 second before giving
up.

Use `Schedule.unfold` to produce the retry step and `Schedule.addDelay` to turn
that step into a delay:

```ts
const retryPolicy = Schedule.unfold(1, (step) => Effect.succeed(step + 1)).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 250))),
  Schedule.take(5)
)
```

The first execution still happens immediately. If it fails with a typed error,
the schedule waits 250 milliseconds before the first retry, then increases the
wait by another 250 milliseconds on each later retry decision.

## When to use it

Use linear backoff when each failure should reduce pressure, but you still want
predictable recovery speed. It fits short-lived overload, brief queue or cache
contention, reconnect attempts inside a single process, and internal services
where a simple fixed increment is easier to reason about than an exponential
curve.

Linear backoff is also useful when operators need to read the policy quickly:
"add 250 milliseconds per failure, stop after five retries" is often easier to
review than a larger composed policy.

## When not to use it

Do not use linear backoff to retry permanent failures. Authentication errors,
validation failures, malformed requests, and unsafe non-idempotent writes should
be handled before the retry policy is applied.

Do not use it as a fleet-wide protection mechanism by itself. If many callers
fail together, a deterministic linear policy can still make them retry together.
For clustered systems or public APIs, consider adding jitter after choosing the
base delay curve.

Do not leave the schedule unbounded unless retrying forever is intentional. A
linear delay grows slowly, so an unbounded policy can keep work alive for a long
time.

## Schedule shape

`Schedule.unfold(initial, next)` outputs the current state and computes the next
state for the following decision. Starting at `1` makes the first retry delay
one increment instead of zero.

`Schedule.addDelay` adds an extra delay based on the schedule output. Because
`Schedule.unfold` has no delay of its own, the added delay becomes the retry
delay.

`Schedule.take(5)` bounds the schedule so the effect can retry only a limited
number of times after the original attempt.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class IndexError extends Data.TaggedError("IndexError")<{
  readonly reason: "busy" | "unavailable"
}> {}

declare const refreshSearchIndex: Effect.Effect<void, IndexError>

const retryWithLinearBackoff = Schedule.unfold(
  1,
  (step) => Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 250))),
  Schedule.take(5)
)

export const program = refreshSearchIndex.pipe(
  Effect.retry(retryWithLinearBackoff)
)
```

`program` runs `refreshSearchIndex` immediately. If it fails, it waits 250
milliseconds and retries. Later failures wait 500, 750, 1000, and 1250
milliseconds before the next retry, up to the retry limit.

If any attempt succeeds, the program succeeds with `void`. If the original
attempt and all retries fail, `Effect.retry` returns the last `IndexError`.

## Variants

Use a smaller increment for user-facing paths where responsiveness matters:

```ts
const quickLinearBackoff = Schedule.unfold(1, (step) => Effect.succeed(step + 1)).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 100))),
  Schedule.take(3)
)
```

Use a larger increment for background work that should reduce downstream
pressure more visibly:

```ts
const backgroundLinearBackoff = Schedule.unfold(
  1,
  (step) => Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.seconds(step))),
  Schedule.take(10)
)
```

If many processes may retry at the same time, add jitter to the finished policy:

```ts
const jitteredLinearBackoff = retryWithLinearBackoff.pipe(
  Schedule.jittered
)
```

## Notes and caveats

The step value is schedule state, not the result of the retried effect.
`Effect.retry` feeds typed failures into the schedule, but this policy ignores
the failure value and only uses the retry count.

Because the delay is computed with `Duration.millis(step * 250)`, changing the
initial state changes the first delay. Start at `0` only when an immediate first
retry is intentional.

Linear backoff has no built-in cap. If the retry count can become large, add a
limit such as `Schedule.take`, a time budget, or a maximum-delay policy before
using it in production.
