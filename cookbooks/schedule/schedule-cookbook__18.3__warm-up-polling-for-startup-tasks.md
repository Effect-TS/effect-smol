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

Use this for startup work that often becomes ready quickly but may need a slower
follow-up cadence. The schedule starts with a tight readiness burst and then
backs off.

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

Sequence a short warm-up cadence into a slower cadence with `Schedule.andThen`.
Apply `Schedule.while` after the sequencing so a terminal status stops both
phases. Use `Schedule.passthrough` so the repeat result is the latest
`StartupStatus`.

## Code

```ts
import { Clock, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

type StartupStatus =
  | { readonly state: "starting"; readonly loaded: number; readonly total: number }
  | { readonly state: "ready"; readonly warmedEntries: number }
  | { readonly state: "failed"; readonly reason: string }

const warmUpPolling = Schedule.spaced("200 millis").pipe(
  Schedule.take(3),
  Schedule.andThen(Schedule.spaced("2 seconds")),
  Schedule.satisfiesInputType<StartupStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "starting")
)

const script: ReadonlyArray<StartupStatus> = [
  { state: "starting", loaded: 1, total: 4 },
  { state: "starting", loaded: 2, total: 4 },
  { state: "starting", loaded: 3, total: 4 },
  { state: "starting", loaded: 3, total: 4 },
  { state: "ready", warmedEntries: 4 }
]

let checks = 0

const checkWarmUpStatus = Effect.gen(function*() {
  const now = yield* Clock.currentTimeMillis
  const status = script[Math.min(checks, script.length - 1)]!
  checks += 1
  console.log(`t+${now}ms check ${checks}: ${status.state}`)
  return status
})

const program = Effect.gen(function*() {
  const fiber = yield* checkWarmUpStatus.pipe(
    Effect.repeat(warmUpPolling),
    Effect.forkDetach
  )

  yield* TestClock.adjust("3 seconds")

  const finalStatus = yield* Fiber.join(fiber)
  console.log("final:", finalStatus)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

The first three scheduled recurrences use the warm-up cadence. Later recurrences
use the two-second cadence.

## Variants

Use a shorter warm-up burst when the task is expected to settle almost
immediately.

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

`Schedule.take(3)` limits the number of warm-up recurrences; it is not the
number of total status checks. The initial status check happens before those
scheduled recurrences.

`Schedule.while` sees successful status values only. If `checkWarmUpStatus`
fails, `Effect.repeat` stops with that failure.
