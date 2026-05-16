---
book: Effect `Schedule` Cookbook
section_number: "27.5"
section_title: "Jittered retries after infrastructure incidents"
part_title: "Part VI — Jitter Recipes"
chapter_title: "27. Jitter for Retry"
status: "draft"
code_included: true
---

# 27.5 Jittered retries after infrastructure incidents

After an infrastructure incident, the dangerous moment is often the recovery
window. A database primary comes back, a service mesh route starts accepting
traffic again, or a regional dependency begins returning healthy responses. If
every client, worker, and service replica retries on the same deterministic
backoff boundaries, recovery can turn into a second load spike.

Use a jittered retry schedule when many callers may observe the same outage and
then try to recover together. The schedule keeps the backoff policy visible,
while `Schedule.jittered` spreads each retry delay so the fleet does not move in
one synchronized wave.

## Problem

A shared infrastructure dependency has failed or restarted, and many callers
are waiting to retry the same operation. A plain exponential policy helps each
caller back off, but identical callers still retry at identical boundaries:
200 milliseconds, 400 milliseconds, 800 milliseconds, and so on.

Those aligned retries can hit the recovering dependency exactly when it is
least able to absorb a burst. Add jitter after choosing the base cadence:

```ts
const recoveryRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(8))
)
```

In Effect, `Schedule.jittered` randomly adjusts each recurrence delay between
80% and 120% of the delay produced by the wrapped schedule.

## When to use it

Use this recipe for post-incident recovery paths that may run across a fleet:
reconnecting to a database, re-establishing cache clients, retrying service
discovery calls, refreshing credentials after an identity provider outage, or
resuming workers after a broker restart.

It fits transient failures where retrying is expected to succeed once the
dependency stabilizes. The operation should be safe to retry, and the retry
policy should still have a clear limit so the incident does not create
unbounded background pressure.

Use jitter as a refinement to a deliberate retry shape. Choose the base delay,
growth rate, and retry count first; then apply `Schedule.jittered` so callers
keep the same operational shape while avoiding identical retry timestamps.

## When not to use it

Do not use jitter to make permanent failures look transient. Bad credentials,
invalid configuration, malformed requests, incompatible schema versions, and
other deterministic failures should stop before they reach the retry policy.

Do not rely on jitter alone when the recovering dependency needs hard
protection. If the fleet can produce more retry traffic than the dependency can
handle, combine jitter with concurrency limits, rate limits, circuit breakers,
queueing, or admission control.

Do not use this policy for unsafe non-idempotent operations unless the operation
has an idempotency key, de-duplication, transactional boundary, or another
guarantee that repeated execution is acceptable.

## Schedule shape

`Schedule.exponential("200 millis")` starts with a 200 millisecond delay and,
with the default factor of `2`, grows after each failure: 200 milliseconds, 400
milliseconds, 800 milliseconds, 1.6 seconds, and so on.

`Schedule.jittered` wraps that schedule and randomly adjusts each selected
delay. Effect's jitter bounds are fixed at 80% to 120% of the original delay:

- a 200 millisecond delay becomes 160 to 240 milliseconds
- a 400 millisecond delay becomes 320 to 480 milliseconds
- an 800 millisecond delay becomes 640 to 960 milliseconds

The policy is still exponential, but callers no longer share the exact same
retry boundary. During recovery, that small difference is often enough to turn a
single synchronized retry spike into a wider stream of retry attempts.

`Schedule.both(Schedule.recurs(8))` adds the retry limit. Both schedules must
continue, so the policy allows at most eight retries after the original attempt.
The exponential schedule contributes the delay, `Schedule.jittered` spreads
that delay, and `Schedule.recurs(8)` contributes the stopping condition.

With `Effect.retry`, the original effect runs immediately. After a typed
failure, the failure is fed to the schedule. If the schedule continues, the next
attempt waits for the jittered delay. If the schedule stops,
`Effect.retry` propagates the last typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class InfrastructureError extends Data.TaggedError("InfrastructureError")<{
  readonly dependency: "Database" | "Cache" | "IdentityProvider"
  readonly reason: "Unavailable" | "Overloaded" | "Restarting" | "Misconfigured"
}> {}

declare const reconnectInfrastructure: Effect.Effect<void, InfrastructureError>

const isRecoverableInfrastructureError = (error: InfrastructureError) =>
  error.reason === "Unavailable" ||
  error.reason === "Overloaded" ||
  error.reason === "Restarting"

const recoveryRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(8))
)

export const program = reconnectInfrastructure.pipe(
  Effect.retry({
    schedule: recoveryRetryPolicy,
    while: isRecoverableInfrastructureError
  })
)
```

`program` attempts the reconnect immediately. If the dependency is unavailable,
overloaded, or restarting, the retry policy waits with exponential backoff plus
jitter. If the error is `Misconfigured`, the `while` predicate stops retrying
immediately because waiting will not repair the configuration.

Across a fleet, the first retry waits somewhere from 160 to 240 milliseconds,
the second retry waits somewhere from 320 to 480 milliseconds, and later retries
continue to spread around the exponential delay. Each instance still backs off,
but the recovering dependency does not receive one coordinated burst at every
retry boundary.

If all eight retries fail, `Effect.retry` returns the final
`InfrastructureError`.

## Variants

For a slower recovery path, start with a larger base delay:

```ts
const conservativeRecoveryPolicy = Schedule.exponential("1 second").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(10))
)
```

This keeps early recovery pressure lower while still spreading callers around
each exponential delay.

For a steady retry cadence during a known maintenance window, jitter a spaced
schedule:

```ts
const steadyRecoveryPolicy = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(12))
)
```

Each retry waits between 4 and 6 seconds instead of every caller retrying
exactly every 5 seconds.

For a recovery path that must stop within a wall-clock budget, combine the
jittered cadence with `Schedule.during`:

```ts
const budgetedRecoveryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.during("2 minutes"))
)
```

The policy continues only while the elapsed schedule time remains within the
two-minute budget. Use this when operators need a bounded recovery attempt
before surfacing the failure to a supervisor, health check, or alerting path.

## Notes and caveats

`Schedule.jittered` changes timing, not retry eligibility. Keep failure
classification close to the effect with `while`, `until`, or a narrower typed
error model.

`Schedule.jittered` has fixed bounds in Effect: each selected delay is adjusted
between 80% and 120% of the original delay.

The first execution is not delayed. Jitter applies to recurrence delays after
the effect has failed and the retry schedule has decided to continue.

Jitter reduces alignment, but it does not reduce the number of callers
retrying. For large fleets, pair it with load-shedding mechanisms that cap total
pressure on the recovering dependency.

`Schedule.recurs(8)` means eight retries after the original attempt, not eight
total executions.

The composed schedule output is nested schedule output. Plain `Effect.retry`
uses the schedule for timing and stopping, but the successful value is still the
value produced by the retried effect.
