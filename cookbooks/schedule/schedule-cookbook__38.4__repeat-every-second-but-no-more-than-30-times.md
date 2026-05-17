---
book: Effect `Schedule` Cookbook
section_number: "38.4"
section_title: "Repeat every second, but no more than 30 times"
part_title: "Part IX — Composition Recipes"
chapter_title: "38. Combine Attempt Limits and Delays"
status: "draft"
code_included: true
---

# 38.4 Repeat every second, but no more than 30 times

You have an effect that should run once, then repeat after successful runs with
a one-second pause, but only for a bounded number of scheduled recurrences.

## Problem

You need repeat behavior for a short background loop, bounded status refresh,
or maintenance task that is easy to read from the policy itself:

- the first run happens immediately
- each successful recurrence waits one second after the previous run completes
- the schedule permits no more than 30 scheduled recurrences

The count belongs in the schedule rather than in a mutable loop counter next to
the effect.

## When to use it

Use this when the effect reports progress through successful values and you want
to repeat that effect a limited number of times.

Good examples include bounded polling, short-lived heartbeat-style loops,
refreshing local state during startup, and maintenance work where each run
should finish before the next one is scheduled.

## When not to use it

Do not use this to retry failures. `Effect.repeat` repeats after success. If the
effect fails, the repeat stops with that failure. Use `Effect.retry` when the
schedule should be driven by failures instead.

Do not use `Schedule.spaced("1 second")` when you need a strict wall-clock tick.
`spaced` waits after the previous run completes. If the run takes 200
milliseconds, the next run starts roughly 1.2 seconds after the previous start.

Do not use this as a hard timeout for one long-running execution. The schedule is
consulted between runs; it does not interrupt a run that is already in flight.

## Schedule shape

Start with `Schedule.spaced("1 second")`, then cap the number of schedule
outputs with `Schedule.take(30)`.

With `Effect.repeat`, the effect itself runs once before the schedule makes a
decision. `Schedule.take(30)` therefore means "allow up to 30 recurrences after
the initial successful run." The effect can run up to 31 times total.

If the requirement is "no more than 30 executions total, including the first
one", use `Schedule.take(29)` instead.

## Code

```ts
import { Console, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

let runs = 0

const refreshStatus = Effect.gen(function*() {
  runs += 1
  yield* Console.log(`refresh ${runs}`)
  return runs
})

const repeatEverySecondAtMost30Times = Schedule.spaced("1 second").pipe(
  Schedule.take(30)
)

const program = Effect.gen(function*() {
  const fiber = yield* refreshStatus.pipe(
    Effect.repeat(repeatEverySecondAtMost30Times),
    Effect.forkDetach
  )

  yield* TestClock.adjust("30 seconds")

  const lastScheduleOutput = yield* Fiber.join(fiber)
  yield* Console.log(
    `completed after ${runs} executions; last schedule output ${lastScheduleOutput}`
  )
}).pipe(
  Effect.provide(TestClock.layer()),
  Effect.scoped
)

Effect.runPromise(program)
```

The example uses `TestClock` so the one-second schedule remains exact while the
snippet terminates immediately. `refreshStatus` runs once immediately, then up
to 30 more times after one-second schedule intervals.

## Variants

Use `Schedule.recurs(30)` when you want to express the count limit as a separate
schedule and combine it with the cadence.

Both schedules must continue for the combined schedule to continue. The spaced
schedule contributes the one-second delay, and `Schedule.recurs(30)` contributes
the recurrence limit.

Prefer `Schedule.take(30)` when the count limit is simply trimming the spaced
schedule. Prefer `Schedule.recurs(30)` when you want the count limit to remain a
named component, especially in a larger composed policy.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule. Failed effects do not
become schedule inputs; they stop the repeat.

The schedule controls recurrences, not the original execution. For
`Schedule.take(30)` and `Schedule.recurs(30)`, read the number as "up to 30
repeats after the first successful run."

`Schedule.spaced("1 second")` spaces runs from completion to next start. Use
`Schedule.fixed("1 second")` only when the policy should try to stay on a fixed
one-second cadence.
