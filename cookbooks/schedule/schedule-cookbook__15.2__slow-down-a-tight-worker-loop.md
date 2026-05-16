---
book: Effect `Schedule` Cookbook
section_number: "15.2"
section_title: "Slow down a tight worker loop"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "15. Repeat with Controlled Spacing"
status: "draft"
code_included: true
---

# 15.2 Slow down a tight worker loop

You have a worker effect that can finish very quickly when there is little or no work to
do. If that effect is repeated immediately after each success, the worker can spin in a
tight loop, consuming CPU and repeatedly checking the same empty source. This recipe
treats repetition as a policy for successful effects. The schedule decides whether
another successful iteration should run, what spacing applies, and what value the repeat
returns. Failures stay in the effect error channel, so the repeat policy stays separate
from recovery or retry behavior.

## Problem

You have a worker effect that can finish very quickly when there is little or no work to do.

If that effect is repeated immediately after each success, the worker can spin in a tight loop, consuming CPU and repeatedly checking the same empty source.

## When to use it

Use this when each successful worker iteration should be followed by a deliberate pause before the next attempt to find work.

This is a good fit for simple polling workers where "nothing available" is still a successful result. The worker checks once, completes successfully, then waits before checking again.

## When not to use it

Do not use this to recover from failures. `Effect.repeat` is success-driven; if the worker effect fails, repetition stops with that failure. Use `Effect.retry` when the next attempt should be caused by failure.

Do not use this when the worker must run on clock-aligned interval boundaries. `Schedule.spaced` waits after a successful run completes, so the total time between starts includes the work duration plus the spacing.

Do not use this section for advanced load smoothing or dependency protection policies. Here the goal is only to prevent a fast successful loop from spinning.

## Schedule shape

The central shape is `Schedule.spaced("250 millis")`.

With `Effect.repeat`, the worker runs once immediately. After a successful iteration, `Schedule.spaced("250 millis")` waits 250 milliseconds before allowing the next recurrence.

The spacing is after success, not before the first run. If the worker fails, the repeat does not ask the schedule for another recurrence; the repeated program fails immediately with the worker failure.

For a bounded worker loop, combine the spacing with `Schedule.take`:

```ts
Schedule.spaced("250 millis").pipe(Schedule.take(100))
```

This permits 100 scheduled recurrences after the initial successful run. If every iteration succeeds, the worker runs 101 times total.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const pollOnce = Console.log("polling for work")

const slowWorkerLoop = pollOnce.pipe(
  Effect.repeat(Schedule.spaced("250 millis"))
)
```

`pollOnce` runs immediately. If it succeeds, the next poll is delayed by 250 milliseconds. Every later successful poll receives the same pause before the next recurrence.

## Variants

Use a named schedule when the worker policy is shared:

```ts
import { Console, Effect, Schedule } from "effect"

const workerSpacing = Schedule.spaced("1 second").pipe(
  Schedule.take(60)
)

const worker = Console.log("checking queue").pipe(
  Effect.repeat(workerSpacing)
)
```

This keeps the worker from spinning and also gives the loop a clear recurrence limit.

Use a shorter spacing when fast pickup matters and the empty loop is still too expensive. Use a longer spacing when empty checks are cheap to defer and CPU quietness matters more than immediate pickup.

## Notes and caveats

`Schedule.spaced` is unbounded by itself. For finite examples, tests, command-line jobs, or short-lived workers, add `Schedule.take` or another stopping rule.

The pause is controlled by successful completion of the worker effect. A long-running iteration is not interrupted or shortened by the schedule.

A failure from the worker stops the repeat. The schedule does not turn failures into delayed successes.

The output of the repeated program is the schedule's final output when the schedule completes. With `Schedule.spaced`, that output is the recurrence count.
