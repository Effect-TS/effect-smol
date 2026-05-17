---
book: "Effect `Schedule` Cookbook"
section_number: "26.5"
section_title: "Poll a job-based HTTP API"
part_title: "Part VII — Real-World Recipes"
chapter_title: "26. Backend Recipes"
status: "draft"
code_included: true
---

# 26.5 Poll a job-based HTTP API

Job-based HTTP APIs are polling problems when the status endpoint returns
successful "still running" responses rather than errors.

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

Combine a spaced cadence, a terminal-state predicate, and an elapsed budget.
`Schedule.spaced("2 seconds")` waits after each successful status response
before the next poll. `Schedule.while` allows another recurrence only while the
latest status is non-terminal. `Schedule.during("1 minute")` gives the polling
loop an elapsed budget.

`Schedule.passthrough` makes the latest `JobStatus` the schedule output.
`Schedule.bothLeft` adds the deadline while preserving that status output.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

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

let polls = 0

const readJobStatus = (jobId: string): Effect.Effect<JobStatus, JobStatusError> =>
  Effect.gen(function*() {
    polls += 1

    const status: JobStatus =
      polls === 1
        ? { state: "queued", jobId }
        : polls === 2
          ? { state: "running", jobId, progress: 60 }
          : { state: "succeeded", jobId, artifactUrl: "/exports/job-1.csv" }

    yield* Console.log(`poll ${polls}: ${status.state}`)
    return status
  })

const pollJobUntilTerminalOrDeadline = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.during("200 millis").pipe(
      Schedule.satisfiesInputType<JobStatus>()
    )
  )
)

const waitForJob = (jobId: string) =>
  readJobStatus(jobId).pipe(
    Effect.repeat(pollJobUntilTerminalOrDeadline),
    Effect.tap((status) => Console.log(`final status: ${status.state}`))
  )

Effect.runPromise(waitForJob("job-1")).then(console.log, console.error)
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

Use shorter spacing when the caller is waiting interactively and the status
endpoint is cheap. Use longer spacing for background jobs where completion
latency matters less than endpoint load.

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
