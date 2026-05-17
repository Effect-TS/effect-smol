---
book: "Effect `Schedule` Cookbook"
section_number: "1.3"
section_title: "Time, repetition, and decision points"
part_title: "Part I — Foundations"
chapter_title: "1. What a `Schedule` Really Represents"
status: "draft"
code_included: false
---

# 1.3 Time, repetition, and decision points

A `Schedule` is stepped between executions of some other effect. It does not run
the effect. It receives the latest input, updates its own recurrence state, and
decides whether another execution is allowed.

## Problem

Time-based recurrence is often described as "sleep, then try again." That is too
small a model for `Schedule`. A schedule decision includes continuation,
output, and delay. Those are related, but they are not the same thing.

## Model

Each successful schedule decision answers three questions:

- What input did the policy observe?
- What output did the policy emit?
- How long should the driver wait before the next recurrence?

If the policy is done, there is no next recurrence. A zero delay means
"continue immediately"; it does not mean "stop."

For retry, the decision point happens after a typed failure. The failure is the
schedule input. For repeat, the decision point happens after a success. The
successful value is the schedule input. In both cases, the first execution
happens before the first schedule decision.

That rule is the source of the common count distinction:
`Schedule.recurs(3)` allows up to three recurrences after the initial execution.
In retry code, that means up to three retries. In repeat code, it means up to
three repetitions.

## Time

Schedule time is measured at the step boundary. The schedule receives the
current timestamp and the latest input, then computes its output and next delay.
This lets time-based and count-based policies compose cleanly.

Common timing policies have different meanings:

- `Schedule.spaced(duration)` waits the same amount after each recurrence.
- `Schedule.fixed(duration)` aligns recurrences to fixed time windows.
- `Schedule.exponential(base)` increases the delay from one decision to the
  next.
- `Schedule.duration(duration)` recurs once after the configured duration, then
  completes.
- `Schedule.during(duration)` continues while elapsed schedule time remains
  within the configured duration.
- `Schedule.elapsed` emits elapsed time as its output.

These policies still produce schedule decisions. The delay answers when the next
recurrence may happen. The continuation decision answers whether it may happen
at all. The output answers what the policy reports to the driver or later
combinators.

## Common mistakes

The first mistake is counting the initial effect execution as a schedule step.
The schedule is consulted only after the first success or retryable failure.

The second mistake is treating delay and continuation as the same field. A
schedule can continue immediately, continue after a delay, or complete. Only the
last case stops recurrence.

The third mistake is reading schedule output as elapsed time in every case.
Some schedules output durations, but many output counts or transformed values.

## Practical guidance

When reading a schedule, translate it into a decision:

- What input does this decision observe?
- What condition lets it continue?
- What delay does it choose for the next recurrence?
- What output does it publish?

This framing keeps retry, repeat, polling, backoff, jitter, and elapsed-time
limits as variations of the same model instead of separate control-flow tricks.
