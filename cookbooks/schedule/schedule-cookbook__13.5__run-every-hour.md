---
book: Effect `Schedule` Cookbook
section_number: "13.5"
section_title: "Run every hour"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "13. Repeat Periodically"
status: "draft"
code_included: true
---

# 13.5 Run every hour

Use this recipe when successful background work should repeat on a low-frequency
hourly cadence.

## Problem

Slow-moving reference data, local compaction, summary metrics, or an infrequent
external condition needs an immediate first run followed by successful hourly
recurrences.

The schedule should express the recurrence policy and final repeat output, while
failures remain in the effect error channel.

## When to use it

Use `Schedule.fixed("1 hour")` when the action should stay on a regular hourly cadence.

This fits low-frequency background work where each successful run means "run this again on the next hourly interval" and the work is owned by a long-lived process, scope, or supervised fiber.

## When not to use it

Do not use `Effect.repeat` as failure recovery. `Effect.repeat` repeats successful effects; if the action fails, the repeated effect fails unless you handle or retry that failure inside the action.

Do not use this recipe when the requirement is calendar-aware scheduling, such as "run at the top of every hour" or "run only during business hours." This recipe is about a periodic one-hour interval.

Do not use a fixed hourly cadence when every run must be followed by one quiet hour after it completes. Use `Schedule.spaced("1 hour")` for that shape.

## Schedule shape

`Schedule.fixed("1 hour")` recurs on a fixed interval and outputs the number of repetitions so far.

With `Effect.repeat`, the first run happens immediately. The schedule controls the successful repetitions after that first run.

If a run takes longer than one hour, the next run starts immediately when the current run completes, but missed runs do not pile up. This keeps a slow hourly job from creating a backlog of catch-up executions.

By contrast, `Schedule.spaced("1 hour")` waits one full hour after each successful run completes. With `spaced`, a ten-minute action followed by one hour of spacing produces about seventy minutes between start times.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const everyHour = Schedule.fixed("1 hour")

const syncReferenceData = Console.log("syncing reference data")

export const program = syncReferenceData.pipe(
  Effect.repeat(everyHour)
)
```

The schedule is unbounded, so `program` is long-lived work. It completes only if `syncReferenceData` fails, the schedule fails, or the fiber is interrupted.

## Variants

Use `Schedule.spaced("1 hour")` when the requirement is "wait one hour after finishing" rather than "keep an hourly cadence":

```ts
const program = syncReferenceData.pipe(
  Effect.repeat(Schedule.spaced("1 hour"))
)
```

Use a named schedule value for shared hourly policies. This keeps the cadence visible and avoids scattering duration strings across background workers.

## Notes and caveats

`Schedule.fixed("1 hour")` does not run actions concurrently by itself. A slow run delays the next run, and if the schedule is behind, the next repetition may start immediately after the slow run completes.

Keep the repeated action idempotent or otherwise safe to run many times. Hourly background work often touches caches, snapshots, indexes, or external state where duplicate effects should be considered explicitly.

If transient failures should not stop the hourly loop, handle recovery inside the repeated action before applying the periodic repeat.
