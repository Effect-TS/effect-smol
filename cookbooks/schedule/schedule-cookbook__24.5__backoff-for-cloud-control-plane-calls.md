---
book: Effect `Schedule` Cookbook
section_number: "24.5"
section_title: "Backoff for cloud control plane calls"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "24. Exponential Backoff Recipes"
status: "draft"
code_included: true
---

# 24.5 Backoff for cloud control plane calls

Cloud control-plane retries need to account for shared quotas and eventual
consistency. A request may be accepted by one part of the provider before later
reads or dependent writes can observe it.

Use a bounded, jittered exponential backoff for retryable control-plane
responses. Keep the retry predicate separate from the schedule so rate limits,
temporary unavailability, and eventual-consistency races are retried while
authorization and validation failures fail immediately.

## Problem

You need to call a cloud control-plane API after a related resource has just
been created or changed. The provider may temporarily answer with:

- a rate-limit response because the account or client is over quota
- a temporary unavailable response while the control plane is overloaded
- a conflict or "not propagated yet" response while eventual consistency settles

Treat those responses as retryable only inside a bounded policy: the first call
happens immediately, later attempts wait, and permanent failures bypass the
schedule.

## When to use it

Use this recipe for idempotent or safely deduplicated control-plane operations:
adding a tag, attaching a security group, updating a route, creating a DNS
record with a stable name, or retrying a follow-up write after a resource was
accepted but is not visible everywhere yet.

It is especially useful in deployment tools and reconcilers, where many
instances may make similar calls during a rollout and the provider enforces
account-level rate limits.

## When not to use it

Do not use backoff to make an invalid request look transient. Bad input, missing
permissions, invalid regions, exhausted hard quotas, and non-idempotent
side-effects should fail without retrying.

Do not ignore provider guidance. If the response carries a `Retry-After` value
or a richer quota reset timestamp, prefer that value for the rate-limit case or
compose it into a rate-limit-specific policy. A generic exponential fallback is
useful when the provider gives no better timing signal.

## Schedule shape

Start with exponential backoff, add jitter so a fleet does not retry in lockstep,
then clamp the final delay so the tail stays operationally predictable:

```ts
Schedule.exponential("500 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(8)),
  Schedule.both(Schedule.during("45 seconds"))
)
```

`Schedule.exponential("500 millis")` produces the increasing delay curve.
`Schedule.jittered` spreads callers around each computed delay. The
`Schedule.modifyDelay` step applies the hard five-second cap after jitter, so
randomization cannot push a wait past the bound. `Schedule.recurs(8)` allows at
most eight retries after the original attempt. `Schedule.during("45 seconds")`
adds an elapsed-time budget.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly retryAfterMillis?: number
}> {}

class ControlPlaneUnavailable extends Data.TaggedError("ControlPlaneUnavailable")<{}> {}

class ResourceNotPropagated extends Data.TaggedError("ResourceNotPropagated")<{
  readonly resourceId: string
}> {}

class InvalidControlPlaneRequest extends Data.TaggedError("InvalidControlPlaneRequest")<{
  readonly reason: string
}> {}

type ControlPlaneError =
  | RateLimited
  | ControlPlaneUnavailable
  | ResourceNotPropagated
  | InvalidControlPlaneRequest

declare const attachSubnetToLoadBalancer: Effect.Effect<string, ControlPlaneError>

const isRetryableControlPlaneError = (error: ControlPlaneError): boolean => {
  switch (error._tag) {
    case "RateLimited":
    case "ControlPlaneUnavailable":
    case "ResourceNotPropagated":
      return true
    case "InvalidControlPlaneRequest":
      return false
  }
}

const boundedControlPlaneBackoff = Schedule.exponential("500 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(8)),
  Schedule.both(Schedule.during("45 seconds"))
)

export const program = attachSubnetToLoadBalancer.pipe(
  Effect.retry({
    schedule: boundedControlPlaneBackoff,
    while: isRetryableControlPlaneError
  })
)
```

The retry boundary is the single control-plane call. `RateLimited`,
`ControlPlaneUnavailable`, and `ResourceNotPropagated` are allowed to use the
bounded backoff. `InvalidControlPlaneRequest` is not retried, because another
attempt would send the same bad request.

## Variants

If the provider returns a precise rate-limit delay, route that error through a
separate schedule that uses the provider's value instead of guessing from the
exponential curve. Keep the bounded exponential policy as a fallback for
temporary unavailability and eventual-consistency races.

For interactive workflows, reduce the retry count and elapsed budget so the
caller receives a clear failure quickly. For background reconcilers, the same
delay cap can remain useful, but the surrounding process should record attempts,
last error tags, and exhausted-budget failures so operators can see whether the
control plane is rate limiting or still converging.

When many workers may update the same account or region, keep jitter enabled.
Without it, every worker computes the same exponential delays and can create
new bursts exactly when the provider is asking clients to slow down.

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. The first execution is
not delayed; the schedule decides only whether and when to make another attempt
after a failure.

`Schedule.both` uses intersection semantics: the combined policy continues only
while both schedules continue. Combining the backoff with `Schedule.recurs(8)`
and `Schedule.during("45 seconds")` therefore gives both a retry-count bound and
a time-budget bound.

Backoff does not provide idempotency. Cloud control-plane writes should still
use stable resource names, idempotency tokens, conditional updates, or provider
deduplication where the API supports them.
