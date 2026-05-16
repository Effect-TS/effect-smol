---
book: Effect `Schedule` Cookbook
section_number: "25.1"
section_title: "Never wait more than 5 seconds"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "25. Delay Capping Recipes"
status: "draft"
code_included: true
---

# 25.1 Never wait more than 5 seconds

You want a retry or polling policy whose delay may grow, but whose next wait is
never allowed to exceed 5 seconds. That is a delay cap, not a total timeout. The
operation can still run for longer than 5 seconds overall if the schedule allows
many recurrences, but each individual pause before the next attempt stays within
the 5-second ceiling.

## Problem

Unbounded backoff is useful at the beginning of a failure because it quickly
reduces pressure on an unhealthy dependency. Left alone, the same curve can
eventually produce waits that are too long for a request, reconnect loop,
lease-based worker, or status check.

You need to keep the backoff shape while making the maximum delay explicit:
never wait more than 5 seconds before the next recurrence.

## When to use it

Use this recipe when the first few retries should slow down quickly, but the
caller still needs a known upper bound on each wait.

It fits idempotent calls to remote APIs, database reconnects, queue consumers,
cache refreshes, control-plane calls, and polling loops where "try again
eventually" is acceptable but "wait minutes before the next try" is not.

The 5-second cap is especially useful for workflows owned by a user request,
worker lease, health check, supervisor, or operational alert where long retry
tails make behavior harder to reason about.

## When not to use it

Do not use a capped delay to make permanent failures look transient.
Validation errors, authorization failures, malformed requests, and unsafe
non-idempotent writes should be classified before retrying.

Do not confuse this with an elapsed-time budget. A schedule capped at 5 seconds
can still spend much more than 5 seconds overall. Add `Schedule.recurs`,
`Schedule.elapsed`, `Schedule.during`, or a surrounding timeout when the whole
operation must finish within a limit.

Do not use one synchronized capped policy across a large fleet without jitter.
The cap limits how long callers wait, but it does not by itself prevent many
callers from retrying together.

## Schedule shape

Start with the schedule that expresses the natural delay curve. For a retry
policy, that is often `Schedule.exponential("100 millis")`.

Then use `Schedule.modifyDelay` to rewrite each delay before it is used:

```ts
const cappedAt5Seconds = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  )
)
```

`Schedule.modifyDelay` receives the schedule output and the delay selected for
the next recurrence. Returning `Duration.min(delay, Duration.seconds(5))` keeps
the original delay while it is below 5 seconds, then clamps every larger delay
to exactly 5 seconds.

With `Effect.retry`, the first attempt still runs immediately. The cap applies
only after a typed failure has been fed into the schedule and the schedule has
chosen a delay before the next retry.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class RemoteError extends Data.TaggedError("RemoteError")<{
  readonly reason: string
}> {}

declare const callControlPlane: Effect.Effect<
  string,
  RemoteError
>

const cappedBackoff = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(8))
)

export const program = callControlPlane.pipe(
  Effect.retry(cappedBackoff)
)
```

`program` runs `callControlPlane` once immediately. If it fails with a typed
`RemoteError`, the retries use exponential backoff starting at 250 milliseconds.
The delay grows to 500 milliseconds, 1 second, 2 seconds, 4 seconds, and then is
capped at 5 seconds for later retries.

`Schedule.recurs(8)` allows at most eight retries after the original attempt.
If every attempt fails, `Effect.retry` returns the last `RemoteError`. If any
attempt succeeds, the schedule is no longer consulted and the successful string
is returned.

## Variants

Use the same cap with a faster initial delay for interactive work:

```ts
const interactiveBackoff = Schedule.exponential("50 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(4))
)
```

Use a slower base delay when retrying background work that should avoid putting
extra pressure on the dependency:

```ts
const backgroundBackoff = Schedule.exponential("1 second").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(20))
)
```

When many callers may retry the same dependency at the same time, add jitter
after the capped delay policy:

```ts
const fleetBackoff = cappedBackoff.pipe(
  Schedule.jittered
)
```

## Notes and caveats

`Schedule.modifyDelay` changes the actual delay used for the next recurrence. It
does not change the schedule output. For `Schedule.exponential`, the output is
still the uncapped exponential duration even though the wait has been capped.

The cap applies per delay. It does not cap total elapsed time, total attempts,
or the time spent inside each attempt.

`Schedule.recurs(8)` means eight retries after the original attempt, not eight
total attempts.

With `Effect.retry`, only typed failures from the error channel are retried.
Defects and interruptions are not turned into retryable errors by the schedule.
