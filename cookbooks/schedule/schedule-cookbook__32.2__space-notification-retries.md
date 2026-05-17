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

Notification retries are user-facing side effects. The retry cadence should be
visible instead of hidden in sleeps, counters, or provider wrappers.

## Problem

A push, SMS, email, or in-app notification failed after the request left your
service. The provider might have accepted it, delayed it, or dropped the
connection before processing it. Retrying can be correct only when the send is
duplicate-safe and the cadence leaves room for the provider and recipient.

The policy should answer how long to wait, how many retries are allowed, and
why another attempt is safe.

## When to use it

Use this when delivery matters but is not urgent enough to hammer the provider:
delivery receipts, account alerts, collaboration mentions, and transactional
notifications.

It fits providers with an idempotency key, message key, deduplication key, or
client token. The key identifies the logical notification, not the individual
request.

## When not to use it

Do not retry validation failures, unknown recipients, disabled channels,
unsubscribed users, expired templates, or authorization failures.

If duplicates are worse than loss and the provider cannot deduplicate, store
the failed delivery for review or reconcile through provider status APIs.

## Schedule shape

Use `Schedule.spaced` when the goal is controlled spacing rather than fast
recovery. Combine it with `Schedule.recurs` so the retry sequence is bounded.
`Schedule.both` keeps both constraints and uses the longer delay.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

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

let attempts = 0

const sendNotification = (notification: Notification) =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`notification attempt ${attempts} for ${notification.id}`)

    if (attempts === 1) {
      return yield* Effect.fail({ _tag: "Timeout" } as const)
    }
    if (attempts === 2) {
      return yield* Effect.fail({ _tag: "RateLimited" } as const)
    }

    yield* Console.log(`provider accepted ${notification.id}`)
  })

const notificationRetryPolicy = Schedule.spaced("15 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

const deliverNotification = (notification: Notification) =>
  sendNotification(notification).pipe(
    Effect.retry(notificationRetryPolicy)
  )

const program = deliverNotification({
  id: "notification-42",
  userId: "user-123",
  idempotencyKey: "notification-42:user-123",
  body: "A teammate mentioned you."
})

Effect.runPromise(program)
```

The first send happens immediately. The demo then retries twice with visible
spacing and stops on success.

## Variants

Interactive notifications usually need fewer retries so the UI can move on.
Background notifications can use longer spacing because a reminder, digest, or
delayed push can often wait minutes.

For many workers sending at once, add `Schedule.jittered` after choosing the
base spacing. Jitter reduces synchronized retry waves but makes exact timing
less predictable.

## Notes and caveats

Spacing is not idempotency. It reduces burstiness, but the provider still needs
a stable key or equivalent deduplication mechanism to avoid duplicate sends
when an earlier attempt succeeded.

Track attempts by notification id, final error, and sustained retry volume. A
retry schedule should smooth transient failures, not hide a provider outage or
product bug.
