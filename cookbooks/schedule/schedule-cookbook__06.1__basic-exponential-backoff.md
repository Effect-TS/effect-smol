---
book: Effect `Schedule` Cookbook
section_number: "6.1"
section_title: "Basic exponential backoff"
part_title: "Part II — Core Retry Recipes"
chapter_title: "6. Retry with Exponential Backoff"
status: "draft"
code_included: true
---

# 6.1 Basic exponential backoff

This recipe introduces exponential retry backoff with `Schedule.exponential` and
`Effect.retry`. The schedule controls the growing retry delays, while the surrounding
Effect code remains responsible for deciding which typed failures are safe to retry.

## Problem

A dependency can be unhealthy long enough that fixed-delay retries keep too much
pressure on it. You need the first retry to happen after a small pause, then
each repeated failure should make the next retry wait longer.

Use `Schedule.exponential(base)` with `Effect.retry` for this policy. In
practice, combine it with a retry limit:

```ts
const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

This means "start with a 100 millisecond retry delay, double the delay after
each failed retry decision, and stop after at most five retries."

## When to use it

Use exponential backoff when typed failures are probably transient but repeated
immediate or fixed-delay retries would be too aggressive. It fits temporary
network failures, brief service unavailability, short database failovers, and
idempotent requests to dependencies that may need a little time to recover.

It is usually a better default than a tight retry loop for remote calls because
each failed attempt naturally slows the caller down.

## When not to use it

Do not use exponential backoff for operations that are not safe to run more
than once. Retried writes need idempotency, deduplication, transactions, or a
domain-specific recovery strategy.

Do not use an unbounded exponential schedule unless retrying forever is
intentional. `Schedule.exponential("100 millis")` keeps recurring on its own, so
production retry policies usually need `Schedule.recurs`, `times`, a predicate,
or another stopping condition.

Do not use basic exponential backoff as the only policy for a highly contended
service where many callers may retry at the same time. Basic backoff has no
jitter, so callers that fail together can retry together.

## Schedule shape

`Schedule.exponential(base)` is an unbounded schedule. It waits according to
`base * factor^n`, where the default factor is `2` and `n` is the number of
repetitions so far.

With the default factor, `Schedule.exponential("100 millis")` produces these
retry delays:

- first retry delay: 100 milliseconds
- second retry delay: 200 milliseconds
- third retry delay: 400 milliseconds
- fourth retry delay: 800 milliseconds
- continues doubling until another schedule stops it

With `Effect.retry`, the first attempt runs immediately. If that attempt fails
with a typed error, the error is fed to the schedule. The schedule decides
whether to retry and how long to sleep before the next attempt.

When combined with `Schedule.recurs(5)` using `Schedule.both`, both schedules
must want to continue. The exponential schedule contributes the growing delay,
and `Schedule.recurs(5)` contributes the retry limit. If all retries fail,
`Effect.retry` propagates the last typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly status: number
}> {}

declare const fetchUser: (id: string) => Effect.Effect<
  { readonly id: string; readonly name: string },
  RequestError
>

const retryWithBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = fetchUser("user-123").pipe(
  Effect.retry(retryWithBackoff)
)
```

`program` runs `fetchUser("user-123")` immediately. If it fails with a typed
`RequestError`, it waits 100 milliseconds and retries. Later failures wait 200,
400, 800, and 1600 milliseconds before the next retry, up to the five-retry
limit.

If any attempt succeeds, `program` succeeds with the user value. If the original
attempt and all five retries fail, `Effect.retry` returns the last
`RequestError`.

## Variants

Use a different factor when doubling is too aggressive:

```ts
const gentlerBackoff = Schedule.exponential("200 millis", 1.5).pipe(
  Schedule.both(Schedule.recurs(5))
)
```

This starts at 200 milliseconds, then grows by 1.5x on each retry decision:
200 milliseconds, 300 milliseconds, 450 milliseconds, and so on.

For a one-off retry policy, you can also keep the backoff schedule in the
options form and let `times` add the retry limit:

```ts
const program = fetchUser("user-123").pipe(
  Effect.retry({
    schedule: Schedule.exponential("100 millis"),
    times: 5
  })
)
```

Use the explicit `Schedule.exponential(...).pipe(Schedule.both(...))` form when
you want to name the policy, reuse it, or compose it further.

## Notes and caveats

The first execution is not delayed. Backoff begins only after the effect fails
with a typed error.

`Schedule.recurs(5)` means five retries after the original attempt, not five
total attempts. With an original attempt plus five retries, the effect can run
up to six times.

The schedule output of `Schedule.exponential` is the current delay duration.
After `Schedule.both(Schedule.recurs(5))`, the combined output is a tuple
containing the exponential delay and the recurrence count. Plain `Effect.retry`
uses that schedule output to drive retrying, but succeeds with the successful
value of the retried effect.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.

Basic exponential backoff has no jitter and no maximum delay cap. For large
fan-out systems, rate-limited APIs, or long-running retries, add the appropriate
limits before treating it as a production policy.
