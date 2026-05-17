---
book: "Effect `Schedule` Cookbook"
section_number: "24.5"
section_title: "Fast polling first, slower polling later"
part_title: "Part VI — Composition and Termination"
chapter_title: "24. Multi-Phase Policies"
status: "draft"
code_included: true
---

# 24.5 Fast polling first, slower polling later

Some polling workflows need a brief responsive phase, then a calmer cadence. A
newly submitted export, payment, cache refresh, or provisioning request may
complete almost immediately. If it does not, polling every few hundred
milliseconds quickly becomes wasteful.

Use `Schedule.andThen` to run the fast polling phase to completion, then switch
to the slower phase.

## Problem

Model a status loop without scattering sleeps, counters, or phase flags through
the polling code. The first status read should happen immediately; the schedule
describes only follow-up reads and stop conditions.

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

Do not make the fast phase unbounded. Give it a small recurrence cap so a slow
workflow does not keep hammering the status endpoint.

Do not use this schedule by itself to retry failed status reads. `Effect.repeat`
feeds successful values into the schedule. Transport failures, authorization
failures, and decoding failures remain in the effect failure channel and should
be classified separately if they need their own retry policy.

## Schedule shape

Build each phase separately, then sequence them. `Schedule.passthrough` changes
the schedule output to the latest successful status value, so `Effect.repeat`
returns the last observation. `Schedule.while` stops as soon as a terminal
status is observed.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type Status =
  | { readonly _tag: "Running"; readonly progress: number }
  | { readonly _tag: "Completed"; readonly resultId: string }
  | { readonly _tag: "Failed"; readonly reason: string }

type StatusReadError = {
  readonly _tag: "StatusReadError"
  readonly message: string
}

const observations: ReadonlyArray<Status> = [
  { _tag: "Running", progress: 10 },
  { _tag: "Running", progress: 35 },
  { _tag: "Running", progress: 70 },
  { _tag: "Completed", resultId: "export-123" }
]

let reads = 0

const readStatus = (jobId: string): Effect.Effect<Status, StatusReadError> =>
  Effect.gen(function*() {
    const status = observations[Math.min(reads, observations.length - 1)]
    reads++
    yield* Console.log(`${jobId}: read ${reads} -> ${status._tag}`)
    return status
  })

const fastPhase = Schedule.spaced("20 millis").pipe(
  Schedule.take(3)
)

const slowPhase = Schedule.spaced("60 millis").pipe(
  Schedule.both(Schedule.during("500 millis"))
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

const program = pollJob("job-1").pipe(
  Effect.flatMap((status) => Console.log(`final status: ${status._tag}`))
)

Effect.runPromise(program)
```

`pollJob` reads the status immediately. If that first read is already
`"Completed"` or `"Failed"`, the repeat stops without waiting. If the job is
still `"Running"`, the schedule performs a short burst of fast spacing, then
moves to slower spacing.

The returned effect succeeds with the latest observed `Status`. That value can
be terminal, or it can still be `"Running"` if the slow phase exhausts its
budget before completion.

## Variants

Use fewer fast recurrences when the endpoint is expensive or globally rate
limited. For example, four recurrences at 500 milliseconds still gives a short
responsive window without producing as much request pressure.

Use a longer slow interval for back-office workflows where completion can be
reported later. A 30 second or 1 minute slow phase is often more appropriate for
large exports, media processing, or asynchronous reconciliation.

Add `Schedule.jittered` to the slow phase when many clients may start polling at
roughly the same time. Jitter is usually more important in the slow phase
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
