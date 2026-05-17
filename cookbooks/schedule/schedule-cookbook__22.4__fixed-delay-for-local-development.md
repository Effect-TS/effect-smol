---
book: Effect `Schedule` Cookbook
section_number: "22.4"
section_title: "Fixed delay for local development"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "22. Constant Delay Recipes"
status: "draft"
code_included: true
---

# 22.4 Fixed delay for local development

Local development often benefits from a retry policy that is boring and visible.
A simple fixed delay leaves a readable pause between failures while a local
dependency finishes starting.

This recipe uses a local-only constant delay. It is intentionally easy to watch
in logs and easy to change while developing. Do not copy the same defaults into
production unchanged.

## Problem

A local database, queue, emulator, or dependent service may still be booting
when the Effect program starts. You want retries slow enough for console logs to
remain useful, but short enough that a restart does not become tedious.

Use `Schedule.spaced(duration)` with `Effect.retry`: wait after each failed
attempt, and combine the delay with a small retry limit.

## When to use it

Use this recipe for local development loops where human visibility matters more
than finely tuned traffic shaping. It fits local service startup, Docker Compose
dependencies, test emulators, development queues, and optional local dashboards.

The fixed delay makes failures easy to correlate with logs from other processes.
If a service becomes ready after a few seconds, the next retry succeeds without
requiring a manual restart.

## When not to use it

Do not treat this as a production retry policy. A delay that feels good on one
laptop may be too aggressive for a shared dependency, too slow for a user-facing
request, or too predictable across many running instances.

Do not use it for failures that are not expected to recover by waiting, such as
invalid configuration, bad credentials, malformed requests, or non-idempotent
writes that cannot safely be attempted again.

Do not leave the policy unbounded unless the fiber is supervised by a larger
lifetime. Local development loops should still have a limit so mistakes fail
clearly.

## Schedule shape

`Schedule.spaced("1 second")` is an unbounded schedule that waits 1 second
between retry decisions. With `Effect.retry`, the first attempt runs
immediately. Only typed failures are fed into the schedule.

`Schedule.recurs(10)` adds the local guardrail. It allows up to 10 retries after
the original attempt, for up to 11 executions total.

`Schedule.both` combines the fixed delay with the retry limit. Both schedules
must continue, and the combined schedule uses the maximum delay from the two
policies.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class LocalDependencyUnavailable extends Data.TaggedError(
  "LocalDependencyUnavailable"
)<{
  readonly service: string
}> {}

let attempts = 0

const connectToLocalQueue = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`connect attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(
      new LocalDependencyUnavailable({ service: "queue" })
    )
  }

  return { connectionId: "local-queue-1" }
})

const localRetryPolicy = Schedule.spaced("50 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = connectToLocalQueue.pipe(
  Effect.tapError((error) =>
    Console.log(`Waiting for local ${error.service} to become available`)
  ),
  Effect.retry(localRetryPolicy)
)

Effect.runPromise(program).then((connection) => {
  console.log(`connected: ${connection.connectionId}`)
})
```

`program` tries to connect once immediately. If the local queue is not ready, it
logs the typed failure, waits, and tries again. A continuously failing
connection propagates the last `LocalDependencyUnavailable` after the retry
limit is exhausted.

## Variants

For a dependency that usually starts quickly, shorten the loop. For a noisy
service that takes longer to boot, keep the delay visible but use a larger
interval to reduce log pressure.

If the goal is a fixed wall-clock cadence rather than a pause after each failed
attempt, compare this with `Schedule.fixed(duration)`. For retrying local
connections, `Schedule.spaced(duration)` is usually easier to reason about
because the wait happens after the previous attempt has failed.

## Notes and caveats

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.

The first attempt is not delayed. The delay happens between a typed failure and
the next retry attempt.

Keep the local policy close to local configuration. Production policies usually
need different limits, observability, backoff, jitter, rate-limit awareness, or a
total time budget.
