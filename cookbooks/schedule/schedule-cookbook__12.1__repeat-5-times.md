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

You have a successful effect and want to run it again five times. With `Effect.repeat`,
the effect runs once before the schedule is consulted. A schedule such as
`Schedule.recurs(5)` therefore means five recurrences after the original run, for six
total executions if every run succeeds. This recipe treats repetition as a policy for
successful effects. The schedule decides whether another successful iteration should
run, what spacing applies, and what value the repeat returns. Failures stay in the
effect error channel, so the repeat policy stays separate from recovery or retry
behavior.

## Problem

You have a successful effect and want to run it again five times.

With `Effect.repeat`, the effect runs once before the schedule is consulted. A schedule such as `Schedule.recurs(5)` therefore means five recurrences after the original run, for six total executions if every run succeeds.

## When to use it

Use this when the original effect should execute immediately and a successful result should be followed by at most five more executions.

This is a good fit for count-bounded sampling, repeating a successful maintenance action a small number of times, or exercising a successful operation several more times without adding timing.

## When not to use it

Do not use this when "five times" means five total executions. For five total executions, use four recurrences: `Schedule.recurs(4)` or `Effect.repeat({ times: 4 })`.

Do not use `Effect.repeat` to recover from failures. If the effect fails, repeating stops and the failure is returned. Use `Effect.retry` when failure should trigger another attempt.

## Schedule shape

`Schedule.recurs(5)` is the direct schedule shape. Read it as "after the original successful run, allow five scheduled recurrences." The maximum execution count is one original run plus five recurrences, for six total executions.

The schedule output is the recurrence count. When passed directly to `Effect.repeat`, the repeated program returns the schedule's final output, not the effect's final value.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

const writeMetric = Console.log("metric written")

const program = writeMetric.pipe(
  Effect.repeat(Schedule.recurs(5))
)
```

Here `writeMetric` runs once immediately. If it succeeds each time, `Schedule.recurs(5)` allows five more runs, so the effect can execute six times total.

If you want the repeated effect's final successful value instead of the schedule output, use the options form:

```ts
import { Effect } from "effect"

const readSample = Effect.succeed({ ok: true })

const finalSample = readSample.pipe(
  Effect.repeat({ times: 5 })
)
```

This has the same recurrence count: one original run plus five repeats.

## Variants

For five total executions, use four recurrences:

```ts
import { Console, Effect, Schedule } from "effect"

const program = Console.log("sample").pipe(
  Effect.repeat(Schedule.recurs(4))
)
```

Use `Schedule.recurs(5)` when you care about a composable schedule value. Use `Effect.repeat({ times: 5 })` when you only need a count-bound repeat and want the final successful value of the effect.

## Notes and caveats

`Schedule.recurs(5)` means at most five recurrences. It reaches that count only if the original run and all repeated runs succeed.

The original run is not delayed by the schedule. With `Schedule.recurs(5)` alone, there is no added spacing between recurrences.

This recipe is only about a fixed recurrence count. Add timing, forever repetition, or `while` / `until` predicates only when the repeat policy needs those extra rules.
