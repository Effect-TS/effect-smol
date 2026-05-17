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

Use a bounded, jittered backoff when many WebSocket clients may reconnect after
the same gateway restart, network flap, or load-balancer rotation.

## Problem

A reconnect loop should recover from transient close or connect failures without
leaving a user-facing client in an indefinite "reconnecting" state. The policy
must show which failures are retryable, how the delay grows, and where the loop
stops.

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

Do not treat jitter as admission control. Jitter spreads reconnect attempts, but
it does not reduce the number of clients that will try. Large fleets still need
server-side limits, connection draining, backpressure, and user-visible fallback
states.

## Schedule shape

Start with exponential backoff, apply `Schedule.jittered`, cap the final delay
with `Schedule.modifyDelay`, and add a retry limit with `Schedule.recurs`.
`Schedule.jittered` adjusts each computed delay between 80% and 120% of the
wrapped schedule's delay. A 1 second reconnect delay therefore becomes 800
milliseconds to 1.2 seconds.

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

let attempt = 0

const connectWebSocket = Effect.gen(function*() {
  attempt += 1
  yield* Effect.sync(() => console.log(`websocket connect attempt ${attempt}`))

  if (attempt === 1) {
    return yield* Effect.fail(
      new WebSocketConnectError({ reason: "GatewayUnavailable" })
    )
  }
  if (attempt === 2) {
    return yield* Effect.fail(
      new WebSocketConnectError({ reason: "NetworkError" })
    )
  }

  yield* Effect.sync(() => console.log("websocket connected"))
})

const reconnectPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(100)))
  ),
  Schedule.both(Schedule.recurs(8))
)

const program = connectWebSocket.pipe(
  Effect.retry({
    schedule: reconnectPolicy,
    while: isRetryableReconnectError
  })
)

Effect.runPromise(program)
```

The sample uses short delays so it terminates quickly when pasted into
`scratchpad/repro.ts`. The same shape can use larger production intervals.

## Variants

For an interactive screen, keep the retry count and cap small enough that the UI
can move to a visible "reconnect failed" state quickly.

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
