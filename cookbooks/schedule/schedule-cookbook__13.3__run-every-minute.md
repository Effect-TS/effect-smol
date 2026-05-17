---
book: Effect `Schedule` Cookbook
section_number: "13.3"
section_title: "Run every minute"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "13. Repeat Periodically"
status: "draft"
code_included: true
---

# 13.3 Run every minute

Use this recipe when successful background work should repeat about once per minute
without turning the repeat policy into failure recovery.

## Problem

A cache refresh, metrics publisher, local-state check, or liveness signal needs to run
immediately and then recur on a minute-scale cadence because second-scale repetition
would be unnecessarily frequent.

The schedule should decide later successful recurrences and their spacing, while
failures remain in the effect error channel.

## When to use it

Use this when success means "do this again later" and one minute is a reasonable operational interval.

It fits background work that is cheap enough to repeat regularly, slow enough not to need second-level freshness, and owned by a long-lived process, scope, or supervised fiber.

## When not to use it

Do not use `Effect.repeat` for failure-driven recovery. If the effect fails, repetition stops with that failure. Use `Effect.retry` when failures should trigger another attempt.

Do not use an unbounded minute loop in a request-response path that needs to complete. The repeated work needs an owner that can interrupt it.

Do not use this as a cron replacement. This recipe describes a periodic repeat every minute, not calendar-aware scheduling such as "at the top of each hour" or "only on weekdays."

## Schedule shape

For most moderate-frequency background loops, use:

```ts
import { Schedule } from "effect"

const everyMinute = Schedule.spaced("1 minute")
```

`Schedule.spaced("1 minute")` waits one full minute after each successful run completes before starting the next recurrence. With `Effect.repeat`, the first run still happens immediately.

Use `Schedule.fixed("1 minute")` when the one-minute cadence itself is important. `fixed` schedules recurrences against fixed interval boundaries; if a run takes longer than the interval, the next recurrence may run immediately, but missed runs do not pile up. `spaced` measures the pause after completion, so the work duration is added before the next run starts.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const refreshCache = Console.log("refreshing cache")

const program = refreshCache.pipe(
  Effect.repeat(Schedule.spaced("1 minute"))
)
```

The first cache refresh runs immediately. After each successful refresh, the schedule waits one minute before allowing the next recurrence.

Because `Schedule.spaced("1 minute")` is unbounded, `program` is long-lived work. It completes only if `refreshCache` fails, the schedule fails, or the fiber is interrupted.

## Variants

Use a fixed-rate minute cadence when the starts should stay close to minute intervals:

```ts
import { Console, Effect, Schedule } from "effect"

const publishMetrics = Console.log("publishing metrics")

const program = publishMetrics.pipe(
  Effect.repeat(Schedule.fixed("1 minute"))
)
```

Use a bounded version for diagnostics or short-lived maintenance:

```ts
import { Console, Effect, Schedule } from "effect"

const checkState = Console.log("checking state")

const program = checkState.pipe(
  Effect.repeat(Schedule.spaced("1 minute").pipe(Schedule.take(3)))
)
```

With `Schedule.take(3)`, the effect runs once immediately and then up to three scheduled recurrences, for four successful runs total.

## Notes and caveats

The schedule does not delay the first execution. `Effect.repeat` runs the effect once before consulting the schedule.

`Schedule.spaced("1 minute")` is usually the clearer choice for background work where "wait a minute after finishing" is acceptable.

`Schedule.fixed("1 minute")` is the better fit when drift matters more than the gap after completion. It still runs one recurrence at a time; slow executions do not create a backlog of missed runs.

Failures are not skipped. If the repeated operation can fail transiently and should continue on the next minute, handle retry or recovery inside the repeated effect before applying the periodic repeat.

When the schedule eventually ends, `Effect.repeat` succeeds with the schedule's final output. With `Schedule.spaced`, `Schedule.fixed`, and `Schedule.take`, that output is a recurrence count.
