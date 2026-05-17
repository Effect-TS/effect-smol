---
book: Effect `Schedule` Cookbook
section_number: "13.4"
section_title: "Run every 5 minutes"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "13. Repeat Periodically"
status: "draft"
code_included: true
---

# 13.4 Run every 5 minutes

Use this when successful background work should run now and then recur on a
five-minute cadence.

## Problem

A health probe, cache refresh, metrics sync, or maintenance check needs an
immediate first run followed by successful recurrences every five minutes.

## When to use it

Use `Schedule.fixed("5 minutes")` when the action should stay on a regular
five-minute cadence measured from the schedule's time base.

## When not to use it

Do not use this for retrying failures. `Effect.repeat` repeats successful
effects; if the action fails, the repeated effect fails unless you handle or
retry the failure separately.

Do not use a fixed cadence when every run must wait for five quiet minutes
after the previous run finishes. Use `Schedule.spaced("5 minutes")` for that
shape.

## Schedule shape

`Schedule.fixed("5 minutes")` recurs on a fixed interval and outputs the
number of repetitions so far.

If one run takes longer than five minutes, the next run starts immediately when
the previous run completes, but missed runs do not pile up. Effect still runs
one recurrence at a time.

By contrast, `Schedule.spaced("5 minutes")` waits five minutes after each
successful run completes.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let refreshes = 0

const refreshCache = Effect.gen(function*() {
  refreshes += 1
  yield* Console.log(`five-minute refresh ${refreshes}`)
})

const loop = refreshCache.pipe(
  Effect.repeat(Schedule.fixed("5 minutes"))
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

The timeout is only for the pasteable example. A real five-minute loop should
be owned by an application scope or supervised fiber.

## Variants

Use `Schedule.spaced("5 minutes")` when the requirement is "wait five minutes
after finishing" rather than "keep a five-minute cadence." A named schedule
value is useful when the same cadence is shared by multiple background jobs.

## Notes and caveats

`Schedule.fixed("5 minutes")` does not run actions concurrently by itself. A
slow run delays the next run.

Keep the repeated action idempotent or otherwise safe to run many times.
Idempotent means duplicate runs have the same external effect as one run, or
are otherwise harmless for the caller.

If failures should be tolerated, decide whether to handle them inside the
repeated action, retry them with a retry schedule, or let the whole repeated
program fail.
