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

A projection reader may need two consecutive snapshots with the same version and
item count before treating the projection as settled.

That comparison should be visible in the schedule. Future readers should not have
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
reduce those observations into stability state, and continue only while that
state is not stable. `Schedule.identity<Snapshot>()` passes each successful
`Snapshot` through as the schedule output. `Schedule.reduce` keeps the previous
observation in schedule state.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

interface Snapshot {
  readonly version: string
  readonly itemCount: number
}

interface StabilityState {
  readonly previous: Snapshot | undefined
  readonly current: Snapshot | undefined
  readonly stable: boolean
}

const snapshots: ReadonlyArray<Snapshot> = [
  { version: "v1", itemCount: 8 },
  { version: "v2", itemCount: 10 },
  { version: "v2", itemCount: 10 }
]

let reads = 0

const readSnapshot: Effect.Effect<Snapshot> = Effect.gen(function*() {
  const index = yield* Effect.sync(() => {
    const current = reads
    reads += 1
    return current
  })
  const snapshot = snapshots[index] ?? snapshots[snapshots.length - 1]!

  yield* Console.log(
    `snapshot ${index + 1}: version=${snapshot.version}, items=${snapshot.itemCount}`
  )
  return snapshot
})

const sameSnapshot = (left: Snapshot, right: Snapshot) =>
  left.version === right.version && left.itemCount === right.itemCount

const initialState: StabilityState = {
  previous: undefined,
  current: undefined,
  stable: false
}

const untilStable = Schedule.identity<Snapshot>().pipe(
  Schedule.bothLeft(Schedule.spaced("100 millis")),
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

const program = readSnapshot.pipe(
  Effect.repeat(untilStable),
  Effect.flatMap((state) =>
    Console.log(
      `stable at version ${state.current?.version} with ${state.current?.itemCount} items`
    )
  )
)

Effect.runPromise(program)
```

`readSnapshot` runs once before the schedule is consulted. The first successful
snapshot cannot be stable because there is no previous snapshot to compare with.
After each later success, the schedule compares the latest snapshot with the
previous one. When `sameSnapshot` returns `true`, `Schedule.while` returns
`false`, and repetition stops.

The repeat returns the final `StabilityState`. Its `current` field is the
snapshot that matched `previous`.

## Variants

For domains that can pause and then continue changing, require a longer stable
streak instead of one unchanged comparison. Track a count in the reduced state
and stop only after the count reaches the required number of unchanged
observations.

Add a recurrence limit or elapsed budget when stabilization is not guaranteed.
If the limit stops the schedule first, inspect the final state and return a
domain-specific "not stable yet" result.

## Notes and caveats

This is an output condition, so it belongs with `Effect.repeat`, not
`Effect.retry`. Retry schedules observe failures. Repeat schedules observe
successful values.

The schedule does not delay the first observation. Delays apply only before
later recurrences.

If the value never stabilizes, an unbounded stability schedule can repeat
forever. Add a count limit, a time budget, or external cancellation unless the
surrounding workflow already provides one.
