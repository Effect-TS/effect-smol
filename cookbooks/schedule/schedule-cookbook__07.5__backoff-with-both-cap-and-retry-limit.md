---
book: Effect `Schedule` Cookbook
section_number: "7.5"
section_title: "Backoff with both cap and retry limit"
part_title: "Part II — Core Retry Recipes"
chapter_title: "7. Retry with Capped Backoff"
status: "draft"
code_included: true
---

# 7.5 Backoff with both cap and retry limit

You want exponential backoff, but two separate bounds must hold at the same time: no
delay between retries should grow beyond a practical maximum the retrying operation
should stop after a fixed number of retries. This recipe keeps the retry policy
explicit: the schedule decides when another typed failure should be attempted again and
where retrying stops. The surrounding Effect code remains responsible for domain safety,
including which failures are transient, whether the operation is idempotent, and how the
final failure is reported.

## Problem

You want exponential backoff, but two separate bounds must hold at the same
time:

- no delay between retries should grow beyond a practical maximum
- the retrying operation should stop after a fixed number of retries

Build those two bounds by composing schedules:

```ts
const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.either(Schedule.spaced("1 second")),
  Schedule.both(Schedule.recurs(5))
)
```

This means "start retry delays at 100 milliseconds, cap each delay at 1 second,
and allow at most 5 retries after the original attempt."

## When to use it

Use this recipe when an operation should slow down after repeated failures, but
the caller still has a clear retry budget. This is common for idempotent calls
to HTTP APIs, queues, caches, databases, and service clients where unlimited
retrying would hold resources for too long.

The cap keeps later retries from becoming too far apart for the request,
worker, or supervisor that owns the operation. The retry limit keeps the
operation from retrying forever when the dependency remains unavailable.

This is also a good shape when you want an explicit retry policy that can be
reviewed from two numbers: the largest delay and the maximum number of retries.

## When not to use it

Do not use this policy for non-idempotent writes unless the operation has a
deduplication key, transaction boundary, or another guarantee that repeated
execution is safe.

Do not treat the delay cap as a total timeout. A policy capped at 1 second and
limited to 5 retries can still spend several seconds retrying, because the cap
applies to each delay between attempts.

Do not use this as the only protection for large fleets of clients retrying the
same dependency. A capped retry limit bounds each caller, but synchronized
callers can still create retry bursts. Add jitter, concurrency limits, or
rate-limiting when many clients may fail together.

## Schedule shape

`Schedule.exponential("100 millis")` is unbounded. It always recurs and returns
the current delay duration. With the default factor of `2`, the first delays are
100 milliseconds, 200 milliseconds, 400 milliseconds, 800 milliseconds, and so
on.

`Schedule.spaced("1 second")` is also unbounded. It always recurs with the
same delay: 1 second.

`Schedule.either(left, right)` continues when either schedule wants to continue
and uses the minimum of the two schedule delays. Combining exponential backoff
with fixed spacing therefore creates the cap:

- min(100 milliseconds, 1 second) = 100 milliseconds
- min(200 milliseconds, 1 second) = 200 milliseconds
- min(400 milliseconds, 1 second) = 400 milliseconds
- min(800 milliseconds, 1 second) = 800 milliseconds
- once exponential delay exceeds 1 second, the combined delay is 1 second

The capped backoff is still unbounded because both sides of `either` are
unbounded. Add the retry limit with `Schedule.both(Schedule.recurs(5))`.

`Schedule.both(left, right)` continues only while both schedules want to
continue and uses the maximum of their delays. `Schedule.recurs(5)` contributes
the stopping condition and no additional wait, so the capped backoff still
controls the delay while `recurs` controls the retry count.

With `Effect.retry`, the original effect runs immediately. After each typed
failure, the schedule decides whether another retry is allowed and, if so, how
long to wait before that retry. If the retry limit is exhausted, `Effect.retry`
propagates the last typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class GatewayError extends Data.TaggedError("GatewayError")<{
  readonly status: number
}> {}

declare const submitRequest: Effect.Effect<string, GatewayError>

const cappedBackoffWithLimit = Schedule.exponential("100 millis").pipe(
  Schedule.either(Schedule.spaced("1 second")),
  Schedule.both(Schedule.recurs(5))
)

const program = submitRequest.pipe(
  Effect.retry(cappedBackoffWithLimit)
)
```

`program` calls `submitRequest` once immediately. If it fails with a typed
`GatewayError`, it waits 100 milliseconds and retries. Later failures wait 200
milliseconds, 400 milliseconds, 800 milliseconds, and then never more than 1
second.

`Schedule.recurs(5)` allows at most five retries after the original attempt. If
the original attempt and all five retries fail, `program` fails with the last
`GatewayError`.

## Variants

Use a smaller retry budget for an interactive request:

```ts
const interactivePolicy = Schedule.exponential("50 millis").pipe(
  Schedule.either(Schedule.spaced("250 millis")),
  Schedule.both(Schedule.recurs(4))
)
```

This keeps the first retries fast, caps each delay at 250 milliseconds, and
gives up after four retries.

Use a larger cap and budget for background work:

```ts
const backgroundPolicy = Schedule.exponential("500 millis").pipe(
  Schedule.either(Schedule.spaced("10 seconds")),
  Schedule.both(Schedule.recurs(12))
)
```

This lets a worker continue longer without allowing the delay between attempts
to grow beyond 10 seconds.

When only some typed failures should be retried, keep the same schedule and add
a retry predicate at the boundary:

```ts
const program = submitRequest.pipe(
  Effect.retry({
    schedule: cappedBackoffWithLimit,
    while: (error) => error.status === 429 || error.status >= 500
  })
)
```

The schedule controls delay and retry count. The predicate decides which typed
failures are eligible to use that policy.

## Notes and caveats

There is no special cap constructor in this recipe. The cap comes from
`Schedule.either(Schedule.spaced(maxDelay))`, because `either` uses the minimum
delay while either side continues.

Do not replace `either` with `both` for the cap. `Schedule.both` uses the
maximum delay, so combining `Schedule.exponential("100 millis")` directly with
`Schedule.spaced("1 second")` would wait at least 1 second from the first
retry instead of capping only the later exponential delays.

Place `Schedule.both(Schedule.recurs(n))` after the cap when you want both
constraints. The capped schedule supplies the delay. `recurs(n)` supplies the
maximum number of retries after the original attempt.

`Schedule.recurs(5)` means five retries after the original attempt, not five
total attempts.

The composed schedule output is nested composition data from `either` and
`both`. Plain `Effect.retry` uses the schedule for timing and stopping, but the
successful value is still the value produced by the retried effect.
