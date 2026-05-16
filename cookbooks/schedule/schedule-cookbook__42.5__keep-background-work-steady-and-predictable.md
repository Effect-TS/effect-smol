---
book: Effect `Schedule` Cookbook
section_number: "42.5"
section_title: "“Keep background work steady and predictable”"
part_title: "Part IX — Composition Recipes"
chapter_title: "42. Express Operational Intent Through Composition"
status: "draft"
code_included: true
---

# 42.5 “Keep background work steady and predictable”

Steady background work should be easy to explain: run the task, wait a known amount
of time, then run it again. The schedule should not look like a retry policy, a
catch-up mechanism, or a hidden control loop unless those behaviors are actually
required.

For most maintenance work, `Schedule.spaced` is the clearest contract. It waits for
the interval after a successful run completes. That makes the load predictable from
the worker's point of view: one run at a time, followed by one deliberate pause.

## Problem

You have a background task such as refreshing a cache, reconciling records,
publishing metrics, or pruning expired state. It should continue at a steady pace
without a hand-written loop, scattered sleeps, or a composed policy that makes
ordinary cadence look more complicated than it is.

## When to use it

Use this recipe when the important property is a stable gap between completed runs.
It fits work where freshness is approximate, overlapping runs would be undesirable,
and the next run should naturally move later if the current run takes longer than
usual.

This is also a good default when operators need a simple answer to "how often does
this worker create load?" With a spaced schedule, the answer is the run duration plus
the configured pause.

## When not to use it

Do not use this as failure recovery by accident. `Effect.repeat` repeats successful
values; the first failure stops the repeated effect. If transient failures should be
retried, handle that inside the repeated operation or use a separate retry policy
around the part that can fail.

Do not use `Schedule.spaced` when starts must stay close to wall-clock boundaries.
Use `Schedule.fixed` for that shape. A fixed schedule maintains an interval-based
cadence and, if a run takes longer than the interval, the next run may happen
immediately; missed runs do not pile up.

Avoid adding jitter, elapsed budgets, and count limits just to make the policy feel
more robust. Add each piece only when it states a real operational constraint.

## Schedule shape

Start with a named cadence:

```ts
import { Schedule } from "effect"

const backgroundCadence = Schedule.spaced("30 seconds")
```

`Schedule.spaced("30 seconds")` outputs the recurrence count and delays each
follow-up run by thirty seconds after the previous successful run completes. The
initial run is not delayed by the schedule; `Effect.repeat` runs the effect once
before consulting the schedule.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type RefreshError = { readonly _tag: "RefreshError" }

declare const refreshSearchIndex: Effect.Effect<void, RefreshError>

const backgroundCadence = Schedule.spaced("30 seconds")

export const program = refreshSearchIndex.pipe(
  Effect.tap(() => Console.log("search index refreshed")),
  Effect.repeat(backgroundCadence)
)
```

The policy says only one thing: after a successful refresh, wait thirty seconds
before refreshing again. If `refreshSearchIndex` fails, `program` fails. That is
usually better than silently continuing with an unclear health state.

## Variants

Use `Schedule.fixed("30 seconds")` when the cadence itself is the contract, such as a
metrics flush that should stay close to a regular interval. Slow runs can cause the
next recurrence to happen immediately, but fixed scheduling does not enqueue every
missed interval.

Use `Schedule.spaced("30 seconds").pipe(Schedule.take(10))` for a bounded diagnostic
or migration pass. The first run still happens immediately, followed by up to ten
scheduled recurrences.

Use `Schedule.jittered` only when many instances running the same cadence would
otherwise synchronize and create fleet-wide spikes. Jitter is useful for aggregate
load, but it makes a single worker less predictable.

## Notes and caveats

`Schedule.spaced` measures the delay after completion. `Schedule.fixed` aims at
fixed interval boundaries. Choose between them before adding any other combinator.

Keep failure handling separate from cadence. A common shape is a small retry policy
inside one background iteration, followed by a simple repeat schedule around the
iteration. That keeps "recover this attempt" distinct from "run the background task
again later."

An unbounded repeat is long-lived work. Give it an owner such as a scope, supervisor,
or shutdown race so it can be interrupted deliberately.
