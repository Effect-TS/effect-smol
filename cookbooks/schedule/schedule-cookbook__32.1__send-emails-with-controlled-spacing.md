---
book: Effect `Schedule` Cookbook
section_number: "32.1"
section_title: "Send emails with controlled spacing"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "32. Space User-Facing Side Effects"
status: "draft"
code_included: true
---

# 32.1 Send emails with controlled spacing

Email delivery is a user-visible write. Retry timing should be explicit,
bounded, and limited to failures that are safe to retry.

## Problem

An email provider can fail with timeouts, temporary unavailability, or
rate-limit responses. Immediate retries can exceed quotas, trigger throttling,
or create duplicate-looking messages when the provider accepted the first
request but the response was lost.

The retry policy should show the delay between attempts, the retry count, and
the failure types that are retryable.

## When to use it

Use this for transactional or notification email where retrying can help:
welcome emails, password resets, invoices, account alerts, and queued
notifications.

It works best when the provider supports a stable idempotency key, message key,
or client reference. That key should identify the logical email and be reused
for every attempt.

## When not to use it

Do not retry invalid recipients, malformed content, suppressed addresses,
authorization failures, or provider rejections that are clearly permanent.

Do not treat `Schedule.spaced` as an account-wide rate limiter. It spaces this
effect's attempts; queue concurrency and shared quotas still need their own
controls.

## Schedule shape

Use a small bounded retry policy. `Schedule.spaced("30 seconds")` leaves a
fixed gap between failed attempts, and `Schedule.recurs(3)` allows at most
three retries after the original send. `Effect.retry({ schedule, while })`
applies the schedule only to failures accepted by the predicate.

The first provider call is not delayed.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class EmailDeliveryError extends Data.TaggedError("EmailDeliveryError")<{
  readonly reason:
    | "Timeout"
    | "ProviderUnavailable"
    | "RateLimited"
    | "InvalidRecipient"
    | "RejectedContent"
}> {}

interface EmailMessage {
  readonly to: string
  readonly subject: string
  readonly bodyText: string
  readonly idempotencyKey: string
}

interface ProviderMessageId {
  readonly value: string
}

let attempts = 0

const sendViaProvider = (message: EmailMessage) =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`email attempt ${attempts} using key ${message.idempotencyKey}`)

    if (attempts === 1) {
      return yield* Effect.fail(new EmailDeliveryError({ reason: "Timeout" }))
    }

    return { value: `provider-${message.idempotencyKey}` } satisfies ProviderMessageId
  })

const emailRetrySpacing = Schedule.spaced("20 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const isRetryableEmailFailure = (error: EmailDeliveryError): boolean => {
  switch (error.reason) {
    case "Timeout":
    case "ProviderUnavailable":
    case "RateLimited":
      return true
    case "InvalidRecipient":
    case "RejectedContent":
      return false
  }
}

const sendEmailWithControlledSpacing = (message: EmailMessage) =>
  sendViaProvider(message).pipe(
    Effect.retry({
      schedule: emailRetrySpacing,
      while: isRetryableEmailFailure
    })
  )

const program = sendEmailWithControlledSpacing({
  to: "user@example.com",
  subject: "Your report is ready",
  bodyText: "Open the dashboard to view it.",
  idempotencyKey: "email:report-ready:user-123"
}).pipe(
  Effect.tap((receipt) => Console.log(`accepted as ${receipt.value}`))
)

Effect.runPromise(program)
```

The demo uses `20 millis` so it finishes quickly. In production, choose spacing
from provider quota and user experience. The idempotency key belongs to the
logical email, not to a single HTTP attempt.

## Variants

Interactive flows usually need fewer retries and shorter spacing so the caller
gets a timely answer. Outbox workers can use longer spacing and more attempts
because the user is no longer blocked on the request.

When many workers may retry the same kind of email, add `Schedule.jittered`
after the base spacing. Use jitter for fleet behavior, not when a provider
requires precise minimum spacing.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. Permanent failures bypass the
schedule when the `while` predicate returns `false`.

`Schedule.recurs(3)` means three retries after the original attempt, not three
total provider calls.

Spacing reduces burstiness; it does not make delivery idempotent. Duplicate
prevention comes from the provider contract and from reusing the same stable
key.
