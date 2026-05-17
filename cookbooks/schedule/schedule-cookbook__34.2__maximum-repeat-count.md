---
book: Effect `Schedule` Cookbook
section_number: "34.2"
section_title: "Maximum repeat count"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "34. Stop After N Attempts"
status: "draft"
code_included: true
---

# 34.2 Maximum repeat count

A maximum repeat count bounds successful recurrences while the effect body stays
focused on one unit of work.

## Problem

You need to run a successful effect a bounded number of additional times without
putting counters or sleeps around the effect body. A sampler might run once
immediately and then take a few more samples. A warmup step might run once and
repeat twice. In both cases, the effect describes the work and the schedule
describes the repeat limit.

## When to use it

Use `Schedule.recurs(n)` when the policy is "repeat at most `n` more times." It
is the smallest count-based schedule, and its output is the current recurrence
count.

Use `Schedule.take(n)` when another schedule already describes the cadence and
you only want to cap how many outputs from that schedule are used. This is
common with `Schedule.spaced`, `Schedule.fixed`, or `Schedule.exponential`,
which otherwise keep recurring.

## When not to use it

Do not use repeat counts to recover from failures. `Effect.repeat` consults the
schedule after success. If the effect fails, the repeat stops with that failure.
Use `Effect.retry` for failure-driven recurrence.

Avoid counted repeats when the domain has a clearer terminal condition. If a
polling response says `"ready"` or `"done"`, prefer `until` or `while`, with a
count limit only as a guardrail.

## Schedule shape

`Schedule.recurs(n)` can be stepped `n` times before it terminates. With
`Effect.repeat`, that means one initial execution plus up to `n` additional
executions.

When you pass a raw schedule to `Effect.repeat`, the returned effect succeeds
with the schedule's final output. If callers need the last successful value
instead, use the options form of `Effect.repeat`.

## Code

```ts
import { Console, Effect, Ref, Schedule } from "effect"

const writeHeartbeat = Effect.fnUntraced(function*(
  counter: Ref.Ref<number>
) {
  const count = yield* Ref.updateAndGet(counter, (n) => n + 1)
  yield* Console.log(`heartbeat ${count}`)
  return count
})

const program = Effect.gen(function*() {
  const counter = yield* Ref.make(0)
  const finalScheduleOutput = yield* writeHeartbeat(counter).pipe(
    Effect.repeat(Schedule.recurs(3))
  )
  yield* Console.log(`schedule output: ${finalScheduleOutput}`)
})

Effect.runPromise(program)
```

The effect runs once immediately and then repeats three more times. The final
logged value is the schedule output, not the last heartbeat value.

## Variants

Use `Schedule.recurs(0)` when the effect should run once and not repeat. This is
useful when a configured count of zero means "disable additional runs."

Use `Schedule.spaced(duration).pipe(Schedule.take(n))` when operators need both
a maximum repeat count and a predictable delay.

Use `Schedule.exponential(base).pipe(Schedule.take(n))` when successful work
should become less frequent over time, such as checking a non-urgent condition
after an initial success.

## Notes and caveats

The count is a repeat count, not a total execution count. `Schedule.recurs(3)`
allows the initial execution plus three scheduled recurrences.

`Schedule.recurs` and `Schedule.take` both use the schedule attempt count to
decide when to stop. The distinction is what they preserve: `recurs` is itself a
counting schedule, while `take` keeps another schedule's delay and output and
only adds a cap.

Successful values are schedule inputs. That matters if you add `Schedule.while`,
`Schedule.tapInput`, or `Schedule.passthrough`: those combinators observe the
successful result, not failures.
