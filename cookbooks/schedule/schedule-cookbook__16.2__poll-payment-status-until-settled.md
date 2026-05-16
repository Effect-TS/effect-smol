---
book: Effect `Schedule` Cookbook
section_number: "16.2"
section_title: "Poll payment status until settled"
part_title: "Part IV — Polling Recipes"
chapter_title: "16. Poll Until Completion"
status: "draft"
code_included: true
---

# 16.2 Poll payment status until settled

You have submitted or received a payment, and the payment provider exposes a status
endpoint. The status request succeeds even while the payment is still in flight,
returning domain states such as `"pending"` or `"processing"`. This recipe treats
polling as repeated successful observations. The schedule controls cadence and the
condition for taking another observation, while the surrounding Effect code interprets
terminal states, missing data, stale reads, and real failures. Keeping those
responsibilities separate makes the polling loop easier to bound and diagnose.

## Problem

You have submitted or received a payment, and the payment provider exposes a
status endpoint. The status request succeeds even while the payment is still in
flight, returning domain states such as `"pending"` or `"processing"`.

You want to poll successful status observations until the payment reaches a
settled terminal state, such as `"settled"`, `"failed"`, or `"canceled"`.

## When to use it

Use this when polling is an observation loop: each request reads the current
payment status, and non-settled states mean "wait and observe again".

This is a good fit when the payment provider clearly models in-progress and
terminal states, and those terminal states are normal business outcomes rather
than transport failures.

## When not to use it

Do not use this to retry failed status requests. If the status effect fails,
`Effect.repeat` stops with that failure before the schedule can inspect a
payment status.

Do not use this as the complete safety policy for payment writes. Creating,
capturing, refunding, or otherwise mutating a payment needs separate protection
around idempotency, duplicate submissions, and provider-specific guarantees.

Do not leave production polling unbounded unless the fiber has an owner that can
interrupt it and the external system can tolerate the polling rate.

## Schedule shape

Make the successful payment status the schedule input, preserve it as the
schedule output, and continue only while it is not settled:

```ts
Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<PaymentStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isSettled(input))
)
```

With `Effect.repeat`, the first status request runs immediately. After each
successful observation, the observed `PaymentStatus` becomes the schedule input.
`Schedule.while` returns `true` to allow another recurrence and `false` to stop.

`Schedule.satisfiesInputType<PaymentStatus>()` is applied before reading
`metadata.input`, because `Schedule.spaced` is a timing schedule and is not
constructed from `PaymentStatus` values. `Schedule.passthrough` keeps the final
observed status as the value returned by the repeated effect.

## Code

```ts
import { Effect, Schedule } from "effect"

type PaymentStatus =
  | { readonly state: "pending"; readonly paymentId: string }
  | { readonly state: "processing"; readonly paymentId: string }
  | { readonly state: "requires_review"; readonly paymentId: string }
  | { readonly state: "settled"; readonly paymentId: string; readonly settlementId: string }
  | { readonly state: "failed"; readonly paymentId: string; readonly reason: string }
  | { readonly state: "canceled"; readonly paymentId: string }

const isSettled = (status: PaymentStatus): boolean =>
  status.state === "settled" ||
  status.state === "failed" ||
  status.state === "canceled"

declare const observePaymentStatus: Effect.Effect<PaymentStatus>

const pollUntilSettled = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<PaymentStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isSettled(input))
)

const finalStatus = observePaymentStatus.pipe(
  Effect.repeat(pollUntilSettled)
)
```

`observePaymentStatus` runs once before any delay. If the first successful
status is already settled, there are no recurrences. If the status is
`"pending"`, `"processing"`, or `"requires_review"`, the schedule waits two
seconds before observing again.

The repeated effect succeeds with the terminal `PaymentStatus` that made
`isSettled` return `true`.

## Variants

Use `Schedule.identity` when you want to express only the terminal-state logic
without adding a polling delay:

```ts
const untilSettled = Schedule.identity<PaymentStatus>().pipe(
  Schedule.while(({ input }) => !isSettled(input))
)
```

This keeps the status value visually central and is useful for explaining or
testing the stop condition. In real payment polling, add spacing so successful
non-terminal observations do not turn into a tight loop.

## Notes and caveats

Treat in-progress states as successful observations. `"pending"`,
`"processing"`, and similar states usually mean the provider accepted the status
request and the payment workflow is still moving.

Treat terminal business states as successful observations too. A failed or
canceled payment can be the final answer from the payment domain, not a failure
of the status request itself.

Keep the polling effect read-only. This recipe is about observing status until a
terminal state appears, not about repeating payment mutations.

The first observation is not delayed by the schedule. Spacing applies only
before later recurrences.

Choose a polling interval that is acceptable for the provider and for your
users. Time budgets, deadlines, and fallback behavior are separate recipes.
