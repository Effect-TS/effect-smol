---
book: "Effect `Schedule` Cookbook"
section_number: "3.4"
section_title: "Stop after a limit"
part_title: "Part I — Foundations"
chapter_title: "3. Minimal Building Blocks"
status: "draft"
code_included: true
---

# 3.4 Stop after a limit

Use a limit whenever a recurrence policy must not continue forever. The limit
can be the whole policy, or it can cap another policy such as spacing or
backoff.

## Problem

The recurrence needs a clear stopping rule.

The common building blocks are:

- `Schedule.recurs(n)` for a count-only limit.
- `Schedule.take(n)` for limiting another schedule.
- `Schedule.during(duration)` for an elapsed recurrence window.

Each limit controls recurrences after the initial execution.

## When to use it

Use a limit for retry budgets, finite sampling, bounded tests, and caps on
otherwise unbounded schedules such as `Schedule.spaced("1 second")`.

Use `Schedule.recurs(n)` when the count is the policy. Use
`schedule.pipe(Schedule.take(n))` when another schedule already describes the
delay or output and only needs a cap.

## When not to use it

Do not use a schedule limit for value-based stopping. If a successful value
decides whether to continue, use `Effect.repeat` with `until` or `while`. If a
typed failure decides whether to retry, use `Effect.retry` with `until` or
`while`.

Do not use `Schedule.during` as a timeout for a single slow run. A schedule is
consulted between runs; it does not interrupt an effect that is already running.

## Schedule shape

`Effect.repeat` and `Effect.retry` run once before stepping the schedule:

| Limit                             | Meaning after the first run            |
| --------------------------------- | -------------------------------------- |
| `Schedule.recurs(0)`              | No additional recurrences              |
| `Schedule.recurs(3)`              | At most three additional recurrences   |
| `schedule.pipe(Schedule.take(3))` | At most three outputs from `schedule`  |
| `Schedule.during("30 seconds")`   | Recur while the elapsed window is open |

For retry, "three additional recurrences" means up to three retries. For
repeat, it means up to three additional successful executions.

## Code

```ts
import { Console, Effect, Ref, Schedule } from "effect"

const countOnly = Effect.gen(function*() {
  const runs = yield* Ref.make(0)

  yield* Ref.updateAndGet(runs, (n) => n + 1).pipe(
    Effect.tap((run) => Console.log(`count-only run ${run}`)),
    Effect.repeat(Schedule.recurs(2))
  )

  return yield* Ref.get(runs)
})

const spacedAndLimited = Effect.gen(function*() {
  const runs = yield* Ref.make(0)

  yield* Ref.updateAndGet(runs, (n) => n + 1).pipe(
    Effect.tap((run) => Console.log(`spaced run ${run}`)),
    Effect.repeat(Schedule.spaced("20 millis").pipe(Schedule.take(2)))
  )

  return yield* Ref.get(runs)
})

const program = Effect.gen(function*() {
  const countTotal = yield* countOnly
  const spacedTotal = yield* spacedAndLimited

  yield* Console.log(`count-only total: ${countTotal}`)
  yield* Console.log(`spaced total: ${spacedTotal}`)
})

Effect.runPromise(program)
```

Both policies allow two recurrences after the first run, so both examples run
three times total.

## Time window

Use `Schedule.during` for a best-effort elapsed window, usually with spacing so
the loop does not spin.

```ts
import { Console, Effect, Ref, Schedule } from "effect"

const program = Effect.gen(function*() {
  const runs = yield* Ref.make(0)

  yield* Ref.updateAndGet(runs, (n) => n + 1).pipe(
    Effect.tap((run) => Console.log(`windowed run ${run}`)),
    Effect.repeat(
      Schedule.spaced("10 millis").pipe(
        Schedule.both(Schedule.during("30 millis"))
      )
    )
  )

  const total = yield* Ref.get(runs)
  yield* Console.log(`windowed total: ${total}`)
})

Effect.runPromise(program)
```

The window is checked at recurrence boundaries. It is not a deadline for the
body of the effect.

## Notes

The off-by-one rule is the main caveat: external requirements often count total
executions, but schedule limits count recurrences after the first execution. If
a requirement says "try three times total", use a limit of `2`.
