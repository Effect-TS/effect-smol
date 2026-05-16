---
book: Effect `Schedule` Cookbook
section_number: "43.5"
section_title: "Poll a job-based HTTP API"
part_title: "Part X — Real-World Recipes"
chapter_title: "43. Backend Recipes"
status: "draft"
code_included: true
---

# 43.5 Poll a job-based HTTP API

Job-based HTTP APIs often split work into two calls: one request starts the job,
and later requests read the job status. The status endpoint usually returns a
normal successful response while the job is still running, so this is a repeat
problem, not a retry problem.

Use `Schedule` to make the polling contract visible: check immediately, wait
between pending statuses, stop on a terminal status, and stop after a deadline if
the job never becomes terminal.

## Problem

You submit a job to an HTTP API and receive a `jobId`. The status endpoint can
return `"queued"` or `"running"` for a while before returning a terminal
`"succeeded"` or `"failed"` status.

You need the first status check to happen right away, but you do not want an
unbounded loop. Readers should be able to see the polling interval, the terminal
condition, and the deadline in one place.

## When to use it

Use this recipe when an API models long-running work as a job resource and the
status response is a successful domain value. A pending status is not an error;
it is the input that tells the schedule whether another poll should happen.

This is a good fit for export generation, report rendering, media processing,
provisioning, and other backend workflows where completion is eventually visible
through a status endpoint.

## When not to use it

Do not use polling to hide request errors. Authorization failures, invalid job
IDs, decode failures, and transient transport failures should stay in the error
channel and be handled separately from domain statuses.

Also prefer a webhook, queue message, server-sent event, or direct callback when
the system already offers a push-based completion signal.

## Schedule shape

Combine three pieces:

```ts
Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.during("1 minute").pipe(
      Schedule.satisfiesInputType<JobStatus>()
    )
  )
)
```

`Schedule.spaced("2 seconds")` waits after each successful status response
before the next poll. `Schedule.while` allows another recurrence only while the
latest status is non-terminal. `Schedule.during("1 minute")` gives the polling
loop an elapsed recurrence budget.

`Schedule.passthrough` makes the latest `JobStatus` the schedule output.
`Schedule.bothLeft` adds the deadline while preserving that status output.

## Code

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly state: "queued"; readonly jobId: string }
  | { readonly state: "running"; readonly jobId: string; readonly progress: number }
  | { readonly state: "succeeded"; readonly jobId: string; readonly artifactUrl: string }
  | { readonly state: "failed"; readonly jobId: string; readonly reason: string }

type JobStatusError = {
  readonly _tag: "JobStatusError"
  readonly message: string
}

const isTerminal = (status: JobStatus): boolean =>
  status.state === "succeeded" || status.state === "failed"

declare const readJobStatus: (
  jobId: string
) => Effect.Effect<JobStatus, JobStatusError>

const pollJobUntilTerminalOrDeadline = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.during("1 minute").pipe(
      Schedule.satisfiesInputType<JobStatus>()
    )
  )
)

const waitForJob = (jobId: string) =>
  readJobStatus(jobId).pipe(
    Effect.repeat(pollJobUntilTerminalOrDeadline)
  )
```

`waitForJob` performs the first status request immediately. If that first
response is `"succeeded"` or `"failed"`, it returns without waiting. If the
response is `"queued"` or `"running"`, the schedule waits two seconds before
polling again.

The returned effect succeeds with the final observed `JobStatus`. That value is
terminal when the API returned `"succeeded"` or `"failed"` before the deadline.
It can still be `"queued"` or `"running"` when the one-minute polling budget was
used up first.

## Variants

Use a shorter spacing, such as `"500 millis"` or `"1 second"`, when the caller is
waiting interactively and the status endpoint is cheap.

Use a longer spacing, such as `"10 seconds"` or `"30 seconds"`, for background
jobs where completion latency matters less than endpoint load.

Add `Schedule.jittered` after the base cadence when many workers may begin
polling similar jobs at the same time.

If each individual HTTP request needs its own deadline, put a timeout on
`readJobStatus(jobId)` separately. `Schedule.during` limits recurrence
decisions; it is not a hard timeout for an in-flight request.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule. That is why the
predicate sees `JobStatus` values and can stop on terminal domain states.
`Effect.retry` would feed failures into the schedule instead.

The first status request is not delayed. Schedules describe the recurrence after
the original effect has run.

`Schedule.spaced` waits after a status request completes. Use `Schedule.fixed`
only when you need polling aligned to wall-clock intervals.

Keep terminal domain states distinct from infrastructure failures. A job-level
`"failed"` status is a successful HTTP observation that should stop polling; a
failed status request is an effect failure that should be retried, reported, or
classified outside this repeat schedule.
