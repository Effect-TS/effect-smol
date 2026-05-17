---
book: Effect `Schedule` Cookbook
section_number: "3.1"
section_title: "Repeat a fixed number of times"
part_title: "Part I — Foundations"
chapter_title: "3. Minimal Building Blocks"
status: "draft"
code_included: true
---

# 3.1 Repeat a fixed number of times

You have an effect that should run a bounded number of times, with no timing or stop
condition beyond the count. Use `Schedule.recurs(n)` when the effect should run once
immediately and then repeat at most `n` more times. This section keeps the focus on
Effect's `Schedule` model: recurrence is represented as data that decides whether
another decision point exists, which delay applies, and what output the policy
contributes. That framing makes later retry, repeat, and polling recipes easier to
compose without hiding timing behavior inside ad hoc loops.

## Problem

The repeat policy is count-only: there is no predicate, delay, or elapsed-time
window involved.

Use `Schedule.recurs(n)` when the effect should run once immediately and then
repeat at most `n` more times.

## When to use it

Use this when you need a small, fixed number of successful repetitions:

- Running a setup probe a known number of times.
- Re-executing a successful action for a fixed number of samples.
- Starting with a count-only schedule before adding spacing, delay, or backoff.

## When not to use it

Do not use this shape when the repeat should depend on the result value, an error, or elapsed time. Use predicate-based repeat options, retry policies, or time-based schedule combinators for those cases.

Also avoid it when you mean "run exactly once"; a plain effect already does that.

## Schedule shape

`Effect.repeat` runs the effect once before the schedule controls any recurrence. The schedule decides what happens after each successful run.

That means `Schedule.recurs(4)` describes four scheduled recurrences after the initial run, for five total executions.

| Desired total executions | Schedule             |
| ------------------------ | -------------------- |
| 1                        | `Schedule.recurs(0)` |
| 2                        | `Schedule.recurs(1)` |
| 5                        | `Schedule.recurs(4)` |
| 10                       | `Schedule.recurs(9)` |

The same count rule applies to `Effect.repeat({ times: n })`: `times` counts repetitions after the initial run.

## Code

```ts
import { Effect, Ref, Schedule } from "effect"

const program = Effect.gen(function*() {
  const runs = yield* Ref.make(0)

  yield* Ref.update(runs, (n) => n + 1).pipe(
    Effect.repeat(Schedule.recurs(4))
  )

  return yield* Ref.get(runs)
})

// The effect runs 5 times total:
// 1 initial run + 4 scheduled recurrences.
```

## Variants

If the only policy you need is "repeat this many more times", the equivalent shorthand is the `times` option:

```ts
import { Effect, Ref } from "effect"

const program = Effect.gen(function*() {
  const runs = yield* Ref.make(0)

  const lastValue = yield* Ref.updateAndGet(runs, (n) => n + 1).pipe(
    Effect.repeat({ times: 4 })
  )

  return lastValue
})

// lastValue is 5.
```

## Notes and caveats

When you pass a schedule directly, `Effect.repeat(effect, schedule)` returns the schedule's final output. For `Schedule.recurs(n)`, that output is the final recurrence count.

When you use `Effect.repeat({ times: n })`, the returned value is the effect's final successful value. Use the `times` option when you want the simplest fixed repeat and care about the last result of the effect; use `Schedule.recurs` when you want a schedule value you can compose with other schedule combinators.
