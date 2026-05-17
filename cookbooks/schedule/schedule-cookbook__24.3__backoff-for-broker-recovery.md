---
book: Effect `Schedule` Cookbook
section_number: "24.3"
section_title: "Backoff for broker recovery"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "24. Exponential Backoff Recipes"
status: "draft"
code_included: true
---

# 24.3 Backoff for broker recovery

Broker recovery retries need to reconnect eventually without turning recovery
into a second load spike. A visible `Schedule` makes that operational contract
explicit: how quickly clients return, how much pressure they apply, and where
the loop stops.

## Problem

A worker has to reconnect before it can resume consuming messages. Transient
broker errors such as connection refusals, leader-election windows, and
rebalances should wait progressively longer between attempts.

Use `Schedule.exponential` with `Effect.retry` for the reconnect attempt, and
bound it with `Schedule.recurs` so a worker does not retry forever without
supervision.

## When to use it

Use this recipe when a broker connection, subscription, or consumer assignment
can fail with a transient typed error and trying again later is the correct
recovery action.

It fits broker restarts, temporary connection refusals, partition leadership
changes, rebalance windows, and short-lived network failures between workers and
the broker.

The goal is not only to reconnect eventually. The goal is to reconnect in a way
that gives the broker and the systems behind the consumers room to absorb the
returning traffic.

## When not to use it

Do not retry errors that need configuration or operator action, such as invalid
credentials, unknown topics, authorization failures, incompatible protocol
versions, or malformed consumer group settings. Classify those before applying
the schedule.

Do not use reconnect backoff as the only protection for a large fleet. Broker
recovery usually also needs connection limits, consumer concurrency limits,
prefetch or batch-size control, and downstream admission control.

Do not retry a broad worker workflow if it may have already processed messages
before failing. Keep the retry around the connection or subscription step, and
handle message processing with its own acknowledgement and idempotency rules.

## Schedule shape

`Schedule.exponential("500 millis")` creates an unbounded backoff schedule. With
the default factor of `2`, its delays are 500 milliseconds, 1 second, 2
seconds, 4 seconds, and so on.

`Schedule.recurs(8)` allows at most eight retries after the original attempt.
Combined with `Schedule.both`, the policy continues only while both schedules
continue:

```ts
const brokerRecoveryPolicy = Schedule.exponential("500 millis").pipe(
  Schedule.both(Schedule.recurs(8))
)
```

With `Effect.retry`, the first connection attempt is not delayed. If it fails
with a typed error, that error is fed to the schedule. If the schedule
continues, Effect waits for the schedule's delay and tries again. If the
schedule stops, the last typed failure is propagated.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class BrokerUnavailable extends Data.TaggedError("BrokerUnavailable")<{
  readonly broker: string
  readonly reason: "connection-refused" | "leader-election" | "rebalance"
}> {}

class BrokerConfigurationError extends Data.TaggedError(
  "BrokerConfigurationError"
)<{
  readonly broker: string
  readonly reason: "unauthorized" | "unknown-topic"
}> {}

interface BrokerSession {
  readonly consumerGroup: string
}

declare const connectConsumer: Effect.Effect<
  BrokerSession,
  BrokerUnavailable | BrokerConfigurationError
>

const brokerRecoveryPolicy = Schedule.exponential("500 millis").pipe(
  Schedule.both(Schedule.recurs(8))
)

export const program = connectConsumer.pipe(
  Effect.retry({
    schedule: brokerRecoveryPolicy,
    while: (error) => error._tag === "BrokerUnavailable"
  })
)
```

`program` attempts to connect the consumer once immediately. If the broker is in
a transient recovery state, the next attempts wait 500 milliseconds, then 1
second, then 2 seconds, and continue growing from there until the retry limit is
reached.

The `while` predicate keeps the timing policy focused on recoverable broker
states. A configuration error such as `"unauthorized"` or `"unknown-topic"` is
not retried, because more time will not make that connection valid.

## Variants

For a large worker fleet, add jitter after the base backoff so workers do not
move together after a shared outage:

```ts
const fleetBrokerRecoveryPolicy = Schedule.exponential("500 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(8))
)
```

`Schedule.jittered` randomly adjusts each recurrence delay between 80% and 120%
of the original delay. The first retry from a 500 millisecond base will wait
somewhere from 400 to 600 milliseconds.

For a broker that may take longer to elect leaders or rebalance partitions, use
a larger base interval or a higher retry limit:

```ts
const slowBrokerRecoveryPolicy = Schedule.exponential("1 second").pipe(
  Schedule.both(Schedule.recurs(12))
)
```

For consumers that should fail over quickly to another broker or region, keep
the retry count small and let the supervisor decide the next recovery action.

## Notes and caveats

Backoff controls reconnect pressure, not message-processing pressure. After the
consumer reconnects, the backlog may still be large. Tune consumer concurrency,
batch size, prefetch, and downstream rate limits separately.

`Schedule.exponential` is unbounded by itself. Add a retry limit, elapsed budget,
or external supervisor unless unbounded recovery is intentional.

`Schedule.recurs(8)` means eight retries after the original connection attempt,
not eight total attempts.

`Effect.retry` feeds typed failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. For broker recovery, reconnect failures are
usually the schedule input; message values should normally be handled by the
consumer loop after the session has been established.
