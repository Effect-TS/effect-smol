---
book: Effect `Schedule` Cookbook
section_number: "47.3"
section_title: "Poll order fulfillment progress"
part_title: "Part X — Real-World Recipes"
chapter_title: "47. Product and Business Workflow Recipes"
status: "draft"
code_included: true
---

# 47.3 Poll order fulfillment progress

An order has been accepted, payment has cleared, and fulfillment is now moving
through a warehouse, shipping, pickup, or delivery workflow. The customer is
waiting on a screen that needs a useful answer soon: either the order reached a
terminal state, or the app should stop polling and show the latest known
progress with a clear "still processing" message.

Use `Effect.repeat` when each poll succeeds with an ordinary fulfillment status.
The schedule decides whether another successful status should be requested. The
code after polling decides what the final status means for the user.

## Problem

You need to poll order fulfillment progress until the order reaches a terminal
state, but the polling loop must also respect a user-facing budget.

Intermediate statuses such as `"received"`, `"picking"`, `"packing"`, and
`"shipped"` are successful observations. They are not failures. Terminal states
such as `"delivered"`, `"canceled"`, and `"fulfillment_failed"` are also
successful observations from the fulfillment API. The schedule should stop when
one of those terminal states appears, or when the budget is exhausted before a
terminal state appears.

## When to use it

Use this for customer-facing order screens, support tools, and checkout follow-up
pages where polling is acceptable for a short period and the caller can display
the latest observed status.

This is a good fit when the remote system exposes a status endpoint, terminal
states are part of the normal domain model, and a push notification or webhook
is either unavailable or too slow for the current interaction.

## When not to use it

Do not use this as a retry policy for a failing fulfillment endpoint. With
`Effect.repeat`, a failed status read fails the whole effect before the schedule
can inspect a status. Add a separate retry around the status read if transient
transport failures should be retried.

Do not keep a user waiting indefinitely for fulfillment to finish. If the order
is still moving after the budget, return the latest progress and let the UI
switch to a background refresh, push update, or manual reload.

Do not turn terminal business states into effect failures just to stop polling.
Return the final status as data, then map `"canceled"` or
`"fulfillment_failed"` to user-facing control flow after the repeat completes.

## Schedule shape

Start with the polling cadence, preserve the latest successful status as the
schedule output, continue only while the status is non-terminal, and compose in a
short elapsed-time budget:

```ts
Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<FulfillmentStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.during("20 seconds").pipe(
      Schedule.satisfiesInputType<FulfillmentStatus>()
    )
  )
)
```

`Schedule.spaced("2 seconds")` waits between follow-up polls. The first status
read is still immediate. `Schedule.passthrough` makes the repeated effect return
the latest observed status instead of the timing schedule's numeric output.
`Schedule.while` inspects the most recent successful status. `Schedule.during`
adds the user-facing budget, and `Schedule.bothLeft` keeps the status as the
schedule output.

## Code

```ts
import { Effect, Schedule } from "effect"

type FulfillmentStatus =
  | { readonly state: "received"; readonly orderId: string }
  | { readonly state: "picking"; readonly orderId: string; readonly itemsPicked: number }
  | { readonly state: "packing"; readonly orderId: string }
  | { readonly state: "shipped"; readonly orderId: string; readonly trackingNumber: string }
  | { readonly state: "delivered"; readonly orderId: string; readonly deliveredAt: string }
  | { readonly state: "canceled"; readonly orderId: string; readonly reason: string }
  | { readonly state: "fulfillment_failed"; readonly orderId: string; readonly reason: string }

type FulfillmentReadError = {
  readonly _tag: "FulfillmentReadError"
  readonly orderId: string
  readonly message: string
}

declare const readFulfillmentStatus: (
  orderId: string
) => Effect.Effect<FulfillmentStatus, FulfillmentReadError>

const isTerminal = (status: FulfillmentStatus): boolean =>
  status.state === "delivered" ||
  status.state === "canceled" ||
  status.state === "fulfillment_failed"

const userFacingPolling = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<FulfillmentStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.during("20 seconds").pipe(
      Schedule.satisfiesInputType<FulfillmentStatus>()
    )
  )
)

export const pollOrderFulfillment = (orderId: string) =>
  readFulfillmentStatus(orderId).pipe(
    Effect.repeat(userFacingPolling)
  )
```

`pollOrderFulfillment` performs the first read immediately. If the first status
is `"delivered"`, `"canceled"`, or `"fulfillment_failed"`, the schedule stops
without sleeping or issuing another request. If the status is still in progress,
the schedule waits two seconds before the next read.

The returned effect succeeds with the last observed `FulfillmentStatus`. That
value may be terminal, or it may be the latest non-terminal status observed when
the twenty-second user-facing budget ended.

## Variants

For a very latency-sensitive checkout confirmation page, shorten the budget and
keep the last status as data:

```ts
const checkoutConfirmationPolling = Schedule.spaced("1 second").pipe(
  Schedule.satisfiesInputType<FulfillmentStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.during("8 seconds").pipe(
      Schedule.satisfiesInputType<FulfillmentStatus>()
    )
  )
)
```

For a support dashboard where an agent can tolerate a slower refresh, increase
the spacing and use jitter so many open order views do not poll together:

```ts
const supportDashboardPolling = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<FulfillmentStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.during("1 minute").pipe(
      Schedule.satisfiesInputType<FulfillmentStatus>()
    )
  )
)
```

If the caller needs different behavior for delivered, canceled, failed, and
still-in-progress outcomes, keep that interpretation outside the schedule:

```ts
const program = pollOrderFulfillment("order-123").pipe(
  Effect.flatMap((status) => {
    switch (status.state) {
      case "delivered":
        return Effect.succeed({ _tag: "Delivered" as const, status })
      case "canceled":
      case "fulfillment_failed":
        return Effect.succeed({ _tag: "Stopped" as const, status })
      default:
        return Effect.succeed({ _tag: "StillProcessing" as const, status })
    }
  })
)
```

The polling schedule answers "should another status read happen?" The code after
polling answers "what should this user see now?"

## Notes and caveats

`Effect.repeat` feeds successful status values into the schedule. `Effect.retry`
feeds failures into the schedule. Use `Effect.repeat` for domain statuses and a
separate retry policy for transient read failures.

The first status read is not delayed. Schedule delays apply only to later
recurrences.

`Schedule.while` receives schedule metadata. After `Schedule.passthrough`, both
`metadata.input` and the schedule output are the latest successful fulfillment
status.

`Schedule.during` limits the recurrence policy. When the budget stops the
schedule before a terminal state is observed, the caller still receives the last
successful status and can show progress without pretending the order is done.
