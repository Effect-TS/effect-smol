---
book: Effect `Schedule` Cookbook
section_number: "35.1"
section_title: "Stop after 5 seconds"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "35. Stop After a Time Budget"
status: "draft"
code_included: true
---

# 35.1 Stop after 5 seconds

Use `Schedule.during("5 seconds")` for a retry or polling policy with a short
elapsed-time budget. Pair it with an explicit cadence so the policy says both
how often to try and when the recurrence window closes.

This is a schedule budget, not a hard process timeout. It is evaluated at
schedule decision points, after an attempt has finished. If an individual
attempt hangs for longer than five seconds, `Schedule.during("5 seconds")` does
not interrupt it.

## Problem

During startup, a dependency probe should get a few quick retries before the
service reports that readiness has not been reached. The policy should show that
five-second recurrence window directly, instead of hiding it in a manual loop or
scattered sleeps.

## When to use it

Use this when the important bound is elapsed retry or polling time rather than a
fixed number of recurrences.

This is a good fit for startup probes, short cache warmups, quick readiness
checks, and user-facing operations where a small amount of persistence is useful
but the caller still needs a prompt answer.

## When not to use it

Do not use this as the only protection against a slow in-flight operation. A
schedule decides whether to run again after an attempt completes; it does not
interrupt the attempt that is already running.

Do not use it to hide permanent failures. Validate inputs, classify errors, and
avoid retrying unsafe side effects before applying the schedule.

## Schedule shape

Pair `Schedule.during("5 seconds")` with an explicit cadence:

```ts
Schedule.spaced("250 millis").pipe(
  Schedule.both(Schedule.during("5 seconds"))
)
```

`Schedule.spaced("250 millis")` supplies the delay between recurrences.
`Schedule.during("5 seconds")` keeps the recurrence window open only while the
schedule elapsed time is within five seconds. Combining them makes both parts of
the policy visible: how quickly the operation retries and when the retry budget
stops allowing more retries.

## Code

```ts
import { Effect, Schedule } from "effect"

type DependencyError = {
  readonly _tag: "DependencyError"
  readonly message: string
}

declare const checkDependency: Effect.Effect<void, DependencyError>

const retryForUpToFiveSeconds = Schedule.spaced("250 millis").pipe(
  Schedule.both(Schedule.during("5 seconds"))
)

export const program = checkDependency.pipe(
  Effect.retry(retryForUpToFiveSeconds)
)
```

`checkDependency` runs once before the schedule is consulted. If it fails, the
schedule waits 250 milliseconds before the next attempt while the five-second
budget is still open. When the schedule stops recurring, `Effect.retry` returns
the latest failure.

## Variants

Use a shorter cadence for very cheap local checks, and a longer cadence for
remote calls that could add load during an outage. For many clients running the
same policy, add jitter after the cadence is correct so they do not all retry at
the same moments.

If the caller needs the whole operation to be interrupted at five seconds,
combine this schedule-side budget with an Effect timeout at the operation
boundary. Keep the two responsibilities separate: the schedule describes retry
recurrence, while the timeout describes interruption.

## Notes and caveats

`Schedule.during` returns elapsed duration as its output. In this recipe the
output is not used; the schedule exists for its recurrence decision.

The five-second budget is approximate in the practical sense that recurrence
decisions happen between attempts. Long attempts and their own timeouts should
be handled in the effect being retried.
