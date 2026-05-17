---
book: Effect `Schedule` Cookbook
section_number: "47.1"
section_title: "Poll payment settlement status"
part_title: "Part X — Real-World Recipes"
chapter_title: "47. Product and Business Workflow Recipes"
status: "draft"
code_included: true
---

# 47.1 Poll payment settlement status

Payment settlement is often asynchronous. A card authorization, bank transfer,
or processor capture may be accepted first, then settle later after the payment
provider finishes its own workflow.

## Problem

You need to poll a payment provider until a settlement reaches a terminal state,
but you also need an explicit timeout when the provider keeps returning an
in-progress status.

The first status fetch should happen immediately. The schedule should control
only the follow-up polls: how long to wait between them, which successful
statuses continue polling, and when the polling budget is exhausted.

## When to use it

Use this when all of these are true:

- A non-terminal settlement status is a successful provider response.
- The payment provider does not give you a reliable callback for this path.
- The caller needs a bounded answer rather than an unbounded background wait.
- Terminal payment states must be handled differently in domain code.

This fits checkout confirmation screens, admin reconciliation tools, payment
capture workers, and short-lived API calls that wait for a processor to finish
settlement.

## When not to use it

Do not use scheduled polling to hide provider errors. Authentication failures,
invalid payment IDs, malformed requests, and network failures should stay in the
effect error channel or be classified before the polling policy is applied.

Prefer a webhook, queue event, or provider callback when it is reliable enough
for the workflow. Polling is useful when the current request needs a bounded
answer or when the provider's push signal is not available for this operation.

Do not treat a timeout as a failed payment. A timeout means the polling policy
stopped before a terminal status was observed. The payment may still settle
later, so record or surface that distinction explicitly.

## Schedule shape

Use a spaced cadence for provider pressure, pass the latest successful status
through as the schedule output, keep polling only while the status is
non-terminal, and combine that with an elapsed budget:

```ts
const pollOpenSettlements = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<SettlementStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isOpen(input)),
  Schedule.bothLeft(Schedule.during("2 minutes"))
)
```

`Effect.repeat` feeds successful values into the schedule. Here that means each
provider status response becomes the schedule input.

`Schedule.passthrough` makes the repeated effect return the latest observed
status when polling stops. `Schedule.while` stops after a terminal status.
`Schedule.during("2 minutes")` stops the schedule when the elapsed recurrence
budget is exhausted. `Schedule.bothLeft` keeps the status as the schedule output
while still requiring both the status condition and the time budget to continue.

## Code

```ts
import { Effect, Schedule } from "effect"

type SettlementStatus =
  | { readonly _tag: "Pending" }
  | { readonly _tag: "Processing" }
  | { readonly _tag: "Settled"; readonly settlementId: string }
  | { readonly _tag: "Declined"; readonly reason: string }
  | { readonly _tag: "Cancelled"; readonly reason: string }

type PaymentProviderError = {
  readonly _tag: "PaymentProviderError"
  readonly message: string
}

type SettlementResult =
  | { readonly _tag: "SettlementSucceeded"; readonly settlementId: string }
  | { readonly _tag: "SettlementDeclined"; readonly reason: string }
  | { readonly _tag: "SettlementCancelled"; readonly reason: string }

type SettlementTimeout = {
  readonly _tag: "SettlementTimeout"
  readonly paymentId: string
  readonly lastStatus: "Pending" | "Processing"
}

declare const fetchSettlementStatus: (
  paymentId: string
) => Effect.Effect<SettlementStatus, PaymentProviderError>

const isOpen = (status: SettlementStatus): boolean =>
  status._tag === "Pending" || status._tag === "Processing"

const pollOpenSettlements = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<SettlementStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isOpen(input)),
  Schedule.bothLeft(Schedule.during("2 minutes"))
)

export const waitForSettlement = Effect.fnUntraced(function*(paymentId: string) {
  const status = yield* fetchSettlementStatus(paymentId).pipe(
    Effect.repeat(pollOpenSettlements)
  )

  switch (status._tag) {
    case "Settled":
      return {
        _tag: "SettlementSucceeded",
        settlementId: status.settlementId
      } as const
    case "Declined":
      return {
        _tag: "SettlementDeclined",
        reason: status.reason
      } as const
    case "Cancelled":
      return {
        _tag: "SettlementCancelled",
        reason: status.reason
      } as const
    case "Pending":
    case "Processing":
      return yield* Effect.fail({
        _tag: "SettlementTimeout",
        paymentId,
        lastStatus: status._tag
      } as const)
  }
})
```

`fetchSettlementStatus` runs once immediately. If it returns `Pending` or
`Processing`, the schedule waits two seconds before the next provider call. If a
later call returns `Settled`, `Declined`, or `Cancelled`, `Schedule.while` stops
the repetition and the function maps the terminal status into a domain result.

If the two-minute budget closes first, `Effect.repeat` returns the last
non-terminal status. The function turns that into `SettlementTimeout`, keeping
the provider error channel separate from the "still not terminal" outcome.

## Variants

Use a shorter budget for user-facing checkout requests:

```ts
const checkoutPolling = Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<SettlementStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isOpen(input)),
  Schedule.bothLeft(Schedule.during("15 seconds"))
)
```

Use a slower cadence for background reconciliation:

```ts
const reconciliationPolling = Schedule.spaced("30 seconds").pipe(
  Schedule.satisfiesInputType<SettlementStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isOpen(input)),
  Schedule.bothLeft(Schedule.during("10 minutes"))
)
```

Add jitter when many payments may enter polling at the same time:

```ts
const fleetFriendlyPolling = Schedule.spaced("2 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<SettlementStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isOpen(input)),
  Schedule.bothLeft(Schedule.during("2 minutes"))
)
```

Jitter changes only the timing between polls. It does not change which
settlement states are terminal or how timeout is interpreted.

## Notes and caveats

Use `Effect.repeat` because the decision to continue is based on successful
status responses. `Effect.retry` feeds failures into the schedule, which is the
right tool for transient provider errors but not for ordinary `Pending` or
`Processing` statuses.

`Schedule.during` is a recurrence budget, not a hard timeout for an in-flight
provider request. If the provider call itself needs a deadline, apply that to
`fetchSettlementStatus` separately.

The schedule does not delay the first provider call. It controls only the
recurrences after successful observations.

Keep terminal-state interpretation outside the schedule. The schedule should
answer "should we poll again?"; the business workflow should decide what
`Settled`, `Declined`, `Cancelled`, or `SettlementTimeout` means for the order.
