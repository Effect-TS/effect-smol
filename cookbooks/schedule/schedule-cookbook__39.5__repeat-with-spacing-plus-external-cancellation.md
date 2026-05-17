---
book: Effect `Schedule` Cookbook
section_number: "39.5"
section_title: "Repeat with spacing plus external cancellation"
part_title: "Part IX — Composition Recipes"
chapter_title: "39. Combine Delay Strategies and Stop Conditions"
status: "draft"
code_included: true
---

# 39.5 Repeat with spacing plus external cancellation

Use a schedule for repeat cadence and Effect interruption for lifetime. The
schedule decides when the next successful iteration should happen; cancellation
stops the fiber running the loop.

## Problem

You have a heartbeat, sync, metrics flush, lease refresh, or maintenance step
that should run once, then repeat with a fixed gap after each successful run.
An external shutdown signal must be able to stop it immediately, including
while it is sleeping between runs.

Do not put cancellation into the schedule by polling mutable state from
`Schedule.while`. A schedule makes decisions after the effect has produced an
input for the next scheduling step. External cancellation should interrupt the
fiber running the repeated effect.

## When to use it

Use this recipe for supervised background loops where the cadence is stable but
lifetime is owned by something else: a server shutdown hook, a closing scope,
user cancellation, or a worker coordinator. The schedule answers only cadence
questions.

## When not to use it

Do not use `Effect.repeat` when the repeated action's failure should be ignored
and retried. `Effect.repeat` repeats successes and stops on the first failure.
Use `Effect.retry` for failure-driven retry policies.

Also avoid this shape when the stop condition is ordinary domain data from the
action itself. Polling a job status until it is no longer `Running` belongs in
the schedule with `Schedule.while`; a process shutdown signal belongs outside
the schedule.

## Schedule shape

`Schedule.spaced("30 seconds")` waits for the given duration after each
successful run before the next repetition. The initial run is not delayed by the
schedule; `Effect.repeat` runs the effect once first, then asks the schedule
whether and when to repeat.

Use `Schedule.fixed` instead only when wall-clock cadence matters more than
spacing after completion. Here, `Schedule.spaced` is usually clearer because slow
work naturally pushes the next run later.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

let heartbeats = 0

const sendHeartbeat = Effect.gen(function*() {
  heartbeats += 1
  yield* Console.log(`heartbeat ${heartbeats}`)
})

const waitForShutdown = Effect.gen(function*() {
  yield* Effect.sleep("75 millis")
  yield* Console.log("shutdown signal")
})

const heartbeatCadence = Schedule.spaced("20 millis")

const heartbeatLoop = Effect.repeat(sendHeartbeat, heartbeatCadence)

const program = Effect.raceFirst(
  heartbeatLoop,
  waitForShutdown
)

Effect.runPromise(program)
```

The schedule owns only the gap between successful heartbeats. `waitForShutdown`
is an external lifetime signal. `Effect.raceFirst` runs both effects and
interrupts the loser when one side completes. If shutdown wins, the heartbeat
loop is interrupted even if it is waiting for the next scheduled run.

## Variants

- Add `Schedule.jittered` to the cadence when many instances might otherwise send heartbeats at the same time.
- Add `Schedule.take` only when the loop has an internal maximum number of successful repetitions. Do not use it as a substitute for shutdown.
- Fork the repeated effect in a scope when lifetime should be tied to scope closing. Scope closure interrupts the child fiber; the schedule still describes only the repeat timing.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule. The schedule does not see typed failures from `sendHeartbeat`; the first failure stops the repeat. If failures are expected and should be retried, classify that separately and use `Effect.retry` around the failing operation or around a smaller part of the workflow.

Interruption is not a schedule output and should not be modeled as one. Let `Schedule` handle recurrence mechanics: spacing, limits, elapsed budgets, jitter, and predicates over repeated values. Let Effect supervision, scope lifetime, `Effect.raceFirst`, or explicit fiber interruption handle cancellation.
