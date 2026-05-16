---
book: Effect `Schedule` Cookbook
section_number: "5.2"
section_title: "Retry every second"
part_title: "Part II — Core Retry Recipes"
chapter_title: "5. Retry with Fixed Delays"
status: "draft"
code_included: true
---

# 5.2 Retry every second

You want a failing effect to try again after a clear, fixed delay of one second. The
delay should not grow, shrink, jitter, or depend on the error. This recipe keeps the
retry policy explicit: the schedule decides when another typed failure should be
attempted again and where retrying stops. The surrounding Effect code remains
responsible for domain safety, including which failures are transient, whether the
operation is idempotent, and how the final failure is reported.

## Problem

You want a failing effect to try again after a clear, fixed delay of one second.
The delay should not grow, shrink, jitter, or depend on the error. Every retry
should wait one second before the next attempt.

Use `Schedule.spaced("1 second")` with `Effect.retry` for this policy.

## When to use it

Use this recipe when failures are likely to be temporary, but immediate retries
would be too noisy or too aggressive. A one-second pause is often readable in
logs, friendly to nearby dependencies, and still quick enough for short-lived
recovery.

It fits idempotent requests, reconnect attempts, brief service restarts, and
local coordination where trying again once per second is an acceptable cadence.

## When not to use it

Do not use an unbounded one-second retry loop when the operation can keep
failing for a long time. `Schedule.spaced("1 second")` does not stop by itself,
so use a bounded variant when the caller needs a final failure.

Do not use a fixed one-second delay for overloaded or rate-limited dependencies
that need demand to spread out over time. Those cases usually call for
exponential backoff, jitter, server-provided retry metadata, or a wider timeout
policy.

Do not use it for operations that are not safe to run more than once. Retrying a
write requires idempotency, deduplication, or another domain-specific guarantee.

## Schedule shape

`Schedule.spaced("1 second")` is an unbounded schedule. Each recurrence has the
same one-second delay.

With `Effect.retry`, the first attempt runs immediately. If that attempt fails
with a typed error, the error is fed to the schedule. The schedule then chooses
the one-second delay, and the effect is attempted again after that delay.

The shape is:

- attempt 1: run immediately
- if attempt 1 fails: wait 1 second
- attempt 2: run again
- if attempt 2 fails: wait 1 second
- continue until an attempt succeeds, the fiber is interrupted, or a bounded
  variant stops the schedule

The schedule output is a recurrence count. Plain `Effect.retry` uses the
schedule to decide whether and when to retry, but returns the eventual success
value rather than the schedule output.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly endpoint: string
}> {}

interface ResponseBody {
  readonly status: "ok"
  readonly value: string
}

declare const fetchStatus: Effect.Effect<ResponseBody, ServiceUnavailable>

const retryEverySecond = Schedule.spaced("1 second")

const program = fetchStatus.pipe(
  Effect.retry(retryEverySecond)
)
```

`program` runs `fetchStatus` once immediately. If it fails with a typed
`ServiceUnavailable`, it waits one second and tries again. Because
`Schedule.spaced("1 second")` is unbounded, this continues until one attempt
succeeds or the fiber running `program` is interrupted.

## Variants

Bound the same one-second retry cadence with `Schedule.recurs` when you want a
maximum retry count:

```ts
const retryEverySecondUpTo5Times = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(5))
)

const boundedProgram = fetchStatus.pipe(
  Effect.retry(retryEverySecondUpTo5Times)
)
```

This policy retries at most five times after the original attempt. If every
attempt fails, `Effect.retry` propagates the last typed failure.

For a local one-off call site, the options form expresses the same bounded
shape:

```ts
const boundedProgram = fetchStatus.pipe(
  Effect.retry({
    schedule: Schedule.spaced("1 second"),
    times: 5
  })
)
```

Use the named schedule form when you want to reuse the policy or compose it with
more schedule operators.

## Notes and caveats

`Schedule.spaced("1 second")` delays retries; it does not delay the first
attempt. The first execution of the effect always happens immediately.

The delay is measured after a failed attempt before the next retry begins. It
does not make the whole operation run on a strict wall-clock cadence.

When bounding this policy, remember that `Schedule.recurs(5)` means five
retries after the original attempt, not five total attempts.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.
