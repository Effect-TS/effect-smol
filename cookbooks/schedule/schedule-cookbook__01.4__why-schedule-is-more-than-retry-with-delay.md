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

Retry with a delay is one use of `Schedule`, not the definition of it. A
schedule is a reusable recurrence policy that can drive retrying, repeating,
polling, stream pacing, staged behavior, and observability.

## Problem

A delay answers one question: "How long should I wait?" A schedule can also
answer "Should I continue?", "What input did I observe?", "What output should I
publish?", and "How does this policy combine with another policy?"

Reducing `Schedule` to a sleep duration hides those decisions.

## Model

A schedule step receives an input and timing metadata, then either continues
with an output plus a delay or completes with a final output. That model supports
several policy concerns:

- continuation with `Schedule.recurs`, `Schedule.take`, `Schedule.during`, and
  `Schedule.while`;
- timing with `Schedule.spaced`, `Schedule.fixed`, `Schedule.windowed`,
  `Schedule.exponential`, `Schedule.fibonacci`, `Schedule.cron`, and
  `Schedule.duration`;
- output transformation and observation with `Schedule.map`,
  `Schedule.tapInput`, and `Schedule.tapOutput`;
- output collection or accumulation with `Schedule.collectOutputs` and
  `Schedule.reduce`;
- policy composition with `Schedule.both`, `Schedule.either`, and
  `Schedule.andThen`.

The same value can therefore express a bounded backoff retry policy, a polling
cadence, or a two-phase loop. The driver decides whether successful values or
typed failures are fed to the policy.

## Composition

Composition is the part that a raw delay cannot express.

`Schedule.both(left, right)` continues only while both policies continue. When
both produce delays, the combined delay is the maximum. This is useful for
"back off, but stop after five recurrences."

`Schedule.either(left, right)` continues while either policy continues. Its
combined delay uses the minimum delay. This is useful when one policy may keep a
loop alive after another policy has completed.

`Schedule.andThen(left, right)` is sequential. It runs the first policy to
completion, then runs the second. This is the right model for warm-up behavior
followed by a steadier cadence.

## Common mistakes

The first mistake is treating schedule output as disposable. Counts, durations,
labels, accumulated state, and collected values can be useful for logging,
metrics, fallback decisions, and tests.

The second mistake is assuming schedules only see failures. `Effect.retry` feeds
failures into a schedule, but `Effect.repeat` feeds successes. A successful job
state such as `"pending"` belongs in a repeat loop, not in a fake error used only
to make retry inspect it.

The third mistake is encoding every policy in effect control flow. Once timing,
limits, predicates, or phases matter, a schedule value is usually easier to
inspect than a hand-written loop.

## Practical guidance

Reach for `Schedule` when the recurrence policy is more important than a single
sleep. Name the policy in recurrence terms: bounded backoff, fixed polling,
warm-up then steady state, retry while transient, repeat until terminal.

If the only requirement is one hard-coded pause, a duration or `Effect.sleep`
may be enough. If the requirement includes continuation, output, composition, or
input-sensitive decisions, model it as a schedule.
