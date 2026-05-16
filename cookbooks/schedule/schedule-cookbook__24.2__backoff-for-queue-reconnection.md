---
book: Effect `Schedule` Cookbook
section_number: "24.2"
section_title: "Backoff for queue reconnection"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "24. Exponential Backoff Recipes"
status: "draft"
code_included: true
---

# 24.2 Backoff for queue reconnection

Queue consumers often fail for reasons that are not fixed by reconnecting
immediately: the broker is restarting, the network path is unstable, or a queue
endpoint has temporarily refused new sessions. A reconnect policy should make
that pressure visible in one place instead of scattering sleeps through the
consumer loop.

## Problem

You have a consumer that should reconnect after transient queue connection
failures, but it must not hammer the broker while it is recovering. The first
connection attempt should happen immediately. Only failed reconnect attempts
should wait, and the policy should say exactly how the delay grows and when the
worker gives up.

## When to use it

Use this recipe for queue clients, broker consumers, or background workers where
the next sensible action after a transient disconnect is to reconnect. It is a
good fit when operators need concrete answers such as "how many reconnects will
we try?" and "how quickly does the delay grow?"

## When not to use it

Do not use backoff to hide permanent configuration problems. Authentication
failures, missing queues, invalid consumer groups, and schema mismatches should
be handled before this retry policy is applied. A reconnect schedule should
only see failures that are plausibly transient.

## Schedule shape

Use `Schedule.exponential` for the growing delay and combine it with
`Schedule.recurs` for the retry limit. In `Schedule.exponential("250 millis")`,
the produced delays start at 250 milliseconds and double by default: 250ms,
500ms, 1s, 2s, and so on. `Schedule.recurs(6)` allows six recurrences after
the initial attempt, so the worker makes at most seven connection attempts in
total.

Add `Schedule.jittered` when many workers may reconnect at the same time. It
keeps the same basic shape but randomly adjusts each delay to between 80% and
120% of the original delay, which helps avoid a fleet of consumers retrying in
lockstep.

## Code

```ts
import { Effect, Schedule } from "effect"

type QueueConnection = {
  readonly run: Effect.Effect<void, QueueRuntimeError>
}

type QueueConnectError =
  | { readonly _tag: "BrokerUnavailable" }
  | { readonly _tag: "ConnectionReset" }

type QueueRuntimeError =
  | QueueConnectError
  | { readonly _tag: "MessageDecodeFailed" }

declare const openQueueConnection: Effect.Effect<
  QueueConnection,
  QueueConnectError
>

const reconnectBackoff = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(6))
)

const connectWithBackoff = openQueueConnection.pipe(
  Effect.retry(reconnectBackoff)
)

export const consumer = Effect.gen(function*() {
  const connection = yield* connectWithBackoff
  return yield* connection.run
})
```

## Variants

- For a single local worker, remove `Schedule.jittered` if deterministic timing
  is more useful than desynchronization.
- For a larger consumer fleet, keep jitter and consider a larger base delay so
  broker recovery does not receive a synchronized reconnect wave.
- For a supervisor that should restart the whole consumer after runtime
  disconnects, apply the same policy around the larger effect that opens the
  connection and runs the consume loop.

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. In the example, only
`QueueConnectError` reaches the reconnect policy, so decode failures from the
running consumer are not silently retried as connection problems. Keep that
classification close to the queue client, then let the `Schedule` describe only
the recurrence mechanics: growing delay, jitter, and retry limit.
