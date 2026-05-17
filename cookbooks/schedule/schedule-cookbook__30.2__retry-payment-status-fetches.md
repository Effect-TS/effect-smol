---
book: "Effect `Schedule` Cookbook"
section_number: "30.2"
section_title: "Retry payment-status fetches"
part_title: "Part VII — Real-World Recipes"
chapter_title: "30. Product and Business Workflow Recipes"
status: "draft"
code_included: true
---

# 30.2 Retry payment-status fetches

Payment systems often separate the mutation that starts a payment from the read
that reports its state. Retrying a safe status read is different from retrying
the payment mutation itself.

## Problem

You already have a payment id and need to fetch its latest status. The read can
fail because the provider times out, rate-limits briefly, or returns a transient
server error. Retry only those failures, with a bounded policy.

## When to use it

Use this for safe reads such as `GET /payments/:id/status`. Repeating the read
must not create another charge, capture, refund, or ledger write.

## When not to use it

Do not apply this policy to `POST /payments`, `POST /captures`, or
`POST /refunds` unless the provider contract gives you idempotency protection.
Do not retry permanent failures such as invalid credentials, malformed payment
ids, unsupported payment methods, or `404` responses for a payment that should
exist.

## Schedule shape

Use `Effect.retry` because the schedule observes typed failures. Exponential
backoff controls pressure, `Schedule.jittered` avoids synchronized callers,
`Schedule.recurs` bounds retries, and `Schedule.while` filters retryable
failures.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type PaymentStatus =
  | { readonly _tag: "Pending" }
  | { readonly _tag: "Captured" }

type PaymentStatusFetchError = {
  readonly _tag: "PaymentStatusFetchError"
  readonly status: number
}

let attempts = 0

const fetchPaymentStatus = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`status fetch attempt ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail({
      _tag: "PaymentStatusFetchError",
      status: 503
    } as const)
  }
  if (attempts === 2) {
    return yield* Effect.fail({
      _tag: "PaymentStatusFetchError",
      status: 429
    } as const)
  }

  return { _tag: "Captured" } as const
})

const isRetryableStatusFetch = (error: PaymentStatusFetchError) =>
  error.status === 408 || error.status === 429 || error.status >= 500

const paymentStatusFetchRetry = Schedule.exponential("10 millis").pipe(
  Schedule.satisfiesInputType<PaymentStatusFetchError>(),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
  Schedule.while(({ input }) => isRetryableStatusFetch(input)),
  Schedule.tapInput((error) =>
    Console.log(`retryable payment read failure: HTTP ${error.status}`)
  )
)

const program = fetchPaymentStatus.pipe(
  Effect.retry(paymentStatusFetchRetry),
  Effect.flatMap((status) => Console.log(`final status: ${status._tag}`))
)

Effect.runPromise(program)
```

The first read runs immediately. Only failures are fed to the retry schedule,
and only retryable status-fetch failures are allowed through the predicate.

## Variants

Use a smaller budget for a user-facing request. Use a slower base delay for a
background reconciliation worker. Honor provider retry hints such as
`Retry-After` before falling back to local timing.

## Notes and caveats

This recipe retries failed status fetches. It does not poll successful
`Pending` statuses until they become terminal; that is a repeat recipe over
successful values.
