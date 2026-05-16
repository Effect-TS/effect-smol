---
book: Effect `Schedule` Cookbook
section_number: "45.5"
section_title: "Retry infrastructure API calls"
part_title: "Part X — Real-World Recipes"
chapter_title: "45. Infrastructure and Platform Recipes"
status: "draft"
code_included: true
---

# 45.5 Retry infrastructure API calls

Infrastructure API calls often sit on a boundary between automation and shared
platform capacity. A deployment worker, reconciler, or provisioning job may need
to call a control-plane API again after a timeout, a `503`, or a `429`, but the
retry policy must not turn a temporary failure into a traffic spike.

Use `Schedule` to make that contract visible: the first call happens normally,
then typed failures are retried with bounded backoff, jitter, and an elapsed
budget.

## Problem

You are calling an infrastructure API to create, update, or inspect platform
state. The API can fail transiently because the network timed out, the provider
is overloaded, or the caller has hit a rate limit.

Retrying immediately can make the incident worse. Retrying forever can block a
worker or hold a deployment open after the useful deadline has passed. Retrying
an unsafe write can duplicate side effects.

Model retryable infrastructure failures explicitly and put the recurrence policy
in one named schedule.

## When to use it

Use this recipe when the operation is safe to attempt more than once and the
failure is plausibly temporary. Good examples include reading instance status,
refreshing a load balancer target, creating a resource with an idempotency key,
or applying the same desired state to the same resource identifier.

It is especially useful for platform workers that may run in parallel. Backoff
reduces pressure on a struggling dependency, jitter prevents many workers from
retrying in the same millisecond, and a time budget gives operators a clear
deadline for when the retry window closes.

## When not to use it

Do not retry authorization failures, malformed requests, missing tenants,
invalid resource names, or other permanent errors. Those failures should leave
the retry path immediately.

Do not retry non-idempotent writes unless the API gives you a duplicate-safe
contract, such as an idempotency key, a stable client token, an upsert by
resource name, or a documented "set desired state" endpoint.

Do not treat `429 Too Many Requests` like an ordinary `503`. A rate limit is
feedback from the provider that this caller should slow down. Preserve
`Retry-After` or quota metadata when the API gives it to you.

## Schedule shape

Start with exponential backoff, add jitter, and combine it with both a retry
count and an elapsed retry budget:

```ts
const infrastructureRetry = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
  Schedule.both(Schedule.during("20 seconds"))
)
```

`Schedule.exponential("200 millis")` produces growing delays. `Schedule.jittered`
randomizes each computed delay between 80% and 120%, which helps avoid
synchronized retries across a fleet. `Schedule.recurs(5)` allows at most five
retries after the original call. `Schedule.during("20 seconds")` stops the retry
window once the schedule's elapsed time is outside the budget.

`Schedule.both` continues only while both sides continue and uses the maximum of
their delays. In this shape, the backoff side supplies the waits while the count
and duration sides supply stopping conditions.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ApiTimeout extends Data.TaggedError("ApiTimeout")<{
  readonly operation: "CreateSubnet"
}> {}

class ApiUnavailable extends Data.TaggedError("ApiUnavailable")<{
  readonly status: 502 | 503 | 504
}> {}

class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly retryAfterMillis?: number
}> {}

class InvalidRequest extends Data.TaggedError("InvalidRequest")<{
  readonly reason: string
}> {}

type InfrastructureApiError =
  | ApiTimeout
  | ApiUnavailable
  | RateLimited
  | InvalidRequest

declare const createSubnet: (
  request: {
    readonly vpcId: string
    readonly cidrBlock: string
    readonly clientToken: string
  }
) => Effect.Effect<string, InfrastructureApiError>

const retryInfrastructureApi = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
  Schedule.both(Schedule.during("20 seconds"))
)

export const program = createSubnet({
  vpcId: "vpc-123",
  cidrBlock: "10.0.8.0/24",
  clientToken: "deploy-2026-05-16-subnet-10-0-8"
}).pipe(
  Effect.retry({
    schedule: retryInfrastructureApi,
    while: (error) =>
      error._tag === "ApiTimeout" ||
      error._tag === "ApiUnavailable" ||
      error._tag === "RateLimited"
  })
)
```

The `clientToken` is the idempotency guard. If the first request reached the
provider but the response was lost, the retry represents the same logical
operation rather than a second independent subnet creation.

`InvalidRequest` is deliberately excluded from the retry predicate. Repeating
the same malformed request would only spend retry budget and add control-plane
traffic.

## Variants

When a rate-limit response includes provider guidance, keep that information in
the typed error and use it to add delay:

```ts
import { Duration, Effect, Schedule } from "effect"

const retryRateLimitsFromHeader = Schedule.identity<RateLimited>().pipe(
  Schedule.both(Schedule.recurs(2)),
  Schedule.addDelay(([error]) =>
    Effect.succeed(Duration.millis(error.retryAfterMillis ?? 1_000))
  )
)
```

This variant is intentionally small: it waits from the provider's retry hint,
falls back to one second if the hint is missing, and allows only two retries.
Use it for endpoints where `429` should be handled differently from generic
server unavailability.

For background reconciliation, use a larger budget but keep the same shape:

```ts
const backgroundInfrastructureRetry = Schedule.exponential("1 second").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(8)),
  Schedule.both(Schedule.during("2 minutes"))
)
```

For an interactive deployment command, shorten the budget so the caller gets a
clear result quickly:

```ts
const interactiveInfrastructureRetry = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3)),
  Schedule.both(Schedule.during("5 seconds"))
)
```

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule after an attempt fails.
The first infrastructure API call is not delayed, and defects or interruptions
are not treated as typed retry failures.

`Schedule.during` is a retry-window budget, not a hard deadline for an
individual HTTP request. If each API attempt also needs its own timeout, put
that timeout around the API call itself and then retry the resulting typed
timeout failure.

Backoff and jitter protect the provider, but they do not make a write safe.
Idempotency is a property of the API request and the provider contract. Use a
stable client token, resource name, deduplication key, or "set desired state"
operation before retrying writes.

Keep rate-limit handling explicit. A generic jittered backoff is acceptable
when no retry hint exists, but provider guidance such as `Retry-After` should
usually win over a guessed delay.
