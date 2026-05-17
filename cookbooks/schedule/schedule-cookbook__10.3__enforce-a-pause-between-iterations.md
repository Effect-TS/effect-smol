---
book: "Effect `Schedule` Cookbook"
section_number: "10.3"
section_title: "Enforce a pause between iterations"
part_title: "Part III — Repeat Recipes"
chapter_title: "10. Periodic and Spaced Repeat"
status: "draft"
code_included: true
---

# 10.3 Enforce a pause between iterations

Use `Schedule.spaced` when each successful repeat should wait before the next
iteration starts.

## Problem

After a refresh, heartbeat, or lightweight poll succeeds, an immediate recurrence
can be too aggressive. The loop should run again only after a known pause.

## When to use it

Use this when the gap after completed work matters more than wall-clock
alignment.

`Schedule.spaced(duration)` runs the effect once immediately, then waits for the
duration after each successful run before allowing another recurrence.

## When not to use it

Do not use this to retry failures. `Effect.repeat` is success-driven; a failure
from the effect stops the repeat. Use `Effect.retry` for failure-driven attempts.

Do not use this for fixed-rate cadence such as "run on each one-second
boundary." Use `Schedule.fixed(duration)` for interval alignment.

Do not use this when the first run itself must be delayed. The schedule controls
only recurrences after the first evaluation.

## Schedule shape

The central shape is `Schedule.spaced("2 seconds")`: each scheduled recurrence
is separated from the previous successful run by a two-second pause.

This is different from `Schedule.fixed("2 seconds")`. `fixed` schedules recurrences against interval boundaries. If the effect takes longer than the interval, the next recurrence may happen immediately so the schedule can continue from the current time. `spaced` still waits the requested duration after the run completes.

When the repeat should stop after a known number of scheduled recurrences, add `Schedule.take`, as in `Schedule.spaced("2 seconds").pipe(Schedule.take(3))`. This allows three scheduled recurrences after the original successful run. If all runs succeed, the effect runs four times total.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let run = 0

const refresh = Effect.gen(function*() {
  run += 1
  yield* Console.log(`refresh ${run}`)
  return run
})

const program = Effect.gen(function*() {
  const finalRecurrence = yield* refresh.pipe(
    Effect.repeat(Schedule.spaced("10 millis").pipe(Schedule.take(2)))
  )
  yield* Console.log(`repeat returned schedule output ${finalRecurrence}`)
})

Effect.runPromise(program)
```

This prints three refreshes: the initial run plus two scheduled recurrences. The
short delay keeps the example quick while still showing that the schedule waits
between successful runs.

## Variants

Name the schedule when the same spacing policy is shared across a workflow, for
example `const everyTwoSeconds = Schedule.spaced("2 seconds").pipe(Schedule.take(5))`.

Use `Schedule.spaced(duration)` for "wait after completed work." Use
`Schedule.fixed(duration)` for "target this periodic interval."

## Notes and caveats

The pause is not added before the first run. The schedule controls only recurrences after the first successful evaluation.

The pause happens only after success. A failure from the repeated effect stops the repeat and returns the failure.

`Schedule.spaced` is unbounded by itself. Combine it with `Schedule.take`, another stopping rule, or an enclosing lifetime when the workflow must end.

The repeated program succeeds with the schedule's final output when the schedule completes. With `Schedule.spaced`, that output is the recurrence count.
