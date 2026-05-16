---
book: Effect `Schedule` Cookbook
section_number: "21.5"
section_title: "Capped exponential backoff"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "21. Choosing a Delay Strategy"
status: "draft"
code_included: true
---

# 21.5 Capped exponential backoff

Capped exponential backoff keeps the useful part of an exponential curve while
putting an operational ceiling on the delay between attempts. Early retries back
off quickly, which reduces pressure on an unhealthy dependency. Later retries
stop growing forever, which keeps the caller, worker, or supervisor from waiting
minutes or hours between attempts.

## Problem

You want retries to slow down after repeated transient failures, but an
uncapped exponential schedule eventually creates delays that are too large for
the operation that owns the retry.

A delay of 100 milliseconds, 200 milliseconds, 400 milliseconds, and 800
milliseconds may be exactly what you want at the start of an outage. The same
curve eventually reaches long waits that no longer match a request timeout,
queue lease, reconnect loop, or operational alert window.

## When to use it

Use capped exponential backoff when the first few retries should spread out
quickly, but every later retry still needs to happen within a known maximum
interval.

This is a common fit for idempotent calls to HTTP APIs, databases, queues,
caches, and control planes. The cap gives operators a concrete answer to "how
long can this wait between attempts?" while preserving the load-shedding
benefit of exponential growth.

## When not to use it

Do not use this policy to make unsafe work retryable. Non-idempotent writes need
idempotency keys, deduplication, transactions, or another domain guarantee
before retrying is safe.

Do not treat the cap as a total timeout. A policy capped at 5 seconds can still
spend much longer overall if it allows many retries. Use a retry limit or a
time budget when the whole operation must finish within a bound.

Do not use the same capped curve across a large fleet without thinking about
synchronization. If many clients fail together, add jitter after the base timing
is correct.

## Schedule shape

Start with `Schedule.exponential(base)`. It returns a schedule whose output is
the current delay and whose delay grows by the exponential factor.

Use `Schedule.modifyDelay` to clamp each computed delay before it is used:

```ts
const cappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  )
)
```

`Duration.min(delay, Duration.seconds(5))` keeps the exponential delay while it
is below 5 seconds. Once the exponential curve would exceed 5 seconds, the
modified schedule keeps returning 5 seconds as the delay between attempts.

Add a retry limit separately with `Schedule.both(Schedule.recurs(n))` when the
operation should eventually give up.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly service: string
}> {}

declare const refreshControlPlaneState: Effect.Effect<
  string,
  ServiceUnavailable
>

const cappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(8))
)

export const program = refreshControlPlaneState.pipe(
  Effect.retry(cappedBackoff)
)
```

The first call to `refreshControlPlaneState` runs immediately. If it fails with
`ServiceUnavailable`, retries use exponential delays starting at 100
milliseconds. Each delay is capped at 5 seconds, and `Schedule.recurs(8)` allows
at most eight retries after the original attempt.

## Variants

Use a smaller cap for interactive work:

```ts
const interactiveBackoff = Schedule.exponential("50 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(1)))
  ),
  Schedule.both(Schedule.recurs(4))
)
```

Use a larger cap for background recovery:

```ts
const backgroundBackoff = Schedule.exponential("500 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(30)))
  ),
  Schedule.both(Schedule.recurs(20))
)
```

If many processes may retry the same dependency together, keep the cap and add
jitter:

```ts
const fleetBackoff = cappedBackoff.pipe(
  Schedule.jittered
)
```

## Notes and caveats

`Schedule.modifyDelay` changes the delay chosen by the schedule. It does not
change the schedule output. For `Schedule.exponential`, the output remains the
uncapped exponential duration, even though the actual wait has been capped.

`Schedule.recurs(8)` means eight retries after the original attempt, not eight
total attempts.

With `Effect.retry`, failures are fed into the schedule. If the schedule stops,
the last typed failure is returned. If any attempt succeeds, the retry policy is
finished and the successful value is returned.
