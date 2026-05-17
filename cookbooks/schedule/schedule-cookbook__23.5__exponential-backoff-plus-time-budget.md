---
book: "Effect `Schedule` Cookbook"
section_number: "23.5"
section_title: "Exponential backoff plus time budget"
part_title: "Part VI — Composition and Termination"
chapter_title: "23. Combine Limits and Delays"
status: "draft"
code_included: true
---

# 23.5 Exponential backoff plus time budget

Combine a growing retry delay with an elapsed retry window when the caller cares
about bounded recovery time more than a fixed attempt count.

Use `Schedule.exponential` for the delay curve and `Schedule.during` for the
elapsed budget. Combined with `Schedule.both`, both policies must allow another
retry.

## Problem

You are calling a dependency that sometimes returns retryable failures during
deploys, restarts, or load spikes. The caller can wait through a short recovery
window, but retrying should slow down after repeated failures and stop when that
window is exhausted.

You want one policy that makes both parts visible:

- the delay grows after each failed attempt
- the whole retry window has an elapsed-time budget
- the original attempt still runs immediately
- retrying stops when the budget is exhausted

## When to use it

Use this recipe for idempotent dependency calls, startup checks, connection
setup, cache refresh, or background jobs where transient failure is expected but
unbounded retrying would create operational risk.

It is a good fit when the requirement is phrased as a time window: "try for up
to 30 seconds" or "give the service a short recovery window."

## When not to use it

Do not use a time budget to retry permanent failures. Bad input, invalid
credentials, forbidden access, malformed requests, and unsafe non-idempotent
writes should be filtered before this schedule is allowed to run.

Do not treat `Schedule.during` as a timeout for an attempt that is already in
flight. A schedule is consulted between attempts; use an Effect timeout on the
attempt itself if one call needs a deadline.

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

`Schedule.both` combines the two schedules with "both must continue" semantics.
The exponential side contributes the delay and the `during` side contributes the
elapsed budget. When the budget closes, the combined schedule stops even if the
exponential side could keep going.

This is different from an attempt count. A count limit such as
`Schedule.recurs(5)` says how many retries may be scheduled after the original
attempt. A time budget says how long the retry window may remain open. Slow
failed attempts can consume the budget before many retries happen; fast failed
attempts may fit more retries into the same budget.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class DependencyError extends Data.TaggedError("DependencyError")<{
  readonly attempt: number
}> {}

let attempts = 0

const callDependency = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`dependency attempt ${attempts}`)
  return yield* Effect.fail(new DependencyError({ attempt: attempts }))
})

const retryWithinBudget = Schedule.exponential("10 millis").pipe(
  Schedule.both(Schedule.during("70 millis"))
)

const program = callDependency.pipe(
  Effect.retry(retryWithinBudget),
  Effect.catch((error) =>
    Console.log(`stopped after ${attempts} attempts; last error was attempt ${error.attempt}`)
  )
)

Effect.runPromise(program)
```

The first call is immediate. After each failure, the schedule waits with
exponential backoff while the elapsed budget remains open. When the budget is
exhausted, `Effect.retry` fails with the last error, which the example logs.

In production, add error classification before or around this policy so only
retryable failures spend the budget.

## Variants

Add an attempt cap with `Schedule.both(Schedule.recurs(n))` only when count is a
real secondary constraint. Both limits then apply: the elapsed window must still
be open, and no more than `n` retries may be scheduled after the original
attempt.

Use a shorter budget and smaller base delay for interactive paths. Use a larger
base delay for background work that should be conservative with a shared
dependency.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. If only some failures are
retryable, classify them before the schedule spends more of the budget.

`Schedule.during` measures the schedule's elapsed recurrence window. It is not
a hard wall-clock cancellation boundary for running work. If an individual
attempt also needs a deadline, apply a timeout to that effect separately.

The exact number of retries is intentionally not fixed by this recipe. The
budget is the primary limit; the exponential cadence determines how quickly
the operation consumes that budget through waiting between failed attempts.
