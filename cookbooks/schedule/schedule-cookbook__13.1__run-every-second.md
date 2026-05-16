---
book: Effect `Schedule` Cookbook
section_number: "13.1"
section_title: "Run every second"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "13. Repeat Periodically"
status: "draft"
code_included: true
---

# 13.1 Run every second

You have a successful effect that should keep running on a one-second cadence. For
example, you may want a small health check, heartbeat, sampler, or local maintenance
action to run immediately and then recur every second while the surrounding fiber is
alive. This recipe treats repetition as a policy for successful effects. The schedule
decides whether another successful iteration should run, what spacing applies, and what
value the repeat returns. Failures stay in the effect error channel, so the repeat
policy stays separate from recovery or retry behavior.

## Problem

You have a successful effect that should keep running on a one-second cadence.

For example, you may want a small health check, heartbeat, sampler, or local maintenance action to run immediately and then recur every second while the surrounding fiber is alive.

## When to use it

Use `Schedule.fixed("1 second")` when the one-second period is the important part of the policy.

This is the usual shape for periodic work where each run should be scheduled against a fixed interval. The first run happens immediately, and later runs are placed on the one-second cadence as closely as possible.

## When not to use it

Do not use this to retry failures. `Effect.repeat` repeats after success; if the effect fails, repetition stops with that failure. Use `Effect.retry` when failure should trigger another attempt.

Do not use this when you only need a one-second pause after each successful run. That is `Schedule.spaced("1 second")`, which waits one second after the previous run completes.

Do not leave a one-second repeat unbounded unless the repeated work belongs to a long-lived process, supervised fiber, or explicit lifetime.

## Schedule shape

The central shape is `Schedule.fixed("1 second")`.

With `Effect.repeat`, the effect runs once before the schedule is consulted. After a successful run, `Schedule.fixed("1 second")` schedules each recurrence on a fixed one-second interval.

If a run takes less than a second, the next recurrence waits until the next interval. If a run takes longer than the interval, later runs do not pile up; the next recurrence may run immediately to continue from the current time.

This is different from `Schedule.spaced("1 second")`, which waits one full second after each successful run completes. With `spaced`, the time spent doing the work is added before the next run starts.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const heartbeat = Console.log("heartbeat")

const program = heartbeat.pipe(
  Effect.repeat(Schedule.fixed("1 second"))
)
```

Here `heartbeat` runs immediately. If it succeeds, the schedule keeps recurring on a fixed one-second interval.

For an example that stops after a few recurrences:

```ts
import { Console, Effect, Schedule } from "effect"

const pollStatus = Console.log("polling status")

const program = pollStatus.pipe(
  Effect.repeat(Schedule.fixed("1 second").pipe(Schedule.take(5)))
)
```

This allows five scheduled recurrences after the original successful run. If every run succeeds, the effect runs six times total.

## Variants

Use `Schedule.spaced("1 second")` when the requirement is a one-second pause after each successful run:

```ts
import { Console, Effect, Schedule } from "effect"

const program = Console.log("tick").pipe(
  Effect.repeat(Schedule.spaced("1 second"))
)
```

Choose `fixed` for a periodic cadence. Choose `spaced` for a delay between completed runs.

## Notes and caveats

The first execution is not delayed. `Effect.repeat` evaluates the effect once immediately, then uses the schedule for later recurrences.

The repeat is success-driven. A failure from the repeated effect stops the loop and returns the failure.

`Schedule.fixed("1 second")` is unbounded by itself. Combine it with `Schedule.take`, another stopping rule, or an enclosing fiber lifetime when the repeated process must end.

The repeated program succeeds with the schedule's final output when the schedule ends. With these schedules, that output is the recurrence count.
