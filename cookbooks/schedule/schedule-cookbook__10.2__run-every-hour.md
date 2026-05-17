---
book: "Effect `Schedule` Cookbook"
section_number: "10.2"
section_title: "Run every hour"
part_title: "Part III — Repeat Recipes"
chapter_title: "10. Periodic and Spaced Repeat"
status: "draft"
code_included: true
---

# 10.2 Run every hour

Use this when successful background work should run now and then recur on an
hourly cadence.

## Problem

Slow-moving reference data, local compaction, summary metrics, or another
low-frequency task needs an immediate first run followed by successful hourly
recurrences.

## When to use it

Use `Schedule.fixed("1 hour")` when the action should stay on a regular
hourly cadence.

This fits background work owned by a long-lived process, scope, or supervised
fiber.

## When not to use it

Do not use `Effect.repeat` as failure recovery. If the action fails, the
repeated effect fails unless you handle or retry that failure inside the action.

Do not use this for calendar-aware scheduling, such as "run at the top of every
hour" or "run only during business hours." This recipe is about a periodic
one-hour interval.

Do not use a fixed hourly cadence when every run must be followed by one quiet
hour after it completes. Use `Schedule.spaced("1 hour")` for that shape.

## Schedule shape

`Schedule.fixed("1 hour")` recurs on a fixed interval and outputs the number
of repetitions so far.

With `Effect.repeat`, the first run happens immediately. The schedule controls
successful recurrences after that first run.

If a run takes longer than one hour, the next run starts immediately when the
current run completes, but missed runs do not pile up.

By contrast, `Schedule.spaced("1 hour")` waits one full hour after each
successful run completes.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let syncs = 0

const syncReferenceData = Effect.gen(function*() {
  syncs += 1
  yield* Console.log(`reference-data sync ${syncs}`)
})

const loop = syncReferenceData.pipe(
  Effect.repeat(Schedule.fixed("1 hour"))
)

const program = loop.pipe(
  Effect.timeoutOrElse({
    duration: "50 millis",
    orElse: () =>
      Console.log(`demo stopped after ${syncs} sync`)
  })
)

Effect.runPromise(program)
```

The timeout keeps the example quick. The hourly schedule itself is unbounded
and should be owned by the surrounding application.

## Variants

Use `Schedule.spaced("1 hour")` when the requirement is "wait one hour after
finishing" rather than "keep an hourly cadence." Use a named schedule value for
shared hourly policies so the duration is not scattered through background
workers.

## Notes and caveats

`Schedule.fixed("1 hour")` does not run actions concurrently by itself. A slow
run delays the next run.

Hourly background work often touches caches, snapshots, indexes, or external
state. Decide whether duplicate successful runs are harmless before making the
loop long-lived.

If transient failures should not stop the hourly loop, handle recovery inside
the repeated action before applying the periodic repeat.
