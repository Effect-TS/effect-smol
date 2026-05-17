---
book: Effect `Schedule` Cookbook
section_number: "8.5"
section_title: "Jitter for reconnect storms"
part_title: "Part II — Core Retry Recipes"
chapter_title: "8. Retry with Jitter"
status: "draft"
code_included: true
---

# 8.5 Jitter for reconnect storms

Use jittered capped backoff when many clients may reconnect after the same
connection loss.

## Problem

When clients, fibers, workers, or service instances lose a connection together,
retrying on the same schedule can create a second burst just as the dependency
is recovering.

Use exponential backoff to reduce pressure from each caller, cap the base delay
so reconnects do not drift too far apart, then add jitter so callers spread
around each base delay.

## When to use it

Use this for reconnect loops triggered by shared events: load balancer restarts,
deploys, regional network interruptions, broker failovers, server restarts, or
a WebSocket gateway becoming temporarily unavailable.

The connection attempt should be safe to repeat. Permanent failures, such as
invalid credentials or unsupported protocol versions, should bypass the retry
policy through an error predicate.

## When not to use it

Do not use jitter as the only protection against a reconnect storm. Large
systems still need server-side connection limits, admission control,
load-shedding, and backpressure where appropriate.

Do not treat the cap as strict after jitter is applied. If the capped base delay
is 100 milliseconds, `Schedule.jittered` can produce 80 to 120 milliseconds.

## Schedule shape

`Schedule.exponential("20 millis")` starts at 20 milliseconds and doubles.
`Schedule.either(Schedule.spaced("100 millis"))` caps the base delay at 100
milliseconds. `Schedule.jittered` then randomizes the selected delay between
80% and 120%. `Schedule.recurs(6)` stops after six retries.

Place jitter after the cap when the capped delay itself should be spread.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class ReconnectError extends Data.TaggedError("ReconnectError")<{
  readonly reason: "network" | "rejected"
}> {}

interface Connection {
  readonly id: string
}

let attempts = 0

const openConnection: Effect.Effect<Connection, ReconnectError> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`connect attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new ReconnectError({ reason: "network" }))
  }

  return { id: "conn-1" }
})

const reconnectPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.either(Schedule.spaced("100 millis")),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(6))
)

const program = openConnection.pipe(
  Effect.retry({
    schedule: reconnectPolicy,
    while: (error) => error.reason === "network"
  }),
  Effect.tap((connection) => Console.log(`connected: ${connection.id}`))
)

Effect.runPromise(program).then(() => undefined, console.error)
```

The first connection attempt is immediate. Transient network failures retry
with jittered capped backoff. A `"rejected"` failure is not retryable and is
propagated immediately.

## Variants

Use a smaller retry budget for interactive clients that should report failure
quickly. Use a larger capped base delay for background workers or supervisors
that can wait longer between reconnect attempts.

When the server gives a typed signal that reconnecting is not useful, keep the
same timing policy and stop in the `while` predicate.

## Notes and caveats

`Schedule.jittered` has fixed bounds in Effect: 80% to 120% of the original
delay.

The first connection attempt is not delayed. Jitter applies only to recurrence
delays after typed failures.

`Schedule.recurs(6)` means six retries after the original attempt, not six
total connection attempts.
