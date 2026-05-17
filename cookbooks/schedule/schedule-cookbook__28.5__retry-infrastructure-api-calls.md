---
book: "Effect `Schedule` Cookbook"
section_number: "28.5"
section_title: "Retry infrastructure API calls"
part_title: "Part VII — Real-World Recipes"
chapter_title: "28. Infrastructure and Platform Recipes"
status: "draft"
code_included: true
---

# 28.5 Retry infrastructure API calls

Infrastructure retries happen against shared control-plane capacity. A useful
retry policy gives transient failures time to clear without turning automation
into a traffic spike.

## Problem

A provisioning worker calls a provider API to create a subnet. The request may
time out, receive a `503`, or hit a `429`; invalid requests and unsafe writes
should leave the retry path immediately.

Retrying immediately can make the incident worse. Retrying forever can hold a
worker or deployment open past its useful deadline. Retrying an unsafe write can
duplicate side effects. Model retryable infrastructure failures explicitly and
put the recurrence policy in one named schedule.

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
count and an elapsed retry budget. `Schedule.both` continues only while both
sides continue and uses the maximum of their delays; the backoff side supplies
the waits while the count and duration schedules supply stopping conditions.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

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

let attempts = 0

const createSubnet = Effect.fnUntraced(function*(request: {
  readonly vpcId: string
  readonly cidrBlock: string
  readonly clientToken: string
}) {
  attempts += 1
  yield* Console.log(`create subnet attempt ${attempts} with ${request.clientToken}`)

  if (attempts === 1) {
    return yield* Effect.fail(new ApiTimeout({ operation: "CreateSubnet" }))
  }
  if (attempts === 2) {
    return yield* Effect.fail(new ApiUnavailable({ status: 503 }))
  }

  return `subnet-${request.cidrBlock}`
})

const retryInfrastructureApi = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
  Schedule.both(Schedule.during("200 millis"))
)

const program = createSubnet({
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
  }),
  Effect.flatMap((subnetId) => Console.log(`created ${subnetId}`)),
  Effect.catch((error: InfrastructureApiError) =>
    Console.log(`infrastructure call failed: ${error._tag}`)
  )
)

void Effect.runPromise(program)
```

The `clientToken` is the idempotency guard. If the first request reached the
provider but the response was lost, the retry represents the same logical
operation rather than a second independent subnet creation.

`InvalidRequest` is deliberately excluded from the retry predicate. Repeating
the same malformed request would only spend retry budget and add control-plane
traffic.

## Variants

When a rate-limit response includes provider guidance, keep that information in
the typed error and prefer the provider's `Retry-After` timing over a guessed
delay. For background reconciliation, use a larger budget but keep the same
shape. For an interactive deployment command, shorten the budget so the caller
gets a clear result quickly.

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
