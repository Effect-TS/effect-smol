---
book: "Effect `Schedule` Cookbook"
section_number: "24.6"
section_title: "Phase-based control for long workflows"
part_title: "Part VI — Composition and Termination"
chapter_title: "24. Multi-Phase Policies"
status: "draft"
code_included: true
---

# 24.6 Phase-based control for long workflows

Long-running workflows often need more than one recurrence shape. The first few
minutes may need frequent observations because users are waiting for visible
progress. After that, the workflow may still be healthy, but checking it too
often only adds load. Much later, the policy may become a watchdog: keep enough
visibility to notice completion or failure, but do not pretend the workflow is
still latency-sensitive.

Model those phases as schedule values instead of encoding them with counters,
mutable phase flags, and scattered sleeps. Each phase can say how often it
recurs and when it is exhausted, and `Schedule.andThen` makes the handoff from
one phase to the next explicit.

## Problem

Build a single polling schedule for follow-up status reads. The first status
read should happen immediately, so the schedule should describe only later reads
and their stopping conditions:

- a responsive phase while fast completion is common
- a steady phase while the workflow is still expected to finish normally
- a watchdog phase for long tails
- an overall budget that stops the whole policy

## When to use it

Use this recipe for workflows where operational expectations change over time:
exports, imports, media processing, indexing jobs, data backfills, provisioning
requests, settlement flows, and asynchronous reconciliations.

It is especially useful when the same status endpoint serves both a user-visible
experience and a background monitoring path. The schedule keeps the early user
experience responsive without keeping the later background phase aggressive.

## When not to use it

Do not poll when the producer can reliably notify you with a webhook, queue
message, subscription, or durable completion event.

Do not use a long watchdog phase to hide a workflow that should have a real
deadline. If the business rule says the workflow must finish within 30 minutes,
make that deadline part of the workflow state or the outer effect, not just a
large polling schedule.

Do not use this schedule to retry failed status reads. `Effect.repeat` feeds
successful status values into the schedule. Transport failures, decoding
failures, and authorization failures stay in the failure channel and need their
own retry or error handling policy if they are recoverable.

## Schedule shape

Build the cadence from named phases and sequence them with `Schedule.andThen`.
The steady phase does not start until the responsive phase is exhausted, and the
watchdog phase does not start until the steady phase is exhausted. Then combine
that cadence with constraints that apply to the whole polling policy:

- `Schedule.during("2 hours")` gives the whole schedule an elapsed-time budget.
- `Schedule.both` requires both the cadence and the budget to continue.
- `Schedule.passthrough` returns the latest successful workflow status.
- `Schedule.while` stops as soon as the workflow is no longer running.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

type WorkflowStatus =
  | {
      readonly _tag: "Running"
      readonly phase: "Queued" | "Processing" | "Finalizing"
      readonly progress: number
    }
  | { readonly _tag: "Completed"; readonly artifactId: string }
  | { readonly _tag: "Failed"; readonly reason: string }

type StatusReadError = {
  readonly _tag: "StatusReadError"
  readonly message: string
}

const observations: ReadonlyArray<WorkflowStatus> = [
  { _tag: "Running", phase: "Queued", progress: 0 },
  { _tag: "Running", phase: "Processing", progress: 25 },
  { _tag: "Running", phase: "Processing", progress: 60 },
  { _tag: "Running", phase: "Finalizing", progress: 90 },
  { _tag: "Completed", artifactId: "artifact-123" }
]

let reads = 0

const readWorkflowStatus = (
  workflowId: string
): Effect.Effect<WorkflowStatus, StatusReadError> =>
  Effect.gen(function*() {
    const status = observations[Math.min(reads, observations.length - 1)]
    reads++
    yield* Console.log(`${workflowId}: observation ${reads} -> ${status._tag}`)
    return status
  })

const responsivePhase = Schedule.spaced("20 millis").pipe(
  Schedule.take(2)
)

const steadyPhase = Schedule.spaced("50 millis").pipe(
  Schedule.jittered,
  Schedule.take(2)
)

const watchdogPhase = Schedule.spaced("100 millis").pipe(
  Schedule.jittered,
  Schedule.take(2)
)

const phasedCadence = responsivePhase.pipe(
  Schedule.andThen(steadyPhase),
  Schedule.andThen(watchdogPhase)
)

const longWorkflowPolicy = phasedCadence.pipe(
  Schedule.both(Schedule.during("1 second")),
  Schedule.satisfiesInputType<WorkflowStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "Running")
)

export const pollWorkflow = (workflowId: string) =>
  readWorkflowStatus(workflowId).pipe(
    Effect.repeat(longWorkflowPolicy)
  )

const program = pollWorkflow("workflow-1").pipe(
  Effect.flatMap((status) => Console.log(`final workflow status: ${status._tag}`))
)

Effect.runPromise(program)
```

`pollWorkflow` reads once immediately. If that first read returns
`"Completed"` or `"Failed"`, the repeat stops without waiting. If the workflow
is still `"Running"`, the schedule starts with responsive spacing, moves to a
steady cadence, then moves to watchdog checks.

The effect succeeds with the latest observed `WorkflowStatus`. That may be a
terminal status, or it may still be `"Running"` if the phase limits or the
overall budget are exhausted before the workflow reaches a terminal state.

## Variants

For a user-facing request, shorten the overall budget and the watchdog phase.
The user experience should usually return a clear "still running" response
rather than hold a request open for the full operational tail.

For a back-office worker, lengthen the steady and watchdog phases but keep the
phase limits explicit. Long-running does not have to mean unbounded.

For fleet-wide polling, keep jitter on the longer phases. The responsive phase
is short-lived, but the steady and watchdog phases contain the larger population
of long-lived pollers, so they are where synchronized checks create the most
load.

For phase-specific telemetry, use `Schedule.andThenResult` instead of
`Schedule.andThen` on the boundary you need to observe. The result identifies
which side of the phase boundary produced the schedule output, which is useful
when metrics need separate labels for responsive, steady, and watchdog
behavior.

## Notes and caveats

`Schedule.take(n)` limits the recurrences in that phase. It does not count the
initial status read before `Effect.repeat` starts using the schedule.

`Schedule.during` measures elapsed time for the schedule it is combined with.
When it is added outside the phased cadence with `Schedule.both`, it acts as an
overall budget rather than a per-phase budget.

`Schedule.spaced` waits after each status read completes. If the status read
itself can hang, put a timeout on `readWorkflowStatus`; the schedule controls
the delay between reads, not the duration of an individual read.

Keep the terminal-state predicate near the schedule. The phase limits answer
"how long and how often should we observe?" The `Schedule.while` predicate
answers "is another observation still useful?"
