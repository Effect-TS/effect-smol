---
book: "Effect `Schedule` Cookbook"
section_number: "30.1"
section_title: "Poll payment settlement status"
part_title: "Part VII — Real-World Recipes"
chapter_title: "30. Product and Business Workflow Recipes"
status: "draft"
code_included: true
---

# 30.1 Poll payment settlement status

Payment settlement is often asynchronous: the provider accepts the payment
first, then moves it through pending, processing, and terminal states. Model
those non-terminal states as successful observations and use a repeat schedule
to decide when another read is worth doing.

## Problem

You need to poll a provider until settlement reaches a terminal state, but the
caller still needs a bounded answer. `Pending` and `Processing` are not errors;
they are successful responses that mean "poll again after a pause."

## When to use it

Use this for checkout confirmation, payment reconciliation, and short-lived
API calls where the current request should wait briefly for settlement. The
status endpoint must be safe to call repeatedly.

## When not to use it

Do not use this to hide provider failures. Authentication errors, invalid
payment ids, malformed requests, and transport failures belong in the error
channel or in a separate retry policy. Do not treat a timeout as a failed
payment; it only means this polling window ended before a terminal status was
seen.

## Schedule shape

Use `Effect.repeat` because the decision is based on successful statuses. The
schedule keeps the latest status with `Schedule.passthrough`, continues while
the status is open, and also enforces a time budget.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type SettlementStatus =
  | { readonly _tag: "Pending" }
  | { readonly _tag: "Processing" }
  | { readonly _tag: "Settled"; readonly settlementId: string }
  | { readonly _tag: "Declined"; readonly reason: string }

const statuses: ReadonlyArray<SettlementStatus> = [
  { _tag: "Pending" },
  { _tag: "Processing" },
  { _tag: "Settled", settlementId: "set_123" }
]

let reads = 0

const fetchSettlementStatus = Effect.gen(function*() {
  const status = statuses[Math.min(reads, statuses.length - 1)]
  reads += 1
  yield* Console.log(`provider status: ${status._tag}`)
  return status
})

const isOpen = (status: SettlementStatus) =>
  status._tag === "Pending" || status._tag === "Processing"

const pollOpenSettlements = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<SettlementStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isOpen(input)),
  Schedule.bothLeft(
    Schedule.during("100 millis").pipe(
      Schedule.satisfiesInputType<SettlementStatus>()
    )
  )
)

const program = fetchSettlementStatus.pipe(
  Effect.repeat(pollOpenSettlements),
  Effect.flatMap((status) => {
    switch (status._tag) {
      case "Settled":
        return Console.log(`settled as ${status.settlementId}`)
      case "Declined":
        return Console.log(`declined: ${status.reason}`)
      case "Pending":
      case "Processing":
        return Console.log(`timed out while ${status._tag}`)
    }
  })
)

Effect.runPromise(program)
```

The first read happens immediately. The schedule controls only follow-up reads.
When the terminal `Settled` status appears, the repeat stops and the domain code
decides what to report.

## Variants

Use a shorter budget for a checkout request and a slower cadence for background
reconciliation. Add `Schedule.jittered` when many payments may start polling at
the same time.

## Notes and caveats

Keep settlement interpretation outside the schedule. The schedule answers
"should another status read happen?"; the payment workflow decides what
`Settled`, `Declined`, or a still-open timeout means.
