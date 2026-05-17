---
book: Effect `Schedule` Cookbook
section_number: "12.1"
section_title: "Repeat 5 times"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "12. Repeat a Successful Effect"
status: "draft"
code_included: true
---

# 12.1 Repeat 5 times

`Effect.repeat` repeats after success. This recipe covers count-bounded
repetition without adding timing or failure recovery.

## Problem

The count is easy to misread. With `Effect.repeat`, the effect runs once before
the schedule is consulted. `Schedule.recurs(5)` therefore means five
recurrences after the original run, for six total executions if every run
succeeds.

## When to use it

Use this when the original effect should execute immediately and a successful
result should be followed by at most five more executions.

This fits count-bounded sampling, repeating a successful maintenance action a
small number of times, or exercising a successful operation several more times
without adding timing.

## When not to use it

Do not use this when "five times" means five total executions. For five total
executions, use four recurrences: `Schedule.recurs(4)` or
`Effect.repeat({ times: 4 })`.

Do not use `Effect.repeat` to recover from failures. If the effect fails,
repeating stops and the failure is returned. Use `Effect.retry` when failure
should trigger another attempt.

## Schedule shape

`Schedule.recurs(5)` is the direct schedule shape. Read it as "after the
original successful run, allow five scheduled recurrences." The maximum execution
count is one original run plus five recurrences, for six total executions.

The schedule output is the recurrence count. When passed directly to
`Effect.repeat`, the repeated program returns the schedule's final output, not
the effect's final value.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let executions = 0

const writeMetric = Effect.gen(function*() {
  executions += 1
  yield* Console.log(`metric write ${executions}`)
  return executions
})

const program = writeMetric.pipe(
  Effect.repeat(Schedule.recurs(5)),
  Effect.tap((recurrenceCount) =>
    Console.log(`schedule output: ${recurrenceCount}; total executions: ${executions}`)
  )
)

Effect.runPromise(program)
```

Here `writeMetric` runs once immediately. If it succeeds each time,
`Schedule.recurs(5)` allows five more runs, so the effect can execute six times
total.

If you want the repeated effect's final successful value instead of the schedule
output, use the options form:

```ts
import { Console, Effect } from "effect"

let sampleNumber = 0

const readSample = Effect.gen(function*() {
  sampleNumber += 1
  yield* Console.log(`sample ${sampleNumber}`)
  return { sampleNumber }
})

const finalSample = readSample.pipe(
  Effect.repeat({ times: 4 }),
  Effect.tap((sample) => Console.log(`final sample: ${sample.sampleNumber}`))
)

Effect.runPromise(finalSample)
```

This uses four recurrences for five total executions and returns the final
successful sample.

## Variants

For five total executions, use four recurrences:

```ts
import { Console, Effect, Schedule } from "effect"

let executions = 0

const program = Effect.gen(function*() {
  executions += 1
  yield* Console.log(`execution ${executions}`)
}).pipe(
  Effect.repeat(Schedule.recurs(4)),
  Effect.tap(() => Console.log(`total executions: ${executions}`))
)

Effect.runPromise(program)
```

Use `Schedule.recurs(5)` when you care about a composable schedule value. Use
`Effect.repeat({ times: 5 })` when you need five recurrences and want the final
successful value of the effect.

## Notes and caveats

`Schedule.recurs(5)` means at most five recurrences. It reaches that count only
if the original run and all repeated runs succeed.

The original run is not delayed by the schedule. With `Schedule.recurs(5)` alone,
there is no added spacing between recurrences.

This recipe is only about a fixed recurrence count. Add timing, forever
repetition, or `while` / `until` predicates only when the repeat policy needs
those extra rules.
