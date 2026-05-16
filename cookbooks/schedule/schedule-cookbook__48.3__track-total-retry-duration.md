---
book: Effect `Schedule` Cookbook
section_number: "48.3"
section_title: "Track total retry duration"
part_title: "Part XI — Observability and Testing"
chapter_title: "48. Observability, Logging, and Diagnostics"
status: "draft"
code_included: true
---

# 48.3 Track total retry duration

Retry count tells you how many follow-up attempts were scheduled. It does not
tell you how long the caller spent inside the retry window.

Use `Schedule.elapsed` when the total retry duration is something you want to
log, export as a metric, or compare with an operational budget. The elapsed
schedule recurs forever and outputs the duration since the schedule started,
so combine it with the real retry policy rather than using it as the policy by
itself.

## Problem

You have a retry policy with a delay strategy and a budget, but operators need
to answer a different question after an incident: "how much time did this
request spend retrying?"

That value is not the same as the next delay. It includes time that has passed
inside the recurrence window, including the time between failed attempts. It is
also not the same as a timeout for an in-flight attempt. `Effect.retry` consults
the schedule after the effect has failed.

## When to use it

Use this recipe when elapsed retry time should appear in logs, metrics, traces,
or diagnostic events. It is useful for dependency calls, queue publication,
webhook delivery, startup checks, and background workers where a bounded retry
window is part of the service contract.

It is also useful when you have both a hard budget and a softer observability
goal. The budget controls whether another retry may be scheduled. The elapsed
output tells you how much of that window has already been consumed.

## When not to use it

Do not use `Schedule.elapsed` as the only retry policy. It has no spacing and
no stopping condition. Pair it with a cadence such as `Schedule.exponential`
and a limit such as `Schedule.during` or `Schedule.recurs`.

Do not use elapsed schedule time as proof that a single attempt respected a
deadline. If each attempt needs its own timeout, apply that timeout to the
effect being retried.

## Schedule shape

Start with the actual retry behavior:

```ts
const retryCadence = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds")),
  Schedule.both(Schedule.recurs(8))
)
```

This says retries use exponential backoff, the recurrence window must still be
within 30 seconds, and no more than 8 retries may be scheduled after the first
attempt.

Then combine that policy with `Schedule.elapsed` and keep the elapsed value in
the output:

```ts
const observedRetryCadence = retryCadence.pipe(
  Schedule.bothWith(Schedule.elapsed, ([[nextDelay], retryIndex], elapsed) => ({
    elapsed,
    nextDelay,
    retryIndex
  }))
)
```

`Schedule.bothWith` keeps "both schedules must continue" semantics. Because
`Schedule.elapsed` never stops on its own and contributes a zero delay, the
cadence and limits still come from `retryCadence`. The additional output is for
observation.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class DependencyError extends Data.TaggedError("DependencyError")<{
  readonly status: number
}> {}

declare const callDependency: Effect.Effect<string, DependencyError>

const isRetryable = (error: DependencyError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds")),
  Schedule.both(Schedule.recurs(8)),
  Schedule.bothWith(Schedule.elapsed, ([[nextDelay], retryIndex], elapsed) => ({
    elapsed,
    nextDelay,
    retryIndex
  })),
  Schedule.tapInput((error: DependencyError) =>
    Effect.log(`retrying dependency call after status ${error.status}`)
  ),
  Schedule.tapOutput(({ elapsed, nextDelay, retryIndex }) =>
    Effect.log(
      [
        `retry=${retryIndex + 1}`,
        `elapsed_ms=${Duration.toMillis(elapsed)}`,
        `next_delay_ms=${Duration.toMillis(nextDelay)}`
      ].join(" ")
    )
  )
)

export const program = callDependency.pipe(
  Effect.retry({
    schedule: retryPolicy,
    while: isRetryable
  })
)
```

The first call to `callDependency` runs immediately. When it fails with a
retryable `DependencyError`, the schedule decides whether another retry is
allowed, waits according to the exponential delay, and emits an elapsed
duration for the recurrence window.

The logged `elapsed_ms` value is the total time observed by the schedule so
far. The logged `next_delay_ms` value is the delay selected for the next retry.
Keeping both values separate makes the log useful: one explains how much of
the retry window has been spent, and the other explains the pressure the next
retry will place on the dependency.

## Variants

For request paths with a strict service-level objective, make the elapsed
budget the primary constraint and keep the retry count small:

```ts
const interactiveRetryPolicy = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.during("2 seconds")),
  Schedule.both(Schedule.recurs(3)),
  Schedule.bothRight(Schedule.elapsed)
)
```

This version keeps only the elapsed output. That is enough when the metric you
care about is total retry time and the cadence is already obvious from the
policy name or surrounding code.

For background work, keep the same observation point but use a wider budget
and slower base delay:

```ts
const backgroundRetryPolicy = Schedule.exponential("1 second").pipe(
  Schedule.both(Schedule.during("2 minutes")),
  Schedule.both(Schedule.recurs(12)),
  Schedule.bothRight(Schedule.elapsed)
)
```

## Notes and caveats

`Schedule.elapsed` measures elapsed time inside the schedule's recurrence
window. With `Effect.retry`, failures are the schedule input. With
`Effect.repeat`, successful values are the schedule input.

`Schedule.during` is a budget for scheduling the next recurrence, not a
cancellation boundary for work already running. Use it to stop opening more
retry delays after the budget is consumed.

When you export elapsed retry duration as a metric, include enough labels or
log context to explain the retry class. A single global "retry elapsed" number
is hard to interpret unless the dependency, operation, error class, and budget
are visible nearby.
