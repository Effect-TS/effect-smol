---
book: Effect `Schedule` Cookbook
section_number: "1.1"
section_title: "Recurrence policies as data"
part_title: "Part I — Foundations"
chapter_title: "1. What a `Schedule` Really Represents"
status: "draft"
code_included: true
---

# 1.1 Recurrence policies as data

This subsection explains Recurrence policies as data as a practical Effect `Schedule`
recipe. This section keeps the focus on Effect's `Schedule` model: recurrence is
represented as data that decides whether another decision point exists, which delay
applies, and what output the policy contributes. That framing makes later retry, repeat,
and polling recipes easier to compose without hiding timing behavior inside ad hoc
loops.

## What this section is about

This section frames schedules as first-class policy values. Instead of hiding
timing rules inside loops, callbacks, or scattered `sleep` calls, you name the
policy directly and pass it to the operation that needs recurrence behavior.

```ts
import { Schedule } from "effect"

export const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

export const refreshPolicy = Schedule.spaced("30 seconds").pipe(
  Schedule.take(10)
)
```

These values do not perform a network request or refresh a cache. They describe
how recurrence should proceed when some other Effect API drives them.

## Why it matters

Treating recurrence as data separates policy from work. The work answers
"what should happen?" The schedule answers "when should it happen again, and
when should it stop?"

That separation gives you smaller pieces:

- a retry policy can be named, reused, and reviewed independently from the
  effect being retried
- a cadence can be combined with a limit without rewriting the effect body
- a policy can emit useful output, such as a count or a duration, for logging,
  metrics, or later composition

It also keeps failure channels clearer. A retrying database call may fail, but a
basic `Schedule.exponential("100 millis")` policy does not fail merely because
the database call failed. The failure value is input to the recurrence decision;
it is not automatically an error in the policy itself.

## Core idea

At the type level, a schedule has four parameters:

```ts
Schedule.Schedule<Output, Input, Error, Env>
```

Read them from the point of view of the policy:

- `Output` is the information emitted by the schedule at each recurrence, such
  as a count or a duration.
- `Input` is the information the schedule can observe while it is being driven.
- `Error` is an error that can be raised by the schedule itself.
- `Env` is any context required by the schedule itself.

Most everyday schedules are simpler than the full type suggests.
`Schedule.spaced("1 second")` and `Schedule.recurs(3)` produce counts.
Backoff schedules such as `Schedule.exponential("100 millis")` and
`Schedule.fibonacci("100 millis")` produce durations.

Because schedules are values, you can compose them before they run:

```ts
import { Schedule } from "effect"

const cadence = Schedule.exponential("200 millis")
const limit = Schedule.recurs(4)

export const boundedBackoff = cadence.pipe(
  Schedule.both(limit)
)
```

`Schedule.both` combines two policies with "both must continue" semantics. If
both policies produce delays, the combined policy uses the maximum delay and
emits a tuple of both outputs.

## Common mistakes

Calling a schedule "data" does not mean it is a plain JSON object. Some
schedules carry internal step state while they are being driven. The public
model is still data-oriented: a schedule is a first-class value that can be
named, passed around, transformed, and combined before any recurrence happens.

Other common mistakes are:

- putting timing and stopping rules in the effect body instead of in the
  schedule
- treating schedule output as the business result of the repeated or retried
  effect
- assuming every schedule is only about sleeping, when schedules can also count,
  inspect inputs, emit durations, transform outputs, and compose with other
  policies

## Practical guidance

When reading or writing schedule code, ask:

- What recurrence policy am I declaring?
- What does the policy output?
- What input does the policy need to observe?
- Which separate constraints should be composed rather than embedded in the
  effect body?

If the answer is mostly about timing, counting, stopping, or observing recurrence
inputs, it belongs in a `Schedule`. If the answer is about the business work
itself, keep it in the effect that the schedule will drive.

The practical habit is to give policy values names. Start with the smallest
pieces, such as a cadence and a limit, then compose them. Once the policy reads
correctly by itself, attach it to retrying, repeating, streaming, or lower-level
schedule stepping code.
