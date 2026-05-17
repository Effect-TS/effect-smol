---
book: "Effect `Schedule` Cookbook"
section_number: "25.3"
section_title: "“Be responsive first, conservative later”"
part_title: "Part VI — Composition and Termination"
chapter_title: "25. Express Operational Intent"
status: "draft"
code_included: true
---

# 25.3 “Be responsive first, conservative later”

Some failures are worth a fast second look, but not an indefinitely fast one. A
cache refresh, leader-election read, or request to a nearby dependency might
clear on the next attempt. If it does not, the policy should slow down before it
adds pressure to the same system it is waiting on.

Encode that intent as phases: a responsive phase first, then a conservative
phase. The schedule value tells the reader when the workflow switches from "try
again soon" to "back off and give the dependency room."

## Problem

A single exponential schedule can express growing delay, but it does not name
the operational transition. Put that transition in the schedule value so the
responsive and conservative phases can be tuned independently.

## When to use it

Use this when the first few failures are likely to be local, brief, or caused by
startup ordering, but continued failure should be treated as pressure on a
shared dependency. It is a good fit for retries around idempotent reads,
connection establishment, cache warming, discovery calls, and background
reconciliation loops.

## When not to use it

Do not use this to blur permanent failures into retryable failures. Validation
errors, authorization failures, malformed requests, and unsafe non-idempotent
writes should be classified before the schedule is applied.

Avoid this shape when the caller needs a strict latency budget. In that case,
compose the retry schedule with a time limit or move the work out of the request
path.

## Schedule shape

Build two named schedules and sequence them with `Schedule.andThen`.

- The first phase is short and responsive. It uses a small exponential delay and
  a low `Schedule.take` count.
- The second phase is conservative. It starts at a larger delay and is also
  bounded.

`Schedule.andThen(first, second)` runs the first schedule to completion, then
continues with the second schedule. The first execution of the effect is not
part of the schedule; the schedule controls the follow-up attempts after each
failure.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type TransientError = { readonly _tag: "TransientError" }

let attempts = 0

const refreshRemoteSnapshot = Effect.gen(function*() {
  attempts++
  yield* Console.log(`refresh attempt ${attempts}`)

  if (attempts < 5) {
    return yield* Effect.fail({
      _tag: "TransientError"
    } satisfies TransientError)
  }

  return "snapshot refreshed"
})

const responsivePhase = Schedule.exponential("15 millis").pipe(
  Schedule.take(3)
)

const conservativePhase = Schedule.exponential("80 millis").pipe(
  Schedule.take(4)
)

const responsiveThenConservative = Schedule.andThen(
  responsivePhase,
  conservativePhase
)

const program = refreshRemoteSnapshot.pipe(
  Effect.retry(responsiveThenConservative),
  Effect.flatMap((value) => Console.log(value))
)

Effect.runPromise(program)
```

The first few retry decisions come from the responsive phase. If the operation
keeps failing, the conservative phase takes over with larger delays and its own
limit.

## Variants

For user-facing requests, keep both phases small or add an outer timeout around
the whole operation so the caller gets a predictable answer.

For background workers, make the conservative phase longer and add logging or
metrics with `Schedule.tapInput` or `Schedule.tapOutput`.

For fleet-wide retries, add jitter after the base cadence is correct so many
instances do not retry at the same boundaries.

If operators need to distinguish the phase in telemetry, use
`Schedule.andThenResult` instead of `Schedule.andThen`; its output records
whether the current recurrence came from the first or second phase.

## Notes and caveats

With `Effect.retry`, failures are fed into the schedule. That matters if you
observe inputs with `Schedule.tapInput` or stop based on the error value with
`Schedule.while`. Keep error classification close to the effect being retried,
then let the schedule describe only recurrence mechanics: responsive phase,
conservative phase, and final stop condition.
