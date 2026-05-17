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

Broker recovery retries should reconnect eventually without creating another
load spike. A `Schedule` makes the contract explicit: how quickly clients come
back, how much pressure they apply, and where the retry loop stops.

## Problem

A worker must reconnect before it can resume consuming messages. Transient
broker states such as connection refusals, leader-election windows, and
rebalances should wait progressively longer between attempts.

Permanent configuration failures should bypass the schedule.

## When to use it

Use this when a broker connection, subscription, or consumer assignment can fail
with a transient typed error and trying again later is correct. It fits broker
restarts, partition leadership changes, rebalance windows, and short network
failures between workers and the broker.

## When not to use it

Do not retry invalid credentials, unknown topics, authorization failures,
incompatible protocol versions, or malformed consumer group settings. Also avoid
wrapping a broad worker workflow if it may have already processed messages
before failing; message handling needs its own acknowledgement and idempotency
rules.

## Schedule shape

`Schedule.exponential("500 millis")` creates an unbounded backoff schedule. With
the default factor of `2`, the delays are 500 milliseconds, 1 second, 2 seconds,
4 seconds, and so on.

Combine it with `Schedule.recurs` to bound retries. Add `Schedule.jittered` for
large fleets so workers do not move together after a shared outage.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

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

type BrokerConnectError = BrokerUnavailable | BrokerConfigurationError

let attempts = 0

const connectConsumer: Effect.Effect<BrokerSession, BrokerConnectError> =
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`broker connect attempt ${attempts}`)

    if (attempts < 4) {
      return yield* Effect.fail(
        new BrokerUnavailable({
          broker: "orders",
          reason: attempts === 1 ? "leader-election" : "rebalance"
        })
      )
    }

    return { consumerGroup: "orders-worker" }
  })

const brokerRecoveryPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = Effect.gen(function*() {
  const session = yield* connectConsumer.pipe(
    Effect.retry({
      schedule: brokerRecoveryPolicy,
      while: (error) => error._tag === "BrokerUnavailable"
    })
  )
  yield* Console.log(`connected consumer group: ${session.consumerGroup}`)
}).pipe(
  Effect.catch((error) => Console.log(`broker recovery failed: ${error._tag}`))
)

Effect.runPromise(program)
```

The delays are intentionally small for a runnable example. Use a larger base and
retry count for real broker recovery.

## Variants

For a large worker fleet, add `Schedule.jittered` after the exponential backoff.
For brokers that need longer leader elections or rebalances, use a larger base
interval or a higher retry limit. For fast failover to another region, keep the
retry count small and let the supervisor choose the next recovery action.

## Notes and caveats

Backoff controls reconnect pressure, not message-processing pressure. After a
consumer reconnects, backlog pressure still depends on concurrency, batch size,
prefetch, and downstream rate limits.

`Schedule.recurs(5)` means five retries after the original connection attempt,
not five total attempts.
