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

Broker and queue clients often fail in waves when leaders move, pools drain, or
deployments restart many consumers at once. This recipe applies jitter after you
choose the retryable broker backoff shape.

## Problem

You deliver a message to a broker from a background worker. Temporary broker
errors should be retried, but the worker needs a bounded policy that can hand
the message off to a dead-letter, requeue, or operator-visible path.

You want a delivery policy that:

- retries only transient broker failures
- starts with a short delay
- backs off after repeated failures
- jitters each delay so workers do not retry in lockstep
- caps the maximum delay
- stops after a bounded number of retries so the caller can dead-letter,
  requeue, or surface the failure

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

Start with the operational delay curve:

```ts
Schedule.exponential("200 millis")
```

With the default factor of `2`, that produces delays of 200 milliseconds, 400
milliseconds, 800 milliseconds, 1.6 seconds, and so on. `Schedule.jittered`
randomly adjusts each delay between 80% and 120% of the delay selected by the
wrapped schedule.

The cap is applied after jitter so the final sleep never exceeds the configured
maximum. `Schedule.recurs(6)` allows at most six retries after the original
delivery attempt.

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

declare const publishMessage: (
  message: BrokerMessage
) => Effect.Effect<void, BrokerDeliveryError>

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

const brokerDeliveryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(6))
)

export const deliverOrderEvent = (message: BrokerMessage) =>
  publishMessage(message).pipe(
    Effect.retry({
      schedule: brokerDeliveryPolicy,
      while: isRetryableBrokerError
    })
  )
```

`deliverOrderEvent` publishes once immediately. If the broker reports
`ConnectionLost`, `LeaderUnavailable`, or `Throttled`, the next attempt waits
for the jittered exponential delay. If the broker reports `InvalidMessage` or
`Unauthorized`, retrying stops immediately and the typed failure is returned.

If all retryable attempts fail, `Effect.retry` returns the last
`BrokerDeliveryError`. The schedule does not decide whether the message should
be dead-lettered or requeued; it only describes the bounded retry window before
that domain decision.

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

`Schedule.exponential` recurs forever by itself. Pair it with a limit such as
`Schedule.recurs`, `Schedule.take`, `Schedule.during`, or a predicate that stops
on non-retryable broker errors.

`Schedule.recurs(6)` means six retries after the original delivery attempt, not
six total executions.

Keep retry classification near the broker operation. The schedule should make
timing and limits visible; the domain code should decide whether a failed
message is retryable, poison, duplicated, or ready for dead-letter handling.
