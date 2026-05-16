---
book: Effect `Schedule` Cookbook
section_number: "13.2"
section_title: "Run every 10 seconds"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "13. Repeat Periodically"
status: "draft"
code_included: true
---

# 13.2 Run every 10 seconds

You have a successful effect that should run repeatedly with a predictable ten-second
rhythm. This is common for lightweight background work such as sending a heartbeat,
polling a local status endpoint, refreshing a small cache entry, or publishing a
periodic liveness signal. This recipe treats repetition as a policy for successful
effects. The schedule decides whether another successful iteration should run, what
spacing applies, and what value the repeat returns. Failures stay in the effect error
channel, so the repeat policy stays separate from recovery or retry behavior.

## Problem

You have a successful effect that should run repeatedly with a predictable ten-second rhythm.

This is common for lightweight background work such as sending a heartbeat, polling a local status endpoint, refreshing a small cache entry, or publishing a periodic liveness signal.

## When to use it

Use this when success means "run again later" and a ten-second interval is frequent enough to keep state fresh without creating a tight loop.

Use it for work that is expected to be cheap, bounded, and owned by a long-lived process, scope, or supervised fiber.

## When not to use it

Do not use `Effect.repeat` for failure-driven recovery. If the repeated effect fails, repetition stops with that failure. Use `Effect.retry` when failures should trigger another attempt.

Do not use a ten-second repeat for expensive maintenance work that should run on minute-scale or longer intervals. Keep this shape for short operational loops.

Do not use an unbounded repeat in a request-response path that must return to its caller. The surrounding program needs a lifetime owner that can interrupt it.

## Schedule shape

For most heartbeat, status, and cache-refresh loops, use:

```ts
import { Schedule } from "effect"

const everyTenSeconds = Schedule.spaced("10 seconds")
```

`Schedule.spaced("10 seconds")` allows the effect to run once immediately. After each successful run completes, it waits ten seconds before the next recurrence.

Use `Schedule.fixed("10 seconds")` only when you want a fixed-rate cadence measured against interval boundaries. With `fixed`, a slow run can make the next recurrence happen immediately to keep the cadence from drifting, but runs do not pile up. With `spaced`, each successful run is followed by a full ten-second pause.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const sendHeartbeat = Console.log("heartbeat")

const program = sendHeartbeat.pipe(
  Effect.repeat(Schedule.spaced("10 seconds"))
)
```

The first heartbeat is sent immediately. Each later heartbeat is scheduled only after the previous heartbeat succeeds and the ten-second spacing has elapsed.

Because `Schedule.spaced("10 seconds")` is unbounded, `program` is long-lived work. It completes only if `sendHeartbeat` fails, the schedule fails, or the fiber is interrupted.

## Variants

Use `Schedule.fixed("10 seconds")` when the interval itself is the operational signal, such as sampling status close to fixed ten-second boundaries:

```ts
import { Console, Effect, Schedule } from "effect"

const sampleStatus = Console.log("status sampled")

const program = sampleStatus.pipe(
  Effect.repeat(Schedule.fixed("10 seconds"))
)
```

Use a bounded version while testing a loop or running a short diagnostic:

```ts
import { Console, Effect, Schedule } from "effect"

const refreshSmallCache = Console.log("cache refreshed")

const program = refreshSmallCache.pipe(
  Effect.repeat(Schedule.spaced("10 seconds").pipe(Schedule.take(3)))
)
```

With `Schedule.take(3)`, the effect runs once immediately and then up to three scheduled recurrences, for four successful runs total.

## Notes and caveats

The schedule does not delay the first run. `Effect.repeat` evaluates the effect once before the schedule controls later recurrences.

`Schedule.spaced("10 seconds")` measures the pause after a successful run completes. If the work takes two seconds, the next run starts about twelve seconds after the previous run started.

`Schedule.fixed("10 seconds")` targets a fixed-rate cadence. If a run is slow, the next delay may be shorter, or zero when the schedule is behind, but Effect still runs one recurrence at a time.

Failures are not ignored. If a heartbeat, status check, or cache refresh can fail transiently and should keep running, handle retry or error recovery inside the repeated unit before applying the periodic repeat.
