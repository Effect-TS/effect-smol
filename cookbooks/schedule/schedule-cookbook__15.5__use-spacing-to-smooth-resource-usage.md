---
book: Effect `Schedule` Cookbook
section_number: "15.5"
section_title: "Use spacing to smooth resource usage"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "15. Repeat with Controlled Spacing"
status: "draft"
code_included: true
---

# 15.5 Use spacing to smooth resource usage

You have a successful repeated effect that consumes a shared resource each time it runs:
CPU, database connections, queue visibility checks, cache bandwidth, file handles, or an
external API quota. This recipe treats repetition as a policy for successful effects.
The schedule decides whether another successful iteration should run, what spacing
applies, and what value the repeat returns. Failures stay in the effect error channel,
so the repeat policy stays separate from recovery or retry behavior.

## Problem

You have a successful repeated effect that consumes a shared resource each time it runs: CPU, database connections, queue visibility checks, cache bandwidth, file handles, or an external API quota.

If the next iteration starts immediately after each success, the loop can create bursts of resource usage. Even when every individual run is correct, the repeated workflow can make the system feel uneven: short spikes, quiet gaps, then more spikes.

## When to use it

Use this when the repeat loop should keep making progress, but each successful iteration should leave a predictable gap before the next one starts.

This is useful for polling, periodic cleanup, small batch processing, and maintenance work where the exact wall-clock boundary is less important than avoiding back-to-back successful runs.

Use `Schedule.spaced(duration)` when the policy is "after a successful run completes, wait this long before the next recurrence."

## When not to use it

Do not use this to retry failures. `Effect.repeat` is success-driven; if the effect fails, repetition stops with that failure. Use `Effect.retry` for failure-driven recovery.

Do not use this as a full rate limiter. Spacing one repeat loop smooths that loop's own resource usage, but it does not coordinate with other fibers, processes, users, or services.

Do not use this when work must run on fixed interval boundaries. `Schedule.spaced` waits after completion, so the time between starts includes both the work duration and the configured spacing. Use `Schedule.fixed(duration)` for fixed-rate cadence.

## Schedule shape

The central shape is:

```ts
Schedule.spaced("1 second").pipe(Schedule.take(30))
```

`Schedule.spaced("1 second")` waits one second after each successful iteration before allowing the next recurrence.

`Schedule.take(30)` bounds the repeat to 30 scheduled recurrences after the initial successful run. If every run succeeds, the effect runs 31 times total.

Together, the schedule says: run now, then keep repeating after success with a fixed gap between completed work items, and stop after a known recurrence limit.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const processOneBatch = Console.log("processing one batch")

const smoothBatchSchedule = Schedule.spaced("1 second").pipe(
  Schedule.take(30)
)

const program = processOneBatch.pipe(
  Effect.repeat(smoothBatchSchedule)
)
```

The first `processOneBatch` runs immediately. After each successful batch, the schedule waits one second before the next batch. The repeat ends after the recurrence bound, or earlier if `processOneBatch` fails.

## Variants

Use shorter spacing when responsiveness matters and each iteration is cheap:

```ts
const responsiveSpacing = Schedule.spaced("100 millis").pipe(
  Schedule.take(100)
)

const quietSpacing = Schedule.spaced("5 seconds").pipe(
  Schedule.take(12)
)
```

Use longer spacing when the repeated work competes with interactive traffic, keeps connections open, or causes visible load on a dependency.

For long-lived services, the schedule can be unbounded, but the fiber running the repeat should still be tied to the service lifetime.

## Notes and caveats

The spacing is applied after successful completion, not before the first run.

The duration of the work is not hidden by the schedule. If one iteration takes three seconds and the spacing is one second, the next start is roughly four seconds after the previous start.

Spacing smooths only this repeat loop. It does not provide a global request budget, distributed coordination, or fairness across callers.

Choose a spacing that matches the resource being protected. A database maintenance loop, a local cache refresh, and an external API poll usually need different gaps.

`Schedule.spaced` is unbounded by itself. Add `Schedule.take` or another stopping rule when the repeat belongs to a finite operation, test, or command-line program.
