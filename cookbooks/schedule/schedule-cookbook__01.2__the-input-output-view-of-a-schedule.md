---
book: "Effect `Schedule` Cookbook"
section_number: "1.2"
section_title: "The input/output view of a schedule"
part_title: "Part I — Foundations"
chapter_title: "1. What a `Schedule` Really Represents"
status: "draft"
code_included: true
---

# 1.2 The input/output view of a schedule

A schedule is easier to read when you separate the value it observes from the
value it emits. In `Schedule.Schedule<Output, Input, Error, Env>`, `Input` is
what the driver feeds to the policy, and `Output` is what the policy reports.

## Problem

Developers often read a schedule only as a delay. That loses an important part
of the model: schedules can inspect inputs and publish outputs. The input is not
the constructor argument in `Schedule.spaced("1 second")`; it is the value passed
to the schedule each time it is stepped.

## Model

For cookbook usage, read the first two type parameters first:

| Type     | Meaning                                                               |
| -------- | --------------------------------------------------------------------- |
| `Input`  | The value supplied to the schedule at each decision point.            |
| `Output` | The value emitted by the schedule when it continues or completes.     |

`Effect.retry` feeds typed failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. A schedule that ignores input can usually
be used with either entry point. A schedule that inspects input must match the
channel selected by the driver.

Common constructor outputs are also worth knowing:

| Schedule                                           | Common output       |
| -------------------------------------------------- | ------------------- |
| `Schedule.recurs`, `Schedule.spaced`, `Schedule.fixed` | recurrence counts   |
| `Schedule.forever`                                 | recurrence counts   |
| `Schedule.exponential`, `Schedule.duration`, `Schedule.elapsed` | durations |
| `Schedule.passthrough(schedule)`                   | the latest input    |

## Code

This repeat policy observes successful values. `Schedule.passthrough` turns the
latest input into the schedule output, then `Schedule.map` changes the output
into a log-friendly label:

```ts
import { Console, Effect, Schedule } from "effect"

type Status = "warming" | "ready"

let polls = 0

const readStatus = Effect.sync((): Status => {
  polls += 1
  return polls < 3 ? "warming" : "ready"
}).pipe(
  Effect.tap((status) => Console.log(`effect success: ${status}`))
)

const program = Effect.gen(function*() {
  const scheduleOutput = yield* readStatus.pipe(
    Effect.repeat(($) =>
      Schedule.passthrough($(Schedule.forever)).pipe(
        Schedule.tapInput((status) => Console.log(`schedule input: ${status}`)),
        Schedule.map((status) => `schedule output: saw ${status}`),
        Schedule.tapOutput((message) => Console.log(message)),
        Schedule.while(({ input }) => input !== "ready")
      )
    )
  )

  yield* Console.log(`repeat returned: ${scheduleOutput}`)
})

Effect.runPromise(program)
```

The effect succeeds with `"warming"`, `"warming"`, then `"ready"`. Each success
is schedule input. The final success also becomes the final schedule output
after mapping, because the raw schedule overload of `Effect.repeat` returns the
schedule output.

## Common mistakes

Schedule output is not automatically the business value produced by the effect.
With `Effect.retry`, the retried effect still succeeds with the original
successful value. With the raw schedule overload of `Effect.repeat`, the result
is the schedule output. With the options form of `Effect.repeat`, the result is
the last successful value of the repeated effect.

Another common mistake is treating the delay as the output. A schedule decision
contains both an output and the delay before the next recurrence, but only some
schedules choose to output durations.

## Practical guidance

Before choosing combinators, ask two questions:

- What value will the schedule receive: a success, an error, or some other
  input from a lower-level driver?
- What should the schedule report: a count, a duration, the latest input, a
  label, or a combined value?

Use `tapInput` to observe inputs without changing the result, `tapOutput` to
observe outputs, `map` to transform outputs, and `passthrough` when the input
itself is the useful output.
