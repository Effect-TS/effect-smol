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

Email delivery is a user-visible side effect, so retry timing is part of the
product behavior. This recipe keeps retry spacing explicit: the first send
attempt happens immediately, and `Schedule` controls only the later attempts.

## Problem

An email provider can fail transiently with timeouts, temporary unavailability,
or rate-limit responses. A burst of retries can exceed provider quotas, trigger
throttling, create duplicate-looking messages, or turn a temporary outage into
spam-like behavior if the provider does not deduplicate requests.

The retry policy should be visible in one place. Future readers should not have
to infer delivery behavior from scattered sleeps, counters, or worker-loop
details. It should show how long to wait between delivery attempts, how many
attempts are allowed, and which failures are safe to try again.

## When to use it

Use this recipe for transactional or notification email where a retry may be
useful, but each attempt is still a real external write. Examples include
welcome emails, password reset emails, invoices, account alerts, and queued
notifications.

It is most useful when the provider documents transient failures and supports a
deduplication mechanism such as an idempotency key, message key, or stable
client reference. The key should be created before the retry starts and reused
for every provider call that represents the same logical email.

Use a conservative spacing value that fits the provider's quota. If the provider
allows 60 requests per minute for the account, a single worker sending one email
every few seconds may be reasonable; many workers using the same schedule may
not be. The schedule controls this fiber's retries, not the total traffic from
the whole fleet.

## When not to use it

Do not retry invalid recipients, malformed email content, suppressed addresses,
authorization failures, or provider rejections that are clearly permanent. Those
should be recorded as final delivery failures or surfaced to the workflow that
created the email.

Do not retry a non-idempotent provider call blindly. If a timeout leaves the
client unsure whether the provider accepted the message, another request without
a stable key may send the same email twice.

Do not treat `Schedule.spaced` as a complete rate limiter for the whole
application. It spaces attempts made by this scheduled effect. Global provider
quotas still need queue-level concurrency limits, account-level rate limiting,
or coordination across workers.

## Schedule shape

For email delivery, prefer a small bounded policy:

- `Schedule.spaced("30 seconds")` waits after each failed attempt before the
  next retry decision.
- `Schedule.recurs(3)` allows at most three retries after the original send.
- `Schedule.both` combines the timing policy with the retry limit, so both must
  continue.
- `Effect.retry({ schedule, while })` applies the schedule only to failures that
  the predicate classifies as retryable.

The initial provider call is not delayed by the schedule. If it fails with a
retryable error, the next attempt is spaced out.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

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

declare const sendViaProvider: (
  message: EmailMessage
) => Effect.Effect<ProviderMessageId, EmailDeliveryError>

const emailRetrySpacing = Schedule.spaced("30 seconds").pipe(
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

export const sendEmailWithControlledSpacing = (
  message: EmailMessage
) =>
  sendViaProvider(message).pipe(
    Effect.retry({
      schedule: emailRetrySpacing,
      while: isRetryableEmailFailure
    })
  )
```

The `idempotencyKey` belongs to the logical email, not to an individual attempt.
Generate or load it before calling `sendEmailWithControlledSpacing`, store it
with the outbox record, and pass the same value on every retry. If the first
provider request succeeds but the response is lost, a later retry with the same
key should ask the provider about the same logical send rather than create a new
one.

## Variants

For interactive flows, keep the retry budget short. A password reset request
should return promptly even if background delivery continues elsewhere:

```ts
const interactiveEmailRetry = Schedule.spaced("5 seconds").pipe(
  Schedule.both(Schedule.recurs(1))
)
```

For outbox workers, longer spacing can be safer because the user is no longer
blocked on the HTTP request:

```ts
const backgroundEmailRetry = Schedule.spaced("1 minute").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

If many workers may retry the same class of email at the same time, consider
adding jitter after choosing the base spacing:

```ts
const jitteredBackgroundEmailRetry = Schedule.spaced("1 minute").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)
```

Jitter reduces synchronized retries, but it also makes exact timing less
predictable. Use it for fleet behavior, not when a provider requires precise
minimum spacing.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. In this recipe, only failures
accepted by `isRetryableEmailFailure` are scheduled for another attempt.
Permanent failures bypass the schedule and fail immediately.

`Schedule.recurs(3)` means three retries after the original attempt. It does not
mean three total provider calls.

Spacing protects the provider and the user experience, but it does not by itself
make email delivery idempotent. Duplicate prevention comes from the provider's
deduplication contract and from your application reusing the same stable key.

Provider quotas are usually account-wide. If ten workers each run this same
policy, the aggregate request rate is ten times higher than the single-fiber
schedule suggests. Keep concurrency and quota enforcement close to the outbox or
delivery queue.

Email has user-visible side effects even when the API call looks like a normal
write. Record enough state to explain what happened: the idempotency key, final
provider message id when available, retryable failures observed, and whether the
email was abandoned because the schedule stopped.
