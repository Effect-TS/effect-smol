---
book: Effect `Schedule` Cookbook
section_number: "7.1"
section_title: "Exponential backoff with a maximum delay"
part_title: "Part II — Core Retry Recipes"
chapter_title: "7. Retry with Capped Backoff"
status: "draft"
code_included: true
---

# 7.1 Exponential backoff with a maximum delay

This recipe shows how to cap exponential backoff so retry delays grow early without
exceeding a maximum wait.

## Problem

Uncapped exponential backoff can grow beyond the latency budget for one
request, even when the first few retries are useful for reducing pressure on a
dependency.

Build the cap by composing schedules:

```ts
const cappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.either(Schedule.spaced("5 seconds")),
  Schedule.both(Schedule.recurs(8))
)
```

This means "use exponential delays starting at 100 milliseconds, never wait
more than 5 seconds between retries, and stop after at most 8 retries."

## When to use it

Use capped exponential backoff when failures are probably transient, repeated
retries should slow down, and there is still a practical upper bound on how
long one retrying operation should wait between attempts.

It fits external APIs, databases, queues, caches, and service calls where the
first few retries should back off quickly but later retries should settle into a
maximum polling interval.

The cap is especially useful when an uncapped exponential policy would create
delays that are too large for a user-facing request, background job lease, or
supervisor timeout.

## When not to use it

Do not use this policy for operations that are unsafe to run more than once.
Retried writes need idempotency, deduplication, transactions, or a
domain-specific recovery plan.

Do not confuse a maximum retry delay with an overall timeout. A capped policy
can still spend more total time retrying than the cap, because the cap applies
to each delay between attempts.

Do not use capped backoff as the whole resilience strategy for high fan-out
clients. If many callers can retry together, add jitter, concurrency limits, or
rate limiting around the call site.

## Schedule shape

`Schedule.exponential("100 millis")` is unbounded and returns growing delay
durations: 100 milliseconds, 200 milliseconds, 400 milliseconds, 800
milliseconds, and so on with the default factor of `2`.

`Schedule.spaced("5 seconds")` is also unbounded, but its delay is always 5
seconds.

`Schedule.either(left, right)` continues when either schedule wants to continue
and uses the minimum of the two schedule delays. When the left side is
exponential backoff and the right side is fixed spacing, that minimum gives the
cap:

- first retry: min(100 milliseconds, 5 seconds) = 100 milliseconds
- second retry: min(200 milliseconds, 5 seconds) = 200 milliseconds
- third retry: min(400 milliseconds, 5 seconds) = 400 milliseconds
- later retries: once exponential exceeds 5 seconds, use 5 seconds

`Schedule.either` is the part that caps the delay. `Schedule.both` has different
timing semantics: it continues only while both schedules continue and uses the
maximum of their delays. Use `Schedule.both(Schedule.recurs(n))` after the cap
when you want a retry limit.

With `Effect.retry`, the original effect runs immediately. If it fails with a
typed error, the error is fed to the capped schedule. The schedule chooses the
delay before the next retry. If all allowed retries fail, `Effect.retry`
propagates the last typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ApiError extends Data.TaggedError("ApiError")<{
  readonly status: number
}> {}

declare const request: Effect.Effect<string, ApiError>

const cappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.either(Schedule.spaced("5 seconds")),
  Schedule.both(Schedule.recurs(8))
)

const program = request.pipe(
  Effect.retry(cappedBackoff)
)
```

`program` runs `request` immediately. If it fails with a typed `ApiError`, it
waits 100 milliseconds and retries. Later failures wait 200 milliseconds, 400
milliseconds, 800 milliseconds, and so on until the exponential delay would
exceed 5 seconds. After that point, each retry waits 5 seconds.

`Schedule.recurs(8)` allows at most eight retries after the original attempt. If
any attempt succeeds, `program` succeeds with the string returned by `request`.
If the original attempt and all eight retries fail, `Effect.retry` returns the
last `ApiError`.

## Variants

Use a smaller cap for interactive work:

```ts
const interactiveBackoff = Schedule.exponential("50 millis").pipe(
  Schedule.either(Schedule.spaced("1 second")),
  Schedule.both(Schedule.recurs(5))
)
```

This grows quickly but never waits more than 1 second between retries.

Use a gentler factor when doubling reaches the cap too quickly:

```ts
const gentleCappedBackoff = Schedule.exponential("250 millis", 1.5).pipe(
  Schedule.either(Schedule.spaced("5 seconds")),
  Schedule.both(Schedule.recurs(10))
)
```

This starts at 250 milliseconds and multiplies each later exponential delay by
1.5, while still using 5 seconds as the maximum delay.

When only some typed failures are retryable, keep the same schedule and add a
retry predicate at the boundary:

```ts
const program = request.pipe(
  Effect.retry({
    schedule: cappedBackoff,
    while: (error) => error.status === 429 || error.status === 503
  })
)
```

The schedule still controls delay and count. The predicate decides which typed
failures are allowed to use that retry policy.

## Notes and caveats

There is no special `Schedule.cap` API in this recipe. The cap comes from
`Schedule.either(Schedule.spaced(maxDelay))`, because `either` uses the minimum
delay while either side continues.

Do not use `Schedule.both` to combine the exponential schedule with the fixed
maximum delay. `both` uses the maximum delay, so it would wait at least the
fixed duration from the first retry instead of capping only the large
exponential delays.

`Schedule.recurs(8)` means eight retries after the original attempt, not eight
total attempts.

The schedule output is nested composition data: `either` outputs the outputs of
both sides, and `both` adds the recurrence count. Plain `Effect.retry` uses the
schedule for retry timing and stops, but the successful value is still the value
produced by the retried effect.

The first execution is not delayed. Backoff begins only after the effect fails
with a typed error.
