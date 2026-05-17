---
book: Effect `Schedule` Cookbook
section_number: "36.1"
section_title: "Stop when status becomes terminal"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "36. Stop on Output Conditions"
status: "draft"
code_included: true
---

# 36.1 Stop when status becomes terminal

You are polling a job, order, import, deployment, or other long-running
workflow. The status endpoint succeeds even while the workflow is still in
progress, and one of the returned statuses eventually means "there is nothing
more to poll".

Use `Effect.repeat` for the polling loop and let the schedule inspect each
successful status. The effect performs the first status read immediately. After
that, the schedule decides whether to wait and read again.

## Problem

A status API may return `"queued"` or `"running"` as successful responses before
it eventually returns `"completed"`, `"failed"`, or `"canceled"`. The repeat
policy should treat only the non-terminal statuses as reasons to poll again.

A domain status such as `"failed"` is still a successful response from the status
API. The schedule should observe that value and stop the repeat loop, while
transport or decoding failures remain ordinary Effect failures.

## When to use it

Use this when the repeated effect returns a domain status value and only some
of those statuses mean "poll again".

This is a good fit for order fulfillment, export generation, provisioning,
replication, and back-office jobs where states such as `"queued"` or
`"running"` are normal intermediate observations, while states such as
`"completed"`, `"failed"`, or `"canceled"` are terminal observations.

## When not to use it

Do not use this as a retry policy for failed status reads. With
`Effect.repeat`, a failure from the status-read effect stops the repeat before
the schedule can inspect a status. Add a separate retry around the status read
if transient read failures should be retried.

Do not encode normal terminal statuses as failures just to stop polling. If the
remote workflow can end in `"completed"` or `"failed"` and both are meaningful
business outcomes, return both as successful status values and interpret the
final status after the repeat completes.

Do not leave production polling unbounded unless the fiber has a clear owner
that can interrupt it. Add a recurrence limit or elapsed budget when a terminal
status is expected but not guaranteed.

## Schedule shape

Start with a cadence, pass the successful status through as the schedule
output, and continue only while the latest status is not terminal:

```ts
Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<OrderStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)
```

`Schedule.spaced("2 seconds")` waits between successful status reads.
`Schedule.passthrough` changes the schedule output to the latest successful
status. `Schedule.while` receives schedule metadata, including `input`, which
is the status returned by the most recent run of the repeated effect.

Returning `true` from the predicate allows another poll. Returning `false`
stops the repeat and returns the latest status.

## Code

```ts
import { Effect, Schedule } from "effect"

type OrderStatus =
  | { readonly state: "queued"; readonly orderId: string }
  | { readonly state: "running"; readonly orderId: string; readonly step: string }
  | { readonly state: "completed"; readonly orderId: string; readonly receiptId: string }
  | { readonly state: "failed"; readonly orderId: string; readonly reason: string }
  | { readonly state: "canceled"; readonly orderId: string }

type StatusReadError = {
  readonly _tag: "StatusReadError"
  readonly orderId: string
}

declare const readOrderStatus: (
  orderId: string
) => Effect.Effect<OrderStatus, StatusReadError>

const isTerminal = (status: OrderStatus): boolean =>
  status.state === "completed" ||
  status.state === "failed" ||
  status.state === "canceled"

const pollUntilTerminal = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<OrderStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.during("2 minutes").pipe(
      Schedule.satisfiesInputType<OrderStatus>()
    )
  )
)

export const waitForTerminalOrderStatus = (orderId: string) =>
  readOrderStatus(orderId).pipe(
    Effect.repeat(pollUntilTerminal)
  )
```

`waitForTerminalOrderStatus` reads the status immediately. If the first status
is `"completed"`, `"failed"`, or `"canceled"`, there is no delay and no second
request. If the status is `"queued"` or `"running"`, the schedule waits two
seconds before the next read.

The returned effect succeeds with the last observed `OrderStatus`. Usually that
will be a terminal status. If the two-minute recurrence budget is reached first,
the final value may still be `"queued"` or `"running"`, which lets the caller
distinguish "terminal status observed" from "polling budget exhausted".

## Variants

For an internal worker where eventual completion is expected, replace the
two-minute budget with a recurrence cap:

```ts
const pollUntilTerminalOrTwentyReads = Schedule.spaced("5 seconds").pipe(
  Schedule.satisfiesInputType<OrderStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input)),
  Schedule.bothLeft(
    Schedule.recurs(20).pipe(
      Schedule.satisfiesInputType<OrderStatus>()
    )
  )
)
```

For many clients polling the same kind of resource, add jitter after choosing a
base cadence so instances do not synchronize:

```ts
const fleetPollingCadence = Schedule.spaced("2 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<OrderStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => !isTerminal(input))
)
```

If terminal statuses should produce different control flow, keep polling
separate from interpretation:

```ts
const program = waitForTerminalOrderStatus("order-123").pipe(
  Effect.flatMap((status) =>
    status.state === "completed"
      ? Effect.succeed(status.receiptId)
      : Effect.fail(status)
  )
)
```

The polling schedule answers "should I observe again?" The code after polling
answers "what does the final status mean for this caller?"

## Notes and caveats

The first status read is not delayed. Schedule delays apply only before later
recurrences.

`Schedule.while` is evaluated at recurrence decision points after successful
runs. It does not interrupt a status read that is already running.

`Effect.repeat` feeds successful values into the schedule. `Effect.retry` feeds
failures into the schedule. Use `Effect.repeat` when the status value itself
decides whether to continue polling.

When a timing schedule needs to inspect the repeated effect's successful value,
use `Schedule.satisfiesInputType<T>()` before `Schedule.while`. Use
`Schedule.passthrough` when the caller should receive the last observed status
rather than the timing schedule's own output.
