---
book: Effect `Schedule` Cookbook
section_number: "8.3"
section_title: "Add jitter to fixed delays"
part_title: "Part II — Core Retry Recipes"
chapter_title: "8. Retry with Jitter"
status: "draft"
code_included: true
---

# 8.3 Add jitter to fixed delays

You want a fixed-delay retry policy, but you do not want every caller to retry on
exactly the same boundary. A plain fixed delay is easy to reason about, but when many
fibers or clients fail together, they can also retry together. This recipe keeps the
retry policy explicit: the schedule decides when another typed failure should be
attempted again and where retrying stops. The surrounding Effect code remains
responsible for domain safety, including which failures are transient, whether the
operation is idempotent, and how the final failure is reported.

## Problem

You want a fixed-delay retry policy, but you do not want every caller to retry
on exactly the same boundary. A plain fixed delay is easy to reason about, but
when many fibers or clients fail together, they can also retry together.

Start with the fixed delay you want, then add jitter to that schedule:

```ts
const retryPolicy = Schedule.spaced("1 second").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)
```

This means "wait about one second between retries, randomize each wait between
80% and 120% of one second, and stop after at most five retries."

## When to use it

Use this recipe when a fixed retry cadence is appropriate for one caller, but
the same policy may run across many callers at once. It fits worker fleets,
service clients, queue consumers, reconnect loops, and background jobs that can
all observe the same transient failure.

The fixed delay keeps the policy simple. Jitter reduces the chance that every
retry lands on the same instant after a shared outage, deployment, rate limit,
or network interruption.

This is also a useful step when a fixed delay is already good enough and you do
not need exponential backoff, but you still need basic load spreading.

## When not to use it

Do not use jitter as a retry limit. `Schedule.jittered` changes the delay chosen
by another schedule; it does not decide when retrying should stop.

Do not add jitter to make an unsafe operation safe to retry. Non-idempotent
writes still need idempotency keys, deduplication, transactions, or another
domain-specific guarantee.

Do not use fixed-delay jitter when failures should cause retries to slow down
substantially over time. In that case, use exponential backoff, capped backoff,
or another policy that changes the base delay shape before adding jitter.

## Schedule shape

`Schedule.spaced("1 second")` is an unbounded schedule. On its own, each retry
waits exactly one second before the next attempt.

`Schedule.jittered` wraps that schedule and randomly adjusts each recurrence
delay. In Effect, the adjusted delay is between 80% and 120% of the original
delay. For a one-second fixed delay, each retry delay is therefore somewhere
between 800 milliseconds and 1.2 seconds.

With `Effect.retry`, the first attempt still runs immediately. If that attempt
fails with a typed error, the error is fed to the schedule. The schedule chooses
the jittered delay, then the effect is attempted again after that delay.

The bounded shape is:

- attempt 1: run immediately
- if attempt 1 fails: wait between 800 milliseconds and 1.2 seconds
- attempt 2: run again
- if attempt 2 fails: wait between 800 milliseconds and 1.2 seconds
- continue until an attempt succeeds, the retry limit is exhausted, or the
  fiber is interrupted

`Schedule.both(Schedule.recurs(5))` adds the retry limit. The jittered fixed
schedule supplies the delay, and `Schedule.recurs(5)` supplies the maximum
number of retries after the original attempt.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ApiUnavailable extends Data.TaggedError("ApiUnavailable")<{
  readonly endpoint: string
}> {}

declare const callApi: Effect.Effect<string, ApiUnavailable>

const retryWithJitter = Schedule.spaced("1 second").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

const program = callApi.pipe(
  Effect.retry(retryWithJitter)
)
```

`program` runs `callApi` once immediately. If it fails with a typed
`ApiUnavailable`, it waits for a jittered delay around one second and tries
again.

Because `Schedule.jittered` adjusts the one-second delay between 80% and 120%,
each retry waits somewhere from 800 milliseconds to 1.2 seconds. If the
original attempt and all five retries fail, `Effect.retry` propagates the last
typed failure.

## Variants

Use a shorter fixed delay when the operation is cheap and the expected recovery
time is brief:

```ts
const fastJitteredRetry = Schedule.spaced("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)
```

Each retry waits between 160 milliseconds and 240 milliseconds.

Use a longer delay for background work that should place less pressure on a
dependency:

```ts
const backgroundJitteredRetry = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(12))
)
```

Each retry waits between 4 seconds and 6 seconds.

When only some typed failures should be retried, keep the same schedule and add
a retry predicate at the boundary:

```ts
const program = callApi.pipe(
  Effect.retry({
    schedule: retryWithJitter,
    while: (error) => error.endpoint.startsWith("https://api.example.com")
  })
)
```

The schedule controls timing and retry count. The predicate decides which typed
failures are eligible to use that policy.

## Notes and caveats

`Schedule.jittered` does not expose configurable jitter bounds. In Effect, it
adjusts delays between 80% and 120% of the original delay.

Add jitter after choosing the base schedule. In this recipe, the base schedule
is `Schedule.spaced("1 second")`, so jitter is a small random adjustment around
that fixed delay.

The first execution is not delayed. Jitter applies to recurrence delays after a
typed failure, before the next retry attempt.

`Schedule.recurs(5)` means five retries after the original attempt, not five
total attempts.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.
