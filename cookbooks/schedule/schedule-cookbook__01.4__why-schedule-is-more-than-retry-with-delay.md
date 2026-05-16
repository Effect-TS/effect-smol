---
book: Effect `Schedule` Cookbook
section_number: "1.4"
section_title: "Why `Schedule` is more than “retry with delay”"
part_title: "Part I — Foundations"
chapter_title: "1. What a `Schedule` Really Represents"
status: "draft"
code_included: false
---

# 1.4 Why `Schedule` is more than “retry with delay”

This subsection explains Why `Schedule` is more than “retry with delay” as a practical
Effect `Schedule` recipe. This section keeps the focus on Effect's `Schedule` model:
recurrence is represented as data that decides whether another decision point exists,
which delay applies, and what output the policy contributes. That framing makes later
retry, repeat, and polling recipes easier to compose without hiding timing behavior
inside ad hoc loops.

## What this section is about

It is natural to meet `Schedule` through retrying. A request fails, you wait a little, then you try again. That use case is important, but it is also the smallest useful picture of what a schedule can do.

This section reframes `Schedule` as a reusable policy for recurrence. Retry is one interpreter of that policy. Repetition is another. Streams and channels can also use schedules to pace, repeat, or retry work. The same value can describe when to continue, how long to wait, what to publish, and how to combine with other policies.

## Why it matters

A delay answers only one question: “How long should I wait?” A schedule can answer several questions at once.

It can answer “Should I continue?” with constructors and limiters such as `Schedule.recurs`, `Schedule.take`, `Schedule.during`, and `Schedule.while`.

It can answer “What should the next interval be?” with timing schedules such as `Schedule.spaced`, `Schedule.fixed`, `Schedule.windowed`, `Schedule.exponential`, `Schedule.fibonacci`, `Schedule.cron`, and `Schedule.duration`.

It can answer “What information should this policy publish?” because every schedule has an output type. Some schedules output counts, some output durations, and transformed schedules can output labels, phases, metrics, accumulated state, or whatever value is useful to the caller.

This is why “retry with delay” is an incomplete mental model. A retry policy such as exponential backoff capped at five retries is not just a number of milliseconds. It combines a timing policy (`Schedule.exponential`) with a stopping policy (`Schedule.recurs` or `Schedule.take`). The resulting value is still a schedule, so it can be tapped for observability, mapped into a different output, jittered, sequenced with another phase, or reused wherever an Effect API accepts a schedule.

## Core idea

A `Schedule` is a small state machine for recurrence. Each step receives an input, consults its own state and timing metadata, and either continues by producing an output plus the delay before the next step, or stops with a final output.

The generic shape also tells the same story:

- `Output` is what the schedule publishes at each step.
- `Input` is what the repeated process feeds back into the schedule.
- `Error` is how a schedule step itself can fail.
- `Env` is the environment required by effectful schedule logic.

Those parameters are not decoration. They are what make schedules useful outside retry loops. A schedule can observe inputs with `Schedule.tapInput`, publish outputs with `Schedule.tapOutput`, collect outputs with `Schedule.collectOutputs`, or accumulate state with `Schedule.reduce`. Because mapping, tapping, predicates, and state transitions can be effectful, the schedule remains part of the Effect program rather than a separate callback-based mechanism.

Schedules also compose as policies. With `Schedule.both`, two schedules must both continue, the combined delay is the maximum delay, and the output contains both outputs. With `Schedule.either`, the combined schedule continues while either side can continue, using the minimum delay. With `Schedule.andThen`, one schedule runs to completion before the next schedule begins.

Timing metadata is another part of the model. Schedule predicates can inspect the input, the attempt number, the start time, the current time, elapsed time, elapsed time since the previous step, the current output, and the current duration. That is what lets a schedule express policies such as “continue while elapsed time is under the budget,” “collect outputs until this runtime condition changes,” or “publish a different phase after a number of attempts.”

## Common mistakes

The first mistake is treating a schedule as a sleep duration. Delay is one field in each successful transition, but it is not the whole transition. The policy also carries input, output, state, composition, and termination.

The second mistake is thinking schedules only apply to failures. In retry, the schedule input is usually the failure that caused the retry. In repetition, the schedule input is usually the successful value that was just produced. The same abstraction can drive polling, heartbeats, fixed-rate jobs, time windows, staged backoff, observability hooks, and stream pacing.

The third mistake is discarding schedule outputs too early. Outputs are often useful for logging, metrics, phase labels, accumulated state, or downstream decisions. A schedule that publishes useful information is easier to inspect and reuse than one treated as an invisible timer.

## Practical guidance

The practical rule is simple: reach for `Schedule` when the interesting part of a repeated workflow is the policy, not just the sleep. If you need only one hard-coded pause, a duration is enough. If you need a reusable decision about when to continue, how long to wait, what to emit, and how the policy composes with other policies, model it as a `Schedule`.

When designing a schedule, name the policy in terms of recurrence rather than retry alone. Ask what input the schedule should observe, what output would be useful to publish, what condition should stop the recurrence, and whether the timing policy should be combined with a count, duration, predicate, or second phase. That framing keeps the schedule reusable across retry, repeat, and streaming use cases.
