---
book: Effect `Schedule` Cookbook
section_number: "27.2"
section_title: "Jittered retries for Redis reconnects"
part_title: "Part VI — Jitter Recipes"
chapter_title: "27. Jitter for Retry"
status: "draft"
code_included: true
---

# 27.2 Jittered retries for Redis reconnects

Use jittered retries for Redis reconnect loops that may run across many workers
at once. Pick the reconnect backoff first, then jitter the delay so workers do
not all reconnect on the same boundary.

## Problem

A worker loses its Redis connection during a restart, failover, or short network
drop. It should reconnect quickly at first, back off after repeated failures,
and stop after a bounded number of attempts so the supervisor can report a real
outage.

## When to use it

Use it for workers, stream consumers, subscription listeners, cache warmers, and
queue processors where reconnecting is expected. It is most useful when many
instances share the same Redis cluster.

## When not to use it

Do not retry configuration errors. A bad Redis URL, missing credentials, TLS
misconfiguration, or an unsupported protocol setting should fail fast and be
reported as an operational problem.

Do not use reconnect backoff as a substitute for connection limits,
health-checking, or graceful shutdown. The schedule controls timing only; it
does not decide whether the process should keep accepting work while Redis is
unavailable.

## Schedule shape

`Schedule.exponential("100 millis")` gives the reconnect loop a short first
delay and doubles the delay after each failed reconnect. `Schedule.jittered`
then randomizes each computed delay between `80%` and `120%` of that delay.

Apply a cap after jitter if the final sleep must never exceed a configured
maximum. Keep the retry count separate from the delay shape:
`Schedule.recurs(8)` means at most eight retries after the original reconnect
attempt.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class RedisReconnectError extends Data.TaggedError("RedisReconnectError")<{
  readonly reason: "timeout" | "connection-refused" | "server-loading"
}> {}

let attempt = 0

const reconnectRedis = Effect.gen(function*() {
  attempt += 1
  yield* Effect.sync(() => console.log(`redis reconnect attempt ${attempt}`))

  if (attempt < 4) {
    return yield* Effect.fail(
      new RedisReconnectError({ reason: "server-loading" })
    )
  }

  yield* Effect.sync(() => console.log("redis reconnected"))
})

const redisReconnectPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(120)))
  ),
  Schedule.both(Schedule.recurs(8))
)

const program = reconnectRedis.pipe(
  Effect.retry(redisReconnectPolicy)
)

Effect.runPromise(program)
```

## Variants

For a startup path, keep the first delay small but use a short retry limit so the
service can fail readiness quickly when Redis is not reachable.

For a long-running background worker, use a larger retry limit or combine the
policy with `Schedule.during` to express an elapsed reconnect budget. That gives
operators a concrete answer to how long the worker will keep trying before it
surfaces the failure.

For a large fleet, keep jitter enabled even when the cap is low. The cap limits
maximum wait time; jitter reduces synchronization.

## Notes and caveats

`Effect.retry` feeds the `RedisReconnectError` into the schedule after a failed
reconnect attempt. The schedule decides whether to try again and how long to
sleep before that next attempt.

`Schedule.exponential` recurs forever by itself. Always pair it with a limit
such as `Schedule.recurs`, `Schedule.take`, `Schedule.during`, or a predicate
that stops on non-retryable Redis errors.

Apply `Schedule.jittered` to the chosen cadence rather than hiding randomness in
the reconnect effect. Keeping jitter in the schedule makes the retry contract
reviewable: exponential backoff for pressure, a cap for maximum sleep, and
jitter for fleet-wide spreading.
