---
book: Effect `Schedule` Cookbook
section_number: "45.1"
section_title: "Retry dependency checks during startup"
part_title: "Part X — Real-World Recipes"
chapter_title: "45. Infrastructure and Platform Recipes"
status: "draft"
code_included: true
---

# 45.1 Retry dependency checks during startup

Startup dependency checks sit between process boot and readiness. They should
absorb short platform races without hiding real boot failures.

## Problem

A service must prove that its database is reachable before it marks itself
ready. DNS lookup failures, refused connections, and timeouts may clear after a
short wait; bad credentials or schema mismatches should fail the process
immediately.

The policy needs three separate bounds:

- exponential backoff so repeated failures slow down
- a retry limit so one instance does not retry forever
- a startup deadline so the total waiting time is bounded

## When to use it

Use this recipe for idempotent startup probes such as database connectivity,
cache reachability, message broker readiness, feature flag client
initialization, or a search cluster health check.

It is a good fit when the service has not opened traffic yet and can afford a
short readiness delay, but operators still need a clear answer when the
dependency does not recover.

## When not to use it

Do not retry permanent startup failures. Missing secrets, bad credentials,
invalid endpoints, incompatible schema versions, and malformed configuration
should fail startup immediately.

Do not put the whole boot sequence inside the retry. Keep the retry boundary
around the small dependency check. Initialization steps that create records,
run migrations, or perform other writes need their own idempotency guarantees
before they are retried.

## Schedule shape

Start with `Schedule.exponential` for the backoff curve. It recurs forever by
itself, so add the other limits explicitly.

Use `Schedule.modifyDelay` with `Duration.min` when no individual sleep should
grow beyond a maximum. Then combine the timing policy with `Schedule.recurs`
for the retry count and `Schedule.during` for the elapsed startup budget.

`Schedule.both` is the right composition for these limits: the combined schedule
continues only while both sides continue. The backoff supplies the delay;
`recurs` and `during` supply stopping conditions.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class DependencyCheckError extends Data.TaggedError("DependencyCheckError")<{
  readonly reason:
    | "DnsLookup"
    | "ConnectionRefused"
    | "Timeout"
    | "BadCredentials"
    | "SchemaMismatch"
}> {}

declare const checkDatabase: Effect.Effect<void, DependencyCheckError>

const isRetryableStartupFailure = (error: DependencyCheckError) =>
  error.reason === "DnsLookup" ||
  error.reason === "ConnectionRefused" ||
  error.reason === "Timeout"

const startupDependencyPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(2)))
  ),
  Schedule.both(Schedule.recurs(8)),
  Schedule.both(Schedule.during("20 seconds"))
)

export const program = checkDatabase.pipe(
  Effect.retry({
    schedule: startupDependencyPolicy,
    while: isRetryableStartupFailure
  })
)
```

The first database check runs immediately. If it fails with a retryable typed
error, the schedule waits 100 milliseconds before the next attempt, then 200
milliseconds, 400 milliseconds, and so on, with each sleep capped at 2 seconds.

`Schedule.recurs(8)` allows at most eight retries after the original attempt.
`Schedule.during("20 seconds")` stops the retry policy once the schedule has
spent too much elapsed time deciding follow-up attempts. Whichever limit is hit
first wins.

If the check fails with `BadCredentials` or `SchemaMismatch`, the `while`
predicate rejects the failure and startup fails without spending the retry
budget.

## Variants

For a stricter container readiness path, reduce both the deadline and retry
count:

```ts
const fastStartupPolicy = Schedule.exponential("50 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(500)))
  ),
  Schedule.both(Schedule.recurs(5)),
  Schedule.both(Schedule.during("5 seconds"))
)
```

For a dependency that commonly takes longer during deploys, keep the first
retry quick but allow a longer total budget:

```ts
const deploymentStartupPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(12)),
  Schedule.both(Schedule.during("45 seconds"))
)
```

If many instances start at the same time, add `Schedule.jittered` before the
delay cap so they do not all retry on the same boundaries:

```ts
const fleetStartupPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(2)))
  ),
  Schedule.both(Schedule.recurs(8)),
  Schedule.both(Schedule.during("20 seconds"))
)
```

## Notes and caveats

`Effect.retry` feeds each typed failure into the schedule after the effect
fails. The original startup check is not delayed.

`Schedule.exponential` controls the shape of the waits between retries. It does
not provide a total timeout. Pair it with `Schedule.recurs` and
`Schedule.during` when startup must either become ready or fail within a known
budget.

The deadline here is a schedule deadline, not a timeout for a single check. If
one dependency check can hang, put an Effect timeout on that check before
retrying it.
