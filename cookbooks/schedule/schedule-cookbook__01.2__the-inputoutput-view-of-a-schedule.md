---
book: Effect `Schedule` Cookbook
section_number: "1.2"
section_title: "The input/output view of a schedule"
part_title: "Part I — Foundations"
chapter_title: "1. What a `Schedule` Really Represents"
status: "draft"
code_included: true
---

# 1.2 The input/output view of a schedule

This subsection explains The input/output view of a schedule as a practical Effect
`Schedule` recipe. This section keeps the focus on Effect's `Schedule` model: recurrence
is represented as data that decides whether another decision point exists, which delay
applies, and what output the policy contributes. That framing makes later retry, repeat,
and polling recipes easier to compose without hiding timing behavior inside ad hoc
loops.

## What this section is about

The public type shows the input/output view directly:

```ts
Schedule.Schedule<Output, Input, Error, Env>
```

For most cookbook work, the first two type parameters are the ones to read
first:

| Type     | Question it answers                                                     |
| -------- | ----------------------------------------------------------------------- |
| `Input`  | What value is fed to the schedule each time it makes its next decision? |
| `Output` | What value does the schedule produce as its own result?                 |

The input is not the constructor argument you pass to something like
`Schedule.spaced("1 second")`. It is the value supplied by the driver that is
running the schedule.

## Why it matters

For `Effect.retry`, the schedule input is the failure value. If an effect fails
with `NetworkError`, a retry policy that inspects its input is inspecting a
`NetworkError`.

For `Effect.repeat`, the schedule input is the success value. If an effect
succeeds with a `User`, a repeat schedule that inspects its input is inspecting
that `User`.

This distinction affects both type inference and meaning. The same schedule can
be used for retrying and repeating when it ignores input, but an input-sensitive
schedule must match the driver that feeds it.

## Core idea

This is why many common schedules can be used almost anywhere. Constructors like
`Schedule.recurs`, `Schedule.spaced`, and `Schedule.forever` do not need to look
at the incoming value, so their input type is `unknown`. They can count, delay,
or stop without caring whether the incoming value was an error from retrying or
a success from repeating.

```ts
import { Schedule } from "effect"

const threeMoreDecisions: Schedule.Schedule<number, unknown> = Schedule.recurs(3)

const echoStringInput: Schedule.Schedule<string, string> = Schedule.identity<string>().pipe(Schedule.take(3))

const labeledSpacing: Schedule.Schedule<string, unknown> = Schedule.spaced("1 second").pipe(
  Schedule.map((count) => `repeat #${count + 1}`),
  Schedule.take(5)
)
```

In the first schedule, `number` is the output: the recurrence count. The input
is `unknown` because `Schedule.recurs(3)` only needs metadata such as the
attempt count.

In the second schedule, the schedule is input-sensitive. `Schedule.identity`
passes each input through as the output, so the input and output types are both
`string`.

In the third schedule, the input is still ignored, but the output has been
changed from a numeric count into a label with `Schedule.map`.

## Common mistakes

The output of a schedule is also separate from the value produced by the effect
being retried or repeated. A retrying effect still succeeds with the successful
value of the original effect. The retry policy's output is mostly useful for
composition, observation, or fallback APIs such as `Effect.retryOrElse`.

Repeating is different in an important way: `Effect.repeat` returns the
schedule's output when the repetition finishes. If the repeated effect succeeds
with `User`, but the schedule is `Schedule.recurs(3)`, the repeated program is
driven by `User` inputs and produces a `number` output from the schedule.

One common source of confusion is delay. Internally, each schedule decision
includes both an output and a duration for the next interval, but the duration is
not automatically the `Output` type. Some schedules choose to output durations:
`Schedule.exponential`, `Schedule.elapsed`, and `Schedule.duration` all produce
`Duration.Duration` values. Others choose to output counts: `Schedule.spaced`,
`Schedule.fixed`, `Schedule.forever`, and `Schedule.recurs` produce `number`
values.

## Practical guidance

Use this input/output view before choosing combinators:

| Need                                                         | Useful schedule operation                          |
| ------------------------------------------------------------ | -------------------------------------------------- |
| Ignore incoming values and only control timing or count      | `recurs`, `spaced`, `fixed`, `exponential`, `take` |
| Observe incoming values without changing the schedule result | `tapInput`                                         |
| Observe schedule results without changing them               | `tapOutput`                                        |
| Change the schedule result value                             | `map`                                              |
| Keep the input as the output                                 | `identity`                                         |
| Combine two policies and keep both outputs                   | `both`                                             |
| Combine two policies but keep only one side's output         | `bothLeft`, `bothRight`                            |

The practical habit is simple: first ask what the schedule will be fed, then ask
what the schedule should report. The delay strategy is only one part of that
answer.
