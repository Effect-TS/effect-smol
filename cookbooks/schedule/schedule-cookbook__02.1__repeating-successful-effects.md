---
book: "Effect `Schedule` Cookbook"
section_number: "2.1"
section_title: "Repeating successful effects"
part_title: "Part I — Foundations"
chapter_title: "2. `repeat` vs `retry`"
status: "draft"
code_included: true
---

# 2.1 Repeating successful effects

Use `Effect.repeat` when a successful result should be followed by another run.
The schedule is consulted after success, not after failure.

## Problem

Manual repetition tends to mix the unit of work with cadence, stopping rules,
and sleeps. `Effect.repeat` keeps the effect focused on one successful run while
a `Schedule` decides whether another successful run should follow.

## When to use it

Use `repeat` for workflows where success means "consider doing this again":
heartbeats, periodic refreshes, metric sampling, polling successful domain
states, and bounded setup checks.

It is also the right fit when the value you need to inspect is in the success
channel. A job status such as `"pending"` is usually a normal successful
response, not an error.

## When not to use it

Do not use `repeat` to recover from failure. If the effect fails, repetition
stops immediately and the failure is returned. Use `Effect.retry` when the next
run should be triggered by a typed failure.

Do not use an unbounded repeat for a one-shot workflow unless some surrounding
fiber, timeout, or interruption boundary is responsible for stopping it.

## Schedule shape

`Effect.repeat` runs the effect once before the schedule makes a decision. After
each success, the successful value becomes schedule input.

`Schedule.recurs(n)` allows up to `n` repetitions after the first run.
`Schedule.spaced(duration)` repeats indefinitely with that delay between
successful runs. Pair unbounded timing schedules with `times`, `take`,
`recurs`, or a predicate when the loop must finish on its own.

The return value depends on the overload. The raw schedule overload returns the
schedule output. The options form, such as `Effect.repeat({ times: n })` or
`Effect.repeat({ schedule })`, returns the final successful value from the
effect.

## Example

This heartbeat runs once immediately, then repeats twice more:

```ts
import { Console, Effect, Schedule } from "effect"

let beats = 0

const heartbeat = Effect.sync(() => {
  beats += 1
  return `heartbeat ${beats}`
}).pipe(
  Effect.tap((message) => Console.log(message))
)

const program = Effect.gen(function*() {
  const lastValue = yield* heartbeat.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("10 millis"),
      times: 2
    })
  )

  yield* Console.log(`repeat returned last value: ${lastValue}`)
})

Effect.runPromise(program)
```

The initial execution is not counted as a scheduled recurrence. The example
runs three times total: one initial heartbeat plus two repetitions.

## Variants

Use `times` for the smallest bounded repeat when you care about the final
successful value. Use a raw schedule when you care about the schedule output.

Use `until` when the successful value describes the stopping condition. Use
`while` when the successful value describes the condition for continuing. Both
predicates inspect successes when used with `repeat`.

For polling, keep normal domain states in the success channel. If the status is
`"pending"`, repeat the successful polling effect until it returns a terminal
state. If the polling request itself fails, `repeat` returns that failure unless
the polling effect handles or retries it internally.

## Notes and caveats

Delays are between recurrences. They do not delay the initial execution.

When `until` or `while` is combined with a bounded schedule, repetition can end
because the predicate stopped it or because the schedule was exhausted. If the
caller must distinguish those outcomes, make that distinction explicit in the
success value or use a schedule output that records it.

If the schedule itself can fail, that failure is part of the returned effect's
error channel. Basic schedules such as `Schedule.recurs` and `Schedule.spaced`
do not add their own error.
