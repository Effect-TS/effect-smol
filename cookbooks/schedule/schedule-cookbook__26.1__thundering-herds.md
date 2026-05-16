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

A thundering herd happens when many clients, workers, browser tabs, service
instances, or fibers all decide to do the same follow-up work at the same time.
The first attempt may be harmless. The problem appears after a shared event:
deployment, outage recovery, cache expiry, process restart, rate-limit response,
or a dependency returning the same transient error to every caller. If every
caller retries after exactly one second, then exactly two seconds, then exactly
four seconds, the retry policy preserves the synchronization that caused the
load spike.

`Schedule` makes that timing policy explicit. Choose the base cadence first, then
add jitter when many independent actors may otherwise move together.

## Problem

You need retries or polling that still waits long enough to protect a downstream
dependency, but you do not want every actor to wake up on the same boundary.
Fixed spacing and deterministic backoff are easy to reason about for one caller,
but across a fleet they can concentrate load into sharp waves.

## When to use it

Use jitter when the same schedule can run in many places at once: reconnecting
clients, workers polling a shared queue, dashboard refreshes, health checks,
cache refills, or retries after a shared dependency outage.

Use it after deciding the operational shape of the policy. For example, keep
`Schedule.exponential("100 millis")` as the base retry shape, keep
`Schedule.spaced("5 seconds")` as the base polling shape, and then apply
`Schedule.jittered` so each recurrence delay is slightly different.

## When not to use it

Do not add jitter to hide an unsafe retry. Non-idempotent writes, authorization
failures, validation failures, and malformed requests should be classified
before a retry schedule is used.

Also avoid jitter when a precise cadence is the requirement. Some maintenance
jobs, batch windows, tests, and user-facing countdowns need predictable timing
more than load smoothing.

## Schedule shape

`Schedule.jittered` modifies the delay already produced by the schedule. In
Effect, each delay is randomly adjusted between `80%` and `120%` of the original
delay. A base delay of `1 second` can therefore become any delay from
`800 millis` to `1.2 seconds`.

That means jitter does not decide how many times to retry, when to stop, or which
inputs are retryable. Compose those decisions separately:

- `Schedule.exponential` or `Schedule.spaced` describes the base cadence.
- `Schedule.recurs` or `Schedule.during` bounds the recurrence.
- `Schedule.jittered` spreads individual wake-ups around the base cadence.

## Code

```ts
import { Effect, Schedule } from "effect"

type ApiError =
  | { readonly _tag: "RateLimited" }
  | { readonly _tag: "ServiceUnavailable" }

declare const fetchSharedResource: Effect.Effect<string, ApiError>

const retryWithoutHerding = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

export const program = Effect.retry(fetchSharedResource, retryWithoutHerding)
```

The first call to `fetchSharedResource` still happens normally. If it fails,
`Effect.retry` feeds the failure into the schedule and follows the schedule's
next delay. The exponential schedule gives later attempts more room, while
`Schedule.jittered` prevents every caller from retrying on the exact same
milliseconds.

## Variants

For a polling loop, use a spaced cadence and add jitter to the repeat schedule:

```ts
const pollCadence = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.during("1 minute"))
)
```

For outage recovery, combine exponential backoff, jitter, and a time budget so
the dependency gets breathing room and the caller still has a clear stopping
point.

## Notes and caveats

Jitter reduces synchronization; it does not reduce the total number of attempts
by itself. Keep attempt limits, elapsed-time budgets, rate limits, and error
classification visible in the schedule or near the effect being retried.

Because `Schedule.jittered` changes timing randomly, logs and metrics should be
read as ranges around the base policy rather than exact timestamps. If you need
deterministic timing in tests, test the base schedule separately or assert the
allowed timing window.
