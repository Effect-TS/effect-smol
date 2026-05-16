---
book: Effect `Schedule` Cookbook
section_number: "35.3"
section_title: "Stop after 2 minutes"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "35. Stop After a Time Budget"
status: "draft"
code_included: true
---

# 35.3 Stop after 2 minutes

A two-minute budget is useful when a workflow should keep trying long enough for
normal background latency, but should not become an unbounded loop. It is common
for user-triggered work that hands back a progress state, and for background
workers that reconcile remote systems after a webhook, queue message, or cache
miss.

Use `Schedule.during("2 minutes")` as the elapsed-time stop condition, and
combine it with a cadence such as `Schedule.spaced`, `Schedule.fixed`, or
`Schedule.exponential`. The cadence says when the next recurrence is allowed.
The budget says when the recurrence window closes.

## Problem

You need a repeat or retry policy that gives a workflow up to two minutes to
make progress, without hiding that limit inside manual sleeps, counters, or
custom loop state.

For example, after a user starts an export you may poll the export status for up
to two minutes before returning a "still processing" response. In a background
worker, you may retry a temporary dependency failure for up to two minutes before
leaving the message for later recovery or surfacing an operational failure.

## When to use it

Use this when two minutes is the operational budget for the recurrence itself:
long enough for normal eventual consistency, short enough that callers and
operators get a clear answer.

This is a good fit for background workflows, user-triggered workflows that can
return a pending state, webhook reconciliation, short-lived polling, and retrying
transient dependency failures.

## When not to use it

Do not use a schedule budget as a hard timeout for one in-flight operation. The
schedule is checked at recurrence decision points. If a single request must be
interrupted after two minutes, use `Effect.timeout("2 minutes")` on that request.

Do not use this to retry permanent failures. Validation errors, authorization
errors, malformed requests, and unsafe non-idempotent writes should be classified
before the schedule is applied.

For an interactive HTTP request, two minutes may be too long to hold the
connection open. Prefer starting the work, returning a job identifier or pending
status, and using the two-minute schedule in the worker or status polling path.

## Schedule shape

The usual shape is a cadence combined with `Schedule.during("2 minutes")`:

```ts
Schedule.spaced("5 seconds").pipe(
  Schedule.both(Schedule.during("2 minutes"))
)
```

`Schedule.during` tracks elapsed schedule time and continues only while the
budget is still open. `Schedule.both` requires both schedules to continue, so
the workflow stops when either the cadence schedule stops or the two-minute
budget has elapsed.

## Code

This example polls an export until it reaches a terminal status, but gives the
polling loop no more than two minutes:

```ts
import { Effect, Schedule } from "effect"

type ExportStatus =
  | { readonly _tag: "Processing" }
  | { readonly _tag: "Complete"; readonly downloadUrl: string }
  | { readonly _tag: "Failed"; readonly reason: string }

declare const fetchExportStatus: Effect.Effect<ExportStatus>

const pollForTwoMinutes = Schedule.spaced("5 seconds").pipe(
  Schedule.satisfiesInputType<ExportStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Processing"),
  Schedule.both(Schedule.during("2 minutes"))
)

export const waitForExport = fetchExportStatus.pipe(
  Effect.repeat(pollForTwoMinutes)
)
```

`fetchExportStatus` runs immediately. After each successful status check,
`Effect.repeat` feeds the successful `ExportStatus` into the schedule. The
schedule continues only while the latest status is `Processing` and the elapsed
budget is still within two minutes.

For retrying a transient dependency failure, use the same budget with
`Effect.retry`:

```ts
import { Effect, Schedule } from "effect"

type DependencyError = { readonly _tag: "DependencyError" }

declare const refreshSearchIndex: Effect.Effect<void, DependencyError>

const retryForTwoMinutes = Schedule.exponential("250 millis").pipe(
  Schedule.both(Schedule.during("2 minutes"))
)

export const refreshWithBudget = refreshSearchIndex.pipe(
  Effect.retry(retryForTwoMinutes)
)
```

Here failures are the schedule input because `Effect.retry` is failure-driven.
The retry cadence grows from 250 milliseconds, and the two-minute budget stops
the retry window even if the dependency keeps failing.

## Variants

For a background worker, use a slower cadence when the downstream system does not
need fast pressure:

```ts
import { Schedule } from "effect"

const backgroundPoll = Schedule.spaced("15 seconds").pipe(
  Schedule.both(Schedule.during("2 minutes"))
)
```

For a user-triggered workflow, keep the recurrence budget in the worker or status
check and return a pending state when the budget closes. If the caller must wait
synchronously, combine the schedule budget with an explicit timeout around each
remote call so one slow request cannot consume the whole window.

Add `Schedule.jittered` to fleet-wide retry policies after the base cadence and
budget are correct:

```ts
import { Schedule } from "effect"

const jitteredRetryForTwoMinutes = Schedule.exponential("500 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.during("2 minutes"))
)
```

## Notes and caveats

The first run is not delayed by the schedule. The schedule controls later
recurrences after the first success for `Effect.repeat`, or after the first
failure for `Effect.retry`.

`Schedule.during("2 minutes")` does not create a two-minute sleep. It is a stop
condition. Combine it with a cadence to avoid tight repeat loops.

The elapsed budget is checked between attempts. If each attempt has its own
latency risk, add `Effect.timeout` to the attempted operation as well as the
schedule budget.

`Schedule.both` combines outputs. If callers do not need the schedule output,
keep the repeated or retried workflow behind a named function and return the
domain result rather than exposing the tuple.
