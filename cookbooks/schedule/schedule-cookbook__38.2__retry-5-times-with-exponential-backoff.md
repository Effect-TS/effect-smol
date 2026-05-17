---
book: Effect `Schedule` Cookbook
section_number: "38.2"
section_title: "Retry 5 times with exponential backoff"
part_title: "Part IX — Composition Recipes"
chapter_title: "38. Combine Attempt Limits and Delays"
status: "draft"
code_included: true
---

# 38.2 Retry 5 times with exponential backoff

Exponential backoff is a good default when a failure may be temporary but
retrying immediately would add pressure to the dependency. The retry limit is
what makes that policy operationally bounded.

## Problem

You call a dependency that sometimes fails with a transient error. The operation
is safe to retry, but it should not retry forever and it should not hammer the
dependency while it is unhealthy.

You want the policy to say three things clearly:

- run the original attempt immediately
- after each failure, wait with exponential backoff
- stop after five scheduled retries

## When to use it

Use this recipe for idempotent work where a later attempt can reasonably
succeed: reading from an overloaded service, refreshing cached metadata,
submitting a deduplicated event, or calling an internal API during a short
deploy window.

It is especially useful when code reviewers and operators need an exact answer
to "how many times can this run?" With `Schedule.recurs(5)`, the answer is one
original attempt plus at most five retries.

## When not to use it

Do not use backoff to hide permanent failures. Bad input, forbidden access,
missing credentials, nonexistent resources, and schema errors should fail
without retrying.

Do not retry unsafe writes unless the operation has an idempotency key,
transaction boundary, or another guarantee that repeated execution cannot
duplicate the side effect.

Do not treat a retry count as a latency budget. Five retries can still take too
long if each attempt blocks before failing. If callers need a hard elapsed-time
limit, add `Schedule.during` or put an explicit timeout around the operation.

## Schedule shape

Start with the delay shape, then add the retry limit:

```ts
import { Schedule } from "effect"

const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

`Schedule.exponential("200 millis")` starts with a 200 millisecond delay and,
with the default factor, doubles the delay on later recurrences. The first few
delays are roughly 200 milliseconds, 400 milliseconds, 800 milliseconds, 1.6
seconds, and 3.2 seconds.

`Schedule.recurs(5)` allows five scheduled recurrences. With `Effect.retry`,
those recurrences are retries after failures. `Schedule.both` requires both
schedules to continue, so the combined policy stops when the retry count is
exhausted.

## Code

```ts
import { Effect, Schedule } from "effect"

type TransientError = {
  readonly _tag: "Timeout" | "Unavailable" | "RateLimited"
}

declare const callDownstream: Effect.Effect<string, TransientError>

const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

export const program = callDownstream.pipe(
  Effect.retry(retryPolicy)
)
```

The first call to `callDownstream` happens immediately. If it fails with a typed
`TransientError`, `Effect.retry` feeds that failure into the schedule. The
schedule then decides whether another retry is allowed and how long to wait
before running it.

With this policy, `callDownstream` can run at most six times total: one original
attempt plus five retries. If all retries fail, `Effect.retry` returns the last
typed failure.

## Variants

Use a larger base interval when the dependency needs more time to recover:

```ts
const slowerRetryPolicy = Schedule.exponential("1 second").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

Use a smaller retry limit for user-facing requests where returning a clear error
quickly matters more than exhausting every recovery chance:

```ts
const quickRetryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(2))
)
```

For fleet-wide retries, add jitter after the exponential cadence so identical
clients do not retry in lockstep:

```ts
const jitteredRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)
```

## Notes and caveats

`Schedule.exponential` is unbounded on its own. Always combine it with a retry
limit, elapsed-time budget, predicate, or another stopping condition for
request/response work.

`Schedule.recurs(5)` counts retries, not total executions. If a requirement says
"try five times total", use `Schedule.recurs(4)`.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as ordinary typed failures.
