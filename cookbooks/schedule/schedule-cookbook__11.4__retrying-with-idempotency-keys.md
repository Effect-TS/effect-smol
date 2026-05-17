---
book: Effect `Schedule` Cookbook
section_number: "11.4"
section_title: "Retrying with idempotency keys"
part_title: "Part II — Core Retry Recipes"
chapter_title: "11. Idempotency and Retry Safety"
status: "draft"
code_included: true
---

# 11.4 Retrying with idempotency keys

Idempotency keys make some external writes safe to retry by tying repeated attempts to
one logical operation. This recipe shows where the key belongs relative to
`Effect.retry` and a bounded `Schedule`.

## Problem

The failure mode is using a retry policy without preserving the same key across
attempts. If each attempt uses a different key, the downstream system may treat
them as independent writes.

The retry policy still matters. A key can prevent duplicate business effects,
but it does not make unbounded retry traffic harmless. Use `Schedule` to keep
the retry delayed, finite, and explicit.

The important boundary is: create or receive one idempotency key before the
retried write, then reuse that exact key for every attempt made by
`Effect.retry`.

## When to use it

Use this recipe for external writes where the downstream API documents
idempotency-key behavior. Common examples include payment creation, order
submission, shipment creation, ticket creation, and API commands that accept a
header such as `Idempotency-Key`.

It is most useful for ambiguous failures: timeouts, dropped connections,
gateway errors, rate limits, or service unavailability. In those cases, the
caller may not know whether the first request was committed. Retrying with the
same key asks the server to return or complete the same logical result.

Keep the retry around the single keyed write. Generate the key outside that
retry boundary, store it with the local command or request record when needed,
and pass it into each attempt.

## When not to use it

Do not generate a fresh idempotency key inside the retried effect. A new key per
attempt usually tells the downstream system that each retry is a new write.

Do not use this recipe for APIs that ignore idempotency keys or only deduplicate
for a shorter period than your operational workflow requires.

Do not retry permanent failures such as invalid payloads, authorization
failures, insufficient funds, or business-rule rejections. The key protects
against duplicate execution; it does not make an invalid command valid.

## Schedule shape

For keyed external writes, start with a conservative bounded retry:

- exponential backoff, so repeated failures slow down
- jitter, so many callers do not retry together
- a finite recurrence limit, so the write cannot retry forever
- a predicate that retries only ambiguous or transient failures

`Schedule.exponential("100 millis")` computes increasing delays.
`Schedule.jittered` randomly adjusts each delay between 80% and 120%.
`Schedule.both(Schedule.recurs(4))` keeps the schedule finite: both schedules
must continue, so the write is retried at most four times after the original
attempt.

With `Effect.retry`, the write runs once immediately. The same effect is then
re-run only after a typed failure that the predicate allows and only while the
schedule continues.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class CreatePaymentError extends Data.TaggedError("CreatePaymentError")<{
  readonly reason: "Timeout" | "ConnectionReset" | "RateLimited" | "BadGateway" | "InvalidRequest" | "Declined"
}> {}

interface Payment {
  readonly id: string
  readonly status: "Created" | "AlreadyCreated"
}

interface PaymentInput {
  readonly customerId: string
  readonly amountCents: number
  readonly idempotencyKey: string
}

declare const createPayment: (input: PaymentInput) => Effect.Effect<Payment, CreatePaymentError>

const retryKeyedWrite = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const isRetryablePaymentFailure = (error: CreatePaymentError): boolean => {
  switch (error.reason) {
    case "Timeout":
    case "ConnectionReset":
    case "RateLimited":
    case "BadGateway":
      return true
    case "InvalidRequest":
    case "Declined":
      return false
  }
}

const submitPayment = (
  customerId: string,
  amountCents: number,
  idempotencyKey: string
) =>
  createPayment({ customerId, amountCents, idempotencyKey }).pipe(
    Effect.retry({
      schedule: retryKeyedWrite,
      while: isRetryablePaymentFailure
    })
  )
```

The `idempotencyKey` is an argument to `submitPayment`, not a value created
inside `createPayment` or inside the retry. Every retry attempt sends the same
`customerId`, `amountCents`, and `idempotencyKey`.

If the first request reaches the payment provider but the response is lost, a
later attempt with the same key should be treated by that provider as the same
logical payment. `Schedule` controls how many times the client asks again and
how long it waits between attempts.

## Variants

For user-facing writes, keep the retry budget small. The idempotency key
reduces duplicate-write risk, but the user still waits for the retry sequence:

```ts
const userFacingKeyedWrite = Schedule.exponential("75 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(2))
)

const backgroundKeyedWrite = Schedule.exponential("500 millis", 1.5).pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(6))
)
```

Use the smaller policy when the caller needs a prompt answer. Use the larger
policy for background workers that can tolerate more latency and where the key
is persisted with the job, command, or outbox record.

If the downstream service returns a "duplicate" or "already processed" response
for the same key, model that as a successful domain result when it represents
the same logical write. Do not turn it into a failure that triggers more
retries.

## Notes and caveats

The idempotency key must identify one logical command. Reusing a key for a
different payload can be rejected by the downstream service or, worse, attach a
new local intent to an old remote result.

Persist the key before retrying when the operation may outlive the current
fiber, process, or HTTP request. A worker restart should resume the same
logical write with the same key, not invent a new one.

Check the downstream service's retention window. Some providers remember keys
for hours or days, not forever. Your retry and reconciliation workflow should
fit inside that documented window.

`Schedule.recurs(4)` means four retries after the original attempt. It does not
mean four total attempts.

The schedule is still a load-control tool, not the idempotency guarantee. The
duplicate-safety contract comes from the external API honoring the stable key.
