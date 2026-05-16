---
book: Effect `Schedule` Cookbook
section_number: "31.3"
section_title: "Spread cleanup work over time"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "31. Throttle Internal Work"
status: "draft"
code_included: true
---

# 31.3 Spread cleanup work over time

Cleanup work is often safe to run in the background, but unsafe to run all at
once. Deleting expired rows, compacting old partitions, clearing orphaned files,
or rebuilding stale metadata can compete with foreground traffic for the same
database, filesystem, object store, or cache.

Use a schedule to make that load-smoothing policy explicit. The cleanup effect
runs one unit of work, then the schedule decides whether another unit may run
and how long to wait before it starts.

## Problem

You have a cleanup or maintenance job that can be split into small successful
steps. Running every step immediately would create a burst of database writes,
storage I/O, locks, cache churn, or downstream calls.

You want the job to keep making progress while spreading the pressure over time.

## When to use it

Use this when each cleanup pass is useful on its own and the main operational
concern is smoothing background load.

`Schedule.spaced(duration)` is the base policy for this shape. With
`Effect.repeat`, the cleanup effect runs once immediately. After each successful
run, the schedule waits for the configured duration before allowing the next
recurrence.

For a fleet of workers, add `Schedule.jittered` after choosing the base spacing.
`Schedule.jittered` randomly adjusts each recurrence delay between 80% and 120%
of the schedule's original delay, which helps keep many workers from waking up
in lockstep.

## When not to use it

Do not use this to retry failed cleanup work. `Effect.repeat` is driven by
successful values; if the cleanup effect fails, the repeated program fails. Use
`Effect.retry` around the cleanup step when failures should be retried.

Do not use this when the job must run on wall-clock boundaries, such as every
hour on the hour. `Schedule.spaced` waits after the previous run completes. Use
`Schedule.fixed` when constant interval boundaries matter more than a pause
after completed work.

Do not hide an unbounded cleanup loop inside a service without a shutdown or
batch limit. Long-running workers should be scoped by the service lifetime, and
finite batches should use a stopping rule such as `Schedule.take`.

## Schedule shape

The shape is a base spacing, optional jitter, and a limit:

```ts
Schedule.spaced("2 minutes").pipe(
  Schedule.jittered,
  Schedule.take(30)
)
```

With `Effect.repeat`, this means:

1. Run one cleanup step immediately.
2. If it succeeds, compute the next delay from the schedule.
3. Wait roughly two minutes, adjusted by jitter.
4. Run the next cleanup step.
5. Stop after the configured number of scheduled recurrences.

`Schedule.take(30)` permits thirty scheduled recurrences after the original
successful run. If every cleanup step succeeds, the cleanup effect runs
thirty-one times total.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type CleanupError = { readonly _tag: "CleanupError" }

declare const deleteExpiredRecordsPage: Effect.Effect<void, CleanupError>

const cleanupCadence = Schedule.spaced("2 minutes").pipe(
  Schedule.jittered,
  Schedule.take(30)
)

export const program = deleteExpiredRecordsPage.pipe(
  Effect.tap(() => Console.log("deleted one page of expired records")),
  Effect.repeat(cleanupCadence)
)
```

The first page is deleted immediately. Each later page is delayed by the
schedule. The two-minute spacing keeps cleanup from turning into a burst, and
the jitter helps multiple worker instances avoid synchronized cleanup spikes.

## Variants

Use a longer spacing for cleanup that contends with foreground traffic:

```ts
import { Effect, Schedule } from "effect"

type CleanupError = { readonly _tag: "CleanupError" }

declare const compactColdStoragePartition: Effect.Effect<void, CleanupError>

const coldStorageCleanup = Schedule.spaced("15 minutes").pipe(
  Schedule.jittered,
  Schedule.take(8)
)

export const program = compactColdStoragePartition.pipe(
  Effect.repeat(coldStorageCleanup)
)
```

Use no jitter when deterministic timing is more important than fleet-wide load
smoothing, for example in a single local worker whose schedule is used in tests
or operational runbooks.

Use `Schedule.fixed(duration)` instead of `Schedule.spaced(duration)` when the
cleanup should be checked at regular interval boundaries. With `fixed`, if the
work takes longer than the interval, the next recurrence can happen immediately
rather than piling up missed runs. With `spaced`, the pause is always added
after the run completes.

## Notes and caveats

The schedule does not delay the first cleanup step. It controls only follow-up
recurrences after a successful run.

`Schedule.spaced` is based on completed work. A cleanup step that takes thirty
seconds followed by `Schedule.spaced("2 minutes")` starts the next step about
two and a half minutes after the previous step started.

`Schedule.jittered` changes the recurrence delays, not the cleanup effect
itself. It is useful for smoothing aggregate load, but it makes exact log
timestamps and metric intervals less predictable.

`Effect.repeat` feeds successful cleanup results into the schedule. If the
cleanup effect fails, repetition stops with that failure unless retry behavior
is modeled separately.
