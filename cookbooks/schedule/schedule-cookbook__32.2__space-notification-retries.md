---
book: Effect `Schedule` Cookbook
section_number: "32.2"
section_title: "Space notification retries"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "32. Space User-Facing Side Effects"
status: "draft"
code_included: true
---

# 32.2 Space notification retries

Notification retries are user-facing side effects. A timeout from a push, SMS, email, or in-app notification provider may be transient, but retrying immediately can create duplicate-looking messages, increase provider pressure, and make the product feel noisy. Use a schedule to make the retry spacing explicit.

## Problem

A notification send failed after the request left your service. You do not know whether the provider accepted it, delayed it, or dropped the connection before processing it. Retrying can be correct, but only if the send operation is idempotent and the retry cadence leaves enough room for the provider and the user experience.

The policy should answer three questions directly:

- How long do we wait before another delivery attempt?
- How many follow-up attempts are allowed?
- What makes this safe if the first attempt actually reached the provider?

## When to use it

Use this recipe when notification delivery is important enough to retry, but not urgent enough to hammer the provider. Examples include delivery receipts, account alerts, collaboration mentions, and transactional notifications where a short delay is better than dropping the message immediately.

It fits best when the provider supports an idempotency key, message key, deduplication key, or client token. That key should identify the logical notification, not the individual HTTP request, so every retry asks the provider to deliver the same notification rather than create a new one.

## When not to use it

Do not retry validation failures, unknown recipients, disabled notification channels, unsubscribed users, expired templates, or authorization failures. Those are product or configuration outcomes, not timing problems.

Also avoid this pattern when duplicates would be worse than loss. If the provider cannot deduplicate and the notification has a high cost, store the failed delivery for operator review or reconcile through provider status APIs instead of blindly sending again.

## Schedule shape

Use a fixed gap when the main goal is spacing rather than rapid recovery. `Schedule.spaced("10 seconds")` waits the same amount between retry decisions. Combining it with `Schedule.recurs(4)` keeps the total number of retries bounded.

`Schedule.both` combines the spacing and retry limit with intersection semantics: the policy continues only while both schedules want to continue, and the longer delay wins. For notification delivery, that means every retry is separated by the configured gap and the retry sequence stops after the count limit.

## Code

```ts
import { Effect, Schedule } from "effect"

type Notification = {
  readonly id: string
  readonly userId: string
  readonly idempotencyKey: string
  readonly body: string
}

type NotificationError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "ProviderUnavailable" }
  | { readonly _tag: "RateLimited" }

declare const sendNotification: (
  notification: Notification
) => Effect.Effect<void, NotificationError>

const notificationRetryPolicy = Schedule.spaced("10 seconds").pipe(
  Schedule.both(Schedule.recurs(4))
)

export const deliverNotification = Effect.fnUntraced(function*(notification: Notification) {
  yield* Effect.retry(
    sendNotification(notification),
    notificationRetryPolicy
  )
})
```

The first send happens immediately. The schedule controls only the follow-up attempts after failures. With this policy, a failed notification can be retried up to four times, with ten seconds between retry decisions.

## Variants

For interactive notifications, use fewer retries and shorter spacing so the UI can move on quickly. A user waiting for a login prompt or approval request usually benefits from a clear failure state more than from a long invisible retry chain.

For background notifications, use longer spacing. A reminder email, digest, or delayed push can often wait minutes. Longer gaps reduce pressure on the provider and leave time for a temporary outage or rate-limit window to clear.

For many workers sending notifications at once, add jitter after choosing the base spacing:

```ts
const fleetWideNotificationRetryPolicy = Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)
```

`Schedule.jittered` adjusts delays between 80% and 120% of the original delay, which helps prevent a fleet from retrying every notification at the same instant.

## Notes and caveats

Spacing is not a substitute for idempotency. The retry policy reduces burstiness, but the provider still needs a stable idempotency key or equivalent deduplication mechanism to avoid duplicate sends when a previous attempt succeeded but the acknowledgement was lost.

Keep provider pressure visible in logs and metrics. Count attempts by notification id, track the final error, and alert on sustained retry volume. A retry schedule should smooth transient failures, not hide a provider outage or a product bug that produces undeliverable notifications.

Think about the recipient as part of the policy. Four retries over less than a minute may be reasonable for one important notification. The same policy applied to hundreds of low-value reminders can feel like spam if provider deduplication, channel preferences, and suppression rules are not enforced before retrying.
