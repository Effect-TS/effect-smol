---
book: Effect `Schedule` Cookbook
section_number: "20.1"
section_title: "Poll until status becomes `Completed`"
part_title: "Part IV — Polling Recipes"
chapter_title: "20. Poll Until a Desired Output Appears"
status: "draft"
code_included: true
---

# 20.1 Poll until status becomes `Completed`

Polling for a desired output is different from polling for any terminal state.
Here, the repeated effect successfully observes a status value, and the schedule
keeps asking only while the work is still in progress. When polling stops, the
final status must still be interpreted: `"Completed"` is the desired result,
while `"Failed"` and `"Canceled"` are terminal domain outcomes that are not
completion. Transport or decoding failures remain effect failures.

## Problem

You have a status endpoint that returns successful observations such as
`"Queued"`, `"Running"`, `"Completed"`, `"Failed"`, or `"Canceled"`. The caller
wants the completed result, but the polling loop must not confuse three
different cases:

- `"Completed"` is the desired successful output.
- `"Failed"` and `"Canceled"` are terminal domain statuses, but they are not the
  desired output.
- A failed status check is an effect failure, not a status value.

## When to use it

Use this when the status check succeeds with ordinary domain states, and only
one terminal state should be treated as the desired result.

This is a good fit for job APIs where `"Queued"` and `"Running"` mean "poll
again", `"Completed"` means "return the result", and other terminal statuses
must be reported separately.

## When not to use it

Do not use this to retry a status-check request that failed because of a
transport, authorization, or decoding problem. With `Effect.repeat`, a failure
from the repeated effect stops the repeat immediately.

Do not continue while `status.state !== "Completed"` if the domain has other
terminal states. That would keep polling after a job has already reached
`"Failed"` or `"Canceled"`.

Do not use this as a timeout recipe by itself. If the job can remain in progress
forever, compose the polling schedule with a recurrence or time limit and decide
how to interpret the last in-progress status.

## Schedule shape

Poll again only while the latest successful status is still in progress:

```ts
Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isInProgress(input))
)
```

`Schedule.spaced("2 seconds")` supplies the delay between later status checks.
`Schedule.satisfiesInputType<JobStatus>()` constrains the timing schedule before
`Schedule.while` reads `metadata.input`. `Schedule.passthrough` keeps the latest
successful `JobStatus` as the schedule output, so `Effect.repeat` returns the
final observed status.

The schedule stops when the status is no longer in progress. The code after
polling then decides whether that final status is exactly `"Completed"` or a
different terminal state.

## Code

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly state: "Queued" }
  | { readonly state: "Running"; readonly percent: number }
  | { readonly state: "Completed"; readonly resultId: string }
  | { readonly state: "Failed"; readonly reason: string }
  | { readonly state: "Canceled" }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

type CompletionError =
  | { readonly _tag: "JobFailed"; readonly reason: string }
  | { readonly _tag: "JobCanceled" }

const isInProgress = (status: JobStatus): boolean => status.state === "Queued" || status.state === "Running"

declare const checkJobStatus: (
  jobId: string
) => Effect.Effect<JobStatus, StatusCheckError>

const pollWhileInProgress = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isInProgress(input))
)

const pollUntilCompleted = (
  jobId: string
): Effect.Effect<
  Extract<JobStatus, { readonly state: "Completed" }>,
  StatusCheckError | CompletionError
> =>
  checkJobStatus(jobId).pipe(
    Effect.repeat(pollWhileInProgress),
    Effect.flatMap((status) => {
      switch (status.state) {
        case "Completed":
          return Effect.succeed(status)
        case "Failed":
          return Effect.fail({ _tag: "JobFailed", reason: status.reason })
        case "Canceled":
          return Effect.fail({ _tag: "JobCanceled" })
        case "Queued":
        case "Running":
          return Effect.never
      }
    })
  )
```

The first status check runs immediately. If it returns `"Queued"` or
`"Running"`, the schedule waits two seconds before checking again. If it returns
`"Completed"`, `"Failed"`, or `"Canceled"`, the schedule stops.

The final `Effect.flatMap` is intentionally separate from the schedule. The
schedule decides whether to poll again; the interpreter decides whether the
final terminal status is the desired output.

## Variants

Add a recurrence limit when the caller needs a bounded poll:

```ts
const pollWhileInProgressAtMostThirtyTimes = pollWhileInProgress.pipe(
  Schedule.bothLeft(
    Schedule.recurs(30).pipe(Schedule.satisfiesInputType<JobStatus>())
  )
)
```

With a limit, the repeated effect can finish with the last `"Queued"` or
`"Running"` status when the recurrence cap is exhausted. In that variant, add a
separate `"NotCompletedInTime"` outcome instead of using `Effect.never` for the
in-progress cases.

If `"Failed"` or `"Canceled"` should be returned as values rather than failures,
keep the same schedule and change only the final interpreter. The polling rule
is still "repeat while in progress", not "repeat while not completed".

## Notes and caveats

`Schedule.while` sees successful status values only. It does not inspect failures
from `checkJobStatus`.

`"Completed"` is the desired output. Other terminal statuses should stop
polling, but they should not be treated as completed work.

The first status check is not delayed by the schedule. Delays apply only before
recurrences.

When a timing schedule reads the latest status through `metadata.input`, apply
`Schedule.satisfiesInputType<T>()` before `Schedule.while`.
