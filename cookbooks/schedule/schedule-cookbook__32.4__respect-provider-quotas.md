---
book: Effect `Schedule` Cookbook
section_number: "32.4"
section_title: "Respect provider quotas"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "32. Space User-Facing Side Effects"
status: "draft"
code_included: true
---

# 32.4 Respect provider quotas

Provider quotas turn retry timing into part of your API contract. Use a
fixed-spacing schedule when the important rule is a minimum gap between
attempts: the first call still happens immediately, and the schedule controls
only the follow-up attempts after a typed failure.

## Problem

A provider enforces a documented per-tenant quota, such as one request per
second. A retry policy that fires several quick attempts after a timeout can
violate that quota even though the code looks small and local.

Some failures are worth retrying: temporary network loss, `429 Too Many
Requests`, or a short-lived server error. Other failures should stop
immediately: malformed requests, invalid credentials, forbidden access, or an
exhausted hard quota.

You want the retry policy to show three things directly:

- the minimum spacing between retry attempts
- the maximum number of extra provider calls
- which failures are retryable quota or availability signals

## When to use it

Use this recipe when a single client, worker, or user-facing path needs to avoid
bursty retries against a quota-protected provider. It is a good fit for
idempotent API calls such as sending a notification with a deduplication key,
refreshing customer metadata, checking delivery status, or submitting a
provider request whose retry contract is documented.

Fixed spacing is clearest when the provider quota is expressed as a steady
rate: one request per second, twelve requests per minute, or one polling call
every few seconds. In those cases, `Schedule.spaced` states the operational
rule more directly than exponential backoff.

## When not to use it

Do not use a local schedule as a fleet-wide rate limiter. A one-second
`Schedule.spaced` policy spaces one retrying effect. It does not coordinate all
fibers, processes, tenants, or deployments sharing the same provider quota.

Do not retry permanent failures. Classify errors before the schedule is allowed
to recur, and keep unsafe non-idempotent writes out of this path unless the
provider gives you an idempotency key or equivalent replay guarantee.

Do not ignore provider guidance. If the response includes `Retry-After` or a
quota reset timestamp, prefer that value for the rate-limit case and use fixed
spacing as a conservative fallback.

## Schedule shape

Combine a fixed interval with a retry limit and a classification predicate:

```ts
Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(3)),
  Schedule.while(({ input }) => isRetryableProviderError(input))
)
```

`Schedule.spaced("1 second")` recurs continuously with a one-second delay
between attempts. `Schedule.recurs(3)` allows at most three retries after the
original attempt. `Schedule.both` keeps both constraints: the policy continues
only while both schedules continue, and the effective delay is the maximum of
their delays.

`Schedule.while` receives the retry input. With `Effect.retry`, that input is
the typed failure from the effect, so the predicate is where domain
classification meets the timing policy.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly status: number
  readonly reason: string
}> {}

interface DeliveryReceipt {
  readonly messageId: string
  readonly accepted: boolean
}

declare const sendProviderMessage: (request: {
  readonly tenantId: string
  readonly messageId: string
  readonly idempotencyKey: string
}) => Effect.Effect<DeliveryReceipt, ProviderError>

const isRetryableProviderError = (error: ProviderError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status === 500 ||
  error.status === 502 ||
  error.status === 503 ||
  error.status === 504

const providerQuotaPolicy = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(3)),
  Schedule.while(({ input }) => isRetryableProviderError(input))
)

export const program = sendProviderMessage({
  tenantId: "tenant_123",
  messageId: "message_456",
  idempotencyKey: "tenant_123:message_456"
}).pipe(
  Effect.retry(providerQuotaPolicy)
)
```

The original `sendProviderMessage` attempt is not delayed. If it fails with a
retryable `ProviderError`, `Effect.retry` feeds that error into the schedule.
The schedule waits one second before the next attempt and stops after three
retries, or sooner if the next failure is not classified as retryable.

The idempotency key is part of the example on purpose. Spacing controls when a
retry happens; it does not make a duplicate write safe.

## Variants

For a stricter quota, choose spacing from the published limit. A provider that
allows twelve requests per minute may need `Schedule.spaced("5 seconds")`, not
an arbitrary short delay.

For user-facing flows, reduce the retry count or add an elapsed budget so the
caller gets a timely answer. For background work, a longer interval and more
attempts may be reasonable if the provider contract permits it.

For many workers sharing one provider account, keep this schedule as the local
retry shape and add a separate shared rate limiter, queue, or admission control
around the provider call.

## Notes and caveats

`Effect.retry` is failure-driven. Successful provider responses end the retry
loop immediately; only typed failures are passed to the schedule as input.

`Schedule.spaced` is unbounded by itself. Always combine it with a retry limit,
elapsed budget, domain predicate, or enclosing workflow lifetime when calling a
third-party API.

Rate limits and retry classification are related but separate. A `429` can be
retryable when quota will refill soon. A hard quota exhaustion, invalid API key,
or forbidden tenant usually should not retry at all.
