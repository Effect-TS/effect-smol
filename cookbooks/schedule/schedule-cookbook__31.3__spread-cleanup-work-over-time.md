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

Cleanup is usually safest as small, paced units. Run one unit, return whether
more remains, and let a schedule delay the next unit.

## Problem

Deleting expired rows, compacting partitions, clearing orphaned files, or
rebuilding metadata can create bursts of writes, I/O, locks, cache invalidation,
or downstream calls. The job should make progress without competing with
foreground traffic all at once.

## When to use it

Use this when each cleanup step is useful on its own and the main risk is
background load. `Schedule.spaced(duration)` is the default shape: the first
cleanup runs immediately, and later successful recurrences wait for the chosen
duration.

For a fleet of workers, add `Schedule.jittered` after choosing the base spacing.
Jitter randomizes each delay between 80% and 120% of the original delay, which
reduces synchronized cleanup spikes.

## When not to use it

Do not use this to retry failed cleanup work. A failed repeated effect stops
the repeat. Put a separate `Effect.retry` around the cleanup step when retrying
is appropriate.

Do not use `Schedule.spaced` for jobs that must run on wall-clock boundaries,
such as exactly every hour. Use `Schedule.fixed` for interval boundaries.

Do not hide unbounded cleanup inside a service without a lifetime, shutdown
path, or recurrence limit.

## Schedule shape

Use a base spacing, optional jitter, and a limit:
`Schedule.spaced("2 minutes").pipe(Schedule.jittered, Schedule.take(30))`.

With `Effect.repeat`, the first cleanup step is not delayed. `Schedule.take(30)`
permits up to thirty scheduled recurrences after that first run.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const expiredPages = ["page-1", "page-2", "page-3"]

const deleteExpiredRecordsPage = Effect.gen(function*() {
  const page = expiredPages.shift()

  if (page === undefined) {
    yield* Console.log("cleanup complete")
    return { remaining: 0 }
  }

  yield* Console.log(`deleted expired records from ${page}`)
  return { remaining: expiredPages.length }
})

const cleanupCadence = Schedule.spaced("15 millis").pipe(
  Schedule.jittered,
  Schedule.take(10)
)

const program = deleteExpiredRecordsPage.pipe(
  Effect.repeat({
    schedule: cleanupCadence,
    while: ({ remaining }) => remaining > 0
  })
)

Effect.runPromise(program)
```

The demo uses milliseconds so it finishes quickly. In a real cleanup job, the
spacing should reflect the database, storage, or cache pressure created by one
cleanup unit.

## Variants

Use longer spacing for cleanup that contends with foreground traffic. Use no
jitter when deterministic timing matters more than fleet-wide smoothing, such
as a single local worker in a runbook.

Use `Schedule.fixed(duration)` instead of `Schedule.spaced(duration)` when the
cleanup should check regular interval boundaries. With `fixed`, a slow run can
be followed immediately by the next boundary. With `spaced`, the pause is added
after the run completes.

## Notes and caveats

`Schedule.spaced` is based on completed work. A thirty-second cleanup followed
by `Schedule.spaced("2 minutes")` starts the next step about two and a half
minutes after the previous step started.

`Schedule.jittered` changes recurrence delays, not the cleanup effect. It
smooths aggregate load but makes exact timestamps less predictable.
