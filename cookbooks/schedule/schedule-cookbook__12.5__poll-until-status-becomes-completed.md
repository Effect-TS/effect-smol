---
book: "Effect `Schedule` Cookbook"
section_number: "12.5"
section_title: "Poll until status becomes `Completed`"
part_title: "Part IV — Polling Recipes"
chapter_title: "12. Poll Until Completion"
status: "draft"
code_included: true
---

# 12.5 Poll until status becomes `Completed`

Polling for a desired output is not the same as polling until any terminal state
appears. The schedule decides when to ask again; the code after polling decides
whether the final status is the desired one.

## Problem

A status endpoint may successfully return `"Queued"`, `"Running"`,
`"Completed"`, `"Failed"`, or `"Canceled"`. Only `"Completed"` is the result
the caller wants.

`"Failed"` and `"Canceled"` are terminal domain states: successful status
responses that mean the job will not complete. They should stop polling, but
they should not be treated as completed work. A failed status request is a
separate effect failure.

## When to use it

Use this for job APIs where in-progress statuses mean "poll again", one status
means "return the completed result", and other terminal statuses must be
reported separately.

## When not to use it

Do not retry transport, authorization, or decoding failures with this schedule.
With `Effect.repeat`, failures from the repeated effect stop the repeat unless
handled before repeating.

Do not continue while `status.state !== "Completed"` when the domain has other
terminal states. That would keep polling after a job has already failed or been
canceled.

Do not leave long-running jobs unbounded unless another owner controls the
fiber lifetime.

## Schedule shape

Use `Schedule.spaced` for the delay, `Schedule.passthrough` to keep the latest
status, and `Schedule.while` to continue only while the status is still in
progress. After `Effect.repeat` returns, map `"Completed"` to success and map
other terminal statuses to domain errors.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

type JobStatus =
  | { readonly state: "Queued" }
  | { readonly state: "Running"; readonly percent: number }
  | { readonly state: "Completed"; readonly resultId: string }
  | { readonly state: "Failed"; readonly reason: string }
  | { readonly state: "Canceled" }

type CompletedStatus = Extract<JobStatus, { readonly state: "Completed" }>

type CompletionError =
  | { readonly _tag: "JobFailed"; readonly reason: string }
  | { readonly _tag: "JobCanceled" }
  | { readonly _tag: "JobDidNotCompleteInTime"; readonly lastState: JobStatus["state"] }

const scriptedStatuses: ReadonlyArray<JobStatus> = [
  { state: "Queued" },
  { state: "Running", percent: 40 },
  { state: "Completed", resultId: "result-123" }
]

let readIndex = 0

const isInProgress = (status: JobStatus): boolean =>
  status.state === "Queued" || status.state === "Running"

const checkJobStatus = (jobId: string): Effect.Effect<JobStatus> =>
  Effect.sync(() => {
    const status = scriptedStatuses[
      Math.min(readIndex, scriptedStatuses.length - 1)
    ]!
    readIndex += 1
    return status
  }).pipe(
    Effect.tap((status) => Console.log(`[${jobId}] ${status.state}`))
  )

const pollWhileInProgress = Schedule.spaced("20 millis").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isInProgress(input)),
  Schedule.take(10)
)

const requireCompleted = (
  status: JobStatus
): Effect.Effect<CompletedStatus, CompletionError> => {
  switch (status.state) {
    case "Completed":
      return Effect.succeed(status)
    case "Failed":
      return Effect.fail({ _tag: "JobFailed", reason: status.reason })
    case "Canceled":
      return Effect.fail({ _tag: "JobCanceled" })
    case "Queued":
    case "Running":
      return Effect.fail({
        _tag: "JobDidNotCompleteInTime",
        lastState: status.state
      })
  }
}

const program = checkJobStatus("job-1").pipe(
  Effect.repeat(pollWhileInProgress),
  Effect.flatMap(requireCompleted),
  Effect.tap((status) => Console.log(`completed with ${status.resultId}`))
)

Effect.runPromise(program).then((status) => {
  console.log("result:", status)
})
```

The first check runs immediately. The schedule repeats only while the latest
successful status is `"Queued"` or `"Running"`. The final interpretation is
kept outside the schedule so `"Failed"` and `"Canceled"` remain visible domain
outcomes.

## Variants

Remove `Schedule.take` when another lifetime or timeout bounds the polling
fiber. Keep an explicit branch for in-progress statuses if you add any schedule
that can stop before completion.

If failed or canceled jobs should be returned as values instead of failures,
keep the same polling schedule and change only the final interpreter.

## Notes and caveats

`Schedule.while` sees successful status values only. It does not inspect
failures from the status-check effect.

The first status check is not delayed. Delays apply only before recurrences.

Use `Schedule.satisfiesInputType<T>()` before `Schedule.while` when a timing
schedule reads the latest successful status from `metadata.input`.
