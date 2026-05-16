---
book: Effect `Schedule` Cookbook
section_number: "27.3"
section_title: "Jittered retries for WebSocket reconnect"
part_title: "Part VI — Jitter Recipes"
chapter_title: "27. Jitter for Retry"
status: "draft"
code_included: true
---

# 27.3 Jittered retries for WebSocket reconnect

WebSocket clients often disconnect together: a deploy restarts the gateway, a
mobile network flaps, a load balancer rotates connections, or a regional outage
briefly drops many sockets. If every client reconnects on the same deterministic
backoff boundary, the reconnect policy can create a second burst exactly when
the server is recovering.

Use a bounded, jittered exponential backoff for reconnect attempts. The original
connect attempt still runs immediately. The schedule controls only later
attempts after a retryable connect failure.

## Problem

You need to reconnect a WebSocket after transient failures without asking every
client to wait for the same sequence of delays. The policy should make three
things explicit:

- which close or connect failures are worth retrying
- how the reconnect delay grows
- where the reconnect loop stops and reports failure to the caller

For user-facing clients, this is not just a load problem. A retry policy that
waits too long can leave the UI looking stuck, while a policy that retries too
quickly can burn battery, radio time, and server capacity.

## When to use it

Use this recipe when reconnecting an idempotent WebSocket session after
transient network or server conditions: temporary gateway unavailability,
connection reset, abnormal close, server overload, or a rolling restart.

It is especially useful when many clients run the same reconnect code: browser
tabs, mobile apps, desktop clients, edge workers, or service replicas that keep
long-lived sockets open.

## When not to use it

Do not retry authentication, authorization, protocol, or validation failures as
if they were transient. An expired token should usually refresh credentials
first. A forbidden user, unsupported protocol version, malformed URL, or rejected
subprotocol should fail in the domain layer before the reconnect schedule is
used.

Do not treat jitter as admission control. Jitter spreads retries around each
computed delay, but it does not reduce the number of clients that will attempt
to reconnect. Large fleets still need server-side limits, connection draining,
backpressure, and user-visible fallback states.

## Schedule shape

Start with exponential backoff, jitter each computed delay, cap the final delay,
and add a retry limit:

```ts
Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(8))
)
```

`Schedule.exponential("250 millis")` produces the increasing reconnect delay
curve. With the default factor of `2`, the base delays are 250 milliseconds, 500
milliseconds, 1 second, 2 seconds, and so on.

`Schedule.jittered` randomly adjusts each delay between 80% and 120% of the
delay produced by the wrapped schedule. A 1 second reconnect delay therefore
becomes 800 milliseconds to 1.2 seconds. The retry shape remains exponential,
but clients no longer share the exact same reconnect boundary.

The `Schedule.modifyDelay` step applies a hard five-second cap after jitter, so
the randomization cannot push the final wait beyond the user-facing bound.
`Schedule.recurs(8)` allows at most eight reconnect attempts after the original
connection attempt.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class WebSocketConnectError extends Data.TaggedError("WebSocketConnectError")<{
  readonly reason:
    | "AbnormalClose"
    | "GatewayUnavailable"
    | "NetworkError"
    | "ServerOverloaded"
    | "Unauthorized"
    | "UnsupportedProtocol"
}> {}

declare const connectWebSocket: Effect.Effect<void, WebSocketConnectError>

const isRetryableReconnectError = (error: WebSocketConnectError): boolean => {
  switch (error.reason) {
    case "AbnormalClose":
    case "GatewayUnavailable":
    case "NetworkError":
    case "ServerOverloaded":
      return true
    case "Unauthorized":
    case "UnsupportedProtocol":
      return false
  }
}

const reconnectPolicy = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(8))
)

export const program = connectWebSocket.pipe(
  Effect.retry({
    schedule: reconnectPolicy,
    while: isRetryableReconnectError
  })
)
```

`program` opens the WebSocket immediately. If that attempt fails with a
retryable `WebSocketConnectError`, the next attempt waits for the jittered
backoff delay. If the error is `Unauthorized` or `UnsupportedProtocol`, the
`while` predicate stops retrying immediately and the typed failure is returned.

If all retryable attempts fail, `Effect.retry` returns the last
`WebSocketConnectError`. The schedule does not hide the final failure; it only
describes when another connection attempt is allowed.

## Variants

For an interactive screen, keep the retry count and cap small enough that the UI
can move to a visible "reconnect failed" state quickly:

```ts
const foregroundReconnectPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(2)))
  ),
  Schedule.both(Schedule.recurs(5))
)
```

For a background client, allow a longer tail but keep the cap explicit and emit
attempt telemetry around the reconnect effect. Operators usually need to know
the close reason, attempt count, and final exhausted failure.

If the server sends a reconnect hint, such as a close reason with a retry-after
duration, prefer that server-provided delay for that case. Use the jittered
exponential policy as the fallback when the client has no better timing signal.

## Notes and caveats

`Schedule.jittered` has fixed bounds in Effect. It adjusts delays between 80%
and 120% of the original delay; this recipe does not assume configurable jitter
bounds.

`Effect.retry` feeds typed failures into the schedule. The first connect attempt
is not delayed. Jitter affects only reconnect delays after failures.

`Schedule.recurs(8)` means eight retries after the original connect attempt, not
eight total executions.

Reconnect safety is still a domain concern. Refresh credentials before retrying
authorization failures, avoid replaying non-idempotent session setup without a
deduplication story, and keep user-facing timeout or fallback behavior close to
the caller.
