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
That is the value `Schedule.while` inspects when it decides whether another
recurrence is allowed.

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

Make the successful output the schedule input, preserve it as the schedule
output, then continue while it is still below the threshold.

`Schedule.while` receives schedule metadata after a successful run. Returning
`true` allows another recurrence. Returning `false` stops the repeat.

The predicate above therefore means "repeat while the latest successful
`Progress` value is still below `100`." When a successful run returns
`percent >= 100`, the repeat stops.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

interface Progress {
  readonly percent: number
}

let percent = 0

const readProgress = Effect.gen(function*() {
  percent = Math.min(percent + 40, 100)
  yield* Console.log(`progress: ${percent}%`)
  return { percent }
})

const untilComplete = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<Progress>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.percent < 100)
)

const program = Effect.gen(function*() {
  const finalProgress = yield* readProgress.pipe(
    Effect.repeat(untilComplete)
  )

  yield* Console.log(`final progress: ${finalProgress.percent}%`)
})

Effect.runPromise(program)
```

`readProgress` runs once immediately. If it succeeds with `percent >= 100`, no
recurrence is scheduled. If it succeeds with `percent < 100`, the schedule
allows another run.

Because the schedule uses `Schedule.passthrough`, the repeated program succeeds
with the final successful `Progress` value that stopped the loop.

## Variants

Add a recurrence limit or a pause when the threshold may take time to appear:

Use the same threshold schedule, then compose it with
`Schedule.bothLeft(Schedule.recurs(20).pipe(Schedule.satisfiesInputType<Progress>()))`.

The repeat then stops when either a successful output reaches `percent >= 100`
or twenty scheduled recurrences have been allowed.

## Notes and caveats

The threshold predicate inspects only successful outputs, after each successful
run. It does not see failures.

The first run is not delayed by the schedule. Delays apply only before later
recurrences.

Use `<` for "repeat while below the threshold" and `<=` when the threshold must
be strictly exceeded. Make the boundary explicit in the predicate.

When composing a timing or count schedule with `Schedule.while`, constrain the
input type with `Schedule.satisfiesInputType<T>()` before reading
`metadata.input`, then use `Schedule.passthrough` when callers need the final
successful value.
