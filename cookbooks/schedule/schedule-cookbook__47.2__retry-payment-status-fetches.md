---
book: Effect `Schedule` Cookbook
section_number: "47.2"
section_title: "Retry payment-status fetches"
part_title: "Part X — Real-World Recipes"
chapter_title: "47. Product and Business Workflow Recipes"
status: "draft"
code_included: true
---

# 47.2 Retry payment-status fetches

Payment systems often separate the mutation that starts a payment from the read
that reports its current state. The mutation might be `POST /payments`,
`POST /captures`, or `POST /refunds`. The status read is usually a safe
`GET /payments/:id/status`.

This recipe is for retrying the safe read when the network or payment provider
temporarily fails. It is not a license to retry the payment mutation itself.

## Problem

You already have a payment id and need to fetch its latest status from a remote
payment provider. The fetch can fail because of transient conditions: a gateway
timeout, a short rate-limit window, a provider deploy, or a dropped connection.

You want a retry policy that:

- retries only typed failures that are plausibly transient
- waits longer after each failed fetch
- adds jitter so many callers do not retry together
- stops after a small retry count or elapsed budget
- leaves the original failure visible when the policy gives up

## When to use it

Use this recipe for safe payment-status reads: checking whether a payment is
`pending`, `authorized`, `captured`, `failed`, or `refunded` after another part
of the system has already initiated the payment workflow.

The important property is that repeating the request does not create another
charge, capture, refund, or ledger write. A retry may increase read traffic, but
it should not change money movement.

## When not to use it

Do not wrap payment mutations in this policy just because they talk to the same
provider. Retrying `POST /payments` or `POST /refunds` can duplicate financial
side effects unless the provider contract gives you an idempotency key, replay
protection, or another deduplication mechanism.

Also avoid retrying permanent failures. Invalid credentials, malformed payment
ids, forbidden access, unsupported payment methods, and provider responses that
mean "this payment does not exist" should fail without backoff.

## Schedule shape

`Effect.retry` feeds each typed failure into the schedule. That means
`Schedule.while` can inspect the `PaymentStatusFetchError` and stop retrying for
non-retryable statuses.

The base schedule uses `Schedule.exponential("100 millis")`, which recurs
forever by itself. The recipe adds:

- `Schedule.jittered` to avoid synchronized retries
- `Schedule.modifyDelay` to cap each computed delay
- `Schedule.recurs(5)` to limit the number of retries
- `Schedule.during("10 seconds")` to limit total retry time
- `Schedule.while` to retry only provider failures that are safe to retry

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

type PaymentStatus =
  | { readonly _tag: "Pending" }
  | { readonly _tag: "Authorized" }
  | { readonly _tag: "Captured" }
  | { readonly _tag: "Failed"; readonly reason: string }
  | { readonly _tag: "Refunded" }

class PaymentStatusFetchError extends Data.TaggedError(
  "PaymentStatusFetchError"
)<{
  readonly status: number
  readonly message: string
}> {}

declare const fetchPaymentStatus: (
  paymentId: string
) => Effect.Effect<PaymentStatus, PaymentStatusFetchError>

const isRetryableStatusFetch = (error: PaymentStatusFetchError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const paymentStatusFetchRetry = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(2)))
  ),
  Schedule.both(Schedule.recurs(5)),
  Schedule.both(Schedule.during("10 seconds")),
  Schedule.while(({ input }) => isRetryableStatusFetch(input))
)

export const program = fetchPaymentStatus("pay_123").pipe(
  Effect.retry(paymentStatusFetchRetry)
)
```

## Variants

For a user-facing checkout screen, reduce the budget so the request returns a
clear failure quickly. The UI can show a neutral state and refresh again later
instead of holding the user through a long retry window.

For a background reconciliation worker, keep jitter enabled and use a wider
elapsed budget. A worker can usually wait longer, but it should still have a
finite policy so provider incidents do not create unbounded pressure.

If the provider sends a rate-limit signal such as `Retry-After`, prefer honoring
that signal where appropriate. The local schedule is a fallback policy; provider
guidance is often more accurate during throttling.

## Notes and caveats

This recipe retries failures from the status fetch. It does not poll successful
`Pending` statuses until they become terminal. If the next decision depends on a
successful status value, use `Effect.repeat` with a schedule that observes
successful outputs instead.

`Schedule.exponential` and `Schedule.spaced` recur forever unless you combine
them with a stopping condition. Pair remote retries with `Schedule.recurs`,
`Schedule.take`, `Schedule.during`, or a domain predicate.

Keep the boundary between reads and mutations explicit in code review. Retrying
a safe `GET` can make a flaky provider tolerable; retrying a payment mutation
without idempotency can move money twice.
