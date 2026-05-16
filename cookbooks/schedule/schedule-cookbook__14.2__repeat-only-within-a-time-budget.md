---
book: Effect `Schedule` Cookbook
section_number: "14.2"
section_title: "Repeat only within a time budget"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "14. Repeat with Limits"
status: "draft"
code_included: true
---

# 14.2 Repeat only within a time budget

You have an effect that should run immediately, then keep repeating after successful
runs only while an elapsed time budget is still open. For example, a worker may poll for
a short warm-up window, refresh a cache briefly after a trigger, or sample a successful
operation for at most a few seconds. This recipe treats repetition as a policy for
successful effects. The schedule decides whether another successful iteration should
run, what spacing applies, and what value the repeat returns. Failures stay in the
effect error channel, so the repeat policy stays separate from recovery or retry
behavior.

## Problem

You have an effect that should run immediately, then keep repeating after successful runs only while an elapsed time budget is still open.

For example, a worker may poll for a short warm-up window, refresh a cache briefly after a trigger, or sample a successful operation for at most a few seconds.

## When to use it

Use this when the limit is naturally expressed as elapsed schedule time: "repeat for up to 10 seconds" or "keep checking during this 1 minute window."

This is a good fit when each successful run should allow another recurrence, but the repeat loop should not remain open forever.

## When not to use it

Do not use this when you need to retry failures. `Effect.repeat` repeats after success; if the effect fails, repetition stops with that failure. Use `Effect.retry` for failure-driven attempts.

Do not use a schedule budget as a hard timeout for an in-flight run. The schedule is consulted at recurrence decision points after successful runs. If one run takes longer than the budget, the schedule does not interrupt that run by itself.

Do not use this when you need a fixed number of successful recurrences. Use `Schedule.recurs(n)` for a count limit, or combine a count limit with the time budget when both constraints matter.

## Schedule shape

The central shape is a repeat cadence combined with `Schedule.during(duration)`:

```ts
Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("10 seconds"))
)
```

`Schedule.spaced("1 second")` chooses the delay between successful recurrences. `Schedule.during("10 seconds")` tracks elapsed schedule time and stops allowing recurrences once that budget is no longer open.

`Schedule.both` requires both schedules to continue. The repeat continues only while the cadence schedule and the elapsed budget schedule both allow another recurrence.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const pollOnce = Console.log("polling")

const repeatWithinBudget = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("10 seconds"))
)

const program = pollOnce.pipe(
  Effect.repeat(repeatWithinBudget)
)
```

Here `pollOnce` runs once immediately. After each successful run, the schedule decides whether another recurrence is still inside the 10 second budget and, if so, waits one second before running again.

The returned effect succeeds with the schedule output. In this example, the output is a tuple containing the `Schedule.spaced` output and the `Schedule.during` elapsed duration.

## Variants

Add a count cap when the repeat should stop at whichever limit is reached first:

```ts
import { Schedule } from "effect"

const repeatWithinBudgetAndCount = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("10 seconds")),
  Schedule.both(Schedule.recurs(20))
)
```

This keeps the time budget as the main limit while preventing an unexpectedly large number of fast successful recurrences.

If each individual run also needs a hard duration limit, apply a timeout to the repeated effect itself:

```ts
import { Console, Effect, Schedule } from "effect"

const pollOnce = Console.log("polling").pipe(
  Effect.timeout("500 millis")
)

const program = pollOnce.pipe(
  Effect.repeat(
    Schedule.spaced("1 second").pipe(
      Schedule.both(Schedule.during("10 seconds"))
    )
  )
)
```

The timeout limits each in-flight run. The schedule budget still limits only the recurrence window after successful runs.

## Notes and caveats

The first run is not delayed by the schedule. `Effect.repeat(schedule)` evaluates the effect once, then uses the schedule for later successful recurrences.

`Schedule.during(duration)` is useful as a stopping condition, but by itself it does not add a practical pause. Combine it with a cadence such as `Schedule.spaced`, `Schedule.fixed`, or another delay-producing schedule.

The elapsed budget is checked between successful runs. It governs whether another recurrence should be scheduled; it is not a substitute for `Effect.timeout` when a single run must be interrupted after a duration.

Because `Schedule.both` combines outputs, the resulting schedule output is structured. If callers do not need that output, keep it internal to the repeated workflow or map it in a later recipe focused on outputs.
