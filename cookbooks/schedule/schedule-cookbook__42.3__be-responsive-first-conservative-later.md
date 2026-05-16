---
book: Effect `Schedule` Cookbook
section_number: "42.3"
section_title: "“Be responsive first, conservative later”"
part_title: "Part IX — Composition Recipes"
chapter_title: "42. Express Operational Intent Through Composition"
status: "draft"
code_included: true
---

# 42.3 “Be responsive first, conservative later”

Some failures are worth a fast second look, but not an indefinitely fast one. A cache refresh, leader-election read, or request to a nearby dependency might clear on the next attempt. If it does not, the policy should slow down before it starts adding pressure to the same system it is waiting on.

Encode that intent as phases: a responsive phase first, then a conservative phase. The schedule value tells the reader exactly when the workflow switches from "try again soon" to "back off and give the dependency room."

## Problem

You need retries that are quick enough for short-lived glitches but restrained enough for longer outages. A single exponential schedule can express growing delay, but it does not name the operational transition. A phase-based schedule makes the transition explicit and keeps the two policies independently tunable.

## When to use it

Use this when the first few failures are likely to be local, brief, or caused by startup ordering, but continued failure should be treated as pressure on a shared dependency. It is a good fit for retries around idempotent reads, connection establishment, cache warming, discovery calls, and background reconciliation loops.

## When not to use it

Do not use this to blur permanent failures into retryable failures. Validation errors, authorization failures, malformed requests, and unsafe non-idempotent writes should be classified before the schedule is applied. Also avoid this shape when the caller needs a strict latency budget; in that case, compose the retry schedule with a time limit or move the work out of the request path.

## Schedule shape

Build two named schedules and sequence them with `Schedule.andThen`.

- The first phase is short and responsive. It uses a small exponential delay and a low `Schedule.take` count.
- The second phase is conservative. It starts at a larger delay and is also bounded.

`Schedule.andThen(first, second)` runs the first schedule to completion, then continues with the second schedule. The first execution of the effect is not part of the schedule; the schedule controls the follow-up attempts after each failure.

## Code

```ts
import { Effect, Schedule } from "effect"

type TransientError = { readonly _tag: "TransientError" }

declare const refreshRemoteSnapshot: Effect.Effect<string, TransientError>

const responsivePhase = Schedule.exponential("50 millis").pipe(
  Schedule.take(3)
)

const conservativePhase = Schedule.exponential("1 second").pipe(
  Schedule.take(4)
)

const responsiveThenConservative = Schedule.andThen(
  responsivePhase,
  conservativePhase
)

export const program = Effect.retry(
  refreshRemoteSnapshot,
  responsiveThenConservative
)
```

## Variants

- For user-facing requests, keep both phases small or add an outer timeout around the whole operation so the caller gets a predictable answer.
- For background workers, make the conservative phase longer and add logging or metrics with `Schedule.tapInput` or `Schedule.tapOutput`.
- For fleet-wide retries, add jitter after the base cadence is correct so many instances do not retry at the same boundaries.
- If operators need to distinguish the phase in telemetry, use `Schedule.andThenResult` instead of `Schedule.andThen`; its output records whether the current recurrence came from the first or second phase.

## Notes and caveats

With `Effect.retry`, failures are fed into the schedule. That matters if you observe inputs with `Schedule.tapInput` or stop based on the error value with `Schedule.while`. Keep error classification close to the effect being retried, then let the schedule describe only recurrence mechanics: responsive phase, conservative phase, and final stop condition.
