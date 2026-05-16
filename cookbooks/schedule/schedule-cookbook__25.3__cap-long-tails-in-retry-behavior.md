---
book: Effect `Schedule` Cookbook
section_number: "25.3"
section_title: "Cap long tails in retry behavior"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "25. Delay Capping Recipes"
status: "draft"
code_included: true
---

# 25.3 Cap long tails in retry behavior

Capping long tails keeps retry behavior useful after the first few failures.
Exponential backoff is good at reducing pressure quickly, but without a ceiling
the later delays can become so large that the retry effectively disappears from
normal operational view. A capped policy keeps slowing down under failure while
still giving operators a predictable maximum wait between attempts.

## Problem

You want retry delays to grow when a dependency is unhealthy, but you do not
want the final retries to drift into minute-scale or hour-scale waits.

That long tail is risky in production. The caller may still be holding a queue
lease, a supervisor may be waiting for a worker to reconnect, or an incident
responder may be looking for the next attempt in logs and metrics. If the next
retry is far away, the system can look idle even though work is still pending.

## When to use it

Use this recipe for idempotent retry paths where the first few failures should
back off aggressively, but every later attempt must remain visible within a
known interval.

Good fits include control-plane calls, reconnect loops, queue consumers, and
background reconciliation jobs. The cap gives a concrete answer to "how long
until this tries again?" while the retry limit gives a concrete answer to "when
does this stop?"

## When not to use it

Do not use a cap to make permanent failures look transient. Validation errors,
authorization failures, malformed requests, and unsafe writes should be
classified before the retry policy is applied.

Do not treat the cap as a total timeout. A 5-second cap only bounds the delay
between attempts. The total runtime also depends on how many retries are
allowed and how long each attempted operation takes.

## Schedule shape

Start with `Schedule.exponential(base)`. According to `Schedule.ts`, it produces
a delay of `base * factor.pow(n)` and returns the current duration as its
output.

Then use `Schedule.modifyDelay` to clamp the actual delay selected for the next
recurrence:

```ts
const cappedCadence = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  )
)
```

`Duration.min(delay, Duration.seconds(5))` keeps the exponential curve while it
is below 5 seconds. Once the curve would grow past 5 seconds, the schedule keeps
waiting at most 5 seconds between retries.

Add stopping behavior separately. `Schedule.both(Schedule.recurs(8))` combines
the capped cadence with an attempt limit and stops as soon as either side stops.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class ControlPlaneUnavailable extends Data.TaggedError(
  "ControlPlaneUnavailable"
)<{
  readonly service: string
}> {}

declare const refreshRoutingTable: Effect.Effect<
  string,
  ControlPlaneUnavailable
>

const cappedBackoff = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.tapInput((error: ControlPlaneUnavailable) =>
    Console.log(`retrying ${error.service}`)
  ),
  Schedule.both(Schedule.recurs(8))
)

export const program = refreshRoutingTable.pipe(
  Effect.retry(cappedBackoff)
)
```

The first call to `refreshRoutingTable` happens immediately. If it fails with
`ControlPlaneUnavailable`, the retry policy starts at 250 milliseconds and grows
exponentially, but no retry waits more than 5 seconds. `Schedule.recurs(8)`
allows at most eight retries after the original attempt.

`Schedule.tapInput` observes the failure that caused the retry without changing
the schedule. For `Effect.retry`, schedule inputs are failures; for
`Effect.repeat`, schedule inputs are successful values.

## Variants

Use a smaller cap for interactive work:

```ts
const userFacingRetry = Schedule.exponential("50 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(1)))
  ),
  Schedule.both(Schedule.recurs(3))
)
```

Use a time budget when the whole retry window must stay bounded:

```ts
const budgetedRetry = cappedBackoff.pipe(
  Schedule.both(Schedule.during("30 seconds"))
)
```

Use jitter for fleet-wide retry paths after choosing the base cadence and cap:

```ts
const fleetRetry = cappedBackoff.pipe(
  Schedule.jittered
)
```

## Notes and caveats

`Schedule.modifyDelay` changes the delay used before the next recurrence. It
does not change the schedule output. With `Schedule.exponential`, the output is
still the exponential duration, even when the actual wait has been capped.

`Schedule.recurs(8)` means eight retries after the original attempt, not eight
total attempts.

Capping long tails is an operational visibility tool, not just a latency tweak.
It lets dashboards, logs, alerts, and humans reason about the next retry without
reading scattered sleeps or hidden counters.
