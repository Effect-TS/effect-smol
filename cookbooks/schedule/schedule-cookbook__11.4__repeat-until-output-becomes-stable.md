---
book: "Effect `Schedule` Cookbook"
section_number: "11.4"
section_title: "Repeat until output becomes stable"
part_title: "Part III — Repeat Recipes"
chapter_title: "11. Repeat with Limits"
status: "draft"
code_included: true
---

# 11.4 Repeat until output becomes stable

Use this recipe when repeated successful observations should stop once a named
stability comparison says the output is unchanged.

## Problem

A read model may be stable when two consecutive reads have the same version. A
cache snapshot may be stable when its checksum stops changing. The repeat
should compare successful observations and stop when the named comparison says
the value is stable.

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

Start with a cadence, constrain it to accept the successful observation as
input, preserve that observation as output, then reduce it into comparison
state.

`Schedule.passthrough` keeps the latest successful observation as the schedule
output. `Schedule.reduce` remembers the previous observation and computes a
stability state. `Schedule.while` stops when that state is stable.

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
  { version: "v1", itemCount: 10 },
  { version: "v2", itemCount: 12 },
  { version: "v2", itemCount: 12 }
]

let index = 0

const readSnapshot = Effect.gen(function*() {
  const lastSnapshot = snapshots[snapshots.length - 1]!
  const snapshot = snapshots[index] ?? lastSnapshot
  index += 1
  yield* Console.log(
    `snapshot ${snapshot.version} with ${snapshot.itemCount} items`
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

const untilStable = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<Snapshot>(),
  Schedule.passthrough,
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

const program = Effect.gen(function*() {
  const state = yield* readSnapshot.pipe(Effect.repeat(untilStable))
  yield* Console.log(`stable version: ${state.current?.version}`)
})

Effect.runPromise(program)
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
strong enough. Carry a streak count in the reduced state and stop only after the
count reaches the required number of unchanged comparisons.

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
