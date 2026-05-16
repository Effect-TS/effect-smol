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

When many services depend on the same API, database, broker, cache, or control
plane, synchronized retries can make a partial outage worse. Every caller sees
the same failure, computes the same delay, wakes up together, and sends another
burst to the dependency at exactly the wrong time.

Jitter protects the shared dependency by spreading those follow-up attempts
around the base delay. It does not reduce the number of allowed retries by
itself, but it makes the pressure less bursty and gives other callers a fairer
chance to use the same limited capacity.

## Problem

You need to retry a safe downstream call when the dependency returns transient
errors such as rate limits, overload, or temporary unavailability.

A plain exponential backoff reduces retry frequency, but a fleet using the same
policy can still retry in lockstep. That is especially harmful when the
dependency enforces shared rate limits or quota buckets. The retry policy should
slow down, stop within explicit bounds, and avoid making every client compete at
the same instant.

## When to use it

Use this recipe when many independent clients, workers, pods, fibers, or
scheduled jobs call the same downstream dependency and may see the same
transient failure at roughly the same time.

It fits idempotent reads, idempotent writes, reconnect attempts, status checks,
and remote calls protected by shared rate limits. It is also useful for
multi-tenant systems where one busy tenant should not cause every other caller
to lose a fair chance at the dependency.

## When not to use it

Do not use jitter to retry permanent failures. Invalid requests, authorization
failures, malformed payloads, exhausted hard quotas, and unsafe non-idempotent
writes should be classified before retry is applied.

Do not treat jitter as a replacement for real admission control. Server-side
rate limits, queues, circuit breakers, and concurrency limits still matter.
Jitter only changes when the next recurrence happens.

## Schedule shape

Start with the backoff shape that matches the dependency, add jitter to spread
callers around each computed delay, and then compose explicit bounds:

```ts
Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(6)),
  Schedule.both(Schedule.during("20 seconds"))
)
```

`Schedule.exponential("200 millis")` increases the delay after repeated
failures. `Schedule.jittered` randomly adjusts each recurrence delay between
80% and 120% of the original delay. The count and time bounds keep the retry
policy from turning a downstream incident into an unbounded background load.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

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

declare const writeAuditEvent: Effect.Effect<void, DownstreamError>

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

const sharedDependencyRetry = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(6)),
  Schedule.both(Schedule.during("20 seconds"))
)

export const program = writeAuditEvent.pipe(
  Effect.retry({
    schedule: sharedDependencyRetry,
    while: isRetryableDownstreamError
  })
)
```

The first call to `writeAuditEvent` is immediate. If it fails with
`RateLimited`, `DependencyOverloaded`, or `DependencyUnavailable`, the retry
waits according to the jittered backoff. If it fails with `BadRequest`, retry
does not run because another attempt would send the same invalid request.

Across a fleet, every caller still follows the same operational policy, but
each recurrence chooses its own adjusted delay. That makes retries less likely
to arrive as synchronized waves against the shared dependency.

## Variants

For a strict public API rate limit, prefer any explicit provider signal such as
`Retry-After` when it is available. Use jittered exponential backoff as the
fallback when the dependency only tells you that the request should be retried
later.

For background workers, keep jitter enabled and consider longer base delays.
Background work usually benefits more from protecting shared capacity than from
retrying as quickly as possible.

For user-facing requests, reduce the retry count or elapsed budget so the user
gets a timely failure. Jitter still helps fairness, but the caller experience
should define the maximum wait.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. The schedule decides whether
and when to make another attempt after the original effect has failed.

`Schedule.jittered` preserves the schedule output and changes only the computed
delay. In Effect, the jitter range is fixed at 80% to 120% of the original
delay.

Jitter improves fairness by reducing synchronized contention, but it does not
guarantee equal access. If fairness is a hard requirement, pair jitter with
server-side quotas, tenant-aware queues, or explicit concurrency controls.
