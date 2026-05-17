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

Use `Schedule.recurs(n)` when a successful effect should run once now and then
repeat at most `n` more times. The schedule is the recurrence policy; the effect
itself is still executed by `Effect.repeat`.

## Problem

You need a count-only repeat: no delay, predicate, or elapsed-time window.

## When to use it

Use this for small, bounded successful repeats:

- Running a setup probe a known number of times.
- Taking a fixed number of samples.
- Starting with a count limit before adding spacing or backoff.

Do not use it when the next run depends on the previous value. In that case,
use `Effect.repeat` options such as `until` or `while`.

## Schedule shape

`Effect.repeat` runs the effect once before the schedule is stepped. Therefore
`Schedule.recurs(4)` means four recurrences after the first run, for five total
executions.

| Desired total executions | Policy               |
| ------------------------ | -------------------- |
| 1                        | `Schedule.recurs(0)` |
| 2                        | `Schedule.recurs(1)` |
| 5                        | `Schedule.recurs(4)` |

The `times` option follows the same rule: `Effect.repeat({ times: 4 })` also
means one initial run plus four repeats.

## Code

```ts
import { Console, Effect, Ref, Schedule } from "effect"

const program = Effect.gen(function*() {
  const runs = yield* Ref.make(0)

  yield* Ref.updateAndGet(runs, (n) => n + 1).pipe(
    Effect.tap((run) => Console.log(`run ${run}`)),
    Effect.repeat(Schedule.recurs(4))
  )

  const total = yield* Ref.get(runs)
  yield* Console.log(`total runs: ${total}`)
})

Effect.runPromise(program)
```

This prints five runs: the first execution plus four scheduled recurrences.

## Variant

Use `times` when you only need a local fixed repeat and want the final effect
value back:

```ts
import { Console, Effect, Ref } from "effect"

const program = Effect.gen(function*() {
  const runs = yield* Ref.make(0)

  const lastValue = yield* Ref.updateAndGet(runs, (n) => n + 1).pipe(
    Effect.tap((run) => Console.log(`run ${run}`)),
    Effect.repeat({ times: 4 })
  )

  yield* Console.log(`last value: ${lastValue}`)
})

Effect.runPromise(program)
```

With a schedule, `Effect.repeat` succeeds with the schedule output. With
`times`, it succeeds with the last successful value produced by the repeated
effect.

## Notes

The main mistake is counting total executions instead of recurrences. If a
requirement says "run five times total", use `Schedule.recurs(4)` or
`times: 4`.
