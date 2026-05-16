---
book: Effect `Schedule` Cookbook
section_number: "1.5"
section_title: "Composability as the core design idea"
part_title: "Part I — Foundations"
chapter_title: "1. What a `Schedule` Really Represents"
status: "draft"
code_included: true
---

# 1.5 Composability as the core design idea

This subsection explains Composability as the core design idea as a practical Effect
`Schedule` recipe. This section keeps the focus on Effect's `Schedule` model: recurrence
is represented as data that decides whether another decision point exists, which delay
applies, and what output the policy contributes. That framing makes later retry, repeat,
and polling recipes easier to compose without hiding timing behavior inside ad hoc
loops.

## What this section is about

This section explains the design habit that makes `Schedule` useful beyond simple retry loops: build recurrence behavior by composing small policies.

A schedule does not run your program by itself. It describes how a repeated or retried operation should proceed: whether to continue, how long to wait, and what output the policy produced at that step. Because that policy is an ordinary value, you can combine it with other schedule values before handing it to `Effect.repeat` or `Effect.retry`.

## Why it matters

Real recurrence policies usually have more than one concern. A retry policy might need exponential backoff, a maximum retry count, logging, and a fallback phase. A polling policy might need a regular interval, a time window, and a different cadence after startup.

If those concerns are hidden inside one control-flow block, the policy is harder to inspect and harder to change. With `Schedule`, each concern can be expressed separately and then combined:

```ts
import { Schedule } from "effect"

const boundedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

Here, `Schedule.exponential("100 millis")` chooses the delay pattern and `Schedule.recurs(5)` supplies the stopping condition. The composed policy says both requirements must be satisfied.

## Core idea

Choose the combinator by the relationship between policies:

- Use `both` when all policies must still allow recurrence. It continues only while both sides continue, and it uses the maximum of their delays.
- Use `either` when any policy may keep recurrence alive. It continues while either side continues, and it uses the minimum of their delays.
- Use `andThen` when recurrence has phases. It runs the first schedule to completion, then runs the second.

Use `both` for bounded backoff:

```ts
import { Schedule } from "effect"

const retryAtMostFiveTimesWithBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

Use `either` when either schedule is enough to continue:

```ts
import { Schedule } from "effect"

const aggressiveOrFallback = Schedule.exponential("100 millis").pipe(
  Schedule.take(3),
  Schedule.either(Schedule.spaced("1 second").pipe(Schedule.take(5)))
)
```

Use `andThen` for phases:

```ts
import { Schedule } from "effect"

const burstThenSlowDown = Schedule.spaced("100 millis").pipe(
  Schedule.take(3),
  Schedule.andThen(Schedule.spaced("1 second").pipe(Schedule.take(5)))
)
```

A schedule also has an output. `both` and `either` keep both outputs as a tuple. If that is not the shape you want, use the output-selecting variants:

- `bothLeft` / `eitherLeft` keep the left output.
- `bothRight` / `eitherRight` keep the right output.
- `bothWith` / `eitherWith` combine both outputs into a custom value.

## Common mistakes

One mistake is treating `Schedule` as a bag of retry presets. The useful model is smaller: each schedule describes one recurrence policy, and combinators describe how policies interact.

Another mistake is reaching for `both` when the intended behavior is phased. `both` runs two policies at the same time and stops when either side is done. If the desired behavior is "try this policy first, then switch to that policy", use `andThen`.

A third mistake is ignoring output shape. A composed schedule may produce a tuple because both sides produce outputs. That is correct, but it may not be the most convenient API for the caller. Pick `bothLeft`, `bothRight`, or `bothWith` when the output should be simpler or more meaningful.

## Practical guidance

Build schedules out of named pieces. Start with timing, add a stopping condition, then decide whether the relationship is conjunctive, disjunctive, or sequential.

```ts
import { Schedule } from "effect"

const backoff = Schedule.exponential("100 millis")
const retryLimit = Schedule.recurs(5)

const retryPolicy = backoff.pipe(
  Schedule.bothLeft(retryLimit)
)
```

Read the result as a sentence: use exponential backoff, bounded by a retry limit, and keep the delay output. That is the core design idea of `Schedule`: complex recurrence behavior should be assembled from small, inspectable policies rather than hidden inside one large control-flow block.
