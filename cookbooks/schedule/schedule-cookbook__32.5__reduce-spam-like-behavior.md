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

User-facing side effects need stricter retry behavior than internal reads. A
timeout does not prove the user saw nothing.

## Problem

Sending an email, push notification, SMS, webhook, or in-app message can time
out after the request reaches the provider. Retrying every failure immediately
can turn one intended message into a burst of visible messages.

A safer retry policy states which failures are retryable, how long to wait,
how many retries are allowed, and what duplicate-safe boundary makes another
attempt acceptable.

The schedule is not the spam-prevention mechanism by itself. Product safety
also depends on idempotency keys, suppression lists, channel preferences,
unsubscribe checks, and message eligibility.

## When to use it

Use this for one intended user-facing side effect whose delivery may fail
transiently: a reminder email, push notification, approval notice, transactional
message, or downstream notification-provider call.

It fits the product decision "send this once, but retry a small number of times
if the provider is briefly unavailable."

## When not to use it

Do not use `Effect.repeat` to send the same user-facing message several times
unless the product explicitly calls for distinct messages. Retrying a failed
attempt is different from scheduling reminders.

Do not retry permanent failures such as invalid addresses, unsubscribed users,
blocked channels, malformed payloads, authorization failures, or policy denials.

Do not rely on timing alone for compliance or consent. The send effect should
still check current preferences and suppression data when those facts can
change.

## Schedule shape

Start with `Schedule.exponential` so early retries can recover from a brief
provider blip. Add a fixed cap with `Schedule.either(Schedule.spaced(...))`;
`either` uses the minimum delay, so exponential growth stops at the fixed cap.

Add `Schedule.jittered` after the base timing is correct. It randomizes each
delay between 80% and 120% of the original delay. Add `Schedule.recurs(n)` to
limit retries after the original attempt.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

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

let attempts = 0

const deliverReminder = (reminder: Reminder) =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`delivery attempt ${attempts} for ${reminder.reminderId}`)

    if (attempts === 1) {
      return yield* Effect.fail(new DeliveryError({ reason: "ProviderUnavailable" }))
    }
    if (attempts === 2) {
      return yield* Effect.fail(new DeliveryError({ reason: "RateLimited" }))
    }

    yield* Console.log(`delivered through ${reminder.channel}`)
  })

const isRetryableDeliveryError = (error: DeliveryError) =>
  error.reason === "ProviderUnavailable" ||
  error.reason === "RateLimited"

const deliveryRetryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.either(Schedule.spaced("30 millis")),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

const sendReminder = (reminder: Reminder) =>
  deliverReminder(reminder).pipe(
    Effect.retry({
      schedule: deliveryRetryPolicy,
      while: isRetryableDeliveryError
    })
  )

const program = sendReminder({
  reminderId: "reminder-789",
  userId: "user-123",
  idempotencyKey: "reminder-789:user-123",
  channel: "email"
})

Effect.runPromise(program)
```

The demo retries two transient failures and succeeds. The idempotency key is
part of the operation boundary; the schedule only controls timing and retry
count.

## Variants

Use a shorter policy for interactive notifications where the user is waiting
for feedback. Use a longer policy for background delivery if the message is
still useful later and the send operation remains duplicate-safe.

Use `Schedule.during` when the product constraint is elapsed retry budget
rather than count. Remember that the total wall-clock time also includes the
time spent running each delivery attempt.

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. That is the right entry
point for retrying the same delivery attempt after a transient failure.

`Effect.repeat` feeds successful values into the schedule. It is usually the
wrong entry point for reducing spam-like behavior because a successful send
followed by a repeat is another send.

`Schedule.jittered` reduces synchronized retries, but it does not reduce the
number of attempts. If too many messages are eligible at once, add batching,
rate limiting, queue backpressure, or admission control around the sender.
