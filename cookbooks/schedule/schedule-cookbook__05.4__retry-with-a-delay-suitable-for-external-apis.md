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

For simple external API calls, combine a modest fixed delay with a retry limit
and an error predicate. The schedule answers "when"; the predicate answers
"whether this failure is safe to retry."

## Problem

External APIs can fail transiently at the network or service boundary, but
retrying every failure can hammer the provider or repeat unsafe requests.

## When to use it

Use this for idempotent external API calls where a short constant pause is
acceptable: reads, metadata lookups, status checks, or writes protected by an
idempotency key.

A one-second delay with a small retry budget is a readable default when the API
does not publish a more specific retry policy.

## When not to use it

Do not retry client errors such as invalid input, authentication failure,
authorization failure, or most not-found responses. Those usually need to be
returned or handled directly.

Do not ignore provider guidance. If the API returns `Retry-After`, exposes
rate-limit reset metadata, or documents endpoint-specific retry rules, model
that policy instead of using a fixed delay.

## Schedule shape

The options form keeps the three policy pieces together:

- `schedule: Schedule.spaced("1 second")` waits one second before each retry
- `times: 4` permits four retries after the original attempt
- `while: isRetryableApiError` retries only selected typed failures

If an attempt succeeds, retrying stops immediately. If a non-retryable error is
returned, the retry budget is not spent.

## Code

```ts
import { Console, Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class ExternalApiError extends Data.TaggedError("ExternalApiError")<{
  readonly attempt: number
  readonly status: number
}> {}

interface Customer {
  readonly id: string
  readonly name: string
}

const fetchCustomer = Effect.fnUntraced(function*(
  id: string,
  attempts: Ref.Ref<number>
) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`api attempt ${attempt}`)

  if (attempt < 3) {
    return yield* Effect.fail(new ExternalApiError({ attempt, status: 503 }))
  }

  return { id, name: "Ada" } satisfies Customer
})

const isRetryableApiError = (error: ExternalApiError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const retryExternalApi = {
  schedule: Schedule.spaced("1 second"),
  times: 4,
  while: isRetryableApiError
}

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* fetchCustomer("customer-123", attempts).pipe(
    Effect.retry(retryExternalApi),
    Effect.forkScoped
  )

  yield* TestClock.adjust("1 second")
  yield* TestClock.adjust("1 second")

  const customer = yield* Fiber.join(fiber)
  yield* Console.log(`customer: ${customer.id} ${customer.name}`)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program).then(() => undefined)
```

The API fails twice with a retryable `503`, waits one virtual second before
each retry, and then returns the customer.

## Notes

`times: 4` means four retries after the original attempt, so the API can be
called at most five times. If a provider says "four total attempts", use
`times: 3`.

A fixed delay is intentionally simple. It does not inspect headers, adapt to
congestion, add jitter, or cap long-running retry behavior.

Keep the retry boundary around the single idempotent API call. Avoid wrapping
local writes, notifications, or other effects that should not run more than
once.
