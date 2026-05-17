---
book: "Effect `Schedule` Cookbook"
section_number: "22.1"
section_title: "Stop when status becomes terminal"
part_title: "Part VI — Composition and Termination"
chapter_title: "22. Stop Conditions"
status: "draft"
code_included: true
---

# 22.1 Stop when status becomes terminal

Poll a job, order, import, deployment, or other long-running workflow when the
status endpoint succeeds even while the workflow is still in progress. A later
successful status eventually means "there is nothing more to poll".

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

Combine `Schedule.identity<OrderStatus>()` with a cadence using
`Schedule.bothLeft`. The identity schedule makes the latest successful status
the schedule output, while the cadence supplies the delay before the next read.
Then use `Schedule.while` to continue only while that status is not terminal.

Returning `true` from the predicate allows another poll. Returning `false`
stops the repeat and returns the latest status.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

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

const statuses: ReadonlyArray<OrderStatus> = [
  { state: "queued", orderId: "order-123" },
  { state: "running", orderId: "order-123", step: "packing" },
  { state: "completed", orderId: "order-123", receiptId: "receipt-456" }
]

let reads = 0

const readOrderStatus = (
  orderId: string
): Effect.Effect<OrderStatus, StatusReadError> =>
  Effect.gen(function*() {
    const index = yield* Effect.sync(() => {
      const current = reads
      reads += 1
      return current
    })
    const status = statuses[index] ?? statuses[statuses.length - 1]!

    yield* Console.log(`status read ${index + 1}: ${status.state}`)
    return status
  })

const isTerminal = (status: OrderStatus): boolean =>
  status.state === "completed" ||
  status.state === "failed" ||
  status.state === "canceled"

const pollUntilTerminal = Schedule.identity<OrderStatus>().pipe(
  Schedule.bothLeft(Schedule.spaced("100 millis")),
  Schedule.while(({ output }) => !isTerminal(output))
)

const waitForTerminalOrderStatus = (orderId: string) =>
  readOrderStatus(orderId).pipe(
    Effect.repeat(pollUntilTerminal)
  )

const program = waitForTerminalOrderStatus("order-123").pipe(
  Effect.flatMap((status) => Console.log(`final status: ${status.state}`))
)

Effect.runPromise(program)
```

`waitForTerminalOrderStatus` reads the status immediately. If the first status
is `"completed"`, `"failed"`, or `"canceled"`, there is no delay and no second
request. If the status is `"queued"` or `"running"`, the schedule waits two
seconds in a real policy before the next read; the runnable example uses a
shorter delay so it finishes quickly.

The returned effect succeeds with the last observed `OrderStatus`. Usually that
will be a terminal status. If you add a recurrence cap or elapsed budget, the
final value may still be `"queued"` or `"running"`, so check the final status
before treating the workflow as complete.

## Variants

For an internal worker where eventual completion is expected, combine the
condition with `Schedule.recurs`. For caller-facing polling, combine it with
`Schedule.during` so the caller gets a bounded answer.

For many clients polling the same kind of resource, add `Schedule.jittered`
after choosing a base cadence so instances do not synchronize.

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
use a schedule whose input type matches that value. `Schedule.identity<T>()` is
convenient when the caller should receive the last observed value rather than the
timing schedule's own output.
