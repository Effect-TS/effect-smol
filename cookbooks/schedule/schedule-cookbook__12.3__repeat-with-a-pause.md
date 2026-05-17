---
book: Effect `Schedule` Cookbook
section_number: "12.3"
section_title: "Repeat with a pause"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "12. Repeat a Successful Effect"
status: "draft"
code_included: true
---

# 12.3 Repeat with a pause

`Effect.repeat` can add a deliberate pause between successful runs. This recipe covers
spacing recurrences without turning the repeat into failure recovery.

## Problem

Without spacing, a successful queue check, cache refresh, or heartbeat can
immediately schedule the next run. Use the schedule to place a fixed pause
between successful recurrences.

## When to use it

Use this when success is the trigger for another run and each recurrence should wait the same amount of time.

This is useful when the repeated action is cheap enough to run more than once, but immediate repetition would be noisy, wasteful, or hard to observe.

## When not to use it

Do not use this to retry failures. `Effect.repeat` repeats after success; if the effect fails, repetition stops with that failure. Use `Effect.retry` for failure-driven attempts.

Do not use this when you need calendar-style periodic timing or alignment to clock boundaries. A pause between successful recurrences is simpler than a full periodic schedule.

Do not leave the schedule unbounded unless the surrounding workflow is intended to keep running. Add a small recurrence limit when the repeated action should stop after a known number of pauses.

## Schedule shape

The central shape is `Schedule.spaced(duration)`, for example `Schedule.spaced("2 seconds")`.

With `Effect.repeat`, the original effect runs once immediately. After a successful run, the schedule decides whether to recur and how long to wait before that recurrence.

`Schedule.spaced("2 seconds")` keeps allowing recurrences with a two-second pause. For a bounded recipe, combine it with `Schedule.take(n)`:

```ts
Schedule.spaced("2 seconds").pipe(Schedule.take(3))
```

This means three scheduled recurrences after the original successful run. If every run succeeds, the effect runs four times total, with a two-second pause before each recurrence.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const refreshCache = Console.log("cache refreshed")

const program = refreshCache.pipe(
  Effect.repeat(Schedule.spaced("2 seconds").pipe(Schedule.take(3)))
)
```

Here `refreshCache` runs immediately. If it succeeds, Effect waits two seconds before the first recurrence. The same pause is used before each later recurrence, up to three scheduled recurrences.

The program returned by `Effect.repeat(schedule)` succeeds with the schedule's final output. With `Schedule.spaced`, that output is the recurrence count.

## Variants

If you already have a count schedule and want to add a pause to it, use `Schedule.addDelay`:

```ts
import { Effect, Schedule } from "effect"

const repeatWithPause = Schedule.recurs(3).pipe(
  Schedule.addDelay(() => Effect.succeed("2 seconds"))
)
```

This keeps the recurrence count shape explicit and adds a two-second delay to each scheduled recurrence.

Use `Schedule.spaced("2 seconds").pipe(Schedule.take(3))` when the pause is the main idea. Use `Schedule.recurs(3).pipe(Schedule.addDelay(...))` when you want to start from a count policy and attach timing to it.

## Notes and caveats

The pause is not before the first run. The first evaluation of the effect happens immediately; the schedule controls only later recurrences.

The pause happens only after success. A failure from the repeated effect stops the repeat and returns the failure.

`Schedule.spaced` by itself is unbounded. Pair it with a limit, another stopping rule, or an enclosing lifetime when the workflow must end.

`Schedule.addDelay` adds to any delay the base schedule already chose. With `Schedule.recurs(3)`, this effectively adds the fixed pause to each recurrence.
