---
book: Effect `Schedule` Cookbook
section_number: "2.2"
section_title: "Retrying failed effects"
part_title: "Part I — Foundations"
chapter_title: "2. `repeat` vs `retry`"
status: "draft"
code_included: true
---

# 2.2 Retrying failed effects

This subsection explains Retrying failed effects as a practical Effect `Schedule`
recipe. This section keeps the focus on Effect's `Schedule` model: recurrence is
represented as data that decides whether another decision point exists, which delay
applies, and what output the policy contributes. That framing makes later retry, repeat,
and polling recipes easier to compose without hiding timing behavior inside ad hoc
loops.

## What this section is about

`Effect.retry` reruns an effect after it fails with a typed error. The original
effect always runs at least once. If it succeeds, no retry happens. If it fails,
the retry policy decides whether another attempt should run.

The schedule input is the typed error from the failed attempt. If a later attempt
succeeds, the whole effect succeeds with that value. If the policy stops while
attempts are still failing, the last typed failure is propagated.

Defects and interruptions are not retried as typed failures.

## Why it matters

The difference from `repeat` is the channel that drives the schedule. `repeat`
feeds successful values into the schedule. `retry` feeds failures into the
schedule.

That makes retry the right tool for transient inability to complete an
operation: rate limits, temporary service outages, reconnect attempts, or
resource contention. It is not a polling tool for successful states. Once the
effect succeeds, retrying stops immediately.

Retry policies also affect how many times external work can happen. `times: 3`
and `Schedule.recurs(3)` both mean three retries after the first attempt, so the
effect can run at most four times total.

## Core idea

Use a count-only retry when all failures should be retried immediately:

```ts
import { Data, Effect, Schedule } from "effect"

interface User {
  readonly id: string
}

class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly retryable: boolean
}> {}
declare const fetchUser: Effect.Effect<User, NetworkError>

const fixedRetries = fetchUser.pipe(
  Effect.retry(Schedule.recurs(3))
)

const fixedRetriesWithOptions = fetchUser.pipe(
  Effect.retry({ times: 3 })
)
```

Use a schedule when the retry policy needs timing, composition, or reuse:

```ts
import { Data, Effect, Schedule } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{
  readonly status: number
  readonly retryable: boolean
}> {}

declare const request: Effect.Effect<string, HttpError>

const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const requestWithRetry = request.pipe(
  Effect.retry({
    schedule: retryPolicy,
    while: (error) => error.retryable
  })
)
```

`Schedule.exponential("200 millis")` provides increasing delays.
`Schedule.jittered` randomizes each delay between 80% and 120%.
`Schedule.both(Schedule.recurs(4))` caps the policy at four retries.

The `while` predicate is checked after a typed failure. If it returns `true`,
the schedule can allow another attempt. If it returns `false`, retry stops and
the current error is returned. Use `until` when the predicate describes the
stopping condition instead:

```ts
const requestUntilUnauthorized = request.pipe(
  Effect.retry({
    schedule: retryPolicy,
    until: (error) => error.status === 401
  })
)
```

This keeps retrying until the predicate returns `true`, or until the schedule is
exhausted. `while` and `until` may also return effects; if such a predicate
effect fails, that failure is propagated instead of retrying.

## Common mistakes

- Counting `times` or `Schedule.recurs` as total executions. They count retries
  after the first attempt.
- Expecting retry to continue after success. The first success completes the
  whole effect.
- Retrying a whole workflow when only one operation is safe to run more than
  once.
- Using `while` or `until` without a finite `schedule` or `times` value when
  unbounded retry is not intended.
- Expecting defects or interruptions to behave like typed failures.

## Practical guidance

Put `retry` around the smallest effect that is safe to run more than once.
Retrying a pure lookup, an idempotent HTTP request, or a reconnect attempt is
usually reasonable. Retrying a larger workflow can accidentally repeat logging,
notifications, writes, or other effects that already succeeded before the
transient failure occurred.

Use `retry` when failures are expected to be temporary. If all attempts fail and
you need a fallback value or recovery effect, use `Effect.retryOrElse`; plain
`Effect.retry` preserves the final failure.
