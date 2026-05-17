---
book: Effect `Schedule` Cookbook
section_number: "32.5"
section_title: "Reduce spam-like behavior"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "32. Space User-Facing Side Effects"
status: "draft"
code_included: true
---

# 32.5 Reduce spam-like behavior

User-facing side effects need stricter retry behavior than internal reads
because an uncertain response does not mean the user saw nothing. This recipe
keeps delivery retries paced, bounded, and tied to a duplicate-safe send
boundary.

## Problem

A timeout while sending an email, push notification, SMS, webhook, or in-app
message can leave your process unsure whether the provider accepted the
delivery. You want to retry transient delivery failures without creating a
burst of messages that feels like spam.

The unsafe shape is to treat every failure as a reason to try again
immediately, or to use a repeating schedule as if it were a reminder policy.
That can turn one intended notification into several visible messages. It can
also move retry traffic into the same short window after a deploy, provider
incident, or rate-limit event.

A safer retry policy answers four questions in code:

- which delivery failures are retryable
- how long to wait before each retry
- how many retries are allowed after the original attempt
- what duplicate-safe boundary makes another attempt acceptable

The schedule is not the spam-prevention mechanism by itself. Product safety
still comes from the operation boundary: duplicate suppression, idempotency
keys, unsubscribe checks, channel preferences, and clear rules for when the
user should receive another message.

## When to use it

Use this recipe for a single intended user-facing side effect whose delivery
may fail transiently: sending a reminder email, dispatching a push
notification, notifying a user about an approval, delivering a transactional
message, or calling a downstream notification provider.

It is a good fit when the product decision is "send this message once, but
retry the delivery attempt a small number of times if the provider is briefly
unavailable."

Use it only after the send operation has a duplicate-safe identity, such as a
message id, reminder id, idempotency key, or provider-level duplicate
suppression. The schedule limits retry pressure; it does not prove that a
previous attempt was invisible to the user.

## When not to use it

Do not use `Effect.repeat` to send the same user-facing message several times
unless the product explicitly calls for several distinct messages. Retrying a
failed delivery attempt is different from scheduling multiple reminders.

Do not retry permanent failures: invalid addresses, unsubscribed users,
blocked channels, malformed payloads, authorization failures, and policy
denials should stop immediately.

Do not use a generic retry policy to bypass provider throttling or abuse
controls. If the provider returns a rate-limit response with explicit guidance,
model that guidance close to the integration instead of hiding it behind an
unreviewed backoff.

Do not rely on timing alone for compliance or consent. The effect being retried
should still check the user's current preferences, suppression lists, and
message eligibility before every attempt if those facts can change.

## Schedule shape

Start with exponential backoff so the first retry can recover from a brief
provider blip without hammering the same endpoint.

Add a cap with `Schedule.either(Schedule.spaced(...))`. `Schedule.either` uses
the minimum delay between the two schedules, so the exponential delay grows
until it reaches the fixed cap.

Add `Schedule.jittered` after the base timing is correct. In `Schedule.ts`,
`jittered` adjusts each recurrence delay to a random value between 80% and 120%
of the original delay. That keeps many fibers or instances from retrying at
exactly the same moments.

Finally, add `Schedule.both(Schedule.recurs(n))` to stop after a small number
of retries after the original attempt. `Effect.retry` runs the effect
immediately first; the schedule is consulted only after a typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class DeliveryError extends Data.TaggedError("DeliveryError")<{
  readonly reason:
    | "ProviderUnavailable"
    | "RateLimited"
    | "InvalidRecipient"
    | "Suppressed"
}> {}

interface Reminder {
  readonly reminderId: string
  readonly userId: string
  readonly idempotencyKey: string
  readonly channel: "email" | "push"
}

declare const deliverReminder: (
  reminder: Reminder
) => Effect.Effect<void, DeliveryError>

const isRetryableDeliveryError = (error: DeliveryError) =>
  error.reason === "ProviderUnavailable" ||
  error.reason === "RateLimited"

const deliveryRetryPolicy = Schedule.exponential("1 second").pipe(
  Schedule.either(Schedule.spaced("1 minute")),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

export const sendReminder = (reminder: Reminder) =>
  deliverReminder(reminder).pipe(
    Effect.retry({
      schedule: deliveryRetryPolicy,
      while: isRetryableDeliveryError
    })
  )
```

`sendReminder` calls `deliverReminder` immediately. If the provider is
unavailable or rate-limited, it retries with exponential delays capped at about
1 minute and jittered by 80% to 120%. The policy permits at most three retries
after the original attempt.

If the recipient is invalid or suppressed, `Effect.retry` does not retry
because the `while` predicate returns `false`. If every permitted retry fails,
the last `DeliveryError` is propagated.

## Variants

Use a shorter policy for interactive notifications where the user is waiting
for visible feedback:

```ts
const quickNotificationRetry = Schedule.exponential("250 millis").pipe(
  Schedule.either(Schedule.spaced("3 seconds")),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(2))
)
```

Use a longer policy for background delivery if the message is still useful
later and the send operation remains duplicate-safe:

```ts
const backgroundDeliveryRetry = Schedule.exponential("5 seconds").pipe(
  Schedule.either(Schedule.spaced("5 minutes")),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)
```

Use `Schedule.during` when the important product constraint is elapsed retry
budget rather than count:

```ts
const deliveryRetryWindow = Schedule.exponential("2 seconds").pipe(
  Schedule.either(Schedule.spaced("30 seconds")),
  Schedule.jittered,
  Schedule.both(Schedule.during("10 minutes"))
)
```

This stops retrying once the schedule has been recurring for the configured
duration. The total wall-clock time can still include the time spent running
each delivery attempt.

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. That is the right entry
point for "try this same delivery attempt again if it failed transiently."

`Effect.repeat` feeds successful values into the schedule. That is usually the
wrong entry point for reducing spam-like behavior, because a successful send
followed by a repeat is another send.

`Schedule.recurs(3)` means up to three retries after the original attempt, not
three total attempts.

`Schedule.jittered` reduces synchronized retries, but it does not reduce the
number of attempts. If too many messages are eligible at once, use batching,
rate limiting, queue backpressure, or admission control around the sender.

Keep product safety outside the timing policy. A schedule can space and bound
attempts, but it cannot decide whether a user has consented, whether a message
is still relevant, or whether the provider already accepted the previous
attempt.
