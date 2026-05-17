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

Use this recipe when successful background work should stay on a regular five-minute
cadence.

## Problem

A health probe, cache refresh, metrics sync, or lightweight maintenance check needs an
immediate first run followed by successful recurrences every five minutes.

The schedule should keep the cadence visible and return its repeat output, while
failures remain in the effect error channel.

## When to use it

Use `Schedule.fixed("5 minutes")` when the action should stay on a regular five-minute cadence. This is the usual choice for periodic checks where the interval is measured from the schedule's time base, not from the end of each action.

## When not to use it

Do not use this shape for retrying failures. `Effect.repeat` repeats successful effects; if the action fails, the repeated effect fails unless you handle or retry the failure separately.

Do not use a fixed five-minute cadence when every run must wait for five quiet minutes after the previous run finishes. Use `Schedule.spaced("5 minutes")` for that shape.

## Schedule shape

`Schedule.fixed("5 minutes")` recurs on a fixed interval and outputs the number of repetitions so far.

If one run takes longer than five minutes, the next run starts immediately when the previous run completes, but missed runs do not pile up. This keeps the process from launching a backlog of catch-up executions.

By contrast, `Schedule.spaced("5 minutes")` waits five minutes after each successful run completes. With `spaced`, a three-minute action followed by a five-minute spacing produces about eight minutes between start times.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const everyFiveMinutes = Schedule.fixed("5 minutes")

const refreshCache = Effect.gen(function*() {
  yield* Console.log("Refreshing cache")
  // refresh cache entries, poll a dependency, or run maintenance work here
})

export const program = refreshCache.pipe(
  Effect.repeat(everyFiveMinutes)
)
```

The first execution happens when `program` starts. The schedule controls the successful repetitions after that first execution.

## Variants

Use `Schedule.spaced("5 minutes")` when the requirement is "wait five minutes after finishing" rather than "keep a five-minute cadence":

```ts
import { Schedule } from "effect"

const afterEachSuccessfulRefresh = Schedule.spaced("5 minutes")
```

Use it in the same `Effect.repeat` position as the fixed schedule. A named schedule value is useful when the same cadence is shared by multiple background jobs because it keeps the periodic policy visible and avoids scattering duration strings through the code.

## Notes and caveats

`Schedule.fixed("5 minutes")` does not run actions concurrently by itself. A slow run delays the next run, and if the schedule is behind, the next repetition may start immediately after the slow run completes.

Keep the repeated action idempotent or otherwise safe to run many times. Five-minute background work often touches caches, probes, or maintenance state where duplicate or overlapping external effects should be considered explicitly.

If failures should be tolerated, decide whether to handle them inside the repeated action, retry them with a retry schedule, or let the whole repeated program fail.
