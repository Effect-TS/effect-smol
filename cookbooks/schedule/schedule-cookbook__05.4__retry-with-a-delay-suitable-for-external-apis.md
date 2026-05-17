---
book: Effect `Schedule` Cookbook
section_number: "5.4"
section_title: "Retry with a delay suitable for external APIs"
part_title: "Part II — Core Retry Recipes"
chapter_title: "5. Retry with Fixed Delays"
status: "draft"
code_included: true
---

# 5.4 Retry with a delay suitable for external APIs

This recipe shows a bounded fixed-delay retry policy for simple external API calls.
The schedule controls the retry timing, while the surrounding Effect code remains
responsible for filtering retryable typed failures and preserving idempotency.

## Problem

An external API call can fail transiently across the network boundary, but
immediate retries can hammer the provider. You need a small fixed delay, a retry
budget, and an error predicate so only safe, retryable API failures are tried
again.

Use `Schedule.spaced("1 second")` with `Effect.retry`, and bound it with
`times` or `Schedule.recurs`. Add an error predicate when only some API
failures are retryable.

## When to use it

Use this recipe for idempotent external API calls where a short, constant pause
between retries is acceptable. It fits simple reads, metadata lookups, status
checks, and writes protected by an idempotency key.

It is also useful when the provider does not require a more specific retry
policy, and you want a readable default such as "retry up to four times, waiting
one second before each retry."

## When not to use it

Do not retry every API failure. Client errors such as invalid input,
authentication failure, authorization failure, and most not-found responses
usually need to be returned or handled, not retried.

Do not use a fixed delay when the provider gives a more specific instruction,
such as a `Retry-After` value, endpoint-specific rate-limit guidance, or a
required backoff policy.

Do not use this for non-idempotent writes unless the API gives you a safe
deduplication mechanism. Retrying a request that may already have completed can
duplicate external side effects.

## Schedule shape

`Schedule.spaced("1 second")` is an unbounded schedule that contributes the same
delay on every recurrence. With `Effect.retry`, the first API call runs
immediately. The delay only happens after a typed failure and before the next
attempt.

The options form can combine the fixed delay, retry budget, and error predicate:

- `schedule: Schedule.spaced("1 second")` waits one second before each retry
- `times: 4` allows four retries after the original attempt
- `while: isRetryableApiError` retries only selected typed failures

The resulting shape is:

- attempt 1: call the API immediately
- if the failure is not retryable: fail with that error
- if the failure is retryable and retries remain: wait one second
- attempts 2 through 5: retry at most four more times
- if all permitted attempts fail: fail with the last typed error

If any attempt succeeds, retrying stops immediately and the successful API value
is returned.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ExternalApiError extends Data.TaggedError("ExternalApiError")<{
  readonly operation: string
  readonly status: number
}> {}

interface Customer {
  readonly id: string
  readonly name: string
}

declare const fetchCustomer: (id: string) => Effect.Effect<Customer, ExternalApiError>

const isRetryableApiError = (error: ExternalApiError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const retryExternalApi = {
  schedule: Schedule.spaced("1 second"),
  times: 4,
  while: isRetryableApiError
}

const program = fetchCustomer("customer-123").pipe(
  Effect.retry(retryExternalApi)
)
```

`program` calls `fetchCustomer("customer-123")` once immediately. If it fails
with a retryable `ExternalApiError`, it waits one second and tries again. The
policy allows at most four retries, so the API is called at most five times
total.

If the error has a non-retryable status, or if the fifth total attempt still
fails, `Effect.retry` propagates the last typed `ExternalApiError`.

## Variants

If your API adapter already turns only retryable failures into the typed error,
you can keep the policy as a named schedule:

```ts
const retryEverySecondUpTo4Times = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(4))
)

const program = fetchCustomer("customer-123").pipe(
  Effect.retry(retryEverySecondUpTo4Times)
)
```

Use a longer fixed delay for slower or stricter APIs:

```ts
const retrySlowerExternalApi = {
  schedule: Schedule.spaced("2 seconds"),
  times: 3,
  while: isRetryableApiError
}
```

The retry count and delay are independent. Increasing the delay reduces request
pressure without changing the maximum number of calls.

## Notes and caveats

`Schedule.spaced` does not delay the first attempt. It delays only retry
attempts after typed failures.

`times: 4` means four retries after the original attempt, not four total API
calls. If a provider says "try at most four times total", use `times: 3`.

A fixed delay is intentionally simple. It is not adaptive to congestion, does
not read rate-limit headers, and does not add jitter. Use a more specific policy
when the API contract requires one.

Keep the retry boundary around the single idempotent API call. Avoid wrapping a
larger workflow that also performs local writes, notifications, or other effects
that should not be repeated.
