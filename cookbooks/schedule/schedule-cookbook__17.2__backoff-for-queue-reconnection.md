---
book: "Effect `Schedule` Cookbook"
section_number: "17.2"
section_title: "Backoff for queue reconnection"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "17. Operational Backoff Recipes"
status: "draft"
code_included: true
---

# 17.2 Backoff for queue reconnection

Queue reconnection should have one visible timing policy. That policy describes
how much pressure a consumer applies while the broker, network path, or endpoint
is recovering.

## Problem

A worker must open a queue connection before it can consume messages. The first
attempt should happen immediately. Transient connection failures should retry
with a growing delay and stop after a clear budget.

## When to use it

Use this for queue clients, broker consumers, or background workers where the
right response to a transient disconnect is to reconnect. Operators should be
able to answer "how many reconnects will this try?" and "how quickly does the
delay grow?" from the schedule.

## When not to use it

Do not retry permanent configuration problems: bad credentials, missing queues,
invalid consumer groups, or schema mismatches. Keep decode and processing
failures out of the reconnect policy unless reconnecting is truly the recovery
action.

## Schedule shape

`Schedule.exponential("250 millis")` starts at 250 milliseconds and doubles by
default. `Schedule.recurs(6)` allows six retries after the original attempt.
`Schedule.jittered` spreads reconnects when many workers fail at the same time.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

type QueueConnectError =
  | { readonly _tag: "BrokerUnavailable" }
  | { readonly _tag: "ConnectionReset" }

type QueueRuntimeError =
  | QueueConnectError
  | { readonly _tag: "MessageDecodeFailed" }

interface QueueConnection {
  readonly run: Effect.Effect<void, QueueRuntimeError>
}

let connectAttempts = 0

const openQueueConnection: Effect.Effect<QueueConnection, QueueConnectError> =
  Effect.gen(function*() {
    connectAttempts += 1
    yield* Console.log(`queue connect attempt ${connectAttempts}`)

    if (connectAttempts < 3) {
      return yield* Effect.fail({ _tag: "BrokerUnavailable" } as const)
    }

    return {
      run: Console.log("consumer processed one message")
    }
  })

const reconnectBackoff = Schedule.exponential("20 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const connectWithBackoff = openQueueConnection.pipe(
  Effect.retry(reconnectBackoff)
)

const consumer = Effect.gen(function*() {
  const connection = yield* connectWithBackoff
  yield* connection.run
}).pipe(
  Effect.catch((error) => Console.log(`consumer failed: ${error._tag}`))
)

Effect.runPromise(consumer)
```

The example stops after one processed message so it can be pasted into a
scratchpad and run immediately.

## Variants

For a single local worker, deterministic timing may be easier to debug, so
jitter can be removed. For a larger fleet, keep jitter and consider a larger
base delay so broker recovery does not receive a synchronized reconnect wave.

For a supervisor that should restart the whole consumer after runtime
disconnects, apply the policy around the larger effect that opens the connection
and runs the consume loop.

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. In the example, only
`QueueConnectError` reaches the reconnect policy, so message decode failures are
not silently treated as connection problems.
