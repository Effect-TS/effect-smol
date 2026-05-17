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

Polling an external workflow usually has separate cadence, budget, and
terminal-state concerns. This recipe keeps those concerns in the schedule and
leaves final status interpretation in ordinary Effect code.

## Problem

An external job can report `Queued`, `Running`, `Succeeded`, or `Failed`.
`Queued` and `Running` should keep the poll going only while the caller's elapsed
budget remains open. `Failed` should remain a terminal job result, not be
collapsed into the same case as a timeout.

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
status request. `Schedule.during` controls whether another recurrence is allowed
after a status has been observed; it does not interrupt the read currently
running.

Do not collapse terminal failure and timeout into the same case. A status such
as `"failed"` means the remote workflow ended. A timeout means polling ended
without observing a terminal status.

## Schedule shape

`Schedule.spaced("2 seconds")` supplies the delay between status reads.
`Schedule.passthrough` keeps the latest successful status as the schedule
output. `Schedule.while` permits another recurrence only while that status is
non-terminal. `Schedule.during("1 minute")` contributes the elapsed budget.
`Schedule.bothLeft` requires both schedules to continue, while preserving the
status output from the left side.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

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

const attempts: Record<string, number> = {}

const readStatus = (jobId: string): Effect.Effect<JobStatus, StatusReadError> =>
  Effect.gen(function*() {
    const attempt = (attempts[jobId] ?? 0) + 1
    attempts[jobId] = attempt

    let status: JobStatus
    if (jobId === "failed-job" && attempt >= 3) {
      status = { _tag: "Failed", jobId, reason: "remote validation failed" }
    } else if (attempt === 1) {
      status = { _tag: "Queued", jobId }
    } else {
      status = { _tag: "Running", jobId, percent: Math.min(attempt * 30, 90) }
    }

    yield* Console.log(`${jobId}: ${status._tag}`)
    return status
  })

const isTerminal = (status: JobStatus): boolean =>
  status._tag === "Succeeded" || status._tag === "Failed"

const cadence = Schedule.spaced("20 millis").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)

const elapsedBudget = Schedule.during("70 millis").pipe(
  Schedule.satisfiesInputType<JobStatus>()
)

const pollingPolicy = cadence.pipe(
  Schedule.bothLeft(elapsedBudget)
)

const pollJob = (jobId: string) =>
  readStatus(jobId).pipe(
    Effect.repeat(pollingPolicy),
    Effect.flatMap((status) => {
      switch (status._tag) {
        case "Succeeded":
          return Console.log(`${jobId}: completed with ${status.resultId}`)
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

const logPollError = (error: JobTimedOut | JobFailed) =>
  Console.log(
    error._tag === "JobTimedOut"
      ? `${error.jobId}: polling budget exhausted`
      : `${error.jobId}: terminal failure (${error.reason})`
  )

const program = Effect.gen(function*() {
  yield* pollJob("failed-job").pipe(Effect.catch(logPollError))
  yield* pollJob("slow-job").pipe(Effect.catch(logPollError))
})

Effect.runPromise(program)
```

The first status read happens immediately. If it returns `Succeeded` or
`Failed`, `Schedule.while` stops the repeat before any sleep. If it returns
`Queued` or `Running`, the schedule waits and reads again while the elapsed
budget is still open.

When the schedule stops, `Effect.repeat` returns the schedule output. Because
the composed policy preserves the left output with `Schedule.bothLeft`, that
output is the final observed `JobStatus`. The final `Effect.flatMap` is where
domain interpretation happens: success returns the terminal success status,
terminal failure becomes `JobFailed`, and a remaining non-terminal status means
the polling budget was exhausted.

## Variants

For a successful timeout result instead of an error-channel timeout, map the
final status into a result union after `Effect.repeat`: completed, failed, or
timed out with the last non-terminal status.

For large fleets, add `Schedule.jittered` to the cadence after the base delay is
correct. Keep the terminal predicate unchanged; jitter changes when the next
observation happens, not which statuses are terminal.

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
