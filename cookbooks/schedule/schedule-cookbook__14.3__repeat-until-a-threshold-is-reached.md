---
book: Effect `Schedule` Cookbook
section_number: "14.3"
section_title: "Repeat until a threshold is reached"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "14. Repeat with Limits"
status: "draft"
code_included: true
---

# 14.3 Repeat until a threshold is reached

Use this recipe when the successful output of each run decides whether repetition
should continue.

## Problem

A progress read, backlog sample, score refresh, or other domain check returns a
successful value that can be compared with a threshold.

With `Effect.repeat`, the effect runs once before the schedule is consulted.
After each successful run, the successful output becomes the schedule input.
That is the value a `Schedule.while` predicate inspects when it decides whether
another recurrence is allowed.

## When to use it

Use this when the repeated operation succeeds before the whole workflow is done,
and the successful output tells you how close the workflow is to completion.

Typical examples include sampling progress until it reaches `100`, processing
batches until the backlog falls below a target, or refreshing a score until it
is at least a required minimum.

## When not to use it

Do not use this to retry failures. If the effect fails, `Effect.repeat` stops
with that failure before the schedule predicate can inspect anything.

Do not use this when the threshold is not visible in the successful output. In
that case, make the effect return the domain measurement you need, or move the
decision into the effect itself.

Do not use an unbounded threshold loop unless the threshold is guaranteed by the
surrounding workflow or the fiber has a clear lifetime owner.

## Schedule shape

Make the successful output the schedule input, then continue while the latest
successful output is still below the threshold:

```ts
Schedule.identity<Progress>().pipe(
  Schedule.while(({ input }) => input.percent < 100)
)
```

`Schedule.while` receives schedule metadata after a successful run. Returning
`true` allows another recurrence. Returning `false` stops the repeat.

The predicate above therefore means "repeat while the latest successful
`Progress` value is still below `100`." When a successful run returns
`percent >= 100`, the repeat stops.

## Code

```ts
import { Effect, Schedule } from "effect"

interface Progress {
  readonly percent: number
}

declare const readProgress: Effect.Effect<Progress>

const untilComplete = Schedule.identity<Progress>().pipe(
  Schedule.while(({ input }) => input.percent < 100)
)

const finalProgress = readProgress.pipe(
  Effect.repeat(untilComplete)
)
```

`readProgress` runs once immediately. If it succeeds with `percent >= 100`, no
recurrence is scheduled. If it succeeds with `percent < 100`, the schedule
allows another run.

Because the schedule is `Schedule.identity<Progress>()`, the repeated program
succeeds with the final successful `Progress` value that stopped the loop.

## Variants

Add a recurrence limit or a pause when the threshold may take time to appear:

```ts
import { Effect, Schedule } from "effect"

interface Progress {
  readonly percent: number
}

declare const readProgress: Effect.Effect<Progress>

const untilCompleteOrTwentyRecurrences = Schedule.spaced("500 millis").pipe(
  Schedule.satisfiesInputType<Progress>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.percent < 100),
  Schedule.bothLeft(
    Schedule.recurs(20).pipe(Schedule.satisfiesInputType<Progress>())
  )
)

const finalProgress = readProgress.pipe(
  Effect.repeat(untilCompleteOrTwentyRecurrences)
)
```

`Schedule.spaced("500 millis")` controls the delay between successful runs.
`Schedule.satisfiesInputType<Progress>()` is applied before reading
`metadata.input`, because the base timing and count schedules are not
constructed from `Progress` values. `Schedule.passthrough` keeps the latest
successful `Progress` as the schedule output.

The repeat stops when either a successful output reaches `percent >= 100` or
twenty scheduled recurrences have been allowed.

## Notes and caveats

The threshold predicate inspects only successful outputs, after each successful
run. It does not see failures.

The first run is not delayed by the schedule. Delays apply only before later
recurrences.

Use `<` for "repeat while below the threshold" and `<=` when the threshold must
be strictly exceeded. Make the boundary explicit in the predicate.

When composing a count or timing schedule with `Schedule.while`, constrain the
input type with `Schedule.satisfiesInputType<T>()` before reading
`metadata.input`.
