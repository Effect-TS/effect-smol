---
book: Effect `Schedule` Cookbook
section_number: "5.3"
section_title: "Retry every 5 seconds"
part_title: "Part II — Core Retry Recipes"
chapter_title: "5. Retry with Fixed Delays"
status: "draft"
code_included: true
---

# 5.3 Retry every 5 seconds

This recipe shows a slower fixed-delay retry policy using
`Schedule.spaced("5 seconds")` with `Effect.retry`. The schedule controls the retry
timing, while the surrounding Effect code remains responsible for deciding which typed
failures are safe to retry.

## Problem

A dependency may need a little real recovery time before another attempt is
useful. You need each retry after the original attempt to wait exactly 5
seconds, with no growth, shrinkage, jitter, or error-dependent timing.

Use `Schedule.spaced("5 seconds")` with `Effect.retry` for this policy.

## When to use it

Use this recipe when typed failures may need a little real recovery time before
another attempt is useful. A 5-second interval fits idempotent calls to remote
services, reconnect loops, polling a temporarily unavailable dependency, or
work that should not hammer an unhealthy system.

It is also useful when a dependency asks callers to slow down, but does not
provide an exact retry-after value. The fixed delay keeps the retry shape simple
and predictable.

## When not to use it

Do not use an unbounded 5-second retry loop when the caller needs a clear
timeout, a maximum retry budget, or a fast failure. Five seconds can still add
up quickly if the operation keeps failing.

Do not use this when each failure should change the delay. Rate limits,
overload, and fleet-wide retry storms usually need backoff, jitter, or a
server-provided delay instead of a plain fixed interval.

Do not use it to retry defects or interruptions. `Effect.retry` retries typed
failures from the error channel; defects and fiber interruptions are not retried
as typed failures.

## Schedule shape

`Schedule.spaced("5 seconds")` is an unbounded schedule. It recurs
continuously, waiting 5 seconds between recurrences.

With `Effect.retry`, the first attempt happens immediately. If that attempt
fails with a typed error, the error is fed to the schedule. The schedule then
chooses the 5-second delay, and the effect is attempted again after that delay.

The shape is:

- attempt 1: run immediately
- if attempt 1 fails: wait 5 seconds
- attempt 2: run again
- if attempt 2 fails: wait 5 seconds
- continue until an attempt succeeds, the fiber is interrupted, or a bounded
  variant stops the schedule

The schedule output is a recurrence count, but plain `Effect.retry` returns the
eventual success value and does not expose that count.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly service: string
}> {}

declare const fetchInventory: Effect.Effect<ReadonlyArray<string>, ServiceUnavailable>

const retryEvery5Seconds = Schedule.spaced("5 seconds")

const program = fetchInventory.pipe(
  Effect.retry(retryEvery5Seconds)
)
```

`program` runs `fetchInventory` once immediately. If it fails with a typed
`ServiceUnavailable`, it waits 5 seconds and tries again. Because
`Schedule.spaced("5 seconds")` does not stop on its own, this continues until
one attempt succeeds or the fiber running `program` is interrupted.

## Variants

For most request/response work, bound the same fixed-delay policy with
`Schedule.recurs`:

```ts
const retryEvery5SecondsUpTo3Times = Schedule.spaced("5 seconds").pipe(
  Schedule.both(Schedule.recurs(3))
)

const boundedProgram = fetchInventory.pipe(
  Effect.retry(retryEvery5SecondsUpTo3Times)
)
```

This allows the original attempt plus at most three retries. The retries are
spaced 5 seconds apart, so a continuously failing operation can spend about 15
seconds waiting before `Effect.retry` propagates the last typed failure.

For a local one-off call site, the options form can express the same retry
limit with the same schedule:

```ts
const boundedProgram = fetchInventory.pipe(
  Effect.retry({
    schedule: Schedule.spaced("5 seconds"),
    times: 3
  })
)
```

Use the unbounded form only when the fiber is supervised by a larger lifetime,
such as a background process, daemon, or scoped service that can be interrupted
cleanly.

## Notes and caveats

`Schedule.spaced("5 seconds")` delays retries; it does not delay the first
attempt. The first execution of the effect always happens immediately.

The delay is measured between retry attempts after the previous attempt has
failed. It does not make the whole operation run on a strict wall-clock cadence.

When bounding this policy, remember that `Schedule.recurs(3)` means three
retries after the original attempt, not three total attempts.

Keep the retry boundary narrow. Wrap the transient operation itself, not a
larger workflow that also performs effects that should not be repeated.
