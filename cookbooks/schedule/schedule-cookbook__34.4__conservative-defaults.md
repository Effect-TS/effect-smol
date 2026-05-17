---
book: Effect `Schedule` Cookbook
section_number: "34.4"
section_title: "Conservative defaults"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "34. Stop After N Attempts"
status: "draft"
code_included: true
---

# 34.4 Conservative defaults

Conservative recurrence policies make small counts, visible delays, and explicit
classification the default at the call site.

## Problem

An unbounded or broadly shared recurrence policy can turn a small failure into a
larger operational problem. A retry loop without a low count can keep pressure
on an unhealthy dependency. A repeat loop without a clear stop condition can
poll forever. A policy that retries every typed error can hide validation,
authorization, or duplicate-write bugs behind extra attempts.

You need a default shape that is intentionally modest: classify first, then
retry or repeat with a low recurrence count and a visible delay.

## When to use it

Use this recipe when adding the first retry or repeat policy to a call site and
there is no stronger domain-specific policy yet.

It fits user-facing requests, control-plane calls, health checks, short polling
loops, and background jobs where a couple of extra attempts are useful but a
long tail would make behavior harder to reason about.

It is also a good review baseline. If a caller needs more retries, faster
spacing, or a longer polling window, that choice should be justified by the
operation's safety and service-level expectations.

## When not to use it

Do not use conservative scheduling to make permanent failures look transient.
Validation errors, authentication failures, authorization failures, malformed
requests, and unsafe non-idempotent writes should fail before the schedule is
applied.

Do not use a low retry count as a substitute for idempotency. Retrying a
non-idempotent operation is still unsafe unless the operation has a duplicate
protection mechanism such as an idempotency key.

Do not use one default policy everywhere. A UI read, a queue worker, and a
database reconnect loop usually deserve different counts, spacing, and
classification.

## Schedule shape

Start with the smallest useful recurrence budget. For many call sites, that is
two or three retries after the original attempt.

For retrying typed failures, combine spacing with a recurrence limit:

```ts
const conservativeRetry = Schedule.spaced("250 millis").pipe(
  Schedule.both(Schedule.recurs(2))
)
```

`Schedule.spaced("250 millis")` waits between retry attempts.
`Schedule.recurs(2)` allows at most two retries after the original attempt.
`Schedule.both` keeps both requirements in force: the policy continues only
while the spacing schedule and the count schedule both continue.

For repeating successful observations, use the same idea, but remember that the
schedule sees successful values rather than failures:

```ts
const conservativeRepeat = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(4))
)
```

With `Effect.retry`, the first attempt runs immediately and typed failures are
fed into the schedule. With `Effect.repeat`, the first successful value is
produced immediately and successful values are fed into the schedule to decide
whether another run should happen.

## Code

```ts
import { Data, Effect, Ref, Schedule } from "effect"

class ServiceError extends Data.TaggedError("ServiceError")<{
  readonly reason: "Unavailable" | "RateLimited" | "BadRequest"
  readonly attempt: number
}> {}

const isRetryable = (error: ServiceError): boolean =>
  error.reason === "Unavailable" || error.reason === "RateLimited"

const callService = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)

  if (attempt === 1) {
    return yield* Effect.fail(
      new ServiceError({ reason: "Unavailable", attempt })
    )
  }

  if (attempt === 2) {
    return yield* Effect.fail(
      new ServiceError({ reason: "RateLimited", attempt })
    )
  }

  return "accepted"
})

const conservativeRetry = Schedule.spaced("250 millis").pipe(
  Schedule.both(Schedule.recurs(2))
)

export const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  return yield* callService(attempts).pipe(
    Effect.retry({
      schedule: conservativeRetry,
      while: isRetryable
    })
  )
})
```

The original `callService` attempt runs immediately. If it fails with
`Unavailable` or `RateLimited`, `Effect.retry` waits 250 milliseconds before the
next attempt. The policy allows at most two retries after the original attempt.

The `while` predicate is part of the conservative default. `BadRequest` is a
typed failure too, but it is not a retryable failure for this operation. If
`callService` returned `BadRequest`, retrying would stop immediately and that
failure would be returned.

## Variants

For a slightly more forgiving user-facing read, use exponential backoff but
keep the count small:

```ts
const userFacingReadRetry = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)
```

The delays are 100 milliseconds, 200 milliseconds, and 400 milliseconds before
the three possible retries.

For a background retry that may be started by many workers, add jitter after the
base policy:

```ts
const workerRetry = Schedule.spaced("1 second").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)
```

`Schedule.jittered` changes each delay to a random value between 80% and 120%
of the original delay. It spreads retries that would otherwise happen at the
same boundary, but it does not change which failures are retryable.

For a short polling loop, repeat successful checks with a clear count:

```ts
declare const checkStatus: Effect.Effect<"Pending" | "Done">

const shortPoll = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(4))
)

export const pollStatus = checkStatus.pipe(
  Effect.repeat({
    schedule: shortPoll,
    while: (status) => status === "Pending"
  })
)
```

Here the classification is on successful values. The loop repeats only while
the status is still `Pending`, and it can run at most four additional checks
after the first successful check.

## Notes and caveats

`Schedule.recurs(n)` means `n` recurrences after the original execution. For
`Effect.retry`, that means `n` retries after the first attempt. For
`Effect.repeat`, that means `n` repeats after the first successful run.

Spacing protects the dependency and makes behavior observable. Even a low retry
count can be too aggressive if all retries happen immediately.

Classification belongs next to the effect being retried or repeated. The
schedule should express mechanics: delay, count, jitter, and stop conditions.
The domain code should decide whether a failure or value is eligible to recur.

Low counts are defaults, not guarantees of safety. If many fibers can hit the
same dependency at once, combine conservative schedules with admission control
such as bounded concurrency, queues, or rate limits.
