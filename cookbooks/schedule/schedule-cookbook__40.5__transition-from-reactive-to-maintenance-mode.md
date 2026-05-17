---
book: Effect `Schedule` Cookbook
section_number: "40.5"
section_title: "Transition from reactive to maintenance mode"
part_title: "Part IX — Composition Recipes"
chapter_title: "40. Warm-up and Steady-State Schedules"
status: "draft"
code_included: true
---

# 40.5 Transition from reactive to maintenance mode

Use a reactive phase followed by a maintenance phase when an operational loop
should quiet down over time. `Schedule.andThen` keeps the handoff explicit in
the policy.

## Problem

After a dependency recovery, rebuild, or incident transition, you want an
immediate health read, frequent follow-up checks for a short reactive window,
and then a slower maintenance cadence.

The policy should answer three questions directly:

- how frequently the reactive follow-up checks run
- when the reactive window ends
- what cadence remains after the transition

## When to use it

Use this when the operational need changes over time. During the reactive
phase, you care about fast feedback: did the dependency really recover, is the
queue draining, is the rebuilt index still healthy? During maintenance mode,
you care about continued visibility at a sustainable rate.

This fits background health checks, post-recovery monitoring, cache warm-up
verification, rollout observation, and other loops where "watch closely first,
then relax" is the intended behavior.

## When not to use it

Do not use this to retry failures blindly. With `Effect.repeat`, the schedule
observes successful results. If an individual health check can fail
transiently, decide separately whether that one check should be retried before
the repeat policy sees it.

Do not use a scheduled loop when a direct signal is available. A callback,
queue notification, stream event, or explicit acknowledgement is often a cleaner
way to learn that the system has moved out of the reactive state.

Do not let the maintenance phase become accidental infinite polling. If the loop
has a natural end condition, model that condition with the effect result and a
schedule predicate instead of switching to an unbounded maintenance cadence.

## Schedule shape

Build the phases separately, then sequence them with `Schedule.andThen`.

`reactiveChecks` controls the first twelve follow-up checks after the initial
successful run. Once that schedule completes, `maintenanceChecks` takes over
and continues every five minutes.

The first health check is not delayed by the schedule. It runs when the effect
starts. The schedule controls only the decisions after each successful check.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type Health =
  | { readonly _tag: "Healthy" }
  | { readonly _tag: "Degraded"; readonly reason: string }

let reads = 0

const readHealth = Effect.gen(function*() {
  reads += 1
  const health: Health = reads < 6
    ? { _tag: "Healthy" }
    : { _tag: "Degraded", reason: "sample window complete" }
  yield* Console.log(`health read ${reads}: ${health._tag}`)
  return health
})

const reactiveChecks = Schedule.spaced("10 millis").pipe(
  Schedule.take(4)
)

const maintenanceChecks = Schedule.spaced("50 millis").pipe(
  Schedule.take(2)
)

const reactiveThenMaintenance = Schedule.andThen(
  reactiveChecks,
  maintenanceChecks
)

const healthMonitor = readHealth.pipe(
  Effect.repeat(reactiveThenMaintenance)
)

const program = healthMonitor.pipe(
  Effect.flatMap(() => Console.log("reactive-to-maintenance sample finished"))
)

Effect.runPromise(program)
```

`healthMonitor` reads health immediately. If the read succeeds, it performs up
to four fast follow-up reads in this runnable sample. After that reactive
window, it switches to the slower maintenance cadence.

This schedule does not inspect whether the returned `Health` is `Healthy` or
`Degraded`; it only controls the phase timing. If the observed health should
stop or alter the loop, make that a separate part of the policy so the phase
transition remains readable.

## Variants

Use a time budget instead of a recurrence count when the reactive window is
defined by elapsed time. Use jitter when many instances may enter maintenance
mode together, for example after a deploy or regional recovery.

Keep retries for failed reads separate from the repeat cadence. A short
`Effect.retry` policy can handle transient failures of one health read, while
the sequenced repeat policy handles successful monitoring cadence.

The example bounds the maintenance phase so it terminates quickly. In a daemon,
remove that bound and let scope lifetime or explicit cancellation stop the
monitor.

## Notes and caveats

`Schedule.andThen(left, right)` runs the left schedule until it completes, then
runs the right schedule. If the right schedule is unbounded, the combined
schedule is unbounded after the transition.

`Schedule.take(12)` means twelve recurrences after the original successful run,
not twelve total executions. In this recipe, that gives one immediate health
read plus twelve reactive follow-up reads before maintenance mode begins.

`Schedule.spaced` measures the delay after the previous health read completes.
Use `Schedule.fixed` instead when the maintenance phase must align to a regular
wall-clock cadence.

`Effect.repeat` feeds successful values into the schedule. `Effect.retry` feeds
failures into the schedule. Keeping those two policies separate makes it clear
which timing applies to transient read failures and which timing applies to
normal monitoring.
