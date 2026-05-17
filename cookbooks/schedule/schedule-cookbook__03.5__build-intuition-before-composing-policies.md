---
book: "Effect `Schedule` Cookbook"
section_number: "3.5"
section_title: "Build intuition before composing policies"
part_title: "Part I — Foundations"
chapter_title: "3. Minimal Building Blocks"
status: "draft"
code_included: false
---

# 3.5 Build intuition before composing policies

A `Schedule` is a policy value. It observes an input, produces an output,
requests a delay, and decides whether another recurrence is allowed.

## What this section is about

This section is about reading one schedule before combining it with another.
A schedule is not the effect being repeated or retried. It is stepped after
`Effect.repeat` sees a success or after `Effect.retry` sees a typed failure.

Once that model is clear, composition is easier: combined schedules are still
made from inputs, outputs, delays, and stop conditions.

## Four questions

Ask these questions for any schedule:

- What input does it observe?
- What output does it produce?
- What delay does it request?
- When does it stop?

For `Schedule.recurs(n)`, the important axis is stopping. It permits `n`
recurrences after the first execution and outputs the zero-based recurrence
count.

For `Schedule.spaced(duration)`, the important axis is delay. It keeps recurring
and asks for the same delay between completed runs.

For `Schedule.fixed(interval)`, the important axis is clock alignment. It aims
at regular interval boundaries instead of simply waiting a fixed pause after
each run.

For `Schedule.exponential(base, factor)` and `Schedule.fibonacci(one)`, the
important axis is delay growth. They keep recurring until another policy or
entry-point condition stops them.

## Common mistakes

Do not treat "repeat three times" and "run three times total" as the same
requirement. `Effect.repeat` and `Effect.retry` run once before the schedule
controls additional recurrences.

Do not assume timing policies are bounded. `Schedule.spaced`,
`Schedule.fixed`, `Schedule.exponential`, `Schedule.fibonacci`, and
`Schedule.forever` can continue indefinitely unless another condition stops
them.

Do not assume all delays mean the same thing. A spaced policy waits between
runs, a fixed policy aims at interval boundaries, and a backoff policy changes
the delay from step to step.

## Practical guidance

Before composing policies, describe each one in a short sentence:

- A count policy says how many recurrences are allowed after the first run.
- A timing policy says whether the delay is spacing, clock alignment, or growth.
- An output-producing policy says whether the useful value is a count, duration,
  input, or transformed value.

Prefer the smallest schedule that states the behavior you need now. Add
composition only when there is a second policy to express, such as "retry three
times and wait between attempts."
