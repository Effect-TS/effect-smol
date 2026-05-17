---
book: "Effect `Schedule` Cookbook"
section_number: "15.4"
section_title: "Polling strategy for long-running back-office jobs"
part_title: "Part IV — Polling Recipes"
chapter_title: "15. Adaptive and Fleet-Safe Polling"
status: "draft"
code_included: true
---

# 15.4 Polling strategy for long-running back-office jobs

Use this recipe for back-office jobs that need periodic operator visibility but
are not latency-critical. The schedule gives a few early observations, then
settles into a low-pressure background cadence.

## Problem

Polling too frequently creates steady pressure on the job store, status API, and
worker database. The polling policy should provide enough early signal to catch
fast failures or obvious progress, then settle into a low-pressure cadence until
the job reaches a terminal state.

## When to use it

Use this when job completion is useful to observe but not latency critical.

This is a good fit for scheduled or queue-driven operational work where the
poller feeds logs, metrics, dashboards, follow-up tasks, or notifications rather
than a user actively watching a page.

Use it when status checks are cheap enough to run periodically, but expensive
enough that thousands of jobs polling every few seconds would be noticeable.

## When not to use it

Do not use this for interactive workflows where the caller expects immediate
feedback after clicking a button. Those flows usually need a shorter, bounded
early window before moving to background handling.

Do not use this as a retry policy for a failing status endpoint. With
`Effect.repeat`, failed effects stop the repeat. The schedule sees successful
job status values, not transport or decoding failures.

Do not leave this as an unbounded poller if the surrounding process has no
lifetime, cancellation, or operational owner.

## Schedule shape

Start with a modest operational cadence, then switch to a slower background
cadence with `Schedule.andThen`. Preserve the latest `JobStatus` with
`Schedule.passthrough`, and continue only while the job is still running.

## Code

```ts
import { Clock, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type JobStatus =
  | { readonly state: "running"; readonly processed: number; readonly total: number }
  | { readonly state: "completed"; readonly completedAt: string }
  | { readonly state: "failed"; readonly reason: string }

const backOfficeJobPolling = Schedule.spaced("30 seconds").pipe(
  Schedule.take(3),
  Schedule.andThen(Schedule.spaced("5 minutes")),
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running")
)

const script: ReadonlyArray<JobStatus> = [
  { state: "running", processed: 10, total: 100 },
  { state: "running", processed: 20, total: 100 },
  { state: "running", processed: 30, total: 100 },
  { state: "running", processed: 40, total: 100 },
  { state: "running", processed: 80, total: 100 },
  { state: "completed", completedAt: "2026-05-17T12:00:00Z" }
]

let checks = 0

const readJobStatus = Effect.gen(function*() {
  const now = yield* Clock.currentTimeMillis
  const status = script[Math.min(checks, script.length - 1)]!
  checks += 1
  console.log(`t+${now}ms check ${checks}: ${status.state}`)
  return status
})

const program = Effect.gen(function*() {
  const fiber = yield* readJobStatus.pipe(
    Effect.repeat(backOfficeJobPolling),
    Effect.forkDetach
  )

  yield* TestClock.adjust("15 minutes")

  const finalStatus = yield* Fiber.join(fiber)
  console.log("final:", finalStatus)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

The example uses three early recurrences to keep the output short. In a real
back-office poller, increase that first-phase count if operators need more early
progress samples.

## Variants

Use a one-minute initial phase when early progress is not operationally useful.
For overnight reconciliation or batch import work, `Schedule.spaced("1 minute")`
followed by `Schedule.spaced("10 minutes")` may be enough.

Use a shorter steady interval when the poller triggers the next automated step,
such as publishing a completion notification or enqueueing a dependent job.

Add jitter when many jobs are created at the same scheduled boundary. A slower
cadence reduces pressure, but identical intervals can still synchronize a large
fleet of pollers.

Add an external timeout, cancellation signal, or owner process lifetime when the
job may remain `"running"` indefinitely because of lost workers or corrupted
state.

## Notes and caveats

`Effect.repeat` runs the status check once before the schedule controls any
recurrence. The first observation is immediate.

`Schedule.take(3)` limits the first phase to three recurrences after the initial
status check. It is not three total status checks.

`Schedule.spaced` waits after each successful status check completes. That is
usually what you want for back-office polling because status checks may have
variable latency.

`Schedule.while` reads successful `JobStatus` values only. Keep status endpoint
failures in the effect error channel and handle retries separately if the
endpoint itself is unreliable.
