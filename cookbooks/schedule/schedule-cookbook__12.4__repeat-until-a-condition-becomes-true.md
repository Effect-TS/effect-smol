---
book: Effect `Schedule` Cookbook
section_number: "12.4"
section_title: "Repeat until a condition becomes true"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "12. Repeat a Successful Effect"
status: "draft"
code_included: true
---

# 12.4 Repeat until a condition becomes true

`Effect.repeat` can keep running successful work until the latest successful value
satisfies a condition. This recipe focuses on using that value as the schedule input.

## Problem

The condition is checked after each successful run, because the first run
happens before the schedule is consulted. When the condition is already true
after the first run, there are no recurrences.

## When to use it

Use this when success is not enough by itself; the successful value must also indicate that the repeated work is complete.

This is useful for short repeat loops such as reading a local status value, advancing a small workflow step, or sampling a value until it reaches a desired state.

## When not to use it

Do not use this to retry failures. If the effect fails, `Effect.repeat` stops and returns that failure. Use `Effect.retry` when failure should trigger another attempt.

Do not use this as a full polling recipe for external systems with budgets, observability, and terminal-state handling. Those concerns usually need additional schedules, limits, and domain-specific result handling.

Do not leave the repeat unbounded unless the condition is guaranteed by the surrounding workflow or the fiber has a clear owner that can interrupt it.

## Schedule shape

Use a schedule whose input is the effect's successful output, then continue while the condition is not yet true:

```ts
Schedule.identity<Result>().pipe(
  Schedule.while(({ input }) => !isDone(input))
)
```

`Schedule.identity<Result>()` makes the successful output central: each successful `Result` becomes both the schedule input and output. `Schedule.while` receives schedule metadata after a successful run. Returning `true` allows another recurrence; returning `false` stops the repeat.

Because the predicate is `!isDone(input)`, the repeat continues while the latest successful value is not done and stops as soon as a successful value is done.

## Code

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly state: "running"; readonly progress: number }
  | { readonly state: "ready"; readonly resultId: string }

declare const checkJob: Effect.Effect<JobStatus>

const untilReady = Schedule.identity<JobStatus>().pipe(
  Schedule.while(({ input }) => input.state !== "ready")
)

const finalStatus = checkJob.pipe(
  Effect.repeat(untilReady)
)
```

`checkJob` runs once immediately. If it succeeds with `{ state: "ready", ... }`, the schedule stops and `finalStatus` succeeds with that ready status. If it succeeds with `{ state: "running", ... }`, the schedule allows another recurrence.

The returned value is the schedule's final output. With `Schedule.identity<JobStatus>()`, that output is the successful `JobStatus` that made the condition false.

## Variants

Add spacing when the next recurrence should wait after each non-terminal success:

```ts
import { Effect, Schedule } from "effect"

declare const checkJob: Effect.Effect<JobStatus>

const untilReadyWithPause = Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state !== "ready")
)

const finalStatus = checkJob.pipe(
  Effect.repeat(untilReadyWithPause)
)
```

`Schedule.spaced("1 second")` supplies the pause. `Schedule.satisfiesInputType<JobStatus>()` tells TypeScript that the schedule will be stepped with successful `JobStatus` values. `Schedule.passthrough` keeps that `JobStatus` as the schedule output, so the repeated effect still returns the final status rather than the recurrence count.

If you do not need to keep the final successful value as the schedule output, you can omit `Schedule.identity` or `Schedule.passthrough`. When a direct count or timing schedule has `unknown` input and the predicate reads the successful output, constrain the input first with `Schedule.satisfiesInputType<JobStatus>()`, then use `Schedule.while`.

## Notes and caveats

The condition is checked only after a successful run. A failure from the effect does not reach the schedule predicate; it stops the repeat immediately.

This is "repeat until success output is good enough," not "retry until success." The repeated effect must succeed for the condition to be inspected.

The first run is not delayed by the schedule. Any spacing applies only before later recurrences.

Without a limit or external interruption, a condition that never becomes true can repeat forever. Add a recurrence limit, time budget, or owning fiber lifetime when that is not acceptable.
