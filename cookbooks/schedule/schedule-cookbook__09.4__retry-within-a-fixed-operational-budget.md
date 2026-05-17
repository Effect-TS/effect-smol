---
book: Effect `Schedule` Cookbook
section_number: "9.4"
section_title: "Retry within a fixed operational budget"
part_title: "Part II — Core Retry Recipes"
chapter_title: "9. Retry with Deadlines and Budgets"
status: "draft"
code_included: true
---

# 9.4 Retry within a fixed operational budget

Use this recipe when retries must fit inside an operational time budget while
still using a normal delay schedule. The schedule provides the retry cadence and
the stopping condition; surrounding code still decides retry eligibility and
idempotency.

## Problem

Build a retry policy that uses exponential backoff but schedules more attempts
only while a 30 second budget remains open.

Compose the delay policy with `Schedule.during`:

```ts
const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)
```

This means "retry with exponential backoff, but only while the schedule's
elapsed retry window is still within 30 seconds."

## When to use it

Use this recipe when the caller owns a bounded retry window rather than a fixed
number of retries. Examples include background jobs, webhook delivery,
connection setup, cache refresh, and service calls where retrying is useful for
a short recovery window but should not continue indefinitely.

The delay schedule controls how aggressively the operation retries. The
`Schedule.during` side controls the elapsed window in which more retries may be
scheduled.

This is a good shape when you care more about the total retry window than the
exact retry count. A fast-failing operation may get more attempts than a slow
one, but both are bounded by the same operational budget.

## When not to use it

Do not use this as a hard deadline for an individual attempt. A schedule is
consulted after an attempt finishes with a typed failure; it does not interrupt
an attempt that is already running.

Do not use `Schedule.during` by itself for retrying production work. By itself
it has no spacing, so a fast-failing effect can retry very quickly until the
window closes. Combine it with `Schedule.spaced`, `Schedule.exponential`, or
another delay schedule.

Do not use a time window to hide non-retryable failures. Invalid credentials,
bad input, forbidden tenants, and other permanent typed failures should be
filtered with a retry predicate instead of consuming the whole budget.

## Schedule shape

`Schedule.exponential("200 millis")` is an unbounded delay schedule. It starts
with a 200 millisecond delay and then grows by the default factor of `2`: 200
milliseconds, 400 milliseconds, 800 milliseconds, 1.6 seconds, and so on.

`Schedule.during("30 seconds")` is an elapsed recurrence window. It recurs
while the elapsed schedule time is less than or equal to 30 seconds and outputs
that elapsed duration. It is also unbounded within the open window and has no
delay of its own.

`Schedule.both(left, right)` continues only while both schedules want to
continue and uses the maximum of their delays. In this recipe, the exponential
schedule supplies the retry delay. `Schedule.during("30 seconds")` supplies the
stopping condition. Because the `during` side contributes a zero delay, the
combined delay is still the exponential delay while the budget is open.

With `Effect.retry`, the original effect runs immediately. After each typed
failure, the composed schedule decides whether another retry is still allowed
and how long to wait. If the elapsed window is closed when the schedule is
consulted, retrying stops and `Effect.retry` propagates the last typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class TemporaryGatewayError extends Data.TaggedError("TemporaryGatewayError")<{
  readonly status: number
}> {}

declare const callGateway: Effect.Effect<string, TemporaryGatewayError>

const retryWithinBudget = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)

const program = callGateway.pipe(
  Effect.retry({
    schedule: retryWithinBudget,
    while: (error) => error.status === 429 || error.status >= 500
  })
)
```

`program` calls `callGateway` once immediately. If it fails with a retryable
`TemporaryGatewayError`, it retries with exponential backoff while the 30 second
operational budget is open.

If a later attempt succeeds, `program` succeeds with that value. If attempts
keep failing until the schedule window is closed, `program` fails with the last
`TemporaryGatewayError`.

## Variants

Use a fixed delay when the service should see a steady retry cadence inside the
budget:

```ts
const steadyBudget = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("20 seconds"))
)
```

This retries at most about once per second while the 20 second window remains
open.

Use a count limit as a second operational bound:

```ts
const budgetAndCountLimit = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds")),
  Schedule.both(Schedule.recurs(12))
)
```

This retries with exponential backoff while both limits hold: the elapsed
window is still open and no more than 12 retries have been scheduled after the
original attempt.

Use a shorter budget for interactive work:

```ts
const interactiveBudget = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.during("2 seconds"))
)
```

This gives transient failures a brief recovery window without letting the
request spend a long time retrying.

## Notes and caveats

`Schedule.during(duration)` measures the schedule's elapsed recurrence window.
It is not an absolute wall-clock deadline supplied by the caller, and it does
not cancel in-flight work.

The first attempt is not delayed and is not a retry. The schedule is consulted
only after a typed failure from that first attempt.

The exact number of retries inside a budget depends on the delay policy and how
long each failed attempt takes. A 30 second budget with a 1 second spaced delay
does not guarantee exactly 30 retries.

Because `Schedule.both` uses the maximum of the two delays, combining a delay
schedule with `Schedule.during` keeps the delay schedule's waits. The `during`
side contributes the stopping window.

The composed schedule output is a tuple containing the delay schedule output
and the elapsed duration from `Schedule.during`. Plain `Effect.retry` uses the
schedule for timing and stopping; the successful value is still the value
produced by the retried effect.
