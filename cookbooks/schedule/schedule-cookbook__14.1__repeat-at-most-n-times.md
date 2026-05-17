---
book: Effect `Schedule` Cookbook
section_number: "14.1"
section_title: "Repeat at most N times"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "14. Repeat with Limits"
status: "draft"
code_included: true
---

# 14.1 Repeat at most N times

Use this recipe when a successful effect needs a recurrence budget and the
off-by-one behavior of `Effect.repeat` should stay explicit.

## Problem

The requirement is to allow no more than `N` additional successful repetitions
after the original run.

With `Effect.repeat`, the effect runs once before the schedule is consulted.
`Schedule.recurs(n)` therefore means "after the original successful run, allow
at most `n` recurrences." If every run succeeds, the maximum total executions
are `n + 1`.

## When to use it

Use this when the repeat limit is a recurrence budget: one original run now,
followed by at most `N` more successful runs.

This is a good fit for bounded sampling, short repeated maintenance actions, or
any repeat loop where the count itself is the policy.

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

const syncOnce = Console.log("sync")

const program = syncOnce.pipe(
  Effect.repeat(Schedule.recurs(3))
)
```

Here `syncOnce` runs once immediately. If every run succeeds, the schedule
allows three more runs, for four total executions.

If the external requirement says "run at most 3 times total", subtract the
original run from the schedule limit:

```ts
import { Console, Effect, Schedule } from "effect"

const program = Console.log("sample").pipe(
  Effect.repeat(Schedule.recurs(2))
)
```

This can execute at most three times total: one original run plus two
recurrences.

## Variants

When the only policy is a repeat count and you want the final successful value
of the effect, use the `times` option:

```ts
import { Effect } from "effect"

const readSample = Effect.succeed("sample")

const finalSample = readSample.pipe(
  Effect.repeat({ times: 3 })
)
```

`times` also counts recurrences after the original run. This program can run
four times total and returns the final successful `"sample"` value.

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
