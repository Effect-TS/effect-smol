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

Fulfillment moves through normal domain states: received, picking, packing,
shipped, delivered, canceled, or failed. Poll those states as successful data,
not as failures.

## Problem

You need to show recent fulfillment progress without keeping a user request open
forever. The schedule should pause between reads, stop on terminal states, and
return the latest status when the budget ends.

## When to use it

Use this for order pages, support tools, and checkout follow-up flows where a
short polling window is acceptable and a later push update or refresh can finish
the story.

## When not to use it

Do not use this as a retry policy for a failing fulfillment endpoint. Add a
separate retry around the read if transport failures are expected. Do not turn
terminal business states into defects just to stop polling.

## Schedule shape

Use `Schedule.spaced` for the read cadence, `Schedule.passthrough` to keep the
latest status, `Schedule.while` to continue only for non-terminal states, and
`Schedule.during` for the user-facing budget.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type FulfillmentStatus =
  | { readonly state: "received"; readonly orderId: string }
  | { readonly state: "picking"; readonly orderId: string }
  | { readonly state: "shipped"; readonly orderId: string }
  | { readonly state: "delivered"; readonly orderId: string }
  | { readonly state: "canceled"; readonly orderId: string }

const statuses: ReadonlyArray<FulfillmentStatus> = [
  { state: "received", orderId: "order-123" },
  { state: "picking", orderId: "order-123" },
  { state: "shipped", orderId: "order-123" },
  { state: "delivered", orderId: "order-123" }
]

let reads = 0

const readFulfillmentStatus = Effect.sync(() => {
  const status = statuses[Math.min(reads, statuses.length - 1)]
  reads += 1
  console.log(`fulfillment status: ${status.state}`)
  return status
})

const isTerminal = (status: FulfillmentStatus) =>
  status.state === "delivered" || status.state === "canceled"

const userFacingPolling = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<FulfillmentStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.during("100 millis").pipe(
      Schedule.satisfiesInputType<FulfillmentStatus>()
    )
  )
)

const program = readFulfillmentStatus.pipe(
  Effect.repeat(userFacingPolling),
  Effect.flatMap((status) =>
    isTerminal(status)
      ? Console.log(`terminal fulfillment state: ${status.state}`)
      : Console.log(`still in progress: ${status.state}`)
  )
)

Effect.runPromise(program)
```

The first status read is immediate. The schedule waits only before follow-up
reads and returns the final observed status.

## Variants

Shorten the budget for checkout confirmation. Increase spacing for support
dashboards. Add jitter when many open views may poll together.

## Notes and caveats

`Effect.repeat` feeds successful statuses into the schedule. Keep the mapping
from fulfillment status to UI behavior outside the schedule.
