---
book: Effect `Schedule` Cookbook
section_number: "44.5"
section_title: "Reconnect WebSocket with jitter"
part_title: "Part X — Real-World Recipes"
chapter_title: "44. Frontend and Client Recipes"
status: "draft"
code_included: true
---

# 44.5 Reconnect WebSocket with jitter

Jitter keeps WebSocket reconnect attempts from many clients from landing on the
same backoff boundaries.

## Problem

A browser, mobile app, or frontend service owns a WebSocket connection. When the
socket closes for a transient reason, the client should reconnect without making
the user refresh the page.

You want a reconnect policy that:

- starts quickly for short network interruptions
- backs off after repeated failed reconnect attempts
- jitters each delay so many clients do not reconnect together
- caps each wait so the UI does not disappear into a long exponential tail
- stops after a bounded number of retries so the caller can surface a clear
  disconnected state

## When to use it

Use this recipe for reconnecting browser WebSockets, mobile realtime sessions,
dashboard event streams, collaborative editing channels, notification sockets,
and client-side presence connections.

It is especially useful when many clients share the same gateway or realtime
backend. Jitter reduces the chance that a fleet of clients dropped by the same
event will all retry at the same 100 millisecond, 200 millisecond, 400
millisecond, and 800 millisecond boundaries.

Use it when reconnecting is safe and expected: the client can resubscribe,
refresh missed state, or resume from a known cursor after the socket is opened
again.

## When not to use it

Do not retry authentication or authorization failures as if they were transient
socket failures. Expired credentials should refresh through the authentication
path; forbidden users should see the appropriate domain state.

Do not use reconnect backoff as the only protection for the realtime service.
Gateways still need connection limits, admission control, heartbeats, and
server-side overload behavior. The schedule only controls when this client tries
again.

Do not keep retrying forever in an interactive path without changing the user
state. After the retry budget is exhausted, surface that realtime updates are
disconnected and provide an explicit recovery path.

## Schedule shape

Start with exponential backoff, add jitter, then clamp the final delay:

```ts
Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(8))
)
```

`Schedule.exponential("100 millis")` starts with a short reconnect delay and
doubles by default. `Schedule.jittered` randomly adjusts each computed delay
between `80%` and `120%` of that delay. `Schedule.modifyDelay` applies the cap
after jitter, so the final sleep never exceeds five seconds.

`Schedule.recurs(8)` is the retry budget. With `Effect.retry`, the first
reconnect attempt runs immediately. If it fails, the schedule may allow up to
eight more attempts, each separated by the capped jittered backoff.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class WebSocketReconnectError extends Data.TaggedError("WebSocketReconnectError")<{
  readonly reason: "closed" | "timeout" | "gateway-unavailable" | "unauthorized"
}> {}

declare const reconnectWebSocket: Effect.Effect<void, WebSocketReconnectError>

const isRetryableReconnect = (error: WebSocketReconnectError) =>
  error.reason === "closed" ||
  error.reason === "timeout" ||
  error.reason === "gateway-unavailable"

const webSocketReconnectPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(8)),
  Schedule.while(({ input }) => isRetryableReconnect(input))
)

export const program = reconnectWebSocket.pipe(
  Effect.retry(webSocketReconnectPolicy)
)
```

`program` calls `reconnectWebSocket` once immediately. If the attempt fails with
`closed`, `timeout`, or `gateway-unavailable`, the first retry waits around 100
milliseconds, adjusted by jitter. Later failures use the exponential sequence as
the base delay, then jitter and cap the final sleep.

If the failure is `unauthorized`, the `Schedule.while` predicate stops retrying
immediately. If all permitted retries fail, `Effect.retry` returns the last
`WebSocketReconnectError`, and the UI can move to an explicit disconnected
state.

## Variants

For a very latency-sensitive UI, lower the cap and retry count:

```ts
const quickUiReconnectPolicy = Schedule.exponential("50 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(2)))
  ),
  Schedule.both(Schedule.recurs(5))
)
```

This gives the client a few fast attempts before asking the user to retry or
showing a degraded realtime state.

For background clients, kiosks, or long-lived internal dashboards, use a larger
elapsed budget while keeping the per-delay cap:

```ts
const longLivedReconnectPolicy = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(10)))
  ),
  Schedule.both(Schedule.during("1 minute"))
)
```

This lets the client keep trying through a short outage without allowing any
single sleep to grow beyond ten seconds.

## Notes and caveats

`Schedule.jittered` changes only delays. In Effect, it adjusts each delay between
`80%` and `120%` of the original delay. It does not classify errors, cap delays,
or decide how many retries are allowed.

Apply the cap after jitter when the maximum sleep is part of the user-facing
contract. Without the final `Schedule.modifyDelay`, a jittered exponential delay
can still grow past the amount of time the UI is willing to wait silently.

`Effect.retry` feeds the typed reconnect failure into the schedule. That is why
`Schedule.while` can stop retries for `unauthorized` while allowing transient
close, timeout, and gateway failures to use the reconnect policy.

Across a large client population, jitter is a load-shaping tool, not just a
latency detail. The cap protects one client from waiting too long; jitter helps
the realtime backend avoid synchronized reconnect waves from many clients.
