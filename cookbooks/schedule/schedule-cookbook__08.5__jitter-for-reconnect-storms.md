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

You have many clients, fibers, workers, or service instances that can lose a connection
at the same time. If every caller reconnects on the same schedule, the reconnect logic
can create a second burst of traffic just as the dependency is trying to recover. This
recipe keeps the retry policy explicit: the schedule decides when another typed failure
should be attempted again and where retrying stops. The surrounding Effect code remains
responsible for domain safety, including which failures are transient, whether the
operation is idempotent, and how the final failure is reported.

## Problem

You have many clients, fibers, workers, or service instances that can lose a
connection at the same time. If every caller reconnects on the same schedule,
the reconnect logic can create a second burst of traffic just as the dependency
is trying to recover.

Use a backoff schedule with jitter so reconnect attempts spread out around the
same base policy:

```ts
const reconnectPolicy = Schedule.exponential("500 millis").pipe(
  Schedule.either(Schedule.spaced("30 seconds")),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(20))
)
```

This means "start reconnect retries at 500 milliseconds, grow the delay with
exponential backoff, use 30 seconds as the capped base delay, randomly adjust
each delay between 80% and 120%, and stop after at most 20 retries."

## When to use it

Use this recipe for reconnect loops that can be triggered by a shared event:
load balancer restarts, deploys, regional network interruptions, broker
failovers, server restarts, or a WebSocket gateway briefly becoming
unavailable.

The backoff reduces pressure from each caller after repeated failures. The
jitter reduces synchronization between callers that failed together. The retry
limit keeps one reconnect operation from waiting forever when the connection is
not going to recover within the caller's budget.

This is a good shape for idempotent connection attempts where "try again later"
is correct, but "all clients try again at exactly the same instant" is not.

## When not to use it

Do not use jitter as the only protection against a reconnect storm. Large
systems still need server-side connection limits, admission control,
load-shedding, and backpressure where appropriate.

Do not retry connection failures that need operator or user action, such as
invalid credentials, forbidden tenants, unsupported protocol versions, or
configuration errors. Add an error predicate so only transient typed failures
use the reconnect policy.

Do not treat the 30 second value in this recipe as a strict maximum after
jitter is applied. It is the capped base delay. Because `Schedule.jittered`
adjusts delays between 80% and 120%, a 30 second base delay can become a delay
between 24 and 36 seconds.

## Schedule shape

`Schedule.exponential("500 millis")` starts with a 500 millisecond delay and
then grows by the default factor of `2`: 500 milliseconds, 1 second, 2 seconds,
4 seconds, and so on.

`Schedule.either(Schedule.spaced("30 seconds"))` caps the base backoff by
choosing the smaller delay between the exponential schedule and the fixed 30
second schedule. Before jitter, the base delay eventually reaches 30 seconds
and stays there.

`Schedule.jittered` then randomly adjusts each recurrence delay. In Effect,
that adjusted delay is between 80% and 120% of the original delay:

| Retry delay decision | Base delay       | Jittered delay range         |
| -------------------- | ---------------- | ---------------------------- |
| 1                    | 500 milliseconds | 400-600 milliseconds         |
| 2                    | 1 second         | 800 milliseconds-1.2 seconds |
| 3                    | 2 seconds        | 1.6-2.4 seconds              |
| 4                    | 4 seconds        | 3.2-4.8 seconds              |
| capped               | 30 seconds       | 24-36 seconds                |

`Schedule.both(Schedule.recurs(20))` adds the retry limit. The jittered capped
backoff supplies the delay, and `Schedule.recurs(20)` supplies the maximum
number of retries after the original connection attempt.

With `Effect.retry`, the first connection attempt runs immediately. If it
fails with a typed error, the error is fed to the schedule. If the schedule
continues, Effect waits for the jittered delay and then attempts the connection
again. If all allowed retries fail, `Effect.retry` propagates the last typed
failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ReconnectError extends Data.TaggedError("ReconnectError")<{
  readonly reason: "network" | "rejected"
}> {}

interface Connection {
  readonly id: string
}

declare const openConnection: Effect.Effect<Connection, ReconnectError>

const reconnectPolicy = Schedule.exponential("500 millis").pipe(
  Schedule.either(Schedule.spaced("30 seconds")),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(20))
)

const program = openConnection.pipe(
  Effect.retry({
    schedule: reconnectPolicy,
    while: (error) => error.reason === "network"
  })
)
```

`program` tries to open the connection once immediately. If that attempt fails
with a transient `ReconnectError` whose reason is `"network"`, it retries with
jittered capped backoff.

The first retry waits somewhere from 400 to 600 milliseconds. Later retries
grow from the exponential base delay, and once the capped base reaches 30
seconds, each retry waits somewhere from 24 to 36 seconds. If the failure is
`"rejected"`, the `while` predicate stops retrying and the error is propagated.

## Variants

Use a smaller retry budget for interactive clients that should report failure
quickly:

```ts
const interactiveReconnectPolicy = Schedule.exponential("250 millis").pipe(
  Schedule.either(Schedule.spaced("5 seconds")),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(8))
)
```

This gives the caller a short reconnect window while still spreading attempts
around each base delay.

Use a larger capped base delay for background workers or supervisors that can
wait longer between reconnect attempts:

```ts
const backgroundReconnectPolicy = Schedule.exponential("1 second").pipe(
  Schedule.either(Schedule.spaced("1 minute")),
  Schedule.jittered,
  Schedule.both(Schedule.recurs(60))
)
```

When the base delay reaches 1 minute, the jittered delay is between 48 and 72
seconds.

When the server gives you a typed signal that reconnecting is not useful, keep
the same timing policy and stop at the boundary:

```ts
const program = openConnection.pipe(
  Effect.retry({
    schedule: reconnectPolicy,
    while: (error) => error.reason === "network"
  })
)
```

The schedule controls timing and retry count. The predicate decides which
typed connection failures are eligible to retry.

## Notes and caveats

`Schedule.jittered` does not expose configurable jitter bounds. In Effect, it
adjusts each delay between 80% and 120% of the original delay.

Place `Schedule.jittered` after the capped backoff when you want to spread the
capped delay too. In this recipe, the 30 second capped base delay becomes a
24-36 second jittered delay, which helps avoid a synchronized reconnect wave at
the cap.

The first connection attempt is not delayed. Jitter applies only to recurrence
delays after typed failures.

`Schedule.recurs(20)` means 20 retries after the original attempt, not 20 total
connection attempts.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.
