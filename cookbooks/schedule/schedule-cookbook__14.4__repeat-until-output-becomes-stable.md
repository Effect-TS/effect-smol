---
book: Effect `Schedule` Cookbook
section_number: "14.4"
section_title: "Repeat until output becomes stable"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "14. Repeat with Limits"
status: "draft"
code_included: true
---

# 14.4 Repeat until output becomes stable

Use this recipe when repeated successful observations should stop once a named
stability comparison says the output is unchanged.

## Problem

For example, a read model may be considered stable when two consecutive reads
have the same version, a cache snapshot may be stable when its checksum stops
changing, or an aggregate may be stable when both its revision and item count
match the previous observation.

The schedule should carry enough state to compare the latest successful output
with the previous one and stop when the comparison reports stability.

## When to use it

Use this when success means "I observed the current state", not necessarily
"the workflow is finished".

The schedule should carry enough state to compare the latest successful output
with the previous successful output. The stability predicate should be explicit:
same version, same checksum, same count, or another domain comparison that
means "unchanged" for this workflow.

## When not to use it

Do not use this to retry failures. `Effect.repeat` repeats after successful
results; if the effect fails, repetition stops with that failure.

Do not use this when one unchanged observation is too weak a signal. Some
systems can return the same value briefly and then change again. In that case,
require a stable streak or combine the stability check with a delay and a count
cap.

Do not hide an expensive or fuzzy comparison inside the schedule without naming
the criterion. Readers should be able to tell exactly what "stable" means.

## Schedule shape

Start from a schedule whose input and output are the successful observation,
reduce that observation into comparison state, and continue while the state is
not stable:

```ts
Schedule.identity<Snapshot>().pipe(
  Schedule.reduce(() => initialState, updateStabilityState),
  Schedule.while(({ output }) => !output.stable)
)
```

`Schedule.identity<Snapshot>()` makes each successful `Snapshot` the schedule
output. `Schedule.reduce` remembers the previous successful observation and
computes whether the latest observation is stable. `Schedule.while` stops the
repeat as soon as the reduced state says the output has become stable.

## Code

```ts
import { Effect, Schedule } from "effect"

interface Snapshot {
  readonly version: string
  readonly itemCount: number
}

interface StabilityState {
  readonly previous: Snapshot | undefined
  readonly current: Snapshot | undefined
  readonly stable: boolean
}

declare const readSnapshot: Effect.Effect<Snapshot>

const sameSnapshot = (left: Snapshot, right: Snapshot) =>
  left.version === right.version && left.itemCount === right.itemCount

const initialState: StabilityState = {
  previous: undefined,
  current: undefined,
  stable: false
}

const untilStable = Schedule.identity<Snapshot>().pipe(
  Schedule.reduce(
    () => initialState,
    (state, current): StabilityState => ({
      previous: state.current,
      current,
      stable: state.current !== undefined && sameSnapshot(state.current, current)
    })
  ),
  Schedule.while(({ output }) => !output.stable)
)

const stableSnapshotState = readSnapshot.pipe(
  Effect.repeat(untilStable)
)
```

`readSnapshot` runs once before the schedule is consulted. The first successful
snapshot cannot be stable because there is no previous successful snapshot to
compare with. After each later success, the schedule compares the latest
snapshot with the previous one. When `sameSnapshot` returns `true`, the
`Schedule.while` predicate returns `false`, and the repeat stops.

The returned value is the final `StabilityState`. Its `current` field is the
snapshot that matched `previous`.

## Variants

Require several consecutive stable observations when a single match is not
strong enough:

```ts
import { Effect, Schedule } from "effect"

interface Snapshot {
  readonly checksum: string
}

interface StableStreak {
  readonly previous: Snapshot | undefined
  readonly current: Snapshot | undefined
  readonly count: number
}

declare const readSnapshot: Effect.Effect<Snapshot>

const requiredUnchangedComparisons = 3

const untilStableForThreeComparisons = Schedule.spaced("500 millis").pipe(
  Schedule.satisfiesInputType<Snapshot>(),
  Schedule.passthrough,
  Schedule.reduce(
    (): StableStreak => ({ previous: undefined, current: undefined, count: 0 }),
    (state, current): StableStreak => {
      const unchanged = state.current !== undefined &&
        state.current.checksum === current.checksum

      return {
        previous: state.current,
        current,
        count: unchanged ? state.count + 1 : 0
      }
    }
  ),
  Schedule.while(({ output }) => output.count < requiredUnchangedComparisons)
)

const stableSnapshotState = readSnapshot.pipe(
  Effect.repeat(untilStableForThreeComparisons)
)
```

This variant waits between successful observations and stops only after three
consecutive unchanged comparisons. `Schedule.satisfiesInputType<Snapshot>()`
sets the input type before `Schedule.passthrough` turns each successful
`Snapshot` into the schedule output.

## Notes and caveats

The stability predicate sees only successful outputs. Failures do not become
schedule inputs for `Effect.repeat`.

Decide whether stability means "same as the immediately previous output" or
"within a tolerance". For numeric observations, exact equality is often the
wrong criterion; prefer an explicit tolerance such as an absolute delta.

The first run is not delayed by the schedule. Delays apply only before later
recurrences.

A stability schedule can run forever if the output never becomes stable. Add a
count limit, time budget, or external interruption when the surrounding workflow
does not already provide one.
