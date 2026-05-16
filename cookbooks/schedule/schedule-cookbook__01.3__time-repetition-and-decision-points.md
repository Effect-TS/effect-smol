---
book: Effect `Schedule` Cookbook
section_number: "1.3"
section_title: "Time, repetition, and decision points"
part_title: "Part I — Foundations"
chapter_title: "1. What a `Schedule` Really Represents"
status: "draft"
code_included: false
---

# 1.3 Time, repetition, and decision points

This subsection explains Time, repetition, and decision points as a practical Effect
`Schedule` recipe. This section keeps the focus on Effect's `Schedule` model: recurrence
is represented as data that decides whether another decision point exists, which delay
applies, and what output the policy contributes. That framing makes later retry, repeat,
and polling recipes easier to compose without hiding timing behavior inside ad hoc
loops.

## What this section is about

A `Schedule` is a small decision machine that runs between attempts. It does not perform the work itself. Instead, it is asked what should happen after a retryable failure, a repeatable success, or another scheduled input.

Each decision has three important pieces:

- the input observed by the schedule
- the output produced by the schedule
- the delay before the next recurrence

If the schedule can continue, it produces an output and a duration. If it is finished, it halts and returns its final output to the operation that is driving it.

This means a schedule is not just a timer. It is also not just a counter. It is the place where time, repetition state, and continuation logic meet.

## Why it matters

In a retry, the schedule is consulted after a failure. The failure becomes the schedule input. If the schedule continues, the retry waits for the schedule's delay and then runs the effect again. If the schedule stops, the retry stops retrying.

In a repeat, the schedule is consulted after a success. The successful value becomes the schedule input. If the schedule continues, the repeat waits for the schedule's delay and then runs the effect again. If the schedule stops, the repeat stops repeating.

The important shift is that the schedule controls the gap between attempts, not the body of the attempt. The effect being retried or repeated decides whether there is a success or failure. The schedule decides whether there should be another chance, when that chance should occur, and what information should be carried forward.

## Core idea

Schedule time is measured at the boundary where the schedule is stepped. Internally, a schedule step is given the current timestamp and the latest input. From that, it can compute elapsed time, attempt count, and the next delay.

This is why time-based schedules compose naturally with count-based schedules. A count-based policy such as `Schedule.recurs` answers "how many more recurrence decisions may pass?" A time-based policy such as `Schedule.spaced`, `Schedule.fixed`, `Schedule.exponential`, `Schedule.elapsed`, or `Schedule.during` answers questions about waiting, alignment, backoff, or total elapsed time.

The duration produced by a schedule is the sleep before the next recurrence. A zero duration means "continue immediately." A longer duration means "continue after this delay." Completion means "do not continue."

A schedule can continue with no delay, delay without changing its output shape, or stop after producing a final output. Keeping those concerns separate is what makes schedules composable.

For example:

- `Schedule.forever` continues immediately, producing a recurrence count
- `Schedule.spaced` continues with the same delay after each decision
- `Schedule.fixed` aligns recurrence decisions to fixed time windows
- `Schedule.exponential` increases the delay from one decision to the next
- `Schedule.duration` recurs once after the configured duration, then completes
- `Schedule.during` continues while elapsed schedule time remains within the configured duration

The delay answers "when is the next recurrence?" The continuation decision answers "is there a next recurrence at all?" The output answers "what did this policy learn or produce at this step?"

Schedule metadata makes that boundary explicit. Each step tracks the latest input, the current attempt count, the start time, the current time, elapsed time, time since the previous step, the produced delay, and the produced output. Most cookbook recipes do not need to manipulate this metadata directly, but it explains why APIs such as `Schedule.while`, `Schedule.collectWhile`, `Schedule.elapsed`, and `Schedule.during` can make decisions from both time and values.

## Common mistakes

The count tracked by a schedule belongs to schedule steps. It is not the same thing as the number of times the effect body has been entered in all contexts.

For example, `Schedule.recurs(3)` describes up to three recurrences. In a retry workflow, that means up to three retries after the initial failed attempt. In a repeat workflow, that means up to three repeats after the initial successful run.

This distinction avoids off-by-one mistakes:

- the first effect execution happens before the first schedule decision
- the first schedule decision decides whether to run the effect again
- recurrence limits count those decisions, not the initial execution

When reading schedule code, ask "how many times can this policy say continue?" rather than "how many times will my effect run?"

A second common mistake is to blur delay and continuation. A zero duration does not mean the schedule has stopped; it means the next recurrence can happen immediately. A completed schedule is the thing that says there is no next recurrence.

A useful way to read any schedule is to turn it into three questions:

1. What input does it observe?
2. What output does it produce?
3. Under what condition does it continue, and how long does it wait?

For a retry policy, the input is usually the error. For a repeat policy, the input is usually the successful value. For a composed policy, the output may be a tuple, a transformed value, a collected value, or a value selected from one side of the composition.

Once those three questions are clear, the rest of the API becomes easier to reason about. Count limits, elapsed-time limits, fixed windows, exponential backoff, jitter, and predicates are all different ways of shaping the same decision point.

## Practical guidance

Choose the schedule by naming the decision you want to make:

- "Try at most three more times" points to a recurrence limit.
- "Wait one second between attempts" points to spacing.
- "Back off more each time" points to exponential or Fibonacci backoff.
- "Keep going for no more than thirty seconds" points to elapsed-time control.
- "Stop when the latest input or output no longer qualifies" points to a predicate.

The schedule is the policy for the next opportunity. The effect is the work done at that opportunity. Keeping those roles separate is the foundation for every retry and repeat recipe that follows.
