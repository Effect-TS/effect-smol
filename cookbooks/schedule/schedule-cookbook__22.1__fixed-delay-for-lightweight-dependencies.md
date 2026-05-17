---
book: Effect `Schedule` Cookbook
section_number: "22.1"
section_title: "Fixed delay for lightweight dependencies"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "22. Constant Delay Recipes"
status: "draft"
code_included: true
---

# 22.1 Fixed delay for lightweight dependencies

For a lightweight dependency, a small fixed-delay retry can be clearer than a
backoff policy. The policy waits the same amount between attempts and gives up
after a small retry count.

## Problem

A local cache, sidecar, or health endpoint may be temporarily unavailable during
startup, reload, or a brief connection reset. You want to smooth over that
narrow transient window without hiding a dependency that is genuinely down.

## When to use it

Use a fixed delay when each attempt is cheap, the dependency is local or
low-latency, and the expected recovery time is short. This fits cache lookups
that may reconnect, sidecar health checks during startup, local coordination
services, and small readiness probes.

Keep the retry count small. A fixed delay is easy to reason about because the
worst-case wait is roughly `delay * retries`, plus the time spent running the
operation itself.

## When not to use it

Do not use a fixed delay for a dependency that is overloaded, shared by many
callers, rate limited, or slow to recover. In those cases, exponential backoff,
jitter, a time budget, or a circuit breaker usually communicates the operational
intent better.

Do not retry permanent failures such as invalid cache keys, malformed requests,
authorization failures, or incompatible sidecar versions. Classify those errors
before applying the schedule.

## Schedule shape

For retrying failures with the same pause between attempts, use
`Schedule.spaced(duration)` and combine it with a finite retry limit:

```ts
Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)
```

`Schedule.spaced("100 millis")` waits 100 milliseconds before each retry.
`Schedule.recurs(4)` allows up to four retries after the original attempt. With
`Effect.retry`, the original attempt is not delayed.

Use `Schedule.fixed(duration)` when you need a wall-clock cadence for repeated
successful work. For retry delay, `Schedule.spaced` is usually the clearer
choice because the wait happens after the failed attempt completes.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class CacheUnavailable extends Data.TaggedError("CacheUnavailable")<{
  readonly reason: "Starting" | "ConnectionReset"
}> {}

class CacheMiss extends Data.TaggedError("CacheMiss")<{
  readonly key: string
}> {}

type CacheError = CacheUnavailable | CacheMiss

interface CachedUser {
  readonly id: string
  readonly name: string
}

declare const readUserFromLocalCache: (
  id: string
) => Effect.Effect<CachedUser, CacheError>

const isTransientCacheError = (error: CacheError): boolean => {
  switch (error._tag) {
    case "CacheUnavailable":
      return true
    case "CacheMiss":
      return false
  }
}

const retryLocalCacheWarmup = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

export const getCachedUser = (id: string) =>
  readUserFromLocalCache(id).pipe(
    Effect.retry({
      schedule: retryLocalCacheWarmup,
      while: isTransientCacheError
    })
  )
```

`getCachedUser` runs the cache read immediately. If the local cache reports
`CacheUnavailable`, the effect waits 100 milliseconds and tries again while the
four-retry limit still allows another attempt. If the cache reports `CacheMiss`,
retrying stops immediately because another short wait will not create the user.

If all retries fail with `CacheUnavailable`, the effect fails with the last
`CacheUnavailable` value. If any attempt succeeds, the whole effect succeeds
with the `CachedUser`.

## Variants

For a startup health probe, the same shape works with a longer delay and a small
count:

```ts
const waitForSidecarStartup = Schedule.spaced("250 millis").pipe(
  Schedule.both(Schedule.recurs(8))
)
```

For many application instances retrying the same dependency at the same time,
add jitter after choosing the base delay:

```ts
const retryCacheWithJitter = retryLocalCacheWarmup.pipe(
  Schedule.jittered
)
```

## Notes and caveats

Fixed delay is enough when the dependency is lightweight and recovery is expected
within a few attempts. It is not a general overload strategy.

The schedule receives typed failures when used with `Effect.retry`. Keep the
classification predicate close to the dependency adapter so permanent failures
do not spend the retry budget.

The first attempt is not delayed. The delay applies only between retry attempts.
