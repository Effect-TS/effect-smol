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

Use `Schedule.spaced` when maintenance work should continue after success, but
not run back-to-back.

## Problem

A maintenance task may compact storage, rebuild a cache segment, refresh derived
records, prune old rows, or reconcile external state. Each successful run is useful,
but the next run should wait long enough to leave CPU, database, storage, or
downstream services room to recover.

## When to use it

Use this when the important rule is "after a successful maintenance pass, wait
before starting the next one."

`Schedule.spaced(duration)` is the direct policy for deliberate post-success spacing. With `Effect.repeat`, the maintenance effect runs once immediately. If it succeeds, the schedule waits for the configured duration before allowing the next recurrence.

This is a good fit for recurring maintenance jobs where a fixed pause after completion matters more than clock alignment.

## When not to use it

Do not use this to handle failed maintenance attempts. `Effect.repeat` is
success-driven; if the maintenance effect fails, repetition stops with that
failure. Use `Effect.retry` when failures should be attempted again.

Do not use this when the task must run at wall-clock interval boundaries, such
as every hour on the hour. `Schedule.spaced` waits after the successful run
completes, so the next start time includes the work duration plus the spacing.

Do not use this section for smoothing traffic across many workers or protecting a saturated dependency with adaptive backoff. Here the goal is simply to put a deliberate gap after successful expensive work.

## Schedule shape

The central shape is `Schedule.spaced("10 minutes")`. With `Effect.repeat`, it
means:

1. Run the maintenance effect once immediately.
2. If it succeeds, wait ten minutes.
3. Run the next recurrence.
4. Repeat the same wait-after-success pattern.

The spacing is measured after the previous successful run completes. If a compaction takes three minutes and the schedule is `Schedule.spaced("10 minutes")`, the next compaction starts about thirteen minutes after the previous one started, not ten minutes after it started.

For a finite maintenance batch, combine spacing with a stopping rule, as in `Schedule.spaced("10 minutes").pipe(Schedule.take(6))`. This permits six scheduled recurrences after the initial successful run. If every run succeeds, the maintenance effect runs seven times total.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let shard = 0

const compactOneShard = Effect.gen(function*() {
  shard += 1
  yield* Console.log(`compacted shard ${shard}`)
  return shard
})

const maintenanceSpacing = Schedule.spaced("10 millis").pipe(Schedule.take(2))

const program = Effect.gen(function*() {
  const finalRecurrence = yield* compactOneShard.pipe(
    Effect.repeat(maintenanceSpacing)
  )
  yield* Console.log(`maintenance stopped after recurrence ${finalRecurrence}`)
})

Effect.runPromise(program)
```

The example uses milliseconds so it terminates quickly. A real maintenance job
would usually use minutes and a recurrence limit tied to the maintenance window.

## Variants

Use a shorter spacing when each pass is expensive but small, such as pruning one page of old rows at a time. Use a longer spacing when each pass causes noticeable CPU, I/O, lock, cache, or downstream pressure.

Use `Schedule.spaced(duration)` when the policy is based on completed work. Use `Schedule.fixed(duration)` when the policy is based on clock interval boundaries.

## Notes and caveats

The schedule does not delay the first maintenance run. It controls only recurrences after the first successful evaluation.

A long-running maintenance pass is not interrupted by `Schedule.spaced`. The pause is added after the pass completes successfully.

If the maintenance effect fails, `Effect.repeat` stops and returns that failure. The spacing policy is not a retry policy.

`Schedule.spaced` is unbounded by itself. For finite maintenance batches, add `Schedule.take` or another stopping rule. For long-running services, make sure the repeated workflow is scoped by the service lifetime.

With `Schedule.spaced`, the schedule output is the recurrence count. When a bounded repeat completes, the repeated program succeeds with the schedule's final output.
