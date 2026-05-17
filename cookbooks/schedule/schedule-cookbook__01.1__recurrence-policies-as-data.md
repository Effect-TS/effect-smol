---
book: "Effect `Schedule` Cookbook"
section_number: "1.1"
section_title: "Recurrence policies as data"
part_title: "Part I — Foundations"
chapter_title: "1. What a `Schedule` Really Represents"
status: "draft"
code_included: true
---

# 1.1 Recurrence policies as data

A `Schedule` is a recurrence policy represented as a value. It describes when
another decision point is allowed, how long to wait before it, and what output
the policy emits. It does not perform the work being retried, repeated, or
polled.

## Problem

Recurrence rules are easy to hide in loops, callbacks, and scattered sleeps.
That makes them hard to reuse and hard to review. A schedule keeps those rules
separate from the effect that performs the work.

The work answers "what should happen now?" The schedule answers "should there be
another opportunity, when should it happen, and what did the policy report?"

## Model

At the type level, a schedule has the shape
`Schedule.Schedule<Output, Input, Error, Env>`.

Read them from the policy's point of view:

- `Output` is the value emitted by the schedule, such as a count, duration, or
  label.
- `Input` is the value fed to the schedule by the driver.
- `Error` is an error raised by schedule logic itself.
- `Env` is any Effect context required by the schedule.

Most common schedules are simpler than the full type suggests.
`Schedule.recurs(3)`, `Schedule.spaced("1 second")`, and `Schedule.forever`
ignore their input and output counts. Backoff schedules such as
`Schedule.exponential("100 millis")` output durations.

Because a schedule is a value, you can name it, pass it around, transform it,
and compose it before any recurrence happens.

## Example

This example defines two policies first, then attaches them to effects:

```ts
import { Console, Effect, Schedule } from "effect"

const retryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

const refreshPolicy = Schedule.spaced("10 millis").pipe(
  Schedule.take(2)
)

let attempts = 0

const flakyRequest = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`request attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail("temporary outage")
  }

  return "response"
})

const refresh = Console.log("refresh cache")

const program = Effect.gen(function*() {
  const response = yield* flakyRequest.pipe(
    Effect.retry(retryPolicy)
  )
  yield* Console.log(`retry result: ${response}`)

  const refreshOutput = yield* refresh.pipe(
    Effect.repeat(refreshPolicy)
  )
  yield* Console.log(`refresh schedule output: ${refreshOutput}`)
})

Effect.runPromise(program)
```

## Common mistakes

A schedule value is not a plain JSON object. Some schedules carry internal step
state while they are being driven. The useful point is that the policy is
first-class: it can be named, reviewed, reused, and combined before a driver such
as `Effect.retry` or `Effect.repeat` runs it.

Other common mistakes are:

- putting timing and stopping rules in the effect body when they belong in the
  schedule;
- treating schedule output as the business result of the repeated or retried
  effect;
- assuming a schedule is only a sleep, when schedules can count, inspect inputs,
  emit durations, transform outputs, and compose with other policies.

## Practical guidance

Name the recurrence policy before attaching it to work. Start with the smallest
pieces, such as a cadence and a limit, then compose them.

When reading schedule code, ask:

- What recurrence policy am I declaring?
- What does the policy output?
- What input does the policy need to observe?
- Which constraints should be composed instead of embedded in the effect body?

If the answer is mostly about timing, counting, stopping, or observing recurrence
inputs, it belongs in a `Schedule`. If the answer is about the business action,
keep it in the effect that the schedule drives.
