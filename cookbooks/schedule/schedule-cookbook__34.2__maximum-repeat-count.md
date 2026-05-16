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

Use a maximum repeat count when a successful effect may run again, but only a
known number of times. The important detail is that the first execution is not a
scheduled recurrence. `Effect.repeat` runs the effect once, feeds each successful
value into the schedule, and the schedule decides whether another run is allowed.

## Problem

You need to run a successful effect a bounded number of additional times without
putting counters and sleeps around the effect body.

For example, a metrics sampler might run once immediately and then take four
more samples. A warmup task might run once and then repeat twice to smooth out
transient startup state. In both cases, the effect describes one unit of work and
the schedule describes the repeat limit.

## When to use it

Use `Schedule.recurs(n)` when the only policy is "repeat at most `n` more
times." It is the smallest count-based schedule and its output is the current
recurrence count.

Use `Schedule.take(n)` when another schedule already describes the cadence or
shape, and you only want to cap how many outputs from that schedule are used.
This is common with `Schedule.spaced`, `Schedule.fixed`, or
`Schedule.exponential`, which otherwise keep recurring.

## When not to use it

Do not use repeat counts to recover from failures. `Effect.repeat` consults the
schedule after success. If the effect fails, the repeat stops with that failure.
Use `Effect.retry` for failure-driven recurrence.

Also avoid counted repeats when the domain has a clearer terminal condition. If
a polling response says `"ready"` or `"done"`, prefer a predicate such as
`until` or `while` with a count limit as a guardrail.

## Schedule shape

`Schedule.recurs(n)` can be stepped `n` times before it terminates. With
`Effect.repeat`, that means one initial execution plus up to `n` additional
executions.

`Schedule.take(n)` limits another schedule to at most `n` outputs. The original
schedule still controls its delay and output type; `take` only adds the maximum
count.

When you pass a raw schedule to `Effect.repeat`, the repeated effect succeeds
with the schedule's final output. For count schedules, that means a number. If
you need the final successful value from the effect instead, use the options form
of `Effect.repeat`, such as `Effect.repeat({ schedule })` or
`Effect.repeat({ times })`.

## Code

This program runs the effect once immediately and then repeats it three more
times. The final value is the schedule output, so the type is `Effect<number>`:

```ts
import { Console, Effect, Schedule } from "effect"

const writeHeartbeat = Console.log("heartbeat")

export const program: Effect.Effect<number> = writeHeartbeat.pipe(
  Effect.repeat(Schedule.recurs(3))
)
```

Add `take` when the count limit should cap a timing schedule:

```ts
import { Console, Effect, Schedule } from "effect"

const sampleMetrics = Console.log("sample")

export const sampled: Effect.Effect<number> = sampleMetrics.pipe(
  Effect.repeat(Schedule.spaced("1 second").pipe(Schedule.take(4)))
)
```

The second example runs once immediately, then repeats up to four times with one
second between successful runs.

Use the options form when callers need the last successful value rather than the
schedule output:

```ts
import { Effect, Schedule } from "effect"

declare const readVersion: Effect.Effect<number>

export const finalVersion: Effect.Effect<number> = readVersion.pipe(
  Effect.repeat({
    schedule: Schedule.spaced("1 second").pipe(Schedule.take(4))
  })
)
```

## Variants

Use `Schedule.recurs(0)` when the effect should run once and not repeat. This
can be useful when a count is configurable and zero means "disable additional
runs."

Use `Schedule.spaced(duration).pipe(Schedule.take(n))` when operators need both
a maximum repeat count and a predictable delay.

Use `Schedule.exponential(base).pipe(Schedule.take(n))` when repeated successful
work should become less frequent over time, such as checking a non-urgent
background condition after an initial success.

## Notes and caveats

The count is a repeat count, not a total execution count. `Schedule.recurs(3)`
allows the initial execution plus three scheduled recurrences.

`Schedule.recurs` and `Schedule.take` both use the schedule attempt count to
decide when to stop. The distinction is what they preserve: `recurs` is itself a
counting schedule, while `take` keeps another schedule's delay and output and
only limits how many outputs are accepted.

Successful values are schedule inputs. That matters if you add `Schedule.while`,
`Schedule.tapInput`, or `Schedule.passthrough`: those combinators observe the
successful result of the effect, not its failures.
