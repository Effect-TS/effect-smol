---
book: Effect `Schedule` Cookbook
section_number: "17.5"
section_title: "Return a timeout error gracefully"
part_title: "Part IV — Polling Recipes"
chapter_title: "17. Poll with a Timeout"
status: "draft"
code_included: true
---

# 17.5 Return a timeout error gracefully

Use this recipe when a bounded polling policy needs a caller-friendly result
after it stops. The schedule limits recurrence, and surrounding Effect code
maps the final observed status into the API contract.

## Problem

The loop should stop when a terminal status is observed and also when its
schedule-side budget is exhausted. If the budget ends while the last observed
status is still non-terminal, return a domain timeout error instead of exposing
a raw `"pending"` value.

The schedule is responsible for recurrence. It decides whether to poll again.
It does not turn an exhausted duration budget into an error by itself.

## When to use it

Use this when a non-terminal final value is meaningful only as "we ran out of
polling budget". The caller should be able to distinguish that case from
transport failures, decoding failures, and terminal domain failures.

This is a good fit for job polling, provisioning workflows, exports, payment
settlement checks, and readiness probes where `"pending"` is a normal status
while polling is open but should become a graceful timeout once the bounded
loop has ended.

## When not to use it

Do not use this to interrupt an in-flight status check. `Schedule.during`
participates in recurrence decisions after successful observations; it does
not throw a timeout and does not cancel a status check that is already running.

Do not use this when the final non-terminal status should be returned to the
caller as data. In that case, keep the `Effect.repeat` result as the final
observed status and let the caller decide what to do with it.

Do not map every final status to the same timeout error. A terminal `"failed"`
status and an exhausted polling budget usually mean different things.

## Schedule shape

Keep the latest successful status as the schedule output, and add the elapsed
budget as a recurrence limit:

```ts
Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending"),
  Schedule.bothLeft(
    Schedule.during("30 seconds").pipe(
      Schedule.satisfiesInputType<JobStatus>()
    )
  )
)
```

`Schedule.spaced("1 second")` supplies the polling cadence.
`Schedule.while` permits another recurrence only while the latest successful
status is still pending. `Schedule.during("30 seconds")` closes the recurrence
window after the elapsed budget is used up.

`Schedule.passthrough` is important here: it makes the repeated effect succeed
with the final observed `JobStatus`. After `Effect.repeat` completes, inspect
that value and map a final `"pending"` status to your own timeout error.

## Code

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly state: "pending"; readonly jobId: string }
  | { readonly state: "done"; readonly jobId: string; readonly resultId: string }
  | { readonly state: "failed"; readonly jobId: string; readonly reason: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
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

declare const checkJobStatus: (
  jobId: string
) => Effect.Effect<JobStatus, StatusCheckError>

const pollForUpTo30Seconds = Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "pending"),
  Schedule.bothLeft(
    Schedule.during("30 seconds").pipe(
      Schedule.satisfiesInputType<JobStatus>()
    )
  )
)

const pollUntilDoneOrTimeout = (jobId: string) =>
  checkJobStatus(jobId).pipe(
    Effect.repeat(pollForUpTo30Seconds),
    Effect.flatMap((status) => {
      switch (status.state) {
        case "done":
          return Effect.succeed(status)
        case "failed":
          return Effect.fail(
            {
              _tag: "JobFailed",
              jobId: status.jobId,
              reason: status.reason
            } satisfies JobFailed
          )
        case "pending":
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

The polling effect runs once immediately. If the first status is terminal, the
schedule stops before any delay. If the status remains `"pending"`, the
schedule waits and repeats while both the status predicate and the elapsed
budget allow another recurrence.

The timeout behavior comes from the `Effect.flatMap` after `Effect.repeat`, not
from `Schedule.during`. A final `"pending"` value means the bounded schedule
completed without observing a terminal success, so the code maps that value to
`JobTimedOut`.

## Variants

If the caller prefers a successful domain value instead of a failure-channel
timeout, return an explicit result union after `Effect.repeat`:

```ts
type PollResult =
  | { readonly _tag: "Completed"; readonly status: Extract<JobStatus, { readonly state: "done" }> }
  | { readonly _tag: "TimedOut"; readonly lastStatus: Extract<JobStatus, { readonly state: "pending" }> }
  | { readonly _tag: "Failed"; readonly status: Extract<JobStatus, { readonly state: "failed" }> }

const pollAsResult = (jobId: string) =>
  checkJobStatus(jobId).pipe(
    Effect.repeat(pollForUpTo30Seconds),
    Effect.map((status): PollResult => {
      switch (status.state) {
        case "done":
          return { _tag: "Completed", status }
        case "failed":
          return { _tag: "Failed", status }
        case "pending":
          return { _tag: "TimedOut", lastStatus: status }
      }
    })
  )
```

Use this shape when a timeout is an expected business outcome rather than an
effect failure.

For strict request deadlines, add a timeout to the status-check effect itself.
That is separate from the schedule-side recurrence budget.

## Notes and caveats

`Effect.repeat` returns the schedule output. With `Schedule.passthrough`, that
output is the final successful status observed by the schedule.

`Schedule.during("30 seconds")` does not throw, fail, or produce a timeout
error. It stops allowing future recurrences once the elapsed schedule budget is
used up. Map the final observed value afterward when you want a domain timeout
error.

The duration budget is checked between successful status checks. Time spent
inside a status check contributes to elapsed schedule time before the next
recurrence decision, but the schedule does not interrupt that check.

When a timing schedule is combined with `Schedule.while` over status input, use
`Schedule.satisfiesInputType<T>()` so the status input type remains explicit.
