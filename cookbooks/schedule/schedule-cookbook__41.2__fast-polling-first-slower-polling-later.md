---
book: Effect `Schedule` Cookbook
section_number: "41.2"
section_title: "Fast polling first, slower polling later"
part_title: "Part IX — Composition Recipes"
chapter_title: "41. Build Multi-Phase Policies"
status: "draft"
code_included: true
---

# 41.2 Fast polling first, slower polling later

Some polling workflows deserve a short burst of responsiveness, then a much
calmer steady-state cadence. A newly submitted export, payment, cache refresh,
or provisioning request may complete almost immediately. If it does not, polling
every few hundred milliseconds quickly becomes wasteful.

Use `Schedule.andThen` when the phases are genuinely sequential: run the fast
polling policy until it is exhausted, then switch to the slower policy. The
resulting schedule still remains one value that can be reviewed, named, tested,
and reused.

## Problem

You need to poll quickly at first, because early completion is common and useful
to report. After that initial window, you need to keep observing the same status
endpoint at a slower cadence without scattering sleeps, counters, and phase
flags through the polling code.

The first status check should still happen immediately. The schedule should
describe only the follow-up observations: how often to poll while the workflow is
still running, when to move from the fast phase to the slow phase, and when to
stop.

## When to use it

Use this when a workflow has two natural operational phases:

- an early user-facing window where low latency matters
- a later background window where reducing load matters more

This is a good fit for jobs that often finish in the first few seconds but may
occasionally take minutes, such as exports, media processing, payment
settlement, indexing, cache warmups, and cloud provisioning.

## When not to use it

Do not use this when the remote system already provides a callback, queue
message, webhook, or subscription that can replace polling.

Do not use the fast phase as an unbounded loop. The fast phase should have a
small recurrence cap so the policy cannot keep hammering a dependency when the
workflow is slower than expected.

Do not use this schedule by itself to retry failed status reads. `Effect.repeat`
feeds successful values into the schedule. Transport failures, authorization
failures, and decoding failures remain in the effect failure channel and should
be classified separately if they need their own retry policy.

## Schedule shape

Build each phase separately, then sequence them:

```ts
const fastPhase = Schedule.spaced("250 millis").pipe(
  Schedule.take(8)
)

const slowPhase = Schedule.spaced("5 seconds").pipe(
  Schedule.both(Schedule.during("2 minutes"))
)

const pollingPolicy = Schedule.andThen(fastPhase, slowPhase).pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Running")
)
```

`Schedule.andThen(fastPhase, slowPhase)` runs the fast phase to completion
before stepping the slow phase. `Schedule.passthrough` changes the schedule
output to the latest successful status value, so the repeated effect returns the
last observation. `Schedule.while` stops as soon as a terminal status is
observed.

## Code

```ts
import { Effect, Schedule } from "effect"

type Status =
  | { readonly _tag: "Running"; readonly progress: number }
  | { readonly _tag: "Completed"; readonly resultId: string }
  | { readonly _tag: "Failed"; readonly reason: string }

type StatusReadError = {
  readonly _tag: "StatusReadError"
  readonly message: string
}

declare const readStatus: (
  jobId: string
) => Effect.Effect<Status, StatusReadError>

const fastPhase = Schedule.spaced("250 millis").pipe(
  Schedule.take(8)
)

const slowPhase = Schedule.spaced("5 seconds").pipe(
  Schedule.both(Schedule.during("2 minutes"))
)

const fastThenSlowPolling = Schedule.andThen(fastPhase, slowPhase).pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Running")
)

export const pollJob = (jobId: string) =>
  readStatus(jobId).pipe(
    Effect.repeat(fastThenSlowPolling)
  )
```

`pollJob` reads the status immediately. If that first read is already
`"Completed"` or `"Failed"`, the repeat stops without waiting. If the job is
still `"Running"`, the schedule performs a short burst of 250 millisecond
spacing, then moves to 5 second spacing for the slower phase.

The returned effect succeeds with the latest observed `Status`. That value can
be terminal, or it can still be `"Running"` if the slow phase exhausts its
2 minute budget before completion.

## Variants

Use fewer fast recurrences when the endpoint is expensive or globally rate
limited. For example, four recurrences at 500 milliseconds still gives a short
responsive window without producing as much request pressure.

Use a longer slow interval for back-office workflows where completion can be
reported later. A 30 second or 1 minute slow phase is often more appropriate for
large exports, media processing, or asynchronous reconciliation.

Add `Schedule.jittered` to the slow phase when many clients may start polling at
roughly the same time. Jitter is usually more important in the slow phase,
because that phase contains the long-lived population of pollers.

Use `Schedule.andThenResult` instead of `Schedule.andThen` when you need the
schedule output to preserve which phase produced it. For ordinary polling, the
phase is often less important than returning the latest observed status, so
`Schedule.passthrough` keeps the code simpler.

## Notes and caveats

`Schedule.andThen` is phase sequencing, not intersection. The slow phase does
not start until the fast phase completes.

`Schedule.spaced` waits after each successful status read completes. Use
`Schedule.fixed` only when the policy must target fixed wall-clock boundaries.

The elapsed budget on `slowPhase` starts when that phase starts. If the whole
polling operation needs one overall deadline, combine the sequenced cadence with
a separate outer budget.

When a schedule reads `metadata.input`, constrain the input type before
`Schedule.while`. In this recipe, `Schedule.satisfiesInputType<Status>()` makes
the successful status values visible to the predicate.
