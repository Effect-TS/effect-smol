---
book: Effect `Schedule` Cookbook
section_number: "18.3"
section_title: "Warm-up polling for startup tasks"
part_title: "Part IV — Polling Recipes"
chapter_title: "18. Poll Aggressively at First, Then Slow Down"
status: "draft"
code_included: true
---

# 18.3 Warm-up polling for startup tasks

Use this recipe for startup work that often becomes ready quickly, but may need
a slower follow-up cadence if warm-up takes longer. The schedule starts with a
tight readiness burst and then backs off.

## Problem

You want the first few readiness observations to happen close together because
early readiness matters. If the task takes longer than expected, polling should
continue at a slower cadence instead of keeping startup in an aggressive loop.

## When to use it

Use this when startup can proceed as soon as a successful status check reports a
ready domain state, and the task usually becomes ready within the first few
seconds.

This is a good fit for startup warm-up work owned by the same process or
deployment unit, where frequent early checks improve startup latency but a
longer warm-up should not keep producing rapid status calls.

## When not to use it

Do not use this as a dependency retry policy. If the readiness check itself can
fail because a database, network, or remote service is not accepting requests
yet, handle that failure separately with retry.

Do not use this when startup must fail after a strict deadline. This recipe
slows polling after the warm-up burst; it does not impose a hard startup
timeout.

Do not use an aggressive warm-up interval when the status check performs heavy
work or contends with the startup task it is observing.

## Schedule shape

Sequence a short warm-up cadence into a slower cadence, then stop the whole
policy when the latest successful status is ready:

```ts
Schedule.spaced("200 millis").pipe(
  Schedule.take(10),
  Schedule.andThen(Schedule.spaced("2 seconds")),
  Schedule.satisfiesInputType<StartupStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "starting")
)
```

`Schedule.spaced("200 millis").pipe(Schedule.take(10))` supplies the warm-up
burst after the immediate first check. `Schedule.andThen` moves to
`Schedule.spaced("2 seconds")` once that burst is exhausted. The
`Schedule.while` predicate is applied after the sequencing, so a ready status
stops both the warm-up phase and the slower phase.

`Schedule.passthrough` keeps the latest `StartupStatus` as the schedule output,
so the repeated effect returns the final observed status rather than the timing
schedule's numeric output.

## Code

```ts
import { Effect, Schedule } from "effect"

type StartupStatus =
  | { readonly state: "starting"; readonly loaded: number; readonly total: number }
  | { readonly state: "ready"; readonly warmedEntries: number }
  | { readonly state: "failed"; readonly reason: string }

type StatusCheckError = {
  readonly _tag: "StatusCheckError"
  readonly message: string
}

declare const checkWarmUpStatus: Effect.Effect<StartupStatus, StatusCheckError>

const warmUpPolling = Schedule.spaced("200 millis").pipe(
  Schedule.take(10),
  Schedule.andThen(Schedule.spaced("2 seconds")),
  Schedule.satisfiesInputType<StartupStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "starting")
)

const waitForWarmUpStatus = checkWarmUpStatus.pipe(
  Effect.repeat(warmUpPolling)
)
```

`checkWarmUpStatus` runs once immediately. If it reports `"ready"` or
`"failed"`, polling stops without waiting. If it reports `"starting"`, the
schedule waits 200 milliseconds between the first few recurrences, then falls
back to a two-second cadence.

The resulting effect succeeds with the latest observed `StartupStatus`. That is
usually `"ready"` or `"failed"`, but it can keep polling indefinitely in the
slower phase while the status remains `"starting"`.

## Variants

Use a shorter warm-up burst when the task is expected to settle almost
immediately:

```ts
const shortWarmUpPolling = Schedule.spaced("100 millis").pipe(
  Schedule.take(5),
  Schedule.andThen(Schedule.spaced("1 second")),
  Schedule.satisfiesInputType<StartupStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "starting")
)
```

Use a slower steady cadence when the status endpoint is only useful as a
coarse-grained startup signal. For example, keep the 200 millisecond warm-up
burst, but switch the second phase to `Schedule.spaced("5 seconds")`.

Treat `"failed"` as a successful terminal status when the status endpoint can
report domain failure. After polling returns, decide separately whether that
terminal status should fail the caller.

## Notes and caveats

`Effect.repeat` runs the status check once before the schedule controls any
recurrence. The warm-up schedule starts after that immediate observation.

Apply the readiness predicate after `Schedule.andThen`. If the predicate is
attached only to the warm-up phase, the sequenced schedule can still move into
the slower phase after the warm-up schedule completes.

`Schedule.take(10)` limits the number of warm-up recurrences; it is not the
number of total status checks. The initial status check happens before those
scheduled recurrences.

`Schedule.while` sees successful status values only. If `checkWarmUpStatus`
fails with `StatusCheckError`, `Effect.repeat` stops with that failure.

When a timing schedule reads status through `metadata.input`, constrain it with
`Schedule.satisfiesInputType<StartupStatus>()` before `Schedule.while`.
