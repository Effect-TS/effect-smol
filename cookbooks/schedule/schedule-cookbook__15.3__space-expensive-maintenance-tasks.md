---
book: Effect `Schedule` Cookbook
section_number: "15.3"
section_title: "Space expensive maintenance tasks"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "15. Repeat with Controlled Spacing"
status: "draft"
code_included: true
---

# 15.3 Space expensive maintenance tasks

You have a maintenance effect that succeeds when it completes one unit of work, but that
unit is expensive enough that immediate repetition would put unnecessary pressure on the
system. This recipe treats repetition as a policy for successful effects. The schedule
decides whether another successful iteration should run, what spacing applies, and what
value the repeat returns. Failures stay in the effect error channel, so the repeat
policy stays separate from recovery or retry behavior.

## Problem

You have a maintenance effect that succeeds when it completes one unit of work, but that unit is expensive enough that immediate repetition would put unnecessary pressure on the system.

For example, a task may compact storage, rebuild a cache segment, refresh derived records, prune old rows, or reconcile external state. Each successful run is useful, but the next run should wait long enough to leave CPU, database, storage, or downstream services room to recover.

## When to use it

Use this when the important rule is "after a successful maintenance pass, wait before starting the next one."

`Schedule.spaced(duration)` is the direct policy for deliberate post-success spacing. With `Effect.repeat`, the maintenance effect runs once immediately. If it succeeds, the schedule waits for the configured duration before allowing the next recurrence.

This is a good fit for recurring maintenance jobs where a fixed pause after completion matters more than clock alignment.

## When not to use it

Do not use this to handle failed maintenance attempts. `Effect.repeat` is success-driven; if the maintenance effect fails, repetition stops with that failure. Use `Effect.retry` when failures should be attempted again.

Do not use this when the task must run at wall-clock interval boundaries, such as every hour on the hour. `Schedule.spaced` waits after the successful run completes, so the next start time includes the work duration plus the spacing.

Do not use this section for smoothing traffic across many workers or protecting a saturated dependency with adaptive backoff. Here the goal is simply to put a deliberate gap after successful expensive work.

## Schedule shape

The central shape is:

```ts
Schedule.spaced("10 minutes")
```

With `Effect.repeat`, this means:

1. Run the maintenance effect once immediately.
2. If it succeeds, wait ten minutes.
3. Run the next recurrence.
4. Repeat the same wait-after-success pattern.

The spacing is measured after the previous successful run completes. If a compaction takes three minutes and the schedule is `Schedule.spaced("10 minutes")`, the next compaction starts about thirteen minutes after the previous one started, not ten minutes after it started.

For a finite maintenance batch, combine spacing with a stopping rule, as in `Schedule.spaced("10 minutes").pipe(Schedule.take(6))`. This permits six scheduled recurrences after the initial successful run. If every run succeeds, the maintenance effect runs seven times total.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const compactOneShard = Console.log("compacting one shard")

const maintenanceSpacing = Schedule.spaced("10 minutes").pipe(
  Schedule.take(6)
)

const program = compactOneShard.pipe(
  Effect.repeat(maintenanceSpacing)
)
```

`compactOneShard` runs immediately. After each successful compaction, the repeat waits ten minutes before starting the next compaction. The `Schedule.take(6)` limit keeps the example bounded.

## Variants

Use a longer spacing for jobs that compete with foreground traffic:

```ts
import { Console, Effect, Schedule } from "effect"

const refreshSearchIndexPartition = Console.log("refreshing one search index partition")

const offPeakMaintenance = Schedule.spaced("30 minutes").pipe(
  Schedule.take(3)
)

const program = refreshSearchIndexPartition.pipe(
  Effect.repeat(offPeakMaintenance)
)
```

Use a shorter spacing when each pass is expensive but small, such as pruning one page of old rows at a time. Use a longer spacing when each pass causes noticeable CPU, I/O, lock, cache, or downstream pressure.

Use `Schedule.spaced(duration)` when the policy is based on completed work. Use `Schedule.fixed(duration)` when the policy is based on clock interval boundaries.

## Notes and caveats

The schedule does not delay the first maintenance run. It controls only recurrences after the first successful evaluation.

A long-running maintenance pass is not interrupted by `Schedule.spaced`. The pause is added after the pass completes successfully.

If the maintenance effect fails, `Effect.repeat` stops and returns that failure. The spacing policy is not a retry policy.

`Schedule.spaced` is unbounded by itself. For finite maintenance batches, add `Schedule.take` or another stopping rule. For long-running services, make sure the repeated workflow is scoped by the service lifetime.

With `Schedule.spaced`, the schedule output is the recurrence count. When a bounded repeat completes, the repeated program succeeds with the schedule's final output.
