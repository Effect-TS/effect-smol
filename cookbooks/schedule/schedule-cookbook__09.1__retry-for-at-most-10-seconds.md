---
book: Effect `Schedule` Cookbook
section_number: "9.1"
section_title: "Retry for at most 10 seconds"
part_title: "Part II — Core Retry Recipes"
chapter_title: "9. Retry with Deadlines and Budgets"
status: "draft"
code_included: true
---

# 9.1 Retry for at most 10 seconds

This recipe shows how to bound retries by a short elapsed-time budget instead
of a fixed retry count. The schedule controls retry timing and stopping;
surrounding Effect code still decides which typed failures are safe to retry
and how the last failure is reported.

## Problem

Given an effect that may fail with a typed transient error, build a retry
policy that uses exponential backoff only while a 10 second schedule window is
still open.

Use `Schedule.during("10 seconds")` as the schedule-side time window and
compose it with the retry delay policy:

```ts
const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.during("10 seconds"))
)
```

This means "retry with exponential backoff while the retry schedule is still
inside its 10 second window."

## When to use it

Use this recipe when the caller has a short retry budget and the exact retry
count is less important than keeping retries bounded by elapsed schedule time.
It fits transient network failures, overloaded dependencies, temporary gateway
errors, and service calls where a few quick retries are useful but long-running
retry loops are not acceptable.

It is also useful when attempts may take variable time. A fixed retry count
does not express how much wall-clock time the retrying fiber may spend between
failed attempts, delays, and later retry decisions.

## When not to use it

Do not treat this schedule as a hard timeout around the whole effect. The first
attempt runs before the retry schedule is stepped, and `Schedule.during` does
not interrupt an attempt that is already running.

Do not use this policy for operations that are not safe to run more than once.
Retried writes need idempotency, de-duplication, transactions, or another
domain guarantee that repeated execution is safe.

Do not use a time budget by itself when the operation can retry very rapidly.
`Schedule.during("10 seconds")` does not add a practical delay on its own, so
combine it with `Schedule.exponential`, `Schedule.spaced`, or another delay
policy.

## Schedule shape

`Schedule.exponential("100 millis")` is an unbounded backoff schedule. With the
default factor of `2`, it produces retry delays of 100 milliseconds, 200
milliseconds, 400 milliseconds, 800 milliseconds, and so on.

`Schedule.during("10 seconds")` is a schedule-side time window. It continues
while the elapsed time tracked by the schedule is less than or equal to 10
seconds. It contributes the stopping condition, not the retry delay.

`Schedule.both(left, right)` continues only while both schedules want to
continue and uses the maximum of their delays. In this recipe, the exponential
schedule supplies the retry delay and `Schedule.during("10 seconds")` supplies
the time budget.

With `Effect.retry`, the original effect runs immediately. After a typed
failure, the failure is fed to the schedule. If both sides of the composed
schedule continue, the effect sleeps for the exponential delay and then retries.
If the time window is exhausted, `Effect.retry` propagates the last typed
failure.

Read the 10 second budget conservatively. For retry, the `during` schedule
starts measuring when the schedule is first stepped, which happens after the
first typed failure. It includes the elapsed time between later retry
decisions, including retry delays and time spent in failed retry attempts after
that point. It does not include time spent in the original attempt before the
first failure, and it does not cancel an attempt that is already running.

If a retry decision happens just inside the 10 second window, the selected
sleep and following attempt can run after that boundary. This recipe bounds
retry scheduling decisions; it is not a precise deadline for total program
runtime.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class GatewayError extends Data.TaggedError("GatewayError")<{
  readonly reason: "Unavailable" | "Overloaded" | "BadRequest"
}> {}

interface GatewayResponse {
  readonly body: string
}

declare const callGateway: Effect.Effect<GatewayResponse, GatewayError>

const isRetryableGatewayError = (error: GatewayError) => error.reason === "Unavailable" || error.reason === "Overloaded"

const retryForAtMost10Seconds = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.during("10 seconds"))
)

const program = callGateway.pipe(
  Effect.retry({
    schedule: retryForAtMost10Seconds,
    while: isRetryableGatewayError
  })
)
```

`program` calls `callGateway` once immediately. If it fails with a retryable
typed `GatewayError`, the retry schedule starts and the next attempt waits 100
milliseconds. Later retryable failures wait 200 milliseconds, 400 milliseconds,
800 milliseconds, and so on while the schedule remains within the 10 second
window.

If the error is `BadRequest`, the `while` predicate returns `false` and
retrying stops immediately. If the retry schedule exhausts its 10 second
window before an attempt succeeds, `Effect.retry` returns the last
`GatewayError`.

## Variants

Use a fixed delay when you want a steady retry cadence within the same time
budget:

```ts
const retryEvery500MillisFor10Seconds = Schedule.spaced("500 millis").pipe(
  Schedule.both(Schedule.during("10 seconds"))
)
```

This retries after a 500 millisecond delay while the schedule remains inside
the 10 second window.

Add a retry count when you want both a time budget and an attempt budget:

```ts
const retryFor10SecondsOr8Retries = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.during("10 seconds")),
  Schedule.both(Schedule.recurs(8))
)
```

All composed schedules must continue, so this policy stops when either the 10
second window is exhausted or eight retries have already been scheduled after
the original attempt.

Use a larger base delay for a dependency that should recover without a fast
burst of retries:

```ts
const gentlerRetryBudget = Schedule.exponential("500 millis").pipe(
  Schedule.both(Schedule.during("10 seconds"))
)
```

This spends the same schedule-side time budget but starts with a slower retry
cadence.

## Notes and caveats

`Schedule.during("10 seconds")` controls the schedule, not the original effect.
The first execution is not delayed and is not interrupted by this schedule.

The budget starts when the retry schedule is first stepped after a typed
failure. If the original attempt takes several seconds before failing, that
time is not part of the `during` schedule window.

The budget is checked at retry decision points. A decision made near the end of
the window can still choose a delay, so the next attempt may begin after the 10
second boundary.

`Schedule.during` by itself has no practical delay. Use it with a delay policy
such as `Schedule.exponential("100 millis")` or `Schedule.spaced("500 millis")`
when retrying real work.

`Schedule.both` uses the maximum delay from the two schedules and stops when
either side stops. In this recipe, that gives conservative composition: the
backoff controls waiting, and the time window controls when retry scheduling
must stop.

The composed schedule output is a tuple. Plain `Effect.retry` uses the schedule
for timing and stopping, but the successful value is still the value produced by
the retried effect.
