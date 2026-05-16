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

Redis reconnects are a classic place for jitter. If a Redis node restarts, a
network path drops, or a deployment rolls through a cluster, many workers can
notice the same failure at roughly the same time. A plain exponential backoff
reduces pressure after each failure, but identical clients still tend to retry
on the same delay sequence.

Use `Schedule.jittered` after choosing the backoff shape so each client keeps
the same general policy while avoiding lockstep reconnect attempts.

## Problem

You have a background process that depends on Redis. When the connection is
lost, the process should retry the reconnect instead of failing the whole
worker immediately.

You want a reconnect policy that:

- starts quickly, because many Redis interruptions are brief
- backs off after repeated failures
- jitters each delay so many workers do not reconnect together
- caps the maximum delay so the worker does not wait minutes between attempts
- stops after a bounded number of retries

## When to use it

Use this recipe for Redis reconnect loops in workers, stream consumers,
subscription listeners, cache warmers, and queue processors where reconnecting
is safe and expected.

It is especially useful when many instances share the same Redis cluster. Jitter
spreads retry traffic across a small window around each computed delay, which
helps avoid a second burst of connection attempts immediately after an outage.

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

The cap is applied after jitter so the final sleep never exceeds the configured
maximum. The retry count is separate from the delay shape: `Schedule.recurs(8)`
means the original reconnect attempt may be followed by at most eight scheduled
retries.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class RedisReconnectError extends Data.TaggedError("RedisReconnectError")<{
  readonly reason: "timeout" | "connection-refused" | "server-loading"
}> {}

declare const reconnectRedis: Effect.Effect<void, RedisReconnectError>

const redisReconnectPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(8))
)

export const program = reconnectRedis.pipe(
  Effect.retry(redisReconnectPolicy)
)
```

## Variants

For a startup path, keep the first delay small but use a short retry limit so the
service can fail readiness quickly when Redis is not reachable.

For a long-running background worker, use a larger retry limit or combine the
policy with `Schedule.during` to express an elapsed reconnect budget. That gives
operators a concrete answer to how long the worker will keep trying before it
surfaces the failure.

For a large fleet, keep jitter enabled even when the cap is low. The cap limits
maximum wait time; jitter reduces synchronization. They solve different
operational problems and are usually used together.

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
