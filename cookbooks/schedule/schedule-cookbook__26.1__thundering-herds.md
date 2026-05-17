---
book: Effect `Schedule` Cookbook
section_number: "26.1"
section_title: "Thundering herds"
part_title: "Part VI — Jitter Recipes"
chapter_title: "26. Why Jitter Exists"
status: "draft"
code_included: true
---

# 26.1 Thundering herds

Use jitter when many clients, workers, service instances, or fibers might
otherwise retry or poll on the same cadence.

## Problem

A thundering herd is a burst created when many actors react to the same event at
the same time. Deploys, restarts, cache expiry, outage recovery, rate limits, and
shared transient errors can all synchronize clients. A fixed delay that is mild
for one caller can become a sharp load wave across a fleet.

## When to use it

Use it when the same schedule can run in many places at once: reconnecting
clients, workers polling a shared queue, dashboard refreshes, health checks,
cache refills, or retries after a dependency outage.

Decide the base shape first, then add jitter. For example, keep
`Schedule.exponential("100 millis")` as the retry shape or
`Schedule.spaced("5 seconds")` as the polling shape, then apply
`Schedule.jittered`.

## When not to use it

Do not use jitter to hide unsafe retries. Non-idempotent writes, authorization
failures, validation failures, and malformed requests should be classified
before retrying.

Avoid jitter when exact timing is the requirement, such as protocol heartbeats,
batch windows, deterministic tests, or user-facing countdowns.

## Schedule shape

`Schedule.jittered` modifies the delay produced by another schedule. In Effect,
each delay is randomly adjusted between 80% and 120% of the original delay. It
does not decide what is retryable, how often to stop, or how many attempts are
allowed. Compose those decisions separately:

- `Schedule.exponential` or `Schedule.spaced` describes the base cadence
- `Schedule.recurs` or `Schedule.during` bounds the recurrence
- `Schedule.jittered` spreads wake-ups around the base cadence

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type ApiError = {
  readonly _tag: "ServiceUnavailable"
  readonly client: string
  readonly attempt: number
}

const retryWithoutHerding = Schedule.exponential("20 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const runClient = (client: string) => {
  let attempts = 0

  const fetchSharedResource = Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`${client} attempt ${attempts}`)

    if (attempts < 3) {
      return yield* Effect.fail<ApiError>({
        _tag: "ServiceUnavailable",
        client,
        attempt: attempts
      })
    }

    return `${client} loaded the resource`
  })

  return fetchSharedResource.pipe(
    Effect.retry(retryWithoutHerding),
    Effect.flatMap(Console.log)
  )
}

const program = Effect.forEach(
  ["client-a", "client-b", "client-c"],
  runClient,
  { concurrency: 3, discard: true }
)

Effect.runPromise(program)
```

The first attempt for each client runs immediately. If a client fails, the
exponential schedule controls the retry shape and `Schedule.jittered` prevents
every client from sleeping for exactly the same delay.

## Variants

For polling, jitter a `Schedule.spaced` repeat policy. For outage recovery,
combine exponential backoff, jitter, and an elapsed budget. For a hard
maximum-delay guarantee, apply jitter before the final `Schedule.modifyDelay`
cap.

## Notes and caveats

Jitter reduces synchronization; it does not reduce the total number of attempts.
Keep attempt limits, elapsed-time budgets, rate limits, and error classification
visible near the effect being retried.

Because jitter changes timing randomly, logs and metrics should be read as
ranges around the base policy rather than exact timestamps.
