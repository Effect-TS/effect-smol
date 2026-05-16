---
book: Effect `Schedule` Cookbook
section_number: "47.4"
section_title: "Retry notification delivery"
part_title: "Part X — Real-World Recipes"
chapter_title: "47. Product and Business Workflow Recipes"
status: "draft"
code_included: true
---

# 47.4 Retry notification delivery

Notification delivery is an externally visible side effect: a retry can send a second email, push message, webhook, or SMS if the provider does not deduplicate it. Model the retry policy explicitly and make the delivery request idempotent before applying the schedule.

## Problem

You need to retry notification delivery when the provider times out, rate-limits, or briefly goes unavailable. The retry should not happen in a tight loop, and every attempt must carry the same idempotency key so the provider or your own outbox can collapse duplicates.

## When to use it

Use this recipe for background notification workers, webhook dispatchers, and transactional message senders where a duplicate delivery would be user-visible. It is a good fit when the provider supports idempotency keys, request identifiers, or deduplication windows, and when operators need to know how many follow-up attempts can be made.

## When not to use it

Do not retry malformed messages, invalid recipients, authorization failures, or provider rejections that mean "this notification will never be accepted." Also do not apply this schedule to a non-idempotent send operation. If the downstream system cannot deduplicate and the business cannot tolerate duplicates, route the message to manual review or a safer outbox flow instead.

## Schedule shape

For notification delivery, start with short exponential spacing, add jitter so many workers do not retry together, and combine it with a retry cap. `Effect.retry` feeds the delivery failure into the schedule, so use `Schedule.satisfiesInputType` to keep the policy tied to the retryable error type.

## Code

```ts
import { Effect, Schedule } from "effect"

type Notification = {
  readonly idempotencyKey: string
  readonly recipient: string
  readonly body: string
}

type DeliveryError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "RateLimited" }
  | { readonly _tag: "ProviderUnavailable" }

declare const sendWithIdempotency: (
  notification: Notification
) => Effect.Effect<void, DeliveryError>

const retryTransientDelivery = Schedule.exponential("250 millis").pipe(
  Schedule.satisfiesInputType<DeliveryError>(),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

export const deliverNotification = Effect.fnUntraced(function*(
  notification: Notification
) {
  yield* Effect.retry(
    sendWithIdempotency(notification),
    retryTransientDelivery
  )
})
```

The same `notification.idempotencyKey` is sent on every attempt. The first attempt happens immediately; the schedule only controls follow-up attempts after failures.

```ts
const notification: Notification = {
  idempotencyKey: "notification-01HZYX8R7P0J9PAW4Q6V7N3QYB",
  recipient: "user@example.com",
  body: "Your export is ready."
}

export const program = deliverNotification(notification)
```

## Variants

For a user-facing request, use fewer retries or add `Schedule.during` so the caller receives a timely answer. For a queue worker, increase the spacing and record each failure with `Schedule.tapInput` before the next attempt is scheduled. For a provider with strict rate limits, prefer a slower base cadence over a large retry count; jitter spreads load, but it does not increase the provider's capacity.

## Notes and caveats

`Schedule.recurs(5)` means at most five retries after the initial send attempt. Keep permanent-error classification outside this policy so the schedule only sees failures that are safe to retry. The idempotency key should be stable for the logical notification, not regenerated per attempt.
