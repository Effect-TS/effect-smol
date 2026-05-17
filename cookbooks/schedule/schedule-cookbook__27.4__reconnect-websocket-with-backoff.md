---
book: "Effect `Schedule` Cookbook"
section_number: "27.4"
section_title: "Reconnect WebSocket with backoff"
part_title: "Part VII — Real-World Recipes"
chapter_title: "27. Frontend and Client Recipes"
status: "draft"
code_included: true
---

# 27.4 Reconnect WebSocket with backoff

WebSocket reconnect policies need to balance quick recovery with restraint
during real outages.

## Problem

You have a browser or client application that opens a WebSocket connection. If
the connection cannot be opened because of a transient network failure, the
client should retry. Reconnecting immediately in a loop can create noisy UI and
extra load on the server, especially when many clients lose connectivity at the
same time.

You want a reconnect policy that:

- starts with a small delay
- grows after repeated failed opens
- caps the final wait so the UI remains understandable
- stops after a bounded number of retries

## When to use it

Use this recipe for user-facing WebSocket reconnects where a temporary loss of
connectivity is expected: chat presence, live dashboards, collaborative editing,
notifications, subscriptions, and browser tabs that may move between networks.

It is a good fit when the application can show intermediate states such as
"connecting", "reconnecting", and "offline" while the reconnect policy runs.

## When not to use it

Do not retry permanent setup failures. Invalid URLs, unsupported protocols,
authentication failures, authorization failures, and application-level rejection
messages should be classified before the schedule is applied.

Do not use the reconnect schedule as the only user experience. A person staring
at a disconnected screen needs visible state, a clear failure after the retry
budget is exhausted, and often a manual "try again" action.

Do not use the schedule to supervise an already-open socket by itself.
`Effect.retry` retries failed effect evaluations. If a socket opens
successfully and later closes, model that close as a failure in the effect that
owns the connection lifecycle, then apply the reconnect policy around that
effect.

## Schedule shape

Start with `Schedule.exponential`. It recurs forever by itself and doubles the
delay by default: 250 ms, 500 ms, 1 second, 2 seconds, and so on.

For a user-facing reconnect, cap the final delay with `Schedule.modifyDelay`
and add a retry limit with `Schedule.recurs`. `Schedule.both` combines the
backoff and retry limit with intersection semantics, so reconnecting stops as
soon as the limit stops.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class WebSocketOpenError extends Data.TaggedError("WebSocketOpenError")<{
  readonly reason: "network" | "timeout" | "server-restarting" | "unauthorized"
}> {}

interface LiveSocket {
  readonly id: string
}

let attempts = 0

const openLiveSocket: Effect.Effect<LiveSocket, WebSocketOpenError> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`open WebSocket attempt ${attempts}`)

  if (attempts <= 2) {
    return yield* Effect.fail(new WebSocketOpenError({ reason: "network" }))
  }

  return { id: "live-socket-1" }
})

const isRetryableOpenError = (error: WebSocketOpenError): boolean =>
  error.reason === "network" ||
  error.reason === "timeout" ||
  error.reason === "server-restarting"

const websocketReconnectPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(50)))
  ),
  Schedule.both(Schedule.recurs(8))
)

const connectLiveSocket = openLiveSocket.pipe(
  Effect.retry({
    schedule: websocketReconnectPolicy,
    while: isRetryableOpenError
  }),
  Effect.tap((socket) => Console.log(`connected ${socket.id}`))
)

Effect.runPromise(connectLiveSocket).then(console.log, console.error)
```

`openLiveSocket` is evaluated once immediately. If opening the socket fails with
a `WebSocketOpenError`, `Effect.retry` feeds that failure into the schedule. The
schedule then decides whether another attempt is allowed and how long to wait
before trying again.

## Variants

For a highly interactive screen, use fewer retries or a shorter cap. It is
usually better to show "offline" quickly and let the user retry manually than to
hide a long reconnect sequence behind a spinner.

For a passive background tab or non-critical live feed, use a larger cap and a
larger retry budget. Keep the retry state observable so the UI can stop showing
stale data as if it were live.

For large deployments, add jitter to this backoff. The cap protects the person
waiting in the UI; jitter protects the server from many clients retrying
together. Section 44.5 focuses on that version.

For a socket that opens successfully and then closes later, wrap the whole
connection lifecycle in the effect being retried. The schedule should surround
the effect that can fail when the connection drops, not only the initial
constructor call.

## Notes and caveats

The schedule controls delays between attempts. It does not time out a single
WebSocket opening attempt. If the open handshake can hang, add an effect-level
timeout to `openLiveSocket` before applying `Effect.retry`.

The retry budget counts scheduled retries, not total connection attempts.
`Schedule.recurs(8)` means one immediate open attempt plus up to eight later
attempts.

Be careful with authentication and authorization failures. Retrying a token that
is expired, missing, or forbidden usually makes the UI slower and the logs
noisier. Refresh credentials or ask the user to sign in before reconnecting.

When the retry policy is exhausted, surface that state to the user. A bounded
WebSocket reconnect policy is only helpful if the application clearly moves from
"reconnecting" to "offline" or "connection lost" when the final attempt fails.
