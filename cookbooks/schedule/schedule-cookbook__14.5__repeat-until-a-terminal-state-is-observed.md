---
book: Effect `Schedule` Cookbook
section_number: "14.5"
section_title: "Repeat until a terminal state is observed"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "14. Repeat with Limits"
status: "draft"
code_included: true
---

# 14.5 Repeat until a terminal state is observed

You have an effect that successfully observes the current status of some work, and you
want to repeat that observation until the status reports a terminal state. With
`Effect.repeat`, the effect runs once before the schedule is consulted. This recipe
treats repetition as a policy for successful effects. The schedule decides whether
another successful iteration should run, what spacing applies, and what value the repeat
returns. Failures stay in the effect error channel, so the repeat policy stays separate
from recovery or retry behavior.

## Problem

You have an effect that successfully observes the current status of some work,
and you want to repeat that observation until the status reports a terminal
state.

With `Effect.repeat`, the effect runs once before the schedule is consulted.
After each successful observation, the successful status value becomes the
schedule input. A `Schedule.while` predicate can inspect that successful output
and allow another recurrence only while the status is still non-terminal.

## When to use it

Use this when the repeated effect succeeds with a domain status even while the
domain workflow is still in progress.

This is a good fit for small status-observation loops where states such as
`"queued"` and `"running"` mean "observe again", while states such as
`"succeeded"`, `"failed"`, or `"canceled"` mean "stop repeating".

## When not to use it

Do not use this to retry failed observations. If the observation effect fails,
`Effect.repeat` stops with that failure before the schedule predicate can inspect
a status.

Do not use this as a full polling recipe for external systems with deadlines,
logging, cancellation strategy, and failure classification. This recipe covers
only the repeat condition based on successful status observations.

Do not leave the repeat unbounded unless the status is guaranteed to become
terminal or the fiber has a clear owner that can interrupt it.

## Schedule shape

Make the successful status the schedule input and continue while the latest
successful status is not terminal:

```ts
Schedule.identity<JobStatus>().pipe(
  Schedule.while(({ input }) => !isTerminal(input))
)
```

`Schedule.while` receives schedule metadata after a successful run. In
`Effect.repeat`, `metadata.input` is the successful output from the repeated
effect. Returning `true` allows another recurrence. Returning `false` stops the
repeat.

The predicate above therefore repeats after successful non-terminal statuses and
stops as soon as a successful terminal status is observed.

## Code

```ts
import { Effect, Schedule } from "effect"

type JobStatus =
  | { readonly state: "queued" }
  | { readonly state: "running"; readonly percent: number }
  | { readonly state: "succeeded"; readonly resultId: string }
  | { readonly state: "failed"; readonly reason: string }
  | { readonly state: "canceled" }

const isTerminal = (status: JobStatus): boolean =>
  status.state === "succeeded" ||
  status.state === "failed" ||
  status.state === "canceled"

declare const observeJob: Effect.Effect<JobStatus>

const untilTerminal = Schedule.identity<JobStatus>().pipe(
  Schedule.while(({ input }) => !isTerminal(input))
)

const terminalStatus = observeJob.pipe(
  Effect.repeat(untilTerminal)
)
```

`observeJob` runs once immediately. If it succeeds with a terminal status, there
are no recurrences. If it succeeds with a non-terminal status, the schedule
allows another observation.

Because the schedule is `Schedule.identity<JobStatus>()`, the repeated program
succeeds with the final successful `JobStatus` that made the predicate return
`false`.

## Variants

Add a pause and a recurrence cap when terminal status may take time but the loop
must still have a limit:

```ts
import { Effect, Schedule } from "effect"

declare const observeJob: Effect.Effect<JobStatus>

const untilTerminalOrTwentyRecurrences = Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<JobStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.recurs(20).pipe(Schedule.satisfiesInputType<JobStatus>())
  )
)

const terminalOrLastObservedStatus = observeJob.pipe(
  Effect.repeat(untilTerminalOrTwentyRecurrences)
)
```

`Schedule.spaced("1 second")` supplies the delay between successful
observations. `Schedule.satisfiesInputType<JobStatus>()` is applied before
reading `metadata.input`, because the base timing schedule is not constructed
from `JobStatus` values. `Schedule.passthrough` keeps the successful status as
the schedule output.

The repeat stops when either a successful terminal status is observed or the
recurrence cap is reached. `Schedule.recurs(20)` permits up to 20 recurrences
after the initial observation.

## Notes and caveats

The terminal-state predicate inspects successful outputs only, after each
successful run. Failures from the observed effect do not become schedule inputs.

The first observation is not delayed by the schedule. Spacing applies only
before later recurrences.

Model terminal domain states as successful values when they are normal outcomes
of the observed workflow. Reserve the failure channel for failures of the
observation itself.

When composing a count or timing schedule with `Schedule.while`, constrain the
input type with `Schedule.satisfiesInputType<T>()` before reading
`metadata.input`.
