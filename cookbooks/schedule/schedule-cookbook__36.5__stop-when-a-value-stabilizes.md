---
book: Effect `Schedule` Cookbook
section_number: "36.5"
section_title: "Stop when a value stabilizes"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "36. Stop on Output Conditions"
status: "draft"
code_included: true
---

# 36.5 Stop when a value stabilizes

Some workflows do not have a terminal status field. Instead, they are finished
when repeated observations stop changing. A read model may be caught up when two
consecutive reads report the same version, a cache may be warm when its checksum
stops changing, or a derived aggregate may be ready when both its revision and
item count stay the same.

This recipe uses a schedule over successful outputs. The effect performs the
observation. The schedule remembers enough previous output to decide whether the
next successful output is stable.

## Problem

You have a successful effect that returns the current state of something, and
you want to keep repeating it until the latest successful value matches the
previous successful value by a domain-specific comparison.

The comparison should be visible in the schedule. Future readers should not have
to infer "stable" from an unstructured loop, a mutable variable outside the
policy, or scattered sleep calls.

## When to use it

Use this when each successful run is an observation and completion means "the
observed value has stopped changing".

Good examples include polling a projection version, waiting for an eventually
consistent count to settle, or reading a checksum until two consecutive reads
match. In each case, define exactly what equality means for the workflow.

## When not to use it

Do not use this to retry failures. `Effect.repeat` feeds successful values into
the schedule; a failure stops the repetition with that failure unless you handle
it separately.

Do not use a single unchanged observation when the domain can pause and then
continue changing. In that case, require a longer stable streak, add a time
budget, or wait for a stronger terminal signal.

Avoid vague comparisons. For numeric values, exact equality may be too strict or
too weak. Prefer a named predicate such as "within tolerance" when that is the
real business rule.

## Schedule shape

Start with a schedule whose input and output are the successful observation,
reduce those observations into stability state, and continue only while the
state is not stable:

```ts
Schedule.identity<Snapshot>().pipe(
  Schedule.reduce(() => initialState, updateStabilityState),
  Schedule.while(({ output }) => !output.stable)
)
```

`Schedule.identity<Snapshot>()` passes each successful `Snapshot` through as the
schedule output. `Schedule.reduce` keeps the previous observation in schedule
state. `Schedule.while` stops the repeat once the reduced output says the value
has stabilized.

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

export const stableSnapshotState = readSnapshot.pipe(
  Effect.repeat(untilStable)
)
```

`readSnapshot` runs once before the schedule is consulted. The first successful
snapshot cannot be stable because there is no previous snapshot to compare with.
After each later success, the schedule compares the latest snapshot with the
previous one. When `sameSnapshot` returns `true`, `Schedule.while` returns
`false`, and repetition stops.

The repeat returns the final `StabilityState`. Its `current` field is the
snapshot that matched `previous`.

## Variants

Add spacing and a limit when the observation is remote or when stabilization is
not guaranteed:

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

const stableForThreeReads = Schedule.spaced("500 millis").pipe(
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
  Schedule.while(({ output }) => output.count < requiredUnchangedComparisons),
  Schedule.both(Schedule.recurs(20)),
  Schedule.both(Schedule.during("30 seconds"))
)

export const stableSnapshotState = readSnapshot.pipe(
  Effect.repeat(stableForThreeReads)
)
```

Here `Schedule.spaced("500 millis")` waits between successful observations.
`Schedule.passthrough` makes each successful `Snapshot` the schedule output so
`Schedule.reduce` can compare it with the previous one. The repeat stops after
three consecutive unchanged comparisons, or earlier if the count or time limit
ends the schedule.

## Notes and caveats

This is an output condition, so it belongs with `Effect.repeat`, not
`Effect.retry`. Retry schedules observe failures. Repeat schedules observe
successful values.

The schedule does not delay the first observation. Delays apply only before
later recurrences.

If the value never stabilizes, an unbounded stability schedule can repeat
forever. Add a count limit, a time budget, or external cancellation unless the
surrounding workflow already provides one.
