---
book: "Effect `Schedule` Cookbook"
section_number: "11.2"
section_title: "Repeat only within a time budget"
part_title: "Part III — Repeat Recipes"
chapter_title: "11. Repeat with Limits"
status: "draft"
code_included: true
---

# 11.2 Repeat only within a time budget

Use this when successful recurrences should stay open only for an elapsed time
budget.

## Problem

A worker needs to poll during a warm-up window, refresh a cache briefly after a
trigger, or sample an operation for at most a few seconds.

The effect should run immediately, then allow later successful recurrences only
while the elapsed budget remains open.

## When to use it

Use this when the limit is naturally expressed as elapsed schedule time:
"repeat for up to 10 seconds" or "keep checking during this 1 minute window."

This is a good fit when each successful run may allow another recurrence, but
the loop must not remain open forever.

## When not to use it

Do not use this to retry failures. `Effect.repeat` repeats after success; if
the effect fails, repetition stops with that failure.

Do not use a schedule budget as a hard timeout for an in-flight run. The
schedule is consulted between successful runs; it does not interrupt the
currently running effect.

Do not use this when the limit is purely a count. Use `Schedule.recurs(n)` for
that, or combine count and time when both constraints matter.

## Schedule shape

Combine a cadence with `Schedule.during(duration)`:

`Schedule.spaced("1 second").pipe(Schedule.both(Schedule.during("10 seconds")))`

`Schedule.spaced` chooses the delay between successful recurrences.
`Schedule.during` tracks elapsed schedule time. `Schedule.both` requires both
schedules to continue, so the repeat stops when the budget is exhausted.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let polls = 0

const pollOnce = Effect.gen(function*() {
  polls += 1
  yield* Console.log(`poll ${polls}`)
})

const repeatWithinBudget = Schedule.spaced("20 millis").pipe(
  Schedule.both(Schedule.during("75 millis"))
)

const program = Effect.gen(function*() {
  yield* pollOnce.pipe(Effect.repeat(repeatWithinBudget))

  yield* Console.log(`total polls: ${polls}`)
})

Effect.runPromise(program)
```

The example uses millisecond durations so it terminates quickly. The same shape
works with larger production budgets.

## Variants

Add a count cap when the repeat should stop at whichever limit is reached first:

Use the same cadence and budget, then add
`Schedule.both(Schedule.recurs(20))`.

If each individual run also needs a hard duration limit, apply
`Effect.timeout` to the repeated effect itself. The schedule budget still limits
only the recurrence window after successful runs.

## Notes and caveats

The first run is not delayed. `Effect.repeat` evaluates the effect once, then
uses the schedule for later successful recurrences.

`Schedule.during(duration)` is a stopping condition, not a cadence. Combine it
with `Schedule.spaced`, `Schedule.fixed`, or another delay-producing schedule.

The elapsed budget is checked between successful runs. It is not a substitute
for `Effect.timeout` when a single run must be interrupted after a duration.

Because `Schedule.both` combines outputs, the resulting schedule output is a
tuple. Keep that output internal when callers only care that the loop finished.
