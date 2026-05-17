---
book: Effect `Schedule` Cookbook
section_number: "27.4"
section_title: "Jittered retries for brokers and queues"
part_title: "Part VI — Jitter Recipes"
chapter_title: "27. Jitter for Retry"
status: "draft"
code_included: true
---

# 27.4 Jittered retries for brokers and queues

Use jittered retries for broker and queue operations that may fail in waves when
leaders move, pools drain, or many consumers restart together.

## Problem

A worker publishes or acknowledges a message. Temporary broker failures should
be retried, but the policy must be bounded so the caller can eventually
dead-letter, requeue, or surface the failure. A dead-letter path is a separate
queue or state used for messages that could not be processed normally.

## When to use it

Use this recipe for retryable broker and queue operations such as publishing a
deduplicated event, extending a lease, acknowledging a message, reconnecting a
consumer, or committing an offset when the client can safely repeat the request.

It is especially useful in worker fleets. Jitter spreads retry traffic around
each computed delay, while the retry count keeps a single message from occupying
a worker indefinitely.

## When not to use it

Do not retry messages that failed because the payload is invalid, the topic or
queue name is wrong, credentials are missing, or the broker rejected the request
as a permanent domain error. Those failures should go through the normal
poison-message or operator-alert path.

Do not use a schedule to make unsafe delivery safe. If retrying can duplicate a
message, use an idempotency key, broker-side deduplication, an outbox, or
consumer-side de-duplication before applying this policy.

## Schedule shape

Start with an exponential delay curve for pressure relief. `Schedule.jittered`
then adjusts each delay between 80% and 120% of the selected value. Apply any
hard cap after jitter, and add `Schedule.recurs` so the message does not occupy
a worker indefinitely.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

interface BrokerMessage {
  readonly topic: string
  readonly key: string
  readonly body: string
}

class BrokerDeliveryError extends Data.TaggedError("BrokerDeliveryError")<{
  readonly reason:
    | "ConnectionLost"
    | "LeaderUnavailable"
    | "Throttled"
    | "InvalidMessage"
    | "Unauthorized"
}> {}

const isRetryableBrokerError = (error: BrokerDeliveryError): boolean => {
  switch (error.reason) {
    case "ConnectionLost":
    case "LeaderUnavailable":
    case "Throttled":
      return true
    case "InvalidMessage":
    case "Unauthorized":
      return false
  }
}

let attempt = 0

const publishMessage = Effect.fnUntraced(function*(message: BrokerMessage) {
  attempt += 1
  yield* Effect.sync(() =>
    console.log(`publish ${message.topic}/${message.key} attempt ${attempt}`)
  )

  if (attempt < 3) {
    return yield* Effect.fail(
      new BrokerDeliveryError({ reason: "LeaderUnavailable" })
    )
  }

  yield* Effect.sync(() => console.log("message published"))
})

const brokerDeliveryPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(120)))
  ),
  Schedule.both(Schedule.recurs(6))
)

const message: BrokerMessage = {
  topic: "orders",
  key: "order-123",
  body: "created"
}

const program = publishMessage(message).pipe(
  Effect.retry({
    schedule: brokerDeliveryPolicy,
    while: isRetryableBrokerError
  })
)

Effect.runPromise(program)
```

## Variants

For acknowledgement or offset-commit retries, keep the retry count small if the
broker lease is short. A long local retry loop can be worse than letting the
message become visible again and allowing the queue's normal redelivery policy
to take over.

For producer-side publishing, increase the retry count only when the message is
deduplicated. A bounded schedule controls pressure on the broker, but it does
not prevent duplicate events by itself.

For a broker that returns a server-provided retry delay, prefer that delay for
the throttled case. Use the jittered exponential policy as the fallback when the
broker provides no better timing signal.

## Notes and caveats

`Schedule.jittered` has fixed bounds in Effect. It adjusts delays between 80%
and 120% of the original delay; this recipe does not assume configurable jitter
bounds.

`Schedule.exponential` recurs forever by itself. Pair it with `Schedule.recurs`,
`Schedule.take`, `Schedule.during`, or a retry predicate.

`Schedule.recurs(6)` means six retries after the original delivery attempt, not
six total executions.

Keep retry classification near the broker operation. The schedule should make
timing and limits visible; the domain code should decide whether a failed
message is retryable, poison, duplicated, or ready for dead-letter handling.
