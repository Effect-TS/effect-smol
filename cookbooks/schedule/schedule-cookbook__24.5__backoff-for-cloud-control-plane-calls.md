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

Cloud control-plane retries must account for shared quotas and eventual
consistency. A write may be accepted by one part of the provider before later
reads or dependent writes can observe it.

Use bounded, jittered exponential backoff for retryable control-plane responses.
Keep retryability separate from timing so validation and authorization failures
still fail immediately.

## Problem

After a related resource is created or changed, a provider may temporarily
return:

- a rate-limit response because the account or client is over quota
- a temporary unavailable response while the control plane is overloaded
- a conflict or "not propagated yet" response while eventual consistency settles

Retry those cases inside a bounded policy. Do not retry permanent failures.

## When to use it

Use this for idempotent or deduplicated operations: adding a tag, attaching a
security group, updating a route, creating a DNS record with a stable name, or
retrying a follow-up write after a resource has been accepted but is not visible
everywhere yet.

It is common in deployment tools and reconcilers, where many workers may make
similar calls while the provider enforces account-level rate limits.

## When not to use it

Do not retry invalid regions, missing permissions, malformed requests, exhausted
hard quotas, or unsafe non-idempotent side effects.

If the provider returns `Retry-After` or a quota reset timestamp, prefer that
signal for rate limits. Generic exponential backoff is a fallback when the
provider gives no better timing.

## Schedule shape

Start with `Schedule.exponential`, add `Schedule.jittered`, then clamp the
result with `Schedule.modifyDelay` and `Duration.min`. Combine that cadence with
`Schedule.recurs` and `Schedule.during` so the call has both retry-count and
elapsed-time bounds.

Use the `while` option on `Effect.retry` to allow only rate limits, temporary
unavailability, and eventual-consistency races into the schedule.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly retryAfterMillis?: number
}> {}

class ControlPlaneUnavailable extends Data.TaggedError(
  "ControlPlaneUnavailable"
)<{}> {}

class ResourceNotPropagated extends Data.TaggedError("ResourceNotPropagated")<{
  readonly resourceId: string
}> {}

class InvalidControlPlaneRequest extends Data.TaggedError(
  "InvalidControlPlaneRequest"
)<{
  readonly reason: string
}> {}

type ControlPlaneError =
  | RateLimited
  | ControlPlaneUnavailable
  | ResourceNotPropagated
  | InvalidControlPlaneRequest

let attempts = 0

const attachSubnetToLoadBalancer: Effect.Effect<string, ControlPlaneError> =
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`control-plane attempt ${attempts}`)

    if (attempts === 1) {
      return yield* Effect.fail(new RateLimited({ retryAfterMillis: 50 }))
    }
    if (attempts === 2) {
      return yield* Effect.fail(
        new ResourceNotPropagated({ resourceId: "subnet-123" })
      )
    }
    if (attempts === 3) {
      return yield* Effect.fail(new ControlPlaneUnavailable({}))
    }

    return "load-balancer attached to subnet-123"
  })

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

const boundedControlPlaneBackoff = Schedule.exponential("20 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(100)))
  ),
  Schedule.both(Schedule.recurs(6)),
  Schedule.both(Schedule.during("2 seconds"))
)

const program = Effect.gen(function*() {
  const result = yield* attachSubnetToLoadBalancer.pipe(
    Effect.retry({
      schedule: boundedControlPlaneBackoff,
      while: isRetryableControlPlaneError
    })
  )
  yield* Console.log(result)
}).pipe(
  Effect.catch((error) =>
    Console.log(`control-plane call failed: ${error._tag}`)
  )
)

Effect.runPromise(program)
```

The retry boundary is the single control-plane call. The example succeeds after
rate limiting, propagation lag, and temporary unavailability are retried.

## Variants

Route precise provider rate-limit delays through a rate-limit-specific policy
when available, and keep bounded exponential backoff for temporary
unavailability or propagation races.

For interactive workflows, reduce the retry count and elapsed budget. For
background reconcilers, keep the cap but record attempts, last error tags, and
exhausted-budget failures.

## Notes and caveats

`Schedule.both` uses intersection semantics: the combined policy continues only
while both schedules continue. Combining backoff with `Schedule.recurs(6)` and
`Schedule.during("2 seconds")` gives both a retry-count bound and a time-budget
bound.

Backoff does not provide idempotency. Cloud control-plane writes still need
stable names, idempotency tokens, conditional updates, or provider
deduplication where the API supports them.
