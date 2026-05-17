---
book: Effect `Schedule` Cookbook
section_number: "26.5"
section_title: "Shared downstream dependencies"
part_title: "Part VI — Jitter Recipes"
chapter_title: "26. Why Jitter Exists"
status: "draft"
code_included: true
---

# 26.5 Shared downstream dependencies

Use jitter to protect a shared dependency by spreading retries around a bounded
backoff policy.

## Problem

A plain exponential backoff reduces retry frequency for one caller, but a fleet
using the same policy can still retry in lockstep. That is especially harmful
when the dependency enforces shared rate limits, quota buckets, or expensive
cold paths. The retry policy should slow down, stop within explicit bounds, and
avoid making every client compete at the same instant.

## When to use it

Use it when many clients, workers, pods, fibers, or scheduled jobs call the same
downstream dependency and may see the same transient failure at roughly the same
time.

It fits idempotent reads, idempotent writes, reconnect attempts, status checks,
and remote calls protected by shared rate limits.

## When not to use it

Do not use jitter to retry permanent failures. Invalid requests, authorization
failures, malformed payloads, exhausted hard quotas, and unsafe non-idempotent
writes should be classified before retrying.

Do not treat jitter as a replacement for admission control. Server-side rate
limits, queues, circuit breakers, and concurrency limits still matter.

## Schedule shape

Start with the backoff shape that matches the dependency, add jitter, then add
explicit bounds. A typical policy is `Schedule.exponential("200 millis")`, then
`Schedule.jittered`, then `Schedule.both(Schedule.recurs(6))`, then
`Schedule.both(Schedule.during("20 seconds"))`.

`Schedule.jittered` randomly adjusts each recurrence delay between 80% and 120%
of the original delay. The count and time bounds keep the retry policy from
turning a downstream incident into unbounded background load.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly dependency: string
}> {}

class DependencyOverloaded extends Data.TaggedError("DependencyOverloaded")<{
  readonly dependency: string
}> {}

class DependencyUnavailable extends Data.TaggedError("DependencyUnavailable")<{
  readonly dependency: string
}> {}

class BadRequest extends Data.TaggedError("BadRequest")<{
  readonly message: string
}> {}

type DownstreamError =
  | RateLimited
  | DependencyOverloaded
  | DependencyUnavailable
  | BadRequest

const isRetryableDownstreamError = (error: DownstreamError): boolean => {
  switch (error._tag) {
    case "RateLimited":
    case "DependencyOverloaded":
    case "DependencyUnavailable":
      return true
    case "BadRequest":
      return false
  }
}

let attempts = 0

const writeAuditEvent = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`audit write attempt ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail(new RateLimited({ dependency: "audit-api" }))
  }
  if (attempts === 2) {
    return yield* Effect.fail(
      new DependencyOverloaded({ dependency: "audit-api" })
    )
  }

  yield* Console.log("audit event written")
})

const sharedDependencyRetry = Schedule.exponential("25 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(30)))
  ),
  Schedule.both(Schedule.recurs(6)),
  Schedule.both(Schedule.during("20 seconds"))
)

const program = writeAuditEvent.pipe(
  Effect.retry({
    schedule: sharedDependencyRetry,
    while: isRetryableDownstreamError
  })
)

Effect.runPromise(program)
```

`BadRequest` is not retried because another attempt would send the same invalid
request. Transient downstream failures use jittered backoff with explicit count,
time, and maximum-delay bounds.

## Variants

For public API rate limits, prefer provider signals such as `Retry-After` when
available. Use jittered exponential backoff as the fallback when the dependency
only says to retry later. For user-facing requests, reduce the retry count or
elapsed budget so the caller gets a timely failure.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. The schedule decides whether
and when to make another attempt after the original effect has failed.

Jitter improves fairness by reducing synchronized contention, but it does not
guarantee equal access. If fairness is a hard requirement, pair jitter with
server-side quotas, tenant-aware queues, or explicit concurrency controls.
