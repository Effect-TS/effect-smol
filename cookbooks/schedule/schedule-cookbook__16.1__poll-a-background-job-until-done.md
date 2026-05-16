---
book: Effect `Schedule` Cookbook
section_number: "16.1"
section_title: "Poll a background job until done"
part_title: "Part IV — Polling Recipes"
chapter_title: "16. Poll Until Completion"
status: "draft"
code_included: true
---

# 16.1 Poll a background job until done

You have submitted a background job to another system. The submission already returned a
job id, and now your program needs to check the job status until the job reaches a
terminal domain state. This recipe treats polling as repeated successful observations.
The schedule controls cadence and the condition for taking another observation, while
the surrounding Effect code interprets terminal states, missing data, stale reads, and
real failures. Keeping those responsibilities separate makes the polling loop easier to
bound and diagnose.

## Problem

You have submitted a background job to another system. The submission already
returned a job id, and now your program needs to check the job status until the
job reaches a terminal domain state.

The status check itself is an effect. A successful status check can still report
that the job is `"queued"` or `"running"`. Those are domain statuses, not effect
failures. The effect should fail only when the status check could not be
performed or decoded.

## When to use it

Use this when polling is driven by successful observations of a remote job's
state.

This is a good fit for APIs that expose statuses such as `"queued"`,
`"running"`, `"succeeded"`, `"failed"`, or `"canceled"`, where the terminal
states are ordinary successful responses from the status endpoint.

## When not to use it

Do not use this to retry a failing status endpoint. With `Effect.repeat`, a
failure from the status-check effect stops the repeat immediately. Use retry
around the status check when transport or decoding failures should be retried.

Do not use this section as a timeout recipe. This recipe shows the basic polling
shape and a small recurrence cap. Deadline-oriented polling belongs in the
timeout recipes.

Do not treat a domain `"failed"` job status as an effect failure unless your
caller explicitly wants job failure to fail the effect after polling completes.

## Schedule shape

Use a timing schedule for the pause between status checks, preserve the latest
successful status as the schedule output, and continue while that status is not
terminal:

```ts
Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)
```

`Schedule.spaced("2 seconds")` supplies the delay before each recurrence.
`Schedule.satisfiesInputType<JobStatus>()` constrains the timing schedule before
the predicate reads `metadata.input`. `Schedule.passthrough` keeps the successful
`JobStatus` as the schedule output, so the repeated effect returns the final
observed status.

## Code

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly state: "queued" }
  | { readonly state: "running"; readonly percent: number }
  | { readonly state: "succeeded"; readonly resultId: string }
  | { readonly state: "failed"; readonly reason: string }
  | { readonly state: "canceled" }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

const isTerminal = (status: JobStatus): boolean =>
  status.state === "succeeded" ||
  status.state === "failed" ||
  status.state === "canceled"

declare const checkJobStatus: (
  jobId: string
) => Effect.Effect<JobStatus, StatusCheckError>

const pollUntilTerminal = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)

const pollJob = (jobId: string) =>
  checkJobStatus(jobId).pipe(
    Effect.repeat(pollUntilTerminal)
  )
```

`pollJob` performs the first status check immediately. If the first successful
response is terminal, the schedule stops without another status check. If the
response is non-terminal, the schedule waits two seconds and then repeats.

The resulting effect succeeds with the terminal `JobStatus` when a terminal
status is observed. It fails with `StatusCheckError` only when a status check
effect fails.

## Variants

Add a recurrence cap when the caller wants to stop after a small number of
observations even if the job is still non-terminal:

```ts
const pollAtMostThirtyTimes = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.recurs(30).pipe(Schedule.satisfiesInputType<JobStatus>())
  )
)

const terminalOrLastObservedStatus = (jobId: string) =>
  checkJobStatus(jobId).pipe(
    Effect.repeat(pollAtMostThirtyTimes)
  )
```

This still returns a `JobStatus`. The value may be terminal because the status
predicate stopped the repeat, or it may be the last non-terminal status observed
when the recurrence cap stopped the repeat.

If a terminal domain state should fail the caller, keep polling until the
terminal status is observed, then handle the final successful value in a
separate step. That keeps polling failures and job-domain failures distinct.

## Notes and caveats

`Schedule.while` sees only successful outputs from the status check. It does not
classify effect failures.

The first status check is not delayed. The schedule controls recurrences after
the first run.

Use `Schedule.passthrough` when composing timing or counting schedules and the
caller needs the final observed status.

When a timing or count schedule is combined with `Schedule.while`, apply
`Schedule.satisfiesInputType<T>()` before reading `metadata.input`.
