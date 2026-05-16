---
book: Effect `Schedule` Cookbook
section_number: "18.5"
section_title: "Polling strategy for long-running back-office jobs"
part_title: "Part IV — Polling Recipes"
chapter_title: "18. Poll Aggressively at First, Then Slow Down"
status: "draft"
code_included: true
---

# 18.5 Polling strategy for long-running back-office jobs

A back-office job has been accepted and may run for minutes or hours: ledger
reconciliation, warehouse synchronization, report generation, data repair, or bulk
indexing. Operators need periodic visibility, but nobody is waiting for a sub-second UI
update. This recipe treats polling as repeated successful observations. The schedule
controls cadence and the condition for taking another observation, while the surrounding
Effect code interprets terminal states, missing data, stale reads, and real failures.
Keeping those responsibilities separate makes the polling loop easier to bound and
diagnose.

## Problem

A back-office job has been accepted and may run for minutes or hours: ledger
reconciliation, warehouse synchronization, report generation, data repair, or
bulk indexing. Operators need periodic visibility, but nobody is waiting for a
sub-second UI update.

Polling too frequently creates steady pressure on the job store, status API, and
worker database. The polling policy should provide enough early signal to catch
fast failures or obvious progress, then settle into a low-pressure cadence until
the job reaches a terminal state.

## When to use it

Use this when job completion is useful to observe but not latency critical.

This is a good fit for scheduled or queue-driven operational work where the
poller feeds logs, metrics, dashboards, follow-up tasks, or notifications rather
than a user actively watching a page.

Use it when status checks are cheap enough to run periodically, but expensive
enough that thousands of jobs polling every few seconds would be noticeable.

## When not to use it

Do not use this for interactive workflows where the caller expects immediate
feedback after clicking a button. Those flows usually need a shorter, bounded
early window before moving to background handling.

Do not use this as a retry policy for a failing status endpoint. With
`Effect.repeat`, failed effects stop the repeat. The schedule sees successful
job status values, not transport or decoding failures.

Do not leave this as an unbounded poller if the surrounding process has no
lifetime, cancellation, or operational owner.

## Schedule shape

Start with a modest operational cadence, then switch to a slower background
cadence. Preserve the latest observed job status and continue only while the job
is still running:

```ts
Schedule.spaced("30 seconds").pipe(
  Schedule.take(10),
  Schedule.andThen(Schedule.spaced("5 minutes")),
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running")
)
```

The first phase gives operators a few early observations without polling in a
tight loop. `Schedule.andThen` moves to the long steady interval once that phase
is exhausted. `Schedule.while` stops the whole policy as soon as a terminal
status is observed.

`Schedule.passthrough` keeps the latest `JobStatus` as the schedule output, so
the repeated effect returns the last successful status observation instead of
the numeric output from the timing schedules.

## Code

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly state: "running"; readonly processed: number; readonly total: number }
  | { readonly state: "completed"; readonly completedAt: string }
  | { readonly state: "failed"; readonly reason: string }

type JobStatusError = {
  readonly _tag: "JobStatusError"
  readonly message: string
}

declare const readJobStatus: (
  jobId: string
) => Effect.Effect<JobStatus, JobStatusError>

const backOfficeJobPolling = Schedule.spaced("30 seconds").pipe(
  Schedule.take(10),
  Schedule.andThen(Schedule.spaced("5 minutes")),
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running")
)

const waitForBackOfficeJob = (jobId: string) =>
  readJobStatus(jobId).pipe(
    Effect.repeat(backOfficeJobPolling)
  )
```

`readJobStatus` runs once immediately. If the job is already `"completed"` or
`"failed"`, polling stops without waiting. If the job is `"running"`, the
schedule waits 30 seconds between the first ten recurrences, then waits five
minutes between later recurrences.

The resulting effect succeeds with the latest observed `JobStatus`. A domain
failure such as `"failed"` is still a successful status read; decide after
polling whether that terminal status should fail a larger workflow.

## Variants

Use a one-minute initial phase when early progress is not operationally useful.
For overnight reconciliation or batch import work, `Schedule.spaced("1 minute")`
followed by `Schedule.spaced("10 minutes")` may be enough.

Use a shorter steady interval when the poller triggers the next automated step,
such as publishing a completion notification or enqueueing a dependent job.

Add jitter when many jobs are created at the same scheduled boundary. A slower
cadence reduces pressure, but identical intervals can still synchronize a large
fleet of pollers.

Add an external timeout, cancellation signal, or owner process lifetime when the
job may remain `"running"` indefinitely because of lost workers or corrupted
state.

## Notes and caveats

`Effect.repeat` runs the status check once before the schedule controls any
recurrence. The first observation is immediate.

`Schedule.take(10)` limits the first phase to ten recurrences after the initial
status check. It is not ten total status checks.

`Schedule.spaced` waits after each successful status check completes. That is
usually what you want for back-office polling because status checks may have
variable latency.

`Schedule.while` reads successful `JobStatus` values only. Keep status endpoint
failures in the effect error channel and handle retries separately if the
endpoint itself is unreliable.

When a timing schedule reads status through `metadata.input`, constrain it with
`Schedule.satisfiesInputType<JobStatus>()` before `Schedule.while`.
