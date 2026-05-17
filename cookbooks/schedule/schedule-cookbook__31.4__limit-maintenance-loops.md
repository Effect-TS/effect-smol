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

Maintenance loops should make cadence and stopping rules visible. Even small
cache-warming, compaction, reconciliation, or cleanup steps can waste capacity
when the loop has no clear bound.

## Problem

A worker should run opportunistic maintenance inside a bounded window. The
policy should show how long to wait between steps and what stops the loop if
there is always more work to check.

## When to use it

Use this for finite internal work: startup backlog draining, limited key
warming, shard reconciliation, old-record compaction, or temporary-resource
sweeps.

It is useful when the worker may make progress for a while but must return
capacity to the rest of the service after a count or time budget is reached.

## When not to use it

Do not use a bounded repeat as a substitute for a supervised long-running
worker. If the task must run for the process lifetime, model interruption,
supervision, and observability directly.

Do not hide domain completion in the schedule. If the maintenance step can say
"nothing left to do," use that result to stop. Use the schedule for mechanics:
spacing, recurrence count, elapsed budget, and jitter.

## Schedule shape

Start with `Schedule.spaced` for a pause after each successful step. Add
`Schedule.recurs(n)` for a maximum number of scheduled recurrences. Add
`Schedule.during(duration)` when elapsed schedule time is part of the budget.

`Schedule.both` combines independent limits: the combined schedule continues
only while both schedules continue, and it uses the longer delay.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let step = 0

const runMaintenanceStep = Effect.gen(function*() {
  step += 1
  yield* Console.log(`maintenance step ${step}`)
  return step
})

const maintenanceWindow = Schedule.spaced("20 millis").pipe(
  Schedule.both(Schedule.recurs(4)),
  Schedule.both(Schedule.during("100 millis"))
)

const program = runMaintenanceStep.pipe(
  Effect.repeat(maintenanceWindow),
  Effect.andThen(Console.log("maintenance window closed"))
)

Effect.runPromise(program)
```

The step runs once before the schedule is consulted. After that, it can recur
only while the spacing policy, count limit, and elapsed-time budget all continue.

## Variants

For a small one-shot sweep, use a count limit with a short spacing. For a
startup warmup where time matters more than count, keep `Schedule.during`
visible and choose the spacing from the dependency being warmed.

For many service instances running the same maintenance loop, add
`Schedule.jittered` after the base cadence is correct.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule. `Effect.retry` feeds
failures into a schedule. Maintenance loops usually use `repeat` because each
successful step is the signal to consider another step.

`Schedule.recurs(4)` means at most four scheduled recurrences after the original
execution, not four total executions.
