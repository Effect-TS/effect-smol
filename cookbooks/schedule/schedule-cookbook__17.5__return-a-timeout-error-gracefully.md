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

Use this when a bounded polling loop should return a caller-friendly timeout
instead of exposing a final non-terminal status. The schedule stops recurrence;
Effect code maps the final status into the API contract.

## Problem

The loop should stop when a terminal status is observed and also when its
schedule-side budget is exhausted. If the budget ends while the last observed
status is still non-terminal, return a domain timeout error instead of exposing
a raw `"pending"` value.

`Schedule.during` does not fail the effect. It only stops allowing future
recurrences, so the timeout error must be produced after `Effect.repeat`
returns.

## When to use it

Use it when `"pending"` is normal while polling is open, but a final
`"pending"` means the caller ran out of budget. This is common in job polling,
exports, provisioning, payment settlement, and readiness checks.

## When not to use it

Do not use it to interrupt an in-flight status check. Add `Effect.timeout` to
the checked effect or to the whole workflow when interruption is required.

Do not use this when the final non-terminal status should be returned to the
caller as data. In that case, keep the `Effect.repeat` result as the final
observed status and let the caller decide what to do with it.

Do not map every final status to the same timeout error. A terminal `"failed"`
status and an exhausted polling budget usually mean different things.

## Schedule shape

Keep the latest successful status as the schedule output with
`Schedule.passthrough`, continue only while it is `"pending"`, and combine the
policy with `Schedule.during("30 seconds")`. After `Effect.repeat`, map a final
`"pending"` status to your timeout error.

## Code

```ts
import { Clock, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type JobStatus =
  | { readonly state: "pending"; readonly jobId: string }
  | { readonly state: "done"; readonly jobId: string; readonly resultId: string }
  | { readonly state: "failed"; readonly jobId: string; readonly reason: string }

type JobTimedOut = {
  readonly _tag: "JobTimedOut"
  readonly jobId: string
}

type JobFailed = {
  readonly _tag: "JobFailed"
  readonly jobId: string
  readonly reason: string
}

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

let checks = 0

const checkJobStatus = Effect.gen(function*() {
  const now = yield* Clock.currentTimeMillis
  checks += 1

  const status: JobStatus = {
    state: "pending",
    jobId: "job-1"
  }

  if (checks <= 3 || now >= 30000) {
    console.log(`t+${now}ms check ${checks}: ${status.state}`)
  } else if (checks === 4) {
    console.log("additional pending checks omitted")
  }

  return status
})

const pollUntilDoneOrTimeout = checkJobStatus.pipe(
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

const program = Effect.gen(function*() {
  const fiber = yield* pollUntilDoneOrTimeout.pipe(
    Effect.match({
      onFailure: (error) => ({ _tag: "Failed" as const, error }),
      onSuccess: (status) => ({ _tag: "Succeeded" as const, status })
    }),
    Effect.forkDetach
  )

  yield* TestClock.adjust("35 seconds")
  const result = yield* Fiber.join(fiber)
  console.log("result:", result)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

The logged result contains `JobTimedOut`. That error is produced by the final
`Effect.flatMap`, not by the schedule.

## Variants

If timeout is an expected business value rather than a failure-channel error,
return a result union from the final mapping step, for example
`{ _tag: "TimedOut", lastStatus }`.

For strict request deadlines, add a timeout to the status-check effect itself.
That is separate from the schedule-side recurrence budget.

## Notes and caveats

`Effect.repeat` returns the schedule output. With `Schedule.passthrough`, that
output is the final successful status observed by the schedule.

`Schedule.during("30 seconds")` does not throw, fail, or produce a timeout
error. It stops allowing future recurrences once the elapsed schedule budget is
used up. The budget is checked between successful status checks and does not
interrupt a check that is already running.
