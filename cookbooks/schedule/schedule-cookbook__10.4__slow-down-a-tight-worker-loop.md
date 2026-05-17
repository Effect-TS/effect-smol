---
book: "Effect `Schedule` Cookbook"
section_number: "10.4"
section_title: "Slow down a tight worker loop"
part_title: "Part III — Repeat Recipes"
chapter_title: "10. Periodic and Spaced Repeat"
status: "draft"
code_included: true
---

# 10.4 Slow down a tight worker loop

Use `Schedule.spaced` when a worker can complete successfully without finding
work and should not immediately check again.

## Problem

An empty queue, inbox, or table can make a worker complete almost instantly. If
that successful "nothing available" result repeats without a pause, the worker
spins and burns CPU.

## When to use it

Use this when each successful worker iteration should leave a deliberate pause
before the next check.

This fits simple polling workers where "no work available" is a successful
observation, not an error.

## When not to use it

Do not use this to recover from failures. `Effect.repeat` stops when the worker
effect fails. Use `Effect.retry` when failure should trigger the next attempt.

Do not use this when the worker must run on clock-aligned boundaries.
`Schedule.spaced` waits after a successful run completes, so start-to-start time
includes the work duration plus the spacing.

Do not treat this as a complete load-shedding policy. This recipe only prevents
a fast successful loop from spinning.

## Schedule shape

The central shape is `Schedule.spaced("250 millis")`.

With `Effect.repeat`, the worker runs once immediately. After a successful iteration, `Schedule.spaced("250 millis")` waits 250 milliseconds before allowing the next recurrence.

The spacing is after success, not before the first run. If the worker fails, the
repeat fails immediately.

For a bounded worker loop, combine the spacing with `Schedule.take`:

`Schedule.spaced("250 millis").pipe(Schedule.take(100))` permits 100 scheduled
recurrences after the initial successful run. If every iteration succeeds, the
worker runs 101 times total.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

let checks = 0

const pollOnce = Effect.gen(function*() {
  checks += 1
  yield* Console.log(`queue check ${checks}: empty`)
  return "empty" as const
})

const program = Effect.gen(function*() {
  const finalRecurrence = yield* pollOnce.pipe(
    Effect.repeat(Schedule.spaced("10 millis").pipe(Schedule.take(3)))
  )
  yield* Console.log(`worker stopped after recurrence ${finalRecurrence}`)
})

Effect.runPromise(program)
```

The worker prints four checks: one initial check and three scheduled
recurrences. In a real worker, use a production interval such as 250
milliseconds or one second instead of the short example delay.

## Variants

Use a named schedule when the worker policy is shared, for example
`const workerSpacing = Schedule.spaced("1 second").pipe(Schedule.take(60))`.
This keeps the worker from spinning and gives finite jobs a clear limit.

Use a shorter spacing when fast pickup matters and the empty loop is still too expensive. Use a longer spacing when empty checks are cheap to defer and CPU quietness matters more than immediate pickup.

## Notes and caveats

`Schedule.spaced` is unbounded by itself. For finite examples, tests, command-line jobs, or short-lived workers, add `Schedule.take` or another stopping rule.

The pause is controlled by successful completion of the worker effect. A long-running iteration is not interrupted or shortened by the schedule.

A failure from the worker stops the repeat. The schedule does not turn failures into delayed successes.

The output of the repeated program is the schedule's final output when the schedule completes. With `Schedule.spaced`, that output is the recurrence count.
