---
book: Effect `Schedule` Cookbook
section_number: "39.1"
section_title: "Exponential backoff plus time budget"
part_title: "Part IX — Composition Recipes"
chapter_title: "39. Combine Delay Strategies and Stop Conditions"
status: "draft"
code_included: true
---

# 39.1 Exponential backoff plus time budget

Exponential backoff answers "how long should we wait before trying again?"
A time budget answers "how long is this retry window allowed to stay open?"
This recipe combines those two concerns without turning either one into an
implicit loop counter.

Use `Schedule.exponential` for the growing delays, and compose it with
`Schedule.during` for the elapsed budget:

```ts
const retryWithinBudget = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)
```

Read that as: retry with exponential backoff while the 30 second recurrence
window is still open.

## Problem

You are calling a dependency that may recover quickly from transient failures,
but you do not want retrying to continue indefinitely. A fixed retry count is
not the real requirement: the caller can tolerate a bounded recovery window,
and the dependency should see less pressure after repeated failures.

You want one policy that makes both parts visible:

- the delay grows after each failed attempt
- the whole retry window has an elapsed-time budget
- the original attempt still runs immediately
- retrying stops when the budget is exhausted

## When to use it

Use this recipe for idempotent dependency calls, startup checks, connection
setup, webhook delivery, cache refresh, or background jobs where transient
failure is expected but unbounded retrying would create operational risk.

It is a good fit when the requirement is phrased in time: "keep trying for up
to 30 seconds", "give the service a short recovery window", or "retry during
startup, but do not block forever."

## When not to use it

Do not use a time budget to retry permanent failures. Bad input, invalid
credentials, forbidden access, malformed requests, and unsafe non-idempotent
writes should be filtered before this schedule is allowed to run.

Do not treat `Schedule.during` as a timeout for an attempt that is already in
flight. Schedules are consulted at recurrence decision points. With
`Effect.retry`, that means after an attempt has failed with a typed error.

Do not use `Schedule.during` alone for production retries. It describes an
elapsed window, but it does not provide useful spacing. Pair it with a delay
schedule such as `Schedule.exponential`.

## Schedule shape

`Schedule.exponential("200 millis")` starts with a 200 millisecond delay and
then multiplies each later delay by the default factor of `2`: 200ms, 400ms,
800ms, 1.6s, and so on. By itself, it keeps recurring forever.

`Schedule.during("30 seconds")` keeps recurring while the schedule's elapsed
time is less than or equal to 30 seconds. It supplies the stopping window, not
the backoff cadence.

`Schedule.both` combines the two schedules with "both must continue"
semantics. In this recipe, the exponential side contributes the delay and the
`during` side contributes the elapsed budget. When the budget is closed, the
combined schedule stops even if the exponential side could keep going.

This is different from an attempt count. A count limit such as
`Schedule.recurs(5)` says how many retries may be scheduled after the original
attempt. A time budget says how long the retry window may remain open. Slow
failed attempts can consume the budget before many retries happen; fast failed
attempts may fit more retries into the same budget.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class DependencyError extends Data.TaggedError("DependencyError")<{
  readonly status: number
}> {}

declare const fetchFromDependency: Effect.Effect<string, DependencyError>

const isRetryable = (error: DependencyError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const retryWithinBudget = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)

export const program = fetchFromDependency.pipe(
  Effect.retry({
    schedule: retryWithinBudget,
    while: isRetryable
  })
)
```

The first call to `fetchFromDependency` is immediate. If it fails with a
retryable `DependencyError`, the policy waits 200 milliseconds before the next
attempt, then 400 milliseconds before the next, then 800 milliseconds, and so
on while the 30 second retry window remains open.

If the dependency succeeds during the window, `program` succeeds with its
value. If retryable failures continue until the schedule stops, `program` fails
with the last `DependencyError`. If `isRetryable` returns `false`, retrying
stops immediately for that error.

## Variants

Add an attempt cap only when the count is a real secondary constraint:

```ts
const retryWithinBudgetAndCount = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds")),
  Schedule.both(Schedule.recurs(12))
)
```

This says both limits must hold: the elapsed retry window must still be open,
and no more than 12 retries may be scheduled after the original attempt.

Use a shorter budget for interactive paths:

```ts
const interactiveRetry = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.during("2 seconds"))
)
```

Use a larger base delay for background work that should be conservative with a
shared dependency:

```ts
const backgroundRetry = Schedule.exponential("1 second").pipe(
  Schedule.both(Schedule.during("2 minutes"))
)
```

## Notes and caveats

`Effect.retry` feeds failures into the schedule. The retry predicate in the
example classifies those failures before the schedule spends more of the
budget.

`Schedule.during` measures the schedule's elapsed recurrence window. It is not
a hard wall-clock cancellation boundary for running work. If an individual
attempt also needs a deadline, apply a timeout to that effect separately.

The exact number of retries is intentionally not fixed by this recipe. The
budget is the primary limit; the exponential cadence determines how quickly
the operation consumes that budget through waiting between failed attempts.
