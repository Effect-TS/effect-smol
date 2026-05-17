---
book: Effect `Schedule` Cookbook
section_number: "38.4"
section_title: "Repeat every second, but no more than 30 times"
part_title: "Part IX — Composition Recipes"
chapter_title: "38. Combine Attempt Limits and Delays"
status: "draft"
code_included: true
---

# 38.4 Repeat every second, but no more than 30 times

You have an effect that should run once, then repeat after successful runs with
a one-second pause, but only for a bounded number of recurrences.

## Problem

You need repeat behavior for a short background loop, bounded status refresh,
or maintenance task that is easy to read from the policy itself:

- the first run happens immediately;
- each successful recurrence waits one second after the previous run completes;
- the schedule permits no more than 30 scheduled recurrences.

The count belongs in the schedule rather than in a mutable loop counter next to
the effect.

## When to use it

Use this when the effect reports progress through successful values and you want
to repeat that effect a limited number of times.

Good examples include bounded polling, short-lived heartbeat-style loops,
refreshing local state during startup, and maintenance work where each run
should finish before the next one is scheduled.

## When not to use it

Do not use this to retry failures. `Effect.repeat` repeats after success. If the
effect fails, the repeat stops with that failure. Use `Effect.retry` when the
schedule should be driven by failures instead.

Do not use `Schedule.spaced("1 second")` when you need a strict wall-clock tick.
`spaced` waits after the previous run completes. If the run takes 200
milliseconds, the next run starts roughly 1.2 seconds after the previous start.

Do not use this as a hard timeout for one long-running execution. The schedule is
consulted between runs; it does not interrupt a run that is already in flight.

## Schedule shape

Start with the unbounded cadence:

```ts
Schedule.spaced("1 second")
```

Then cap the number of schedule outputs:

```ts
Schedule.spaced("1 second").pipe(
  Schedule.take(30)
)
```

With `Effect.repeat`, the effect itself runs once before the schedule makes a
decision. `Schedule.take(30)` therefore means "allow up to 30 recurrences after
the initial successful run." The effect can run up to 31 times total.

If the requirement is "no more than 30 executions total, including the first
one", use `Schedule.take(29)` instead.

## Code

```ts
import { Effect, Schedule } from "effect"

type RefreshError = {
  readonly _tag: "RefreshError"
  readonly message: string
}

declare const refreshStatus: Effect.Effect<void, RefreshError>

const repeatEverySecondAtMost30Times = Schedule.spaced("1 second").pipe(
  Schedule.take(30)
)

export const program = refreshStatus.pipe(
  Effect.repeat(repeatEverySecondAtMost30Times)
)
```

`refreshStatus` runs immediately. After each successful run, the schedule waits
one second before allowing the next recurrence. After 30 scheduled recurrences,
the repeat stops.

## Variants

Use `Schedule.recurs(30)` when you want to express the count limit as a separate
schedule and combine it with the cadence:

```ts
import { Schedule } from "effect"

const repeatEverySecondAtMost30Times = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(30))
)
```

Both schedules must continue for the combined schedule to continue. The spaced
schedule contributes the one-second delay, and `Schedule.recurs(30)` contributes
the recurrence limit.

Prefer `Schedule.take(30)` when the count limit is simply trimming the spaced
schedule. Prefer `Schedule.recurs(30)` when you want the count limit to remain a
named component, especially in a larger composed policy.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule. Failed effects do not
become schedule inputs; they stop the repeat.

The schedule controls recurrences, not the original execution. For
`Schedule.take(30)` and `Schedule.recurs(30)`, read the number as "up to 30
repeats after the first successful run."

`Schedule.spaced("1 second")` spaces runs from completion to next start. Use
`Schedule.fixed("1 second")` only when the policy should try to stay on a fixed
one-second cadence.
