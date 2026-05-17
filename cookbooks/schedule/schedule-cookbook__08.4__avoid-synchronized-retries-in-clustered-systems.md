---
book: Effect `Schedule` Cookbook
section_number: "8.4"
section_title: "Avoid synchronized retries in clustered systems"
part_title: "Part II — Core Retry Recipes"
chapter_title: "8. Retry with Jitter"
status: "draft"
code_included: true
---

# 8.4 Avoid synchronized retries in clustered systems

This recipe shows how to reduce synchronized retry waves from clustered callers that
share the same failure.

## Problem

Several nodes, pods, workers, or service clients can observe the same failure at
roughly the same time. A fixed retry delay or identical exponential backoff
policy can then send many callers back to a recovering dependency on the same
retry boundaries.

Add jitter to the retry schedule so each caller keeps the same general backoff
shape but waits a slightly different amount of time before retrying:

```ts
const clusteredRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(8))
)
```

In Effect, `Schedule.jittered` adjusts each delay between 80% and 120% of the
delay produced by the wrapped schedule.

## When to use it

Use this recipe when the same retry policy may run concurrently in many places:
service replicas, queue consumers, background workers, cluster members, or
many fibers calling the same downstream dependency.

It fits transient cluster-wide or dependency-wide failures: temporary leader
unavailability, brief network partitions, overload responses, connection pool
exhaustion, and rolling restarts where many clients reconnect at once.

Use it after choosing the retry shape you actually want. Jitter is a refinement
to a fixed, exponential, or capped backoff policy; it does not decide whether
the operation is safe to retry or how many retries are allowed.

## When not to use it

Do not use jitter as the only protection for a cluster that can produce more
retry traffic than the dependency can handle. Jitter reduces alignment, but it
does not reduce the total number of retrying callers.

Do not use this policy for non-idempotent operations unless the operation has
an idempotency key, de-duplication, transaction boundary, or another guarantee
that repeated execution is safe.

Do not add jitter to hide an unbounded or overly aggressive policy. A cluster
retry policy should still have a retry limit, timeout, queue boundary, circuit
breaker, rate limit, or other operational bound.

## Schedule shape

`Schedule.exponential("200 millis")` starts with a 200 millisecond delay and,
with the default factor of `2`, grows after each failure: 200 milliseconds, 400
milliseconds, 800 milliseconds, 1.6 seconds, and so on.

`Schedule.jittered` wraps that schedule and randomly adjusts each chosen delay.
The adjusted delay is between 80% and 120% of the original delay:

- a 200 millisecond delay becomes 160 to 240 milliseconds
- a 400 millisecond delay becomes 320 to 480 milliseconds
- an 800 millisecond delay becomes 640 to 960 milliseconds

The schedule remains exponential in shape, but callers no longer share the
exact same retry boundary.

`Schedule.both(Schedule.recurs(8))` adds the retry limit. Both schedules must
continue, so the policy allows at most eight retries after the original
attempt. The exponential schedule contributes the delay, `Schedule.jittered`
spreads that delay, and `Schedule.recurs(8)` contributes the stopping
condition.

With `Effect.retry`, the original effect runs immediately. After a typed
failure, the failure is fed to the schedule. If the schedule continues, the
effect is retried after the jittered delay. If the retry limit is exhausted,
`Effect.retry` propagates the last typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ClusterRequestError extends Data.TaggedError("ClusterRequestError")<{
  readonly nodeId: string
  readonly reason: "Unavailable" | "Overloaded" | "Partitioned" | "InvalidRequest"
}> {}

declare const sendHeartbeat: (
  nodeId: string
) => Effect.Effect<void, ClusterRequestError>

const isRetryableClusterError = (error: ClusterRequestError) =>
  error.reason === "Unavailable" ||
  error.reason === "Overloaded" ||
  error.reason === "Partitioned"

const clusteredRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(8))
)

const heartbeatProgram = (nodeId: string) =>
  sendHeartbeat(nodeId).pipe(
    Effect.retry({
      schedule: clusteredRetryPolicy,
      while: isRetryableClusterError
    })
  )
```

`heartbeatProgram` sends one heartbeat immediately. If it fails with a
retryable typed `ClusterRequestError`, the next attempt waits for the
exponential delay after jitter has been applied.

For the first retry, each caller waits somewhere from 160 to 240 milliseconds.
For the second retry, each caller waits somewhere from 320 to 480 milliseconds.
That small spread helps many cluster members avoid retrying in one coordinated
burst.

If the error is `InvalidRequest`, the `while` predicate returns `false` and
retrying stops immediately. If all eight permitted retries fail,
`Effect.retry` returns the last `ClusterRequestError`.

## Variants

For a clustered operation that should retry at a steady interval, jitter the
fixed delay:

```ts
const jitteredFixedRetry = Schedule.spaced("1 second").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(10))
)
```

Each retry waits between 800 milliseconds and 1.2 seconds, rather than every
caller retrying exactly once per second.

For a local call site, keep the retry limit in the `Effect.retry` options:

```ts
const heartbeatProgram = (nodeId: string) =>
  sendHeartbeat(nodeId).pipe(
    Effect.retry({
      schedule: Schedule.exponential("200 millis").pipe(Schedule.jittered),
      times: 8,
      while: isRetryableClusterError
    })
  )
```

`times: 8` has the same retry-count meaning as `Schedule.recurs(8)`: eight
retries after the original attempt.

For a capped backoff where the cap may be approximate after jitter, jitter the
composed capped policy:

```ts
const jitteredNearCappedRetry = Schedule.exponential("200 millis").pipe(
  Schedule.either(Schedule.spaced("5 seconds")),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(12))
)
```

Here the capped delay is also jittered. When the capped schedule chooses 5
seconds, the actual delay can be 4 to 6 seconds because `Schedule.jittered`
adjusts the selected delay by 80% to 120%.

## Notes and caveats

`Schedule.jittered` has fixed bounds in Effect. It adjusts delays between 80%
and 120% of the original delay; this recipe does not assume configurable
jitter bounds.

Jitter changes retry timing, not retry eligibility. Keep using `while` or
`until` predicates when only some typed failures should be retried.

Jitter does not reduce the number of cluster members retrying. If too many
members can retry at once, combine jitter with admission control such as
queueing, rate limiting, concurrency limits, or circuit breakers.

The first execution is not delayed. Jitter only affects retry delays produced
by the schedule after typed failures.

`Schedule.recurs(8)` and `times: 8` mean eight retries after the original
attempt, not eight total executions.

The composed schedule output is nested schedule output. Plain `Effect.retry`
uses the schedule for timing and stopping, but the successful value is still
the value produced by the retried effect.
