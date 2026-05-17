---
book: "Effect `Schedule` Cookbook"
section_number: "10.1"
section_title: "Run every minute"
part_title: "Part III — Repeat Recipes"
chapter_title: "10. Periodic and Spaced Repeat"
status: "draft"
code_included: true
---

# 10.1 Run every minute

Use this when successful background work should run now and then recur on a
one-minute cadence.

## Problem

A cache refresh, metrics publisher, or local-state check needs an immediate
first run and later successful recurrences once per minute.

## When to use it

Use `Schedule.fixed("1 minute")` when minute-level cadence matters and
second-level freshness would be unnecessary load.

This fits background work owned by a long-lived process, scope, or supervised
fiber.

## When not to use it

Do not use this for failure recovery. If the effect fails, `Effect.repeat`
stops with that failure.

Do not use an unbounded minute loop in a request-response path that needs to
complete.

Do not use this as a cron replacement. A fixed one-minute interval is not the
same as "at the top of every minute" or "only during business hours."

## Schedule shape

The core schedule is `Schedule.fixed("1 minute")`.

`fixed` schedules recurrences against interval boundaries. If a run takes
longer than a minute, the next recurrence may run immediately, but missed runs
do not pile up. Use `Schedule.spaced("1 minute")` when the gap after completion
is what matters.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

let refreshes = 0

const refreshCache = Effect.gen(function*() {
  refreshes += 1
  yield* Console.log(`cache refresh ${refreshes}`)
})

const loop = refreshCache.pipe(
  Effect.repeat(Schedule.fixed("1 minute"))
)

const program = loop.pipe(
  Effect.timeoutOrElse({
    duration: "50 millis",
    orElse: () =>
      Console.log(`demo stopped after ${refreshes} refresh`)
  })
)

Effect.runPromise(program)
```

The timeout keeps the example quick while still using the real one-minute
schedule.

## Variants

Use `Schedule.spaced("1 minute")` when every completed run should be followed
by one quiet minute. Add `Schedule.take(n)` when a diagnostic or test should
stop after a fixed number of recurrences.

## Notes and caveats

The schedule does not delay the first execution. It controls only later
successful recurrences.

`Schedule.fixed("1 minute")` runs one recurrence at a time. It does not start
concurrent catch-up runs.

If transient failures should not stop the loop, handle retry or recovery inside
the repeated effect before applying the periodic repeat.
