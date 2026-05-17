---
book: "Effect `Schedule` Cookbook"
section_number: "11.1"
section_title: "Repeat at most N times"
part_title: "Part III — Repeat Recipes"
chapter_title: "11. Repeat with Limits"
status: "draft"
code_included: true
---

# 11.1 Repeat at most N times

Use this when a successful effect needs a count limit and the off-by-one
behavior of `Effect.repeat` must stay explicit.

## Problem

The requirement is "run once now, then allow at most `N` more successful
recurrences."

With `Effect.repeat`, the effect runs once before the schedule is consulted.
`Schedule.recurs(n)` therefore means "after the original successful run, allow
at most `n` recurrences."

## When to use it

Use this when the repeat limit is a recurrence budget: one original run now,
followed by at most `N` more successful runs.

This fits bounded sampling, short repeated maintenance actions, and repeat
loops where the count itself is the policy.

## When not to use it

Do not use `Schedule.recurs(n)` unchanged when the requirement counts total
executions. If you want at most `N` total executions, use
`Schedule.recurs(N - 1)` for positive `N`.

Do not use repeat limits to recover from failures. `Effect.repeat` repeats only
after success; if the effect fails, repetition stops with that failure.

## Schedule shape

The count belongs to the scheduled recurrences, not to the original run:

| Requirement                               | Schedule                 |
| ----------------------------------------- | ------------------------ |
| original run only                         | `Schedule.recurs(0)`     |
| original run plus at most 1 recurrence    | `Schedule.recurs(1)`     |
| original run plus at most `N` recurrences | `Schedule.recurs(N)`     |
| at most `N` total executions, for `N > 0` | `Schedule.recurs(N - 1)` |

`Schedule.recurs(n)` outputs a zero-based recurrence count. When used directly
with `Effect.repeat`, the repeated program returns the final schedule output.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let runs = 0

const sample = Effect.gen(function*() {
  runs += 1
  yield* Console.log(`run ${runs}`)
  return runs
})

const program = Effect.gen(function*() {
  const scheduleOutput = yield* sample.pipe(
    Effect.repeat(Schedule.recurs(3))
  )

  yield* Console.log(`total executions: ${runs}`)
  yield* Console.log(`schedule output: ${scheduleOutput}`)
})

Effect.runPromise(program)
```

This can run four times total: one original run plus three scheduled
recurrences.

## Variants

When the only policy is a repeat count and you want the final successful value
of the effect, use `Effect.repeat({ times: n })`. `times` also counts
recurrences after the original run.

Use `Schedule.recurs(n)` when you want a first-class schedule value that can be
named, reused, or composed with other schedule combinators.

## Notes and caveats

`Schedule.recurs(n)` allows at most `n` recurrences. It reaches that limit only
if the original run and every repeated run succeed.

The original run is not part of the schedule count. This is the main
off-by-one point to check when translating requirements.

Passing `Schedule.recurs(n)` directly to `Effect.repeat` returns the schedule's
final output. Use `Effect.repeat({ times: n })` when the final value of the
effect is the value you want to keep.
