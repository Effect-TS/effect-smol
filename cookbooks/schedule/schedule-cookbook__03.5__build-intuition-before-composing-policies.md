---
book: Effect `Schedule` Cookbook
section_number: "3.5"
section_title: "Build intuition before composing policies"
part_title: "Part I — Foundations"
chapter_title: "3. Minimal Building Blocks"
status: "draft"
code_included: false
---

# 3.5 Build intuition before composing policies

This subsection explains Build intuition before composing policies as a practical Effect
`Schedule` recipe. This section keeps the focus on Effect's `Schedule` model: recurrence
is represented as data that decides whether another decision point exists, which delay
applies, and what output the policy contributes. That framing makes later retry, repeat,
and polling recipes easier to compose without hiding timing behavior inside ad hoc
loops.

## What this section is about

This section is about reading a single `Schedule` value before combining it with
anything else.

A schedule is not the repeated or retried effect. It is the recurrence policy
that is stepped after an observed value arrives. On each step, the policy can
produce an output, choose a delay before the next run, and either continue or
stop.

That small model is enough to understand the basic building blocks. Composition
becomes much easier later when each individual policy already has a clear shape
in your head.

## Why it matters

Most confusion with schedules starts before composition. If you are unsure
whether a policy is bounded, what it outputs, or whether its delay is measured as
a pause or as a target interval, combining it with another policy will only make
the result harder to reason about.

The important habit is to ask what one schedule does when it is stepped once,
then ask what changes on the next step. `Schedule.recurs`, `Schedule.spaced`,
`Schedule.fixed`, `Schedule.exponential`, and `Schedule.fibonacci` are all small
policies, but they emphasize different parts of the model:

- Count policies make stopping visible.
- Spacing policies make delay visible.
- Backoff policies make delay growth visible.
- Fixed-interval policies make clock alignment visible.

Once those shapes are familiar, later combinators are less mysterious because
they are combining policies whose behavior you can already describe.

## Core idea

Read every schedule along four axes:

- What input does it see?
- What output does it produce?
- What delay does it request?
- When does it stop?

For `Schedule.recurs(n)`, the main axis is stopping. It allows a bounded number
of schedule recurrences and outputs a zero-based recurrence count. The delay is
zero because the policy is about count, not time.

For `Schedule.spaced(duration)`, the main axis is delay. It keeps recurring,
outputs a recurrence count, and requests the same delay each time. The pause is
spacing between completed runs.

For `Schedule.fixed(interval)`, the main axis is clock alignment. It keeps
recurring on interval boundaries, outputs a recurrence count, and does not pile
up missed runs if the work takes longer than the interval.

For `Schedule.exponential(base, factor)`, the main axis is growing delay. It
keeps recurring and outputs the current delay. With the default factor, each
delay doubles from the previous one.

For `Schedule.fibonacci(one)`, the main axis is gentler growing delay. It keeps
recurring and outputs the current delay, but grows according to the Fibonacci
sequence rather than by multiplication.

None of these policies says whether the observed value is a success or a
failure. That is decided by the entry point. `Effect.repeat` steps the schedule
after successes, while `Effect.retry` steps it after typed failures.

## Common mistakes

Do not start by asking which combinator you need. Start by describing the policy
you already have. If you cannot say what a single schedule outputs, how long it
waits, and when it stops, composition is premature.

Do not treat "repeat three times" and "run three times total" as the same
statement. A schedule controls recurrences after an initial execution by the
entry point. That means count-based policies are easy places to make an
off-by-one mistake.

Do not assume every timing policy is bounded. `Schedule.spaced`,
`Schedule.fixed`, `Schedule.exponential`, `Schedule.fibonacci`, and
`Schedule.forever` keep recurring on their own. If the operation should stop,
the stopping rule must come from a bounded policy, a predicate, interruption, or
the entry point's own failure or success behavior.

Do not assume all delays mean the same thing. A spaced policy waits for a
duration between runs. A fixed policy aims at regular interval boundaries. A
backoff policy changes the delay from step to step.

## Practical guidance

When a schedule surprises you, write its behavior as a short sentence before
changing the code.

For a count policy, say how many recurrences it permits after the first
execution. For a timing policy, say whether it is a pause, an interval, or a
growing delay. For an output-producing policy, say whether the output is a count,
a duration, the input value, or some transformed value.

Prefer the smallest schedule that describes the behavior you need right now. If
you only need a retry budget, understand the recurrence count first. If you only
need a heartbeat cadence, understand the spacing policy first. If you only need
backoff, understand the delay sequence before adding limits or extra conditions.

The goal is not to avoid composition. The goal is to make each piece obvious
before composition appears. A composed schedule should read like the combination
of simple policies, not like a new control-flow language you have to decode from
scratch.
