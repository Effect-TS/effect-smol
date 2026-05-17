---
book: Effect `Schedule` Cookbook
section_number: "5.1"
section_title: "Retry every 100 milliseconds"
part_title: "Part II — Core Retry Recipes"
chapter_title: "5. Retry with Fixed Delays"
status: "draft"
code_included: true
---

# 5.1 Retry every 100 milliseconds

This recipe shows a very short fixed-delay retry policy using
`Schedule.spaced("100 millis")` with `Effect.retry`. The schedule controls the retry
timing, while the surrounding Effect code remains responsible for deciding which typed
failures are safe to retry.

## Problem

A fast operation can fail because of brief local contention or another condition
expected to clear almost immediately. You need each retry after the original
attempt to wait exactly 100 milliseconds, with no growth, jitter, or
error-dependent timing.

Use `Schedule.spaced("100 millis")` with `Effect.retry` for this policy.

## When to use it

Use this recipe when typed failures are expected to clear quickly and each retry
is cheap, safe, and idempotent. It fits short-lived local coordination, brief
resource contention, and tests or examples where a fixed delay makes the retry
shape easy to see.

It is also useful as the smallest fixed-delay retry building block before adding
a count limit in a later step.

## When not to use it

Do not use an unbounded 100 millisecond retry loop for expensive work,
rate-limited services, overloaded dependencies, or non-idempotent writes. A
fast fixed retry can make those situations worse.

Do not use this when retries should become less frequent after repeated
failures. That calls for backoff or jitter instead of a fixed 100 millisecond
spacing.

Do not use it to retry defects or interruptions. `Effect.retry` retries typed
failures from the error channel; defects and fiber interruptions are not retried
as typed failures.

## Schedule shape

`Schedule.spaced("100 millis")` is an unbounded schedule. It recurs
continuously, waiting 100 milliseconds between recurrences.

With `Effect.retry`, the first attempt happens immediately. If that attempt
fails with a typed error, the error is fed to the schedule. The schedule then
chooses the 100 millisecond delay, and the effect is attempted again after that
delay.

The shape is:

- attempt 1: run immediately
- if attempt 1 fails: wait 100 milliseconds
- attempt 2: run again
- if attempt 2 fails: wait 100 milliseconds
- continue until an attempt succeeds, the fiber is interrupted, or a bounded
  variant stops the schedule

The schedule output is a recurrence count, but plain `Effect.retry` returns the
eventual success value and does not expose that count.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly reason: string
}> {}

declare const request: Effect.Effect<string, RequestError>

const retryEvery100Millis = Schedule.spaced("100 millis")

const program = request.pipe(
  Effect.retry(retryEvery100Millis)
)
```

`program` runs `request` once immediately. If `request` fails with a typed
`RequestError`, it waits 100 milliseconds and tries again. Because
`Schedule.spaced("100 millis")` does not stop on its own, this continues until
one attempt succeeds or the fiber running `program` is interrupted.

## Variants

Bound the same fixed-delay policy with `Schedule.recurs` when you want a maximum
retry count:

```ts
const retryEvery100MillisUpTo5Times = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const boundedProgram = request.pipe(
  Effect.retry(retryEvery100MillisUpTo5Times)
)
```

`Schedule.both` continues only while both schedules continue. The spaced
schedule contributes the fixed 100 millisecond delay, and `Schedule.recurs(5)`
contributes the retry limit. If all retries fail, `Effect.retry` propagates the
last typed failure.

## Notes and caveats

`Schedule.spaced("100 millis")` delays retries; it does not delay the first
attempt. The first execution of the effect always happens immediately.

The delay is measured between retry attempts after the previous attempt has
failed. It does not make the whole operation run on a strict wall-clock cadence.

When bounding this policy, remember that `Schedule.recurs(5)` means five
retries after the original attempt, not five total attempts.

Keep the retry boundary narrow. Wrap the transient operation itself, not a
larger workflow that also performs effects that should not be repeated.
