---
book: Effect `Schedule` Cookbook
section_number: "25.2"
section_title: "Never wait more than 30 seconds"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "25. Delay Capping Recipes"
status: "draft"
code_included: true
---

# 25.2 Never wait more than 30 seconds

Use this recipe for background or service workflows that should preserve early
exponential backoff while guaranteeing that no scheduled wait exceeds 30
seconds.

## Problem

You need retry delays that grow under sustained failure, but you do not want a
long exponential tail where the next attempt might be minutes away. For
background workers, service reconnects, queue consumers, control-plane calls,
and periodic reconciliation, "wait longer" is useful, but "wait arbitrarily
long" is usually not.

The first effect evaluation still happens immediately. The 30 second rule
applies only to delays before later retry attempts.

## When to use it

Use this when a non-interactive workflow may retry for an extended period, but
operators should be able to say that no scheduled retry delay will exceed 30
seconds after the cap is reached.

This is a good fit for reconnect loops, shard processors, background sync,
lease renewal helpers, cache warmers, and service-to-service calls where the
dependency may recover independently.

It is also useful when many attempts may happen during a real incident and the
policy needs to balance two pressures: avoid hammering the dependency while it
is unhealthy, and avoid waiting too long once it becomes healthy again.

## When not to use it

Do not use a 30 second cap for an interactive request just because it is a
convenient round number. User-facing paths usually need a smaller cap, fewer
attempts, and often a total elapsed-time budget so the caller receives a clear
failure quickly.

Do not use this to retry permanent errors. Validation failures, authorization
failures, malformed requests, configuration errors, and unsafe non-idempotent
writes should be classified before the retry policy is applied.

Do not treat the cap as a stopping rule. A capped schedule can still retry
forever unless you combine it with `Schedule.recurs`, `Schedule.take`,
`Schedule.during`, or another condition that terminates the recurrence.

## Schedule shape

Start with the backoff curve you want, then clamp the delay produced by that
schedule:

```ts
Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(30)))
  )
)
```

`Schedule.exponential("250 millis")` produces a growing delay between
recurrences. `Schedule.modifyDelay` receives each proposed next delay and
returns the delay that should actually be used. `Duration.min(delay,
Duration.seconds(30))` keeps the original delay while it is below 30 seconds
and returns 30 seconds once the backoff would exceed the cap.

If you add jitter, apply the cap after jitter so the randomized delay still
obeys the maximum:

```ts
Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(30)))
  )
)
```

`Schedule.jittered` randomly adjusts each recurrence delay between 80% and 120%
of the incoming delay. Capping after jitter keeps the final wait at or below 30
seconds.

## Code

```ts
import { Duration, Effect, Schedule } from "effect"

type ServiceError =
  | { readonly _tag: "Unavailable"; readonly service: string }
  | { readonly _tag: "Timeout"; readonly service: string }

declare const refreshServiceState: Effect.Effect<void, ServiceError>

const retryWithThirtySecondDelayCap = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(30)))
  ),
  Schedule.both(Schedule.recurs(20))
)

export const program = refreshServiceState.pipe(
  Effect.retry(retryWithThirtySecondDelayCap)
)
```

`refreshServiceState` is evaluated once immediately. If it fails with a
`ServiceError`, the retry schedule starts with a short jittered exponential
delay. As failures continue, the proposed exponential delay grows, but the
actual delay used by the schedule never exceeds 30 seconds. `Schedule.recurs(20)`
keeps the example finite by allowing at most 20 retries.

## Variants

For a long-running service loop, remove the retry count only when the loop is
scoped by service lifetime and the error classification is strict. In that
case, the 30 second cap describes steady-state retry cadence, not termination.

For a user-facing path, prefer a much smaller cap, such as one or two seconds,
and combine it with a small retry count or `Schedule.during`. The caller should
not wait through many 30 second sleeps to learn that a request failed.

For fleet-wide reconnects, keep `Schedule.jittered` before the final cap. The
jitter reduces synchronized retries across instances, while the final
`Schedule.modifyDelay` preserves the "never more than 30 seconds" promise.

For polling successful observations rather than retrying failures, use
`Effect.repeat` with an input-aware stopping rule. The same delay cap technique
can be used, but the schedule input will be the successful value instead of the
failure.

## Notes and caveats

The cap applies to schedule delays, not to the runtime of the effect being
retried. If one attempt can hang for a long time, add an effect-level timeout
separately.

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. That difference matters when you add
`Schedule.while`, `Schedule.tapInput`, or `Schedule.passthrough`.

`Schedule.both` combines two schedules with intersection semantics: recurrence
continues only while both schedules continue. For delays, the combined schedule
uses the larger delay, so pairing a capped backoff with `Schedule.recurs(20)`
keeps the backoff delay and adds a retry limit.

Keep the name of the schedule honest. A name like
`retryWithThirtySecondDelayCap` communicates the operational guarantee better
than a name that only describes the implementation, such as `exponentialBackoff`.
