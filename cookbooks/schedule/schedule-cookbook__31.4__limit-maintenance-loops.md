---
book: Effect `Schedule` Cookbook
section_number: "31.4"
section_title: "Limit maintenance loops"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "31. Throttle Internal Work"
status: "draft"
code_included: true
---

# 31.4 Limit maintenance loops

Recurring maintenance work should make both cadence and stop conditions
explicit. A small cache-warming, compaction, reconciliation, or cleanup step can
still consume capacity long after useful work is gone if the loop is unbounded.

## Problem

You need a maintenance loop that runs opportunistically inside a bounded
window. The first run of `Effect.repeat` should happen normally, and the
schedule should then decide whether to run again, how long to wait, and when
the loop has spent enough work or time.

The policy should answer two operational questions without reading the loop
body:

- how much time to leave between maintenance steps
- what stops the loop if there is always more work to check

## When to use it

Use this recipe for internal recurring work that is useful only inside a bounded
window: draining a backlog during startup, warming a limited set of keys,
reconciling a shard, compacting old records, or sweeping temporary resources.

It is especially useful when a worker is allowed to make progress opportunistically
but must hand capacity back to the rest of the service after a count or time
budget is reached.

## When not to use it

Do not use a bounded maintenance loop as a substitute for proper ownership of
long-running background work. If the task must run for the lifetime of the
process, model that directly and add interruption, supervision, and
observability around the worker.

Also avoid hiding domain completion inside the schedule. If the maintenance step
can report "nothing left to do", use that result to stop the workflow. Use the
schedule for recurrence mechanics: spacing, count limits, elapsed budgets, and
fleet-wide load smoothing.

## Schedule shape

Start with the cadence. `Schedule.spaced("30 seconds")` waits after each
successful step before the next one. Use `Schedule.fixed` instead when the work
must align to a wall-clock cadence; if a fixed interval is missed because the
work took too long, the next run happens immediately and missed runs do not pile
up.

Then add limits:

- `Schedule.recurs(n)` allows at most `n` scheduled recurrences after the
  original run.
- `Schedule.take(n)` limits how many outputs are taken from another schedule.
- `Schedule.during(duration)` keeps recurring only while the schedule elapsed
  time is within the duration.

Combine independent limits with `Schedule.both`. The combined schedule continues
only while both schedules continue, and it uses the larger delay. That makes a
count-and-time budget read as "run again every interval until either limit is
exhausted."

## Code

```ts
import { Effect, Schedule } from "effect"

type MaintenanceError = { readonly _tag: "MaintenanceError" }

declare const runMaintenanceStep: Effect.Effect<void, MaintenanceError>

const maintenanceWindow = Schedule.spaced("30 seconds").pipe(
  Schedule.both(Schedule.recurs(20)),
  Schedule.both(Schedule.during("15 minutes"))
)

export const program = Effect.repeat(runMaintenanceStep, maintenanceWindow)
```

The maintenance step runs once before the schedule is consulted. After a
successful step, the schedule waits 30 seconds before the next step. The loop can
then recur at most 20 times, and it also stops once the schedule has been active
for more than 15 minutes. Whichever limit is reached first ends the repeated
work.

## Variants

For a small one-shot cleanup, use only a count limit:

```ts
const shortSweep = Schedule.spaced("5 seconds").pipe(
  Schedule.recurs(3)
)
```

For a maintenance window where elapsed time matters more than count, keep the
time budget visible:

```ts
const startupWarmup = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("1 minute"))
)
```

For many service instances running the same maintenance policy, add jitter after
the base cadence is correct so instances do not all wake up together.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule. `Effect.retry` feeds
failures into the schedule. Maintenance loops usually use `Effect.repeat`
because each successful step is the signal to schedule the next one.

The count is a recurrence limit, not the number of total executions. With
`Effect.repeat(effect, Schedule.recurs(20))`, the original execution can be
followed by at most 20 scheduled recurrences.
