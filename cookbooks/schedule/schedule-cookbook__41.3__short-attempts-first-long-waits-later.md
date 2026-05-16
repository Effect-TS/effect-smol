---
book: Effect `Schedule` Cookbook
section_number: "41.3"
section_title: "Short attempts first, long waits later"
part_title: "Part IX — Composition Recipes"
chapter_title: "41. Build Multi-Phase Policies"
status: "draft"
code_included: true
---

# 41.3 Short attempts first, long waits later

Some failures and pending states are most likely to clear quickly. A cache entry
may appear a few hundred milliseconds later, a just-started job may finish soon,
or a remote dependency may recover after a small network hiccup. In those cases,
you often want a short responsive phase first, then a more patient phase if the
operation is still not ready.

Use `Schedule.andThen` to model that handoff directly. The first schedule runs
until it is exhausted. Only then does the second schedule start making recurrence
decisions.

## Problem

You need a policy that tries or polls quickly at first, but stops putting
frequent pressure on the dependency if the operation takes longer than expected.
The behavior should be visible from the schedule value instead of being hidden
inside counters, sleeps, or branching loops.

## When to use it

Use this recipe when early responsiveness matters, but sustained aggressive
retrying or polling would create noise or load. It fits status polling after a
user-triggered workflow, dependency checks during startup, reconnect attempts,
and retryable calls where the first few failures are often transient.

This policy is also useful when operators need to answer two separate questions:
how hard the system tries at first, and how conservative it becomes later.

## When not to use it

Do not use a longer second phase to disguise a permanent failure. Validation
errors, authorization failures, malformed requests, and unsafe non-idempotent
writes should be classified before retrying.

For polling, prefer a callback, queue notification, or direct completion signal
when the producer can send one reliably. A schedule is a good fit when the
consumer must observe state over time.

## Schedule shape

Build the policy as two named phases:

```ts
import { Schedule } from "effect"

const quickPhase = Schedule.spaced("200 millis").pipe(
  Schedule.take(5)
)

const patientPhase = Schedule.spaced("10 seconds").pipe(
  Schedule.take(12)
)

const quickThenPatient = Schedule.andThen(quickPhase, patientPhase)
```

`quickPhase` allows five fast recurrences. If the effect still needs another
recurrence after that, `patientPhase` takes over and allows twelve more
recurrences with longer waits. With `Effect.retry`, the original attempt still
runs immediately; the schedule controls only the waits before retry attempts.
With `Effect.repeat`, the first successful value is produced immediately; the
schedule controls whether and when another observation is made.

## Code

This example uses the same phase idea for polling a job status. The early phase
checks quickly while the job is likely to finish soon. The later phase keeps
watching, but at a lower cadence.

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly _tag: "Running" }
  | { readonly _tag: "Done"; readonly downloadUrl: string }
  | { readonly _tag: "Failed"; readonly reason: string }

type StatusReadError = { readonly _tag: "StatusReadError" }

declare const readJobStatus: Effect.Effect<JobStatus, StatusReadError>

const quickStatusChecks = Schedule.spaced("200 millis").pipe(
  Schedule.take(5)
)

const slowerStatusChecks = Schedule.spaced("10 seconds").pipe(
  Schedule.take(12)
)

const pollWhileRunning = Schedule
  .andThen(quickStatusChecks, slowerStatusChecks)
  .pipe(
    Schedule.satisfiesInputType<JobStatus>(),
    Schedule.passthrough,
    Schedule.while(({ input }) => input._tag === "Running")
  )

export const program = Effect.repeat(readJobStatus, pollWhileRunning)
```

`Schedule.satisfiesInputType<JobStatus>()` narrows the schedule input for the
status predicate. `Schedule.passthrough` keeps the latest successful status as
the schedule output, so `Effect.repeat` can return the final status that stopped
the repetition. `Schedule.while` stops polling as soon as the status is no
longer `Running`, even if the longer phase still has recurrences left.

For retrying failed effects, keep the same shape and apply it with
`Effect.retry`:

```ts
import { Effect, Schedule } from "effect"

type TransientError = { readonly _tag: "TransientError" }

declare const fetchFromDependency: Effect.Effect<string, TransientError>

const quickRetries = Schedule.spaced("100 millis").pipe(
  Schedule.take(3)
)

const slowRetries = Schedule.spaced("5 seconds").pipe(
  Schedule.take(6)
)

const retryQuicklyThenSlowly = Schedule.andThen(quickRetries, slowRetries)

export const program = Effect.retry(
  fetchFromDependency,
  retryQuicklyThenSlowly
)
```

## Variants

Add `Schedule.jittered` to each phase when many clients may run the same policy
at the same time:

```ts
const quickRetries = Schedule.spaced("100 millis").pipe(
  Schedule.jittered,
  Schedule.take(3)
)

const slowRetries = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.take(6)
)
```

Use `Schedule.andThenResult` instead of `Schedule.andThen` when you need to
observe which phase produced each schedule output. The left phase is represented
as a `Result` failure and the right phase as a `Result` success, which is useful
for phase-specific logging or metrics.

## Notes and caveats

`Schedule.andThen` sequences policies; it does not run both phases at once. If
you need a cadence plus a separate limit at the same time, combine schedules
with operators such as `Schedule.both` instead.

`Schedule.take(n)` limits recurrences made by that phase. It does not count the
initial run of the effect before `Effect.retry` or `Effect.repeat` starts using
the schedule.

Schedules control recurrence decisions and delays. They do not shorten the
duration of an individual attempt. If each request needs its own timeout, apply
that timeout to the effect being retried or repeated, then use the schedule for
the phase-based waits between attempts.
