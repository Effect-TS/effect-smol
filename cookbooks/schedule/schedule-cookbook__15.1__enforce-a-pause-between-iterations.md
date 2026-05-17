---
book: Effect `Schedule` Cookbook
section_number: "15.1"
section_title: "Enforce a pause between iterations"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "15. Repeat with Controlled Spacing"
status: "draft"
code_included: true
---

# 15.1 Enforce a pause between iterations

Use spacing when a successful repeat should leave a deliberate gap before the next
iteration. This recipe keeps the pause policy separate from failure recovery.

## Problem

After refreshing local state, polling a lightweight source, or emitting a heartbeat,
you want the next successful iteration to start only after a known gap.

## When to use it

Use this when the spacing between completed iterations matters more than a clock-aligned cadence.

`Schedule.spaced(duration)` is the direct shape for this policy. The first run happens immediately. After each successful run, the schedule waits for the duration before allowing the next recurrence.

## When not to use it

Do not use this to retry failures. `Effect.repeat` is success-driven; if the effect fails, repetition stops with that failure. Use `Effect.retry` for failure-driven attempts.

Do not use this when the requirement is a fixed-rate periodic cadence, such as "try to run every second on a one-second interval." Use `Schedule.fixed(duration)` for that shape.

Do not use this when the first run itself must be delayed. `Effect.repeat` evaluates the effect once before the schedule controls later recurrences.

## Schedule shape

The central shape is:

```ts
Schedule.spaced("2 seconds")
```

`Schedule.spaced("2 seconds")` means that each scheduled recurrence is separated from the last completed run by a two-second pause.

This is different from `Schedule.fixed("2 seconds")`. `fixed` schedules recurrences against interval boundaries. If the effect takes longer than the interval, the next recurrence may happen immediately so the schedule can continue from the current time. `spaced` still waits the requested duration after the run completes.

When the repeat should stop after a known number of scheduled recurrences, add `Schedule.take`, as in `Schedule.spaced("2 seconds").pipe(Schedule.take(3))`. This allows three scheduled recurrences after the original successful run. If all runs succeed, the effect runs four times total.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const refresh = Console.log("refresh")

const program = refresh.pipe(
  Effect.repeat(Schedule.spaced("2 seconds").pipe(Schedule.take(3)))
)
```

Here `refresh` runs immediately. If it succeeds, Effect waits two seconds before the next iteration. The same pause is enforced before each later scheduled recurrence.

## Variants

Use a named schedule when the spacing is part of a larger workflow:

```ts
import { Console, Effect, Schedule } from "effect"

const everyTwoSeconds = Schedule.spaced("2 seconds").pipe(
  Schedule.take(5)
)

const program = Console.log("sync").pipe(
  Effect.repeat(everyTwoSeconds)
)
```

Use `Schedule.spaced(duration)` when the policy is "wait this long after each successful run." Use `Schedule.fixed(duration)` when the policy is "schedule on this periodic interval."

## Notes and caveats

The pause is not added before the first run. The schedule controls only recurrences after the first successful evaluation.

The pause happens only after success. A failure from the repeated effect stops the repeat and returns the failure.

`Schedule.spaced` is unbounded by itself. Combine it with `Schedule.take`, another stopping rule, or an enclosing lifetime when the workflow must end.

The repeated program succeeds with the schedule's final output when the schedule completes. With `Schedule.spaced`, that output is the recurrence count.
