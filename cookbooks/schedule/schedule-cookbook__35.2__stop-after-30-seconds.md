---
book: Effect `Schedule` Cookbook
section_number: "35.2"
section_title: "Stop after 30 seconds"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "35. Stop After a Time Budget"
status: "draft"
code_included: true
---

# 35.2 Stop after 30 seconds

Use `Schedule.during("30 seconds")` for an elapsed recurrence budget that is
long enough to be operationally visible but still short. Combine it with a
cadence or backoff so the policy also says how much pressure the operation puts
on the dependency during that window.

## Problem

A dependency probe, webhook delivery, or short recovery step should keep trying
for about 30 seconds without scattering sleeps, counters, or deadline checks
around the program.

The important distinction is that the time budget and the delay policy are
separate:

```ts
const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)
```

The exponential schedule controls the retry cadence. `Schedule.during("30
seconds")` controls when retry scheduling must stop.

## When to use it

Use this when the requirement is expressed as an elapsed operational budget
rather than an exact number of attempts. It fits startup checks, dependency
probes, webhook delivery, cache refresh, short background recovery windows, and
service calls where transient failures are worth retrying briefly.

This shape is especially useful when attempt duration varies. A count limit can
say how many retries are allowed, but it cannot say how long the retrying fiber
may spend between failures, sleeps, and later retry decisions.

## When not to use it

Do not treat `Schedule.during("30 seconds")` as a hard timeout for an in-flight
attempt. Schedules are consulted at recurrence decision points. They decide
whether to schedule the next retry or repeat; they do not interrupt work that
is already running.

Do not use `Schedule.during` by itself for production retries. It has no
practical spacing of its own, so a fast-failing effect can retry rapidly until
the 30-second window closes. Pair it with `Schedule.spaced`,
`Schedule.exponential`, or another delay policy.

Do not spend the full 30 seconds on failures you already know are permanent.
Validation errors, authorization failures, malformed requests, and unsafe
non-idempotent writes should be classified before the schedule is applied.

## Schedule shape

`Schedule.during("30 seconds")` is implemented in terms of schedule elapsed
time. It recurs while that elapsed duration is less than or equal to the given
duration, and it outputs the elapsed duration.

When you compose it with a cadence using `Schedule.both`, both schedules must
continue. `Schedule.both` uses the maximum of the two delays. Since
`Schedule.during` contributes the budget and not the operational spacing, the
cadence or backoff side still controls the waits while the budget remains open.

With `Effect.retry`, the first attempt runs immediately. After each typed
failure, the schedule decides whether another retry is allowed and how long to
wait. With `Effect.repeat`, the schedule is consulted after successful values
instead.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class DependencyError extends Data.TaggedError("DependencyError")<{
  readonly retryable: boolean
}> {}

declare const callDependency: Effect.Effect<string, DependencyError>

const retryWithinBudget = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)

export const program = callDependency.pipe(
  Effect.retry({
    schedule: retryWithinBudget,
    while: (error) => error.retryable
  })
)
```

`callDependency` runs once immediately. If it fails with a retryable
`DependencyError`, the retry policy starts with a 200 millisecond backoff and
keeps increasing the delay while the 30-second schedule budget is open.

If a later attempt succeeds, `program` succeeds with the dependency result. If
the dependency keeps failing until the budget closes, `program` fails with the
last `DependencyError`.

## Variants

Use a steady cadence when you want predictable load inside the same budget:

```ts
const pollEverySecondFor30Seconds = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)
```

This schedules at most about one recurrence per second while the elapsed
schedule window remains open.

Add jitter when many fibers or service instances may retry against the same
dependency:

```ts
const fleetFriendlyBudget = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.during("30 seconds"))
)
```

The backoff still defines the general pressure profile, jitter spreads the
individual delays, and `Schedule.during("30 seconds")` keeps the total retry
window bounded.

Add an attempt cap when both the total window and the maximum retry count
matter:

```ts
const budgetAndCount = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds")),
  Schedule.both(Schedule.recurs(12))
)
```

This stops when either the elapsed budget closes or 12 retries have already
been scheduled after the original attempt.

## Notes and caveats

The 30-second budget starts when the schedule is first stepped. For
`Effect.retry`, that happens after the first typed failure, not before the
original attempt begins.

The budget is checked at recurrence decision points. A decision made near the
end of the window can still choose a delay and allow one more attempt after the
30-second boundary. This is a recurrence budget, not a precise wall-clock
deadline for total program runtime.

`Schedule.during("30 seconds")` does not classify errors. Keep retryability
near the effect, for example with the `while` predicate on `Effect.retry`, and
let the schedule describe timing, backoff, jitter, and stopping conditions.

The composed schedule output is a tuple containing the cadence output and the
elapsed duration from `Schedule.during`. Plain `Effect.retry` uses that
schedule output for timing and stopping; the successful value remains the value
produced by the retried effect.
