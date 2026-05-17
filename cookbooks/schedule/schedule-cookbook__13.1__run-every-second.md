---
book: Effect `Schedule` Cookbook
section_number: "13.1"
section_title: "Run every second"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "13. Repeat Periodically"
status: "draft"
code_included: true
---

# 13.1 Run every second

Use this when a successful effect should run now and then recur on a
one-second cadence.

## Problem

A heartbeat, sampler, or small maintenance action needs an immediate first run
and later successful recurrences every second.

## When to use it

Use `Schedule.fixed("1 second")` when the interval itself is the policy. The
first run happens immediately; the schedule controls only later successful
recurrences.

## When not to use it

Do not use `Effect.repeat` to recover from failure. If the effect fails,
repetition stops with that failure. Use `Effect.retry` for failure-driven
attempts.

Do not use a fixed cadence when the requirement is "wait one second after the
previous run completes." Use `Schedule.spaced("1 second")` for that.

Do not leave a one-second loop without an owner such as a scope, supervised
fiber, timeout, or explicit interruption path.

## Schedule shape

The core schedule is `Schedule.fixed("1 second")`.

With `Effect.repeat`, the effect runs once before the schedule is consulted. If
that run succeeds, `Schedule.fixed("1 second")` schedules later recurrences on
one-second interval boundaries.

If a run takes longer than the interval, missed runs do not pile up. The next
run may start immediately after the slow run completes.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let heartbeats = 0

const heartbeat = Effect.gen(function*() {
  heartbeats += 1
  yield* Console.log(`heartbeat ${heartbeats}`)
})

const program = Effect.gen(function*() {
  const scheduleOutput = yield* heartbeat.pipe(
    Effect.repeat(Schedule.fixed("1 second").pipe(Schedule.take(2)))
  )

  yield* Console.log(`schedule output: ${scheduleOutput}`)
})

Effect.runPromise(program)
```

This prints three heartbeats: the original run plus two scheduled recurrences.
`Schedule.take(2)` is only the example cap.

## Variants

Use `Schedule.spaced("1 second")` when each successful run should be followed
by a full one-second pause. Choose `fixed` for a cadence; choose `spaced` for a
gap after completion.

## Notes and caveats

The first execution is not delayed. `Effect.repeat` evaluates the effect once,
then uses the schedule for later recurrences.

The repeat is success-driven. A failure from the repeated effect stops the loop
and returns the failure.

`Schedule.fixed("1 second")` is unbounded by itself. Combine it with a limit or
run it inside a lifetime that can interrupt it.
