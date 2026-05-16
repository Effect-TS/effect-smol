---
book: Effect `Schedule` Cookbook
section_number: "39.3"
section_title: "Polling plus timeout plus terminal-state detection"
part_title: "Part IX — Composition Recipes"
chapter_title: "39. Combine Delay Strategies and Stop Conditions"
status: "draft"
code_included: true
---

# 39.3 Polling plus timeout plus terminal-state detection

Some polling loops have three separate stopping concerns: how often to poll,
how long the caller is willing to wait overall, and which observed statuses are
terminal. Put those concerns in the schedule instead of scattering sleeps,
deadline checks, and status branches through a hand-written loop.

In this recipe the polled effect succeeds with a domain status. The schedule
repeats while the latest status is non-terminal and while the elapsed polling
budget is still open. After the repeat completes, the surrounding Effect code
interprets the final observed status.

## Problem

You need to poll an external workflow until it reports a terminal state, but
you also need a clear elapsed budget. If the workflow is still running when the
budget closes, the caller should receive a timeout result or error. If the
workflow reports a terminal failure, that should remain distinct from a timeout.

## When to use it

Use this when status polling is the right integration model and the final
status has business meaning. Typical examples include export generation,
payment settlement, provisioning jobs, long-running back-office tasks, and
readiness checks for resources created by another system.

This recipe is useful when reviewers need to see the polling cadence, elapsed
budget, and terminal-state predicate in one place.

## When not to use it

Do not use this to retry failed status reads. With `Effect.repeat`, failures of
the status-read effect stop the program before the schedule can inspect a
status. Use `Effect.retry` around the status read when transport recovery is a
separate requirement.

Do not treat the schedule-side budget as a hard timeout for one in-flight
status request. `Schedule.during` controls whether another recurrence is
allowed after a status has been observed; it does not interrupt the status read
currently running.

Do not collapse terminal failure and timeout into the same case. A status such
as `"failed"` means the remote workflow ended. A timeout means polling ended
without observing a terminal status.

## Schedule shape

Name the pieces before composing them:

```ts
const cadence = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)

const elapsedBudget = Schedule.during("1 minute").pipe(
  Schedule.satisfiesInputType<JobStatus>()
)

const pollingPolicy = cadence.pipe(
  Schedule.bothLeft(elapsedBudget)
)
```

`Schedule.spaced("2 seconds")` supplies the delay between status reads.
`Schedule.passthrough` keeps the latest successful status as the schedule
output. `Schedule.while` permits another recurrence only while that status is
non-terminal. `Schedule.during("1 minute")` contributes the elapsed budget.
`Schedule.bothLeft` requires both schedules to continue, while preserving the
status output from the left side.

## Code

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly _tag: "Queued"; readonly jobId: string }
  | { readonly _tag: "Running"; readonly jobId: string; readonly percent: number }
  | { readonly _tag: "Succeeded"; readonly jobId: string; readonly resultId: string }
  | { readonly _tag: "Failed"; readonly jobId: string; readonly reason: string }

type StatusReadError = {
  readonly _tag: "StatusReadError"
  readonly message: string
}

type JobTimedOut = {
  readonly _tag: "JobTimedOut"
  readonly jobId: string
}

type JobFailed = {
  readonly _tag: "JobFailed"
  readonly jobId: string
  readonly reason: string
}

declare const readStatus: (
  jobId: string
) => Effect.Effect<JobStatus, StatusReadError>

const isTerminal = (status: JobStatus): boolean =>
  status._tag === "Succeeded" || status._tag === "Failed"

const cadence = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)

const elapsedBudget = Schedule.during("1 minute").pipe(
  Schedule.satisfiesInputType<JobStatus>()
)

const pollingPolicy = cadence.pipe(
  Schedule.bothLeft(elapsedBudget)
)

export const pollJob = (jobId: string) =>
  readStatus(jobId).pipe(
    Effect.repeat(pollingPolicy),
    Effect.flatMap((status) => {
      switch (status._tag) {
        case "Succeeded":
          return Effect.succeed(status)
        case "Failed":
          return Effect.fail(
            {
              _tag: "JobFailed",
              jobId: status.jobId,
              reason: status.reason
            } satisfies JobFailed
          )
        case "Queued":
        case "Running":
          return Effect.fail(
            {
              _tag: "JobTimedOut",
              jobId: status.jobId
            } satisfies JobTimedOut
          )
      }
    })
  )
```

The first status read happens immediately. If it returns `Succeeded` or
`Failed`, `Schedule.while` stops the repeat before any sleep. If it returns
`Queued` or `Running`, the schedule waits two seconds and reads again while the
one-minute budget is still open.

When the schedule stops, `Effect.repeat` returns the schedule output. Because
the composed policy preserves the left output with `Schedule.bothLeft`, that
output is the final observed `JobStatus`. The final `Effect.flatMap` is where
domain interpretation happens: success returns the terminal success status,
terminal failure becomes `JobFailed`, and a remaining non-terminal status means
the polling budget was exhausted.

## Variants

For a successful timeout result instead of an error channel timeout, map the
final status into a result union after `Effect.repeat`:

```ts
type PollResult =
  | { readonly _tag: "Completed"; readonly status: Extract<JobStatus, { readonly _tag: "Succeeded" }> }
  | { readonly _tag: "Failed"; readonly status: Extract<JobStatus, { readonly _tag: "Failed" }> }
  | { readonly _tag: "TimedOut"; readonly lastStatus: Extract<JobStatus, { readonly _tag: "Queued" | "Running" }> }

export const pollJobAsResult = (jobId: string) =>
  readStatus(jobId).pipe(
    Effect.repeat(pollingPolicy),
    Effect.map((status): PollResult => {
      switch (status._tag) {
        case "Succeeded":
          return { _tag: "Completed", status }
        case "Failed":
          return { _tag: "Failed", status }
        case "Queued":
        case "Running":
          return { _tag: "TimedOut", lastStatus: status }
      }
    })
  )
```

For large fleets, add jitter to the cadence after the base delay is correct:

```ts
const fleetCadence = Schedule.spaced("2 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)
```

Keep the terminal predicate unchanged when adding jitter. Jitter changes when
the next observation happens, not which statuses are terminal.

## Notes and caveats

`Schedule.bothLeft` combines the recurrence decisions with "both must
continue" semantics and keeps the left schedule output. In this recipe that
left output is the latest status, which is the value the caller needs after
polling stops.

`Schedule.during` checks elapsed schedule time between observations. Time spent
inside `readStatus` contributes to elapsed time before the next recurrence
decision, but the schedule does not cancel `readStatus` while it is running.

`Schedule.while` sees successful repeat outputs as schedule inputs. Use
`Schedule.satisfiesInputType<JobStatus>()` before `Schedule.passthrough` and
before composing the elapsed budget so that the input type stays explicit.
