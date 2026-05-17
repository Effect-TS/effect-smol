---
book: "Effect `Schedule` Cookbook"
section_number: "30.4"
section_title: "Retry notification delivery"
part_title: "Part VII — Real-World Recipes"
chapter_title: "30. Product and Business Workflow Recipes"
status: "draft"
code_included: true
---

# 30.4 Retry notification delivery

Notification delivery is externally visible. Retrying an email, SMS, webhook,
or push message is safe only when every attempt carries the same logical
identity and the receiver can deduplicate it.

## Problem

You need to retry transient delivery failures without sending duplicates. The
retry policy should be bounded, spaced, and tied to a stable idempotency key.

## When to use it

Use this for background notification workers and webhook dispatchers where the
provider accepts idempotency keys, message ids, or deduplication windows.

## When not to use it

Do not retry malformed messages, invalid recipients, authorization failures, or
provider rejections that mean the notification will never be accepted. Do not
retry if the downstream system cannot tolerate duplicate delivery.

## Schedule shape

Use `Effect.retry` because delivery failures drive recurrence. Use a short
exponential backoff, jitter for fleet safety, and a small retry count.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type Notification = {
  readonly idempotencyKey: string
  readonly recipient: string
  readonly body: string
}

type DeliveryError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "ProviderUnavailable" }

const notification: Notification = {
  idempotencyKey: "notification-01HZYX8R7P0J9PAW4Q6V7N3QYB",
  recipient: "user@example.com",
  body: "Your export is ready."
}

let attempts = 0

const sendWithIdempotency = (notification: Notification) =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(
      `send attempt ${attempts} with key ${notification.idempotencyKey}`
    )

    if (attempts < 3) {
      return yield* Effect.fail({ _tag: "Timeout" } as const)
    }

    yield* Console.log(`delivered to ${notification.recipient}`)
  })

const retryTransientDelivery = Schedule.exponential("10 millis").pipe(
  Schedule.satisfiesInputType<DeliveryError>(),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
  Schedule.tapInput((error) =>
    Console.log(`delivery retry after ${error._tag}`)
  )
)

const program = sendWithIdempotency(notification).pipe(
  Effect.retry(retryTransientDelivery)
)

Effect.runPromise(program)
```

The first attempt happens immediately. The same `idempotencyKey` is used for
every retry, so duplicate suppression can happen outside the schedule.

## Variants

Use fewer retries for a user-facing request. Use slower spacing for queue
workers under provider throttling. Keep jitter when many workers may retry the
same provider together.

## Notes and caveats

`Schedule.recurs(5)` means at most five retries after the initial send attempt.
Generate the idempotency key for the logical notification, not for each attempt.
