---
book: Effect `Schedule` Cookbook
section_number: "2.4"
section_title: "Common beginner mistakes"
part_title: "Part I — Foundations"
chapter_title: "2. `repeat` vs `retry`"
status: "draft"
code_included: true
---

# 2.4 Common beginner mistakes

Most early mistakes come from mixing three separate things: the success channel,
the error channel, and the schedule output.

## Problem

`Effect.repeat` schedules successes. `Effect.retry` schedules typed failures.
Count-based policies count recurrences after the first execution. The raw
schedule overload of `Effect.repeat` returns the schedule output, not the effect
value.

Those rules are small, but confusing them changes behavior and types.

## Mistakes to avoid

| Mistake                                             | Consequence                                      |
| --------------------------------------------------- | ------------------------------------------------ |
| Using `repeat` to recover from failure              | The first failure is returned immediately.       |
| Using `retry` for a successful polling state        | The first success ends the retry.                |
| Counting `times` as total executions                | The effect may run one more time than expected.  |
| Expecting raw `repeat(schedule)` to return the value | It returns the schedule output.                  |
| Putting predicates on the wrong operator            | The predicate inspects the wrong channel.        |
| Forgetting a schedule is unbounded                  | The loop runs until failure or interruption.     |

## Code

This small program shows three of the common surprises:

```ts
import { Console, Effect, Schedule } from "effect"

const program = Effect.gen(function*() {
  let repeatRuns = 0

  const lastValue = yield* Effect.sync(() => {
    repeatRuns += 1
    return `repeat run ${repeatRuns}`
  }).pipe(
    Effect.repeat({ times: 2 })
  )

  yield* Console.log(
    `repeat ran ${repeatRuns} times and returned "${lastValue}"`
  )

  let retryAttempts = 0

  const retryExit = yield* Effect.failSync(() => {
    retryAttempts += 1
    return "temporary"
  }).pipe(
    Effect.retry({ times: 2 }),
    Effect.exit
  )

  yield* Console.log(
    `retry attempted ${retryAttempts} times and ended with ${retryExit._tag}`
  )

  const rawScheduleOutput = yield* Effect.succeed("done").pipe(
    Effect.repeat(Schedule.recurs(2))
  )

  yield* Console.log(
    `raw schedule repeat returned ${rawScheduleOutput}`
  )

  const repeatExit = yield* Effect.fail("temporary").pipe(
    Effect.repeat(Schedule.recurs(2)),
    Effect.exit
  )

  yield* Console.log(
    `repeat over failure ended with ${repeatExit._tag}`
  )
})

Effect.runPromise(program)
```

`times: 2` allows two recurrences after the initial run. The retry example also
attempts three executions total. The raw schedule repeat returns the final
`Schedule.recurs` output.

## Predicate placement

Predicates in `repeat` options inspect successful values:
`Effect.repeat({ until: (value) => ... })`.

Predicates in `retry` options inspect typed failures:
`Effect.retry({ while: (error) => ... })`.

Use `until` when the predicate describes the stopping condition. Use `while`
when it describes the condition for continuing.

## Practical guidance

Use this checklist before choosing the operator:

| If you mean...                                 | Prefer...                                                   |
| ---------------------------------------------- | ----------------------------------------------------------- |
| Try again after a typed failure                | `Effect.retry`                                              |
| Run again after a success                      | `Effect.repeat`                                             |
| Keep the last successful value from repetition | `Effect.repeat({ times })` or `Effect.repeat({ schedule })` |
| Use the schedule's output as the result        | `Effect.repeat(schedule)`                                   |
| Limit a retry or repeat to `n` more runs       | `Schedule.recurs(n)` or `{ times: n }`                      |

For an external requirement like "try three times total", subtract the initial
run from the recurrence count. That means `times: 2` or `Schedule.recurs(2)`.
