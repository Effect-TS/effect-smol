---
book: Effect `Schedule` Cookbook
section_number: "29.5"
section_title: "When not to add jitter"
part_title: "Part VI — Jitter Recipes"
chapter_title: "29. Jitter Tradeoffs"
status: "draft"
code_included: true
---

# 29.5 When not to add jitter

Jitter is useful for desynchronizing callers, but it is the wrong tool when exact
timing is part of the contract.

## Problem

Before applying `Schedule.jittered`, identify what readers should rely on: the
exact cadence, or only an approximate cadence around a base delay. A randomized
recurrence may fire earlier or later than the wrapped schedule would choose, so
it should be a deliberate load-shaping decision.

## When to use it

Skip jitter when the exact delay is meaningful:

- a protocol heartbeat, maintenance tick, or sampling loop must run at a known
  cadence
- a test needs deterministic virtual-time advancement
- a user-visible retry, refresh, or progress check should feel predictable
- a small single-instance loop has no fleet-wide synchronization problem

In those cases, use the schedule that states the real timing requirement:
`Schedule.fixed` for wall-clock cadence, `Schedule.spaced` for a gap after work
finishes, `Schedule.exponential` for deterministic backoff, and
`Schedule.recurs`, `Schedule.take`, or `Schedule.during` for visible bounds.

## When not to use it

Do not add `Schedule.jittered` just because a schedule repeats. A single worker
that drains a local queue every second does not need random timing unless it is
competing with other workers or protecting a shared dependency. A UI path that
promises "try again in 5 seconds" should not sometimes wait 4 seconds and
sometimes 6 seconds. A test that advances `TestClock` by exact intervals should
not depend on a randomized delay range.

Also avoid jitter when the schedule is documenting an external contract. Cron
boundaries, billing windows, lease renewals, and protocol timeouts usually need
predictability more than desynchronization.

## Schedule shape

Choose the deterministic shape first and leave it unjittered when precision is
the requirement:

```ts
import { Effect, Schedule } from "effect"

declare const sendHeartbeat: Effect.Effect<void>
declare const refreshVisibleStatus: Effect.Effect<void>
declare const drainSmallQueue: Effect.Effect<void>

const heartbeatCadence = Schedule.fixed("30 seconds")

const visibleRefreshCadence = Schedule.spaced("5 seconds").pipe(
  Schedule.take(12)
)

const smallQueueCadence = Schedule.spaced("1 second")

export const heartbeatLoop = Effect.repeat(sendHeartbeat, heartbeatCadence)

export const visibleRefreshLoop = Effect.repeat(
  refreshVisibleStatus,
  visibleRefreshCadence
)

export const smallQueueLoop = Effect.repeat(
  drainSmallQueue,
  smallQueueCadence
)
```

These schedules are intentionally not piped through `Schedule.jittered`. The
heartbeat keeps a fixed cadence, the visible refresh keeps a predictable
five-second gap with a clear limit, and the single-instance queue loop stays
simple because there is no synchronized fleet to spread.

## Code

```ts
import { Effect, Schedule } from "effect"

type PollError = { readonly _tag: "PollError" }

declare const pollUserVisibleStatus: Effect.Effect<string, PollError>

const predictableStatusPolling = Schedule.spaced("2 seconds").pipe(
  Schedule.take(15)
)

export const program = Effect.repeat(
  pollUserVisibleStatus,
  predictableStatusPolling
)
```

The next poll happens after a deterministic two-second gap, and the loop stops
after the configured number of recurrences. Adding `Schedule.jittered` here
would change the user-visible rhythm without improving safety for a
single-user workflow.

## Variants

For tests, prefer deterministic schedules and advance virtual time by the exact
delay the schedule promises. Test jittered policies separately by asserting
that delays stay within Effect's `80%` to `120%` jitter range instead of
asserting one exact delay.

For exact wall-clock cadence, prefer `Schedule.fixed`. For "wait this long
after the previous run finishes", prefer `Schedule.spaced`. For a small
single-instance loop, start with the simplest deterministic cadence and add
jitter only after there is an actual coordination or downstream-load problem.

## Notes and caveats

`Schedule.jittered` changes only the recurrence delay. It does not change which
errors are retryable, when a schedule stops, or whether a repeated operation is
safe. If the problem is overload, quota enforcement, or too many concurrent
callers, jitter may be one useful tool, but it is not a replacement for limits,
classification, or admission control.
