---
book: "Effect `Schedule` Cookbook"
section_number: "14.3"
section_title: "Distinguish “still running” from “failed permanently”"
part_title: "Part IV — Polling Recipes"
chapter_title: "14. Poll with Timeouts"
status: "draft"
code_included: true
---

# 14.3 Distinguish “still running” from “failed permanently”

Use this when a status endpoint reports several successful domain states, but
only some of them mean work is still in progress. The schedule should continue
for in-progress states and stop for terminal states, including domain failures.

## Problem

`"queued"` and `"running"` should poll again. `"succeeded"`, `"failed"`, and
`"canceled"` should stop. A status value of `"failed"` is different from a
failed status request: the request succeeded and reported a terminal domain
outcome.

## Why this comparison matters

`Effect.repeat` repeats after successful effects. With polling, the status
check can succeed even when the remote job reports permanent failure. That
successful status becomes the schedule input, so the repeat predicate must be
about domain state, not request success.

If `"failed"` is treated like `"running"`, the caller keeps polling a job that
is already finished. If `"running"` is treated like an error, the caller stops
before the workflow has had a chance to complete.

Keep the repeat predicate narrow: continue only for statuses that are truly
in progress. After the repeat stops, interpret the final observed status.

## Schedule shape

Classify in-progress statuses with a predicate such as `isStillRunning`, use it
from `Schedule.while`, and keep the final `JobStatus` with
`Schedule.passthrough`.

## Example

```ts
import { Clock, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type JobStatus =
  | { readonly state: "queued"; readonly jobId: string }
  | { readonly state: "running"; readonly jobId: string; readonly progress: number }
  | { readonly state: "succeeded"; readonly jobId: string; readonly resultId: string }
  | { readonly state: "failed"; readonly jobId: string; readonly reason: string }
  | { readonly state: "canceled"; readonly jobId: string }

const isStillRunning = (status: JobStatus): boolean => status.state === "queued" || status.state === "running"

const pollWhileStillRunning = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isStillRunning(input)),
  Schedule.bothLeft(
    Schedule.during("1 minute").pipe(Schedule.satisfiesInputType<JobStatus>())
  )
)

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

const script: ReadonlyArray<JobStatus> = [
  { state: "queued", jobId: "job-1" },
  { state: "running", jobId: "job-1", progress: 40 },
  { state: "failed", jobId: "job-1", reason: "validation failed" }
]

let checks = 0

const checkJobStatus = Effect.gen(function*() {
  const now = yield* Clock.currentTimeMillis
  const status = script[Math.min(checks, script.length - 1)]!
  checks += 1
  console.log(`t+${now}ms check ${checks}: ${status.state}`)
  return status
})

const program = Effect.gen(function*() {
  const fiber = yield* checkJobStatus.pipe(
    Effect.repeat(pollWhileStillRunning),
    Effect.map(interpretFinalStatus),
    Effect.forkDetach
  )

  yield* TestClock.adjust("1 minute")

  const result = yield* Fiber.join(fiber)
  console.log("result:", result)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

The final `"failed"` status stops polling because it is not still running. The
interpreter then maps it to a domain result.

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

For polling APIs, successful status values usually drive the schedule, while
transport, authorization, and decoding problems stay in the effect failure
channel.

## Recommended default

Model ordinary workflow states as successful values. Use a predicate such as
`isStillRunning` for `Schedule.while`, and make that predicate return `true`
only for states that should cause another poll.

After `Effect.repeat` returns, interpret the final observed status. Treat a
permanent failed terminal status as a domain outcome at that boundary, not as a
reason to keep polling.

## Notes and caveats

`Schedule.while` sees successful status values only. A schedule-side duration
limits recurrences but does not interpret the final status or interrupt an
in-flight status check. Keep the in-progress predicate explicit; a catch-all
such as `status.state !== "succeeded"` treats permanent failures as work that
is still running.
