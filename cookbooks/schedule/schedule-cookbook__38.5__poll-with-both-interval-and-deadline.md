---
book: Effect `Schedule` Cookbook
section_number: "38.5"
section_title: "Poll with both interval and deadline"
part_title: "Part IX — Composition Recipes"
chapter_title: "38. Combine Attempt Limits and Delays"
status: "draft"
code_included: true
---

# 38.5 Poll with both interval and deadline

Polling usually needs two separate limits. The interval controls load on the
remote system. The deadline controls how long the caller is willing to keep
observing a non-terminal state. Model those as two schedules and combine them,
instead of hiding a sleep and a clock check inside a loop.

## Problem

You need to poll a job, export, provisioning, payment, or deployment status
endpoint every few seconds, but only until either the work reaches a terminal
state or the polling window expires.

The first status read should happen immediately. After each successful
non-terminal read, wait for the interval before checking again. If the elapsed
recurrence budget is exhausted first, return the last observed status so the
caller can decide whether to report a timeout, keep tracking in the background,
or surface the last known state.

## When to use it

Use this for job, export, provisioning, indexing, payment, or deployment status
polling where a `"running"` response is a successful observation, not an
exceptional failure.

It is also a good fit when operators need to answer both questions separately:
"How often do we call the status endpoint?" and "When do we stop waiting?"

## When not to use it

Do not use this as a retry policy for a failing status endpoint. With
`Effect.repeat`, successful status values feed the schedule; a failure from the
status read stops the repeat. Add a separate retry around the read itself if
transient transport failures should be retried.

Do not treat `Schedule.during` as a hard interruption timeout for an in-flight
request. The deadline is checked at recurrence decision points after successful
observations. Use `Effect.timeout` on the status read when each request needs
its own hard deadline.

## Schedule shape

Use `Schedule.spaced` for the gap after each successful status read, and
`Schedule.during` for the elapsed recurrence budget.

`Schedule.passthrough` makes the latest successful status the schedule output.
That lets `Schedule.while` express terminal-state detection directly against
the observed status. `Schedule.bothLeft` keeps that status as the output while
requiring both the cadence policy and the deadline policy to allow another
recurrence.

## Code

```ts
import { Console, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type JobStatus =
  | { readonly _tag: "Running"; readonly jobId: string }
  | { readonly _tag: "Completed"; readonly jobId: string; readonly resultId: string }
  | { readonly _tag: "Failed"; readonly jobId: string; readonly reason: string }

type StatusReadError = { readonly _tag: "StatusReadError" }

type PollDeadlineExceeded = {
  readonly _tag: "PollDeadlineExceeded"
  readonly lastStatus: JobStatus
}

let reads = 0

const readStatus = Effect.fnUntraced(function*(jobId: string) {
  reads += 1

  const status: JobStatus = reads < 3
    ? { _tag: "Running", jobId }
    : { _tag: "Completed", jobId, resultId: "result-1" }

  yield* Console.log(`read ${reads}: ${status._tag}`)
  return status
})

const cadence = Schedule.spaced("5 seconds").pipe(
  Schedule.setInputType<JobStatus>(),
  Schedule.passthrough
)

const deadline = Schedule.during("2 minutes").pipe(
  Schedule.setInputType<JobStatus>()
)

const pollEvery5SecondsForUpTo2Minutes = cadence.pipe(
  Schedule.while(({ output }) => output._tag === "Running"),
  Schedule.bothLeft(deadline)
)

const pollJob = Effect.fnUntraced(function*(jobId: string) {
  const status = yield* readStatus(jobId).pipe(
    Effect.repeat(pollEvery5SecondsForUpTo2Minutes)
  )

  if (status._tag === "Running") {
    return yield* Effect.fail({
      _tag: "PollDeadlineExceeded",
      lastStatus: status
    } satisfies PollDeadlineExceeded)
  }

  return status
})

const program = Effect.gen(function*() {
  const fiber = yield* pollJob("job-1").pipe(Effect.forkDetach)
  yield* TestClock.adjust("10 seconds")

  const status = yield* Fiber.join(fiber)
  yield* Console.log(`poll result: ${status._tag}`)
}).pipe(
  Effect.matchEffect({
    onFailure: (error: StatusReadError | PollDeadlineExceeded) =>
      Console.log(`poll failed with ${error._tag}`),
    onSuccess: () => Console.log("polling finished")
  }),
  Effect.provide(TestClock.layer()),
  Effect.scoped
)

Effect.runPromise(program)
```

`pollJob` performs the first read immediately. The next two reads are driven by
the five-second cadence, but `TestClock` advances those intervals instantly for
the runnable example.

The final `PollDeadlineExceeded` branch is optional but often useful. Without
it, the repeat returns the last observed `JobStatus`, which may still be
`Running` when the deadline stops the schedule.

## Variants

For a user-facing request, use a shorter deadline and return
`PollDeadlineExceeded` with the last known status so the UI can show progress
without pretending the job failed.

For a background worker, increase the spacing and keep the same terminal-state
detection. If many workers start at the same time, apply `Schedule.jittered` to
the cadence after choosing the base interval.

If each status request also needs a per-request timeout, put `Effect.timeout` on
`readStatus`. That timeout changes the behavior of an individual status read.
The schedule still controls only the recurrence interval, deadline, and
terminal-state detection.

## Notes and caveats

`Schedule.spaced("5 seconds")` waits five seconds after a successful status read
before the next recurrence. Use `Schedule.fixed` instead when you need
wall-clock-aligned polling boundaries.

`Schedule.during("2 minutes")` measures elapsed schedule time and stops the
repeat when the recurrence window is no longer open. It does not cancel a
status read already in progress.

`Schedule.bothLeft` has intersection semantics: both schedules must want to
recur. The combined delay is the maximum delay requested by the two schedules,
and the output kept by the repeat is the left schedule output, the latest
`JobStatus` in this recipe.
