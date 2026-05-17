---
book: Effect `Schedule` Cookbook
section_number: "17.4"
section_title: "Distinguish “still running” from “failed permanently”"
part_title: "Part IV — Polling Recipes"
chapter_title: "17. Poll with a Timeout"
status: "draft"
code_included: true
---

# 17.4 Distinguish “still running” from “failed permanently”

Use this recipe when a polling endpoint reports multiple successful domain
statuses and only some of them mean work is still in progress. The schedule
decides whether to continue from the status value; later code interprets the
terminal result.

## Problem

For example, `"queued"` and `"running"` should continue polling. `"succeeded"`,
`"failed"`, and `"canceled"` should stop polling. The important distinction is
that `"failed"` is a terminal domain status, not necessarily a failure of the
status-check request.

## Why this comparison matters

`Effect.repeat` repeats after successful effects. With polling, the status
check can succeed even when the remote job reports a permanent failure. That
successful status becomes the schedule input, so the schedule should decide
whether another recurrence is allowed from the domain status value.

If `"failed"` is treated like `"running"`, the caller keeps polling a job that
is already finished. If `"running"` is treated like an error, the caller stops
before the workflow has had a chance to complete.

Keep the repeat predicate narrow: continue only for statuses that are truly
in progress. After the repeat stops, interpret the final observed status.

## Option 1

Classify in-progress statuses with a small predicate and use that predicate in
`Schedule.while`:

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly state: "queued"; readonly jobId: string }
  | { readonly state: "running"; readonly jobId: string; readonly progress: number }
  | { readonly state: "succeeded"; readonly jobId: string; readonly resultId: string }
  | { readonly state: "failed"; readonly jobId: string; readonly reason: string }
  | { readonly state: "canceled"; readonly jobId: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

const isStillRunning = (status: JobStatus): boolean => status.state === "queued" || status.state === "running"

declare const checkJobStatus: (
  jobId: string
) => Effect.Effect<JobStatus, StatusCheckError>

const pollWhileStillRunning = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isStillRunning(input)),
  Schedule.bothLeft(
    Schedule.during("1 minute").pipe(Schedule.satisfiesInputType<JobStatus>())
  )
)

const pollJobStatus = (jobId: string) =>
  checkJobStatus(jobId).pipe(
    Effect.repeat(pollWhileStillRunning)
  )
```

`Schedule.spaced("2 seconds")` supplies the cadence for later polls.
`Schedule.while` allows another poll only while the latest successful status is
`"queued"` or `"running"`. `Schedule.passthrough` keeps the final observed
`JobStatus` as the result of the repeated effect.

The returned status may be `"succeeded"`, `"failed"`, `"canceled"`, or the last
in-progress status observed when the one-minute recurrence budget stopped the
schedule. Interpreting that value is a separate step.

## Option 2

Separate polling from interpretation by giving the terminal domain statuses an
explicit interpreter after the schedule has stopped:

```ts
type PollResult =
  | { readonly _tag: "Completed"; readonly resultId: string }
  | { readonly _tag: "FailedPermanently"; readonly reason: string }
  | { readonly _tag: "Canceled" }
  | { readonly _tag: "StillRunning"; readonly status: Extract<JobStatus, { readonly state: "queued" | "running" }> }

const interpretFinalStatus = (status: JobStatus): PollResult => {
  switch (status.state) {
    case "succeeded":
      return { _tag: "Completed", resultId: status.resultId }
    case "failed":
      return { _tag: "FailedPermanently", reason: status.reason }
    case "canceled":
      return { _tag: "Canceled" }
    case "queued":
    case "running":
      return { _tag: "StillRunning", status }
  }
}

const pollJob = (jobId: string) =>
  pollJobStatus(jobId).pipe(
    Effect.map(interpretFinalStatus)
  )
```

This keeps `Schedule` responsible for recurrence and keeps business decisions
about terminal outcomes in ordinary domain code. A permanent domain failure is
not confused with a failed HTTP request, decoding failure, or authorization
failure from `checkJobStatus`.

## Tradeoffs

Keeping terminal domain failures as successful statuses makes the repeat logic
clear: the schedule stops because the status is no longer in progress. The
caller can then decide whether `"failed"` should become a typed failure, a
return value, a log entry, or a user-facing message.

Mapping permanent domain failures into the effect failure channel before
`Effect.repeat` can be useful when the rest of the program already models them
as failures. The cost is that the schedule no longer sees those statuses. The
repeat stops because the effect failed, not because `Schedule.while` classified
the status as terminal.

For polling APIs, the first form is usually easier to reason about: transport
or observation problems fail the effect, while domain statuses drive the
schedule.

## Recommended default

Model ordinary workflow states as successful values. Use a predicate such as
`isStillRunning` for `Schedule.while`, and make that predicate return `true`
only for states that should cause another poll.

After `Effect.repeat` returns, interpret the final observed status. Treat a
permanent failed terminal status as a domain outcome at that boundary, not as a
reason to keep polling.

## Notes and caveats

`Schedule.while` sees successful status values only. It does not inspect
failures from the status-check effect.

Use `Schedule.satisfiesInputType<T>()` before `Schedule.while` when a timing
schedule such as `Schedule.spaced` or `Schedule.during` needs to read the
latest status through `metadata.input`.

A schedule-side duration such as `Schedule.during("1 minute")` limits
recurrences. It does not decide how to interpret the final status and does not
interrupt an in-flight status check.

Keep the in-progress predicate explicit. A catch-all such as
`status.state !== "succeeded"` accidentally treats permanent failures as work
that is still running.
