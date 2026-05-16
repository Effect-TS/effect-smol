---
book: Effect `Schedule` Cookbook
section_number: "7.2"
section_title: "Preventing excessively long waits"
part_title: "Part II — Core Retry Recipes"
chapter_title: "7. Retry with Capped Backoff"
status: "draft"
code_included: true
---

# 7.2 Preventing excessively long waits

You want exponential backoff, but you do not want a single retry policy to wait longer
and longer without a practical upper bound. Exponential growth is useful early in a
failure: the caller quickly backs away from an unhealthy dependency. This recipe keeps
the retry policy explicit: the schedule decides when another typed failure should be
attempted again and where retrying stops. The surrounding Effect code remains
responsible for domain safety, including which failures are transient, whether the
operation is idempotent, and how the final failure is reported.

## Problem

You want exponential backoff, but you do not want a single retry policy to wait
longer and longer without a practical upper bound. Exponential growth is useful
early in a failure: the caller quickly backs away from an unhealthy dependency.
After enough failures, though, the next wait can become longer than the caller's
latency budget, the job's usefulness window, or the time an operator expects
before seeing a final failure.

There is no need to invent a special cap API. Compose the exponential schedule
with a fixed `Schedule.spaced(cap)` schedule using `Schedule.either`, then add a
separate count limit:

```ts
const cappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.either(Schedule.spaced("5 seconds")),
  Schedule.both(Schedule.recurs(8))
)
```

`Schedule.either` uses the minimum of the two schedule delays. While the
exponential delay is below five seconds, it wins. Once it grows beyond five
seconds, the fixed five-second schedule wins. `Schedule.recurs(8)` keeps the
whole retry policy finite.

## When to use it

Use this recipe when exponential backoff is the right shape, but unbounded wait
growth is not acceptable. It fits idempotent calls to services that may be
temporarily overloaded, rate-limited, restarting, or slow to recover.

The cap is especially useful for request or job workflows with a known
usefulness window. Waiting 100 milliseconds, then 200 milliseconds, then 400
milliseconds may be helpful. Waiting several minutes before the next retry may
be worse than surfacing the failure and letting a higher-level workflow decide
what to do.

Use the count limit for the retry budget and the cap for the maximum delay
between retries. They solve different problems and usually belong together.

## When not to use it

Do not use a capped backoff policy to retry permanent failures such as invalid
input, missing authorization, or a request the downstream will never accept.
Those failures should fail fast or be handled by domain logic.

Do not treat the cap as a timeout for one attempt. A schedule controls the delay
between attempts; it does not interrupt an effect that is currently running. Use
timeout operators around the effect itself when an individual attempt needs a
deadline.

Do not leave the capped policy unbounded unless retrying forever is intentional.
`Schedule.exponential("100 millis").pipe(Schedule.either(Schedule.spaced("5 seconds")))`
still recurs forever because both component schedules recur forever.

## Schedule shape

`Schedule.exponential(base)` is an unbounded schedule. With the default factor
of `2`, `Schedule.exponential("100 millis")` produces retry delays of 100
milliseconds, 200 milliseconds, 400 milliseconds, 800 milliseconds, and so on.

`Schedule.spaced("5 seconds")` is also unbounded. It contributes the same
five-second delay at every recurrence.

`Schedule.either(left, right)` recurs while either schedule wants to recur and
uses the minimum of the two durations between recurrences. Combining the
exponential schedule with the fixed spaced schedule therefore caps each wait:

| Retry delay decision | Exponential delay  | Spaced cap | Effective delay   |
| -------------------- | ------------------ | ---------- | ----------------- |
| 1                    | 100 milliseconds   | 5 seconds  | 100 milliseconds  |
| 2                    | 200 milliseconds   | 5 seconds  | 200 milliseconds  |
| 3                    | 400 milliseconds   | 5 seconds  | 400 milliseconds  |
| 4                    | 800 milliseconds   | 5 seconds  | 800 milliseconds  |
| 5                    | 1600 milliseconds  | 5 seconds  | 1600 milliseconds |
| 6                    | 3200 milliseconds  | 5 seconds  | 3200 milliseconds |
| 7                    | 6400 milliseconds  | 5 seconds  | 5 seconds         |
| 8                    | 12800 milliseconds | 5 seconds  | 5 seconds         |

Finally, `Schedule.both(Schedule.recurs(8))` gives the policy intersection
semantics. The combined schedule continues only while the capped backoff and the
count limit both continue. `Schedule.recurs(8)` means at most eight retries
after the original attempt, so the effect can run at most nine times total.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly service: string
  readonly status: number
}> {}

interface AccountSummary {
  readonly id: string
  readonly balance: number
}

declare const loadAccountSummary: (
  id: string
) => Effect.Effect<AccountSummary, ServiceUnavailable>

const cappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.either(Schedule.spaced("5 seconds")),
  Schedule.both(Schedule.recurs(8))
)

const program = loadAccountSummary("account-123").pipe(
  Effect.retry(cappedBackoff)
)
```

`program` calls `loadAccountSummary("account-123")` once immediately. If it
fails with a typed `ServiceUnavailable`, the first retry waits 100
milliseconds. Later retry waits are 200 milliseconds, 400 milliseconds, 800
milliseconds, 1600 milliseconds, 3200 milliseconds, and then at most five
seconds.

If the account call eventually succeeds, the whole effect succeeds with the
`AccountSummary`. If the original attempt and all eight retries fail,
`Effect.retry` propagates the last `ServiceUnavailable`.

## Variants

Choose the cap from your latency budget:

```ts
const userFacingBackoff = Schedule.exponential("50 millis").pipe(
  Schedule.either(Schedule.spaced("1 second")),
  Schedule.both(Schedule.recurs(4))
)
```

This policy backs off quickly but never waits more than one second before the
next retry. It allows at most four retries after the original attempt.

Use a higher cap for background work that can wait longer but should still have
a bounded retry cadence:

```ts
const backgroundBackoff = Schedule.exponential("500 millis").pipe(
  Schedule.either(Schedule.spaced("30 seconds")),
  Schedule.both(Schedule.recurs(10))
)
```

The cap limits the longest single wait. The recurrence count still controls how
many retries the workflow can spend before returning the final typed failure.

When only some typed failures are retryable, keep the same capped schedule and
filter at the retry boundary:

```ts
const isRetryable = (error: ServiceUnavailable) => error.status === 429 || error.status >= 500

const retryRetryableFailures = loadAccountSummary("account-123").pipe(
  Effect.retry({
    schedule: cappedBackoff,
    while: isRetryable
  })
)
```

The schedule controls timing and count. The predicate decides which typed
failures are allowed to use the retry policy.

## Notes and caveats

The first attempt is not delayed. The schedule is consulted only after a typed
failure and before a retry attempt.

`Schedule.either` gives union semantics for continuation, not a stopping
condition. In this recipe, the cap works because `either` also uses the minimum
delay between the two schedules.

`Schedule.both` is what applies the finite retry budget. Because `both` uses the
maximum of the combined delays, pairing the capped backoff with
`Schedule.recurs(8)` preserves the capped backoff delay while adding the count
limit.

The schedule output of `Schedule.either` is a tuple containing the outputs of
the exponential schedule and the spaced schedule. After `Schedule.both`, the
output is nested with the recurrence count. Plain `Effect.retry` uses the
schedule for retry decisions and returns the successful value of the retried
effect, so this output shape usually does not matter.

A cap prevents excessive individual waits. It does not add jitter, does not
read provider-specific retry headers, and does not make non-idempotent work safe
to retry.
