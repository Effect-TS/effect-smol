---
book: Effect `Schedule` Cookbook
section_number: "9.5"
section_title: "Prefer time-budget limits over attempt counts"
part_title: "Part II — Core Retry Recipes"
chapter_title: "9. Retry with Deadlines and Budgets"
status: "draft"
code_included: true
---

# 9.5 Prefer time-budget limits over attempt counts

Use this section when retry latency matters more than a fixed number of
attempts. It shows how to combine a delay schedule with an elapsed-time budget
so the retry policy stays explicit.

## What this section is about

Start by separating two limits that are easy to conflate in retry policy
design.

An attempt count answers "how many more times may this operation run?" A time
budget answers "how long may this retry window remain open?" Those are related,
but they are not interchangeable. In Effect, a time-budget retry policy is
usually built by combining a delay schedule with `Schedule.during`:

```ts
import { Schedule } from "effect"

const retryWithinBudget = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.during("10 seconds"))
)
```

Here, `Schedule.exponential("100 millis")` chooses the delay between retries.
`Schedule.during("10 seconds")` supplies the elapsed retry window.
`Schedule.both` requires both schedules to continue, so the policy stops when
the time budget is exhausted.

## Why it matters

Fixed attempt counts are easy to read, but they do not describe user-visible or
operational latency very well. Three retries might finish in a few milliseconds
when a dependency fails immediately, or take much longer when each failed
attempt spends time waiting on the network before returning a typed failure.

Time budgets express the constraint that usually matters at the boundary of a
system: how long the caller is willing to keep retrying. A background worker may
have a 30 second recovery window. A startup check may have a 2 minute readiness
window. A user-facing request may have only a brief retry budget before it
should return the last failure.

This is also a better fit for delay schedules. `Schedule.spaced`,
`Schedule.fixed`, and `Schedule.exponential` control retry cadence. They say
when the next retry should be attempted, but they do not decide by themselves
when retrying should stop. `Schedule.during` adds that elapsed stopping
condition without replacing the delay policy.

## Core idea

Start with the delay shape, then add the time budget:

```ts
import { Schedule } from "effect"

const steadyRetryFor30Seconds = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)

const backoffRetryFor30Seconds = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)
```

Read each policy in two parts:

- the left schedule controls retry timing
- the `Schedule.during` side controls the elapsed retry window

`Schedule.both(left, right)` has intersection semantics. The combined schedule
continues only while both sides want to recur, and the delay is the maximum of
the two delays. Since `Schedule.during` contributes the stopping window rather
than a practical retry delay, the composed policy keeps the cadence from
`Schedule.spaced`, `Schedule.fixed`, or `Schedule.exponential`.

Use `Schedule.recurs` as an additional guard only when the count itself is a
real requirement:

```ts
import { Schedule } from "effect"

const retryWithinBudgetAndCount = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.during("10 seconds")),
  Schedule.both(Schedule.recurs(20))
)
```

This says "retry with exponential backoff while the 10 second retry window is
open, but never schedule more than 20 retries after the original attempt."

## Common mistakes

Do not treat `Schedule.recurs(3)` as a latency budget. It limits how many
retries may be scheduled after the original attempt, not how long those attempts
and delays may take.

Do not use `Schedule.during` by itself for production retry policies. It
describes an elapsed recurrence window, but it does not add a useful delay on
its own. A fast-failing effect can retry very aggressively until the window
closes. Combine it with a delay schedule.

Do not treat `Schedule.during` as a hard timeout for an in-flight attempt. A
schedule is consulted at retry decision points after typed failures. It does
not interrupt the original attempt or a later attempt that is already running.

Do not choose a time budget to hide retrying the wrong failures. Permanent
failures such as bad input, invalid credentials, forbidden access, or
misconfiguration should usually stop retrying immediately through a retry
predicate or a more precise error model.

## Practical guidance

Prefer a time budget when the requirement is stated in time: "try for up to 10
seconds", "keep probing during startup for about 2 minutes", or "give the
dependency a short recovery window." Then choose the delay schedule that fits
the dependency.

Use `Schedule.exponential` when repeated failures should slow down over time.
This is usually the default shape for overloaded services, transient network
failures, and shared dependencies.

Use `Schedule.spaced` when the retry cadence should be steady and easy to
reason about. This fits simple polling, readiness probes, and small background
jobs where a constant interval is acceptable.

Use `Schedule.fixed` when retries should align to a fixed-rate interval rather
than waiting a fixed duration after each failed attempt completes.

Add `Schedule.recurs` only as a secondary cap when the number of retries is
also operationally meaningful. In most service-boundary code, the time budget
is the clearer primary limit because it matches the amount of waiting the caller
can tolerate.
