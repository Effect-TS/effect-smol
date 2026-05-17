---
book: "Effect `Schedule` Cookbook"
section_number: "19.2"
section_title: "Respect provider quotas"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "19. Rate Limits and User-Facing Effects"
status: "draft"
code_included: true
---

# 19.2 Respect provider quotas

Provider quotas make retry timing part of the integration contract. Use fixed
spacing when the rule is a minimum gap between attempts.

## Problem

A provider enforces a documented quota, such as one request per second. Quick
retries after a timeout or `429 Too Many Requests` can violate that quota even
when the code is local and small.

The policy should show the minimum retry spacing, the maximum number of extra
provider calls, and the failures that count as retryable quota or availability
signals.

## When to use it

Use this when one client, worker, or user-facing path must avoid bursty retries
against a quota-protected provider. It fits idempotent calls such as sending a
notification with a deduplication key, refreshing customer metadata, checking
delivery status, or submitting a provider request with a documented retry
contract.

`Schedule.spaced` is clearest when the provider quota is a steady rate.

## When not to use it

Do not use a local schedule as a fleet-wide rate limiter. A one-second
`Schedule.spaced` policy spaces one retrying effect, not every fiber, process,
tenant, or deployment sharing the account.

Do not retry permanent failures. Classify errors before the schedule is allowed
to recur.

If the response includes `Retry-After` or a quota reset timestamp, prefer that
provider guidance for the rate-limit case and keep fixed spacing as a fallback.

## Schedule shape

Combine `Schedule.spaced` with `Schedule.recurs`, then pass a retry predicate to
`Effect.retry`. The schedule controls when another attempt may happen; the
predicate controls whether a failure is allowed to use the schedule.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly status: number
  readonly reason: string
}> {}

interface DeliveryReceipt {
  readonly messageId: string
  readonly accepted: boolean
}

type ProviderRequest = {
  readonly tenantId: string
  readonly messageId: string
  readonly idempotencyKey: string
}

let attempts = 0

const sendProviderMessage = (request: ProviderRequest) =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`provider attempt ${attempts} for ${request.messageId}`)

    if (attempts === 1) {
      return yield* Effect.fail(new ProviderError({ status: 429, reason: "rate limited" }))
    }
    if (attempts === 2) {
      return yield* Effect.fail(new ProviderError({ status: 503, reason: "unavailable" }))
    }

    return { messageId: request.messageId, accepted: true } satisfies DeliveryReceipt
  })

const isRetryableProviderError = (error: ProviderError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status === 500 ||
  error.status === 502 ||
  error.status === 503 ||
  error.status === 504

const providerQuotaPolicy = Schedule.spaced("20 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = sendProviderMessage({
  tenantId: "tenant-123",
  messageId: "message-456",
  idempotencyKey: "tenant-123:message-456"
}).pipe(
  Effect.retry({
    schedule: providerQuotaPolicy,
    while: isRetryableProviderError
  }),
  Effect.tap((receipt) => Console.log(`accepted: ${receipt.accepted}`))
)

Effect.runPromise(program)
```

The original provider call is immediate. Retryable failures are spaced by the
schedule and stop after the retry count is exhausted.

## Variants

For stricter quotas, choose spacing from the published limit. Twelve requests
per minute implies at least five seconds between attempts for one worker.

For user-facing flows, reduce retry count or add an elapsed budget. For
background work, longer intervals and more attempts may be acceptable when the
provider contract permits them.

For many workers sharing one provider account, keep this as the local retry
shape and add shared admission control around the provider call.

## Notes and caveats

`Effect.retry` is failure-driven. Successful provider responses end the retry
loop immediately; typed failures are passed to the retry policy.

`Schedule.spaced` is unbounded by itself. Combine it with a retry limit, elapsed
budget, domain predicate, or enclosing workflow lifetime when calling a
third-party API.

A `429` can be retryable when quota will refill soon. A hard quota exhaustion,
invalid API key, or forbidden tenant usually should not retry.
