---
book: "Effect `Schedule` Cookbook"
section_number: "25.4"
section_title: "“Avoid overload at all costs”"
part_title: "Part VI — Composition and Termination"
chapter_title: "25. Express Operational Intent"
status: "draft"
code_included: true
---

# 25.4 “Avoid overload at all costs”

When the requirement is "avoid overload at all costs", the retry policy should
prefer giving up over adding pressure to a dependency that is already
struggling. That means conservative spacing, increasing waits, fleet-wide
desynchronization, and explicit limits.

Use the schedule to make that operational promise reviewable. A reader should
be able to see the first retry delay, the backoff curve, the maximum final
delay, the retry count, and the elapsed budget without hunting through a custom
loop.

## Problem

Define a retry schedule for callers seeing a slow, unavailable, or rate-limited
downstream service. The schedule must make overload control explicit:
conservative initial delay, growing waits, jitter, a maximum wait, and finite
count and time limits.

## When to use it

Use this for shared infrastructure paths where extra traffic is more dangerous
than a delayed or failed caller response: broker reconnects, cache refreshes,
webhook delivery, background synchronization, dependency readiness checks, and
batch workers.

It is especially useful when many processes may observe the same outage at the
same time. The policy should spread retries across the fleet and cap the amount
of work each caller contributes.

## When not to use it

Do not use this policy for validation failures, authorization failures,
permanent configuration errors, or unsafe non-idempotent writes. Classify those
before retrying and fail without entering the schedule.

Do not treat client-side backoff as admission control. It reduces retry
pressure, but it does not replace server-side rate limits, quotas, queues,
backpressure, load shedding, or circuit breaking.

## Schedule shape

Start with a slow exponential backoff, add jitter, cap the final delay, and add
both count and elapsed-time limits. `Schedule.exponential("2 seconds")` starts
with a two-second delay and then grows by the default factor of `2`. That is
intentionally slower than a latency-oriented retry policy.

`Schedule.jittered` adjusts each recurrence delay between 80% and 120% of the
incoming delay. If many workers fail at the same time, their later retries are
less likely to stay synchronized.

Use `Schedule.modifyDelay` to cap the final delay after jitter. Add
`Schedule.recurs` and `Schedule.during` with `Schedule.both` so the policy stops
when either the retry count or elapsed budget is exhausted.

## Code

```ts
import { Console, Duration, Effect, Schedule } from "effect"

type InventorySnapshot = {
  readonly sku: string
  readonly available: number
}

type DownstreamError =
  | { readonly _tag: "Timeout"; readonly service: string }
  | { readonly _tag: "Unavailable"; readonly service: string }
  | { readonly _tag: "RateLimited"; readonly service: string }
  | { readonly _tag: "Rejected"; readonly service: string }

const isRetryable = (error: DownstreamError): boolean =>
  error._tag === "Timeout" ||
  error._tag === "Unavailable" ||
  error._tag === "RateLimited"

let attempts = 0

const loadInventorySnapshot = Effect.gen(function*() {
  attempts++
  yield* Console.log(`inventory attempt ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail({
      _tag: "RateLimited",
      service: "inventory"
    } satisfies DownstreamError)
  }
  if (attempts < 4) {
    return yield* Effect.fail({
      _tag: "Unavailable",
      service: "inventory"
    } satisfies DownstreamError)
  }

  return {
    sku: "sku-123",
    available: 42
  } satisfies InventorySnapshot
})

const avoidOverloadRetryPolicy = Schedule.exponential("40 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(120)))
  ),
  Schedule.both(Schedule.recurs(8)),
  Schedule.both(Schedule.during("500 millis"))
)

const program = loadInventorySnapshot.pipe(
  Effect.retry({
    schedule: avoidOverloadRetryPolicy,
    while: isRetryable
  }),
  Effect.flatMap((snapshot) =>
    Console.log(`${snapshot.sku}: ${snapshot.available} available`)
  )
)

Effect.runPromise(program)
```

The demo uses short durations so it finishes quickly. In production, the same
shape would usually start at seconds, cap at tens of seconds or minutes, and
use an operational budget that matches the caller.

`program` performs the first call immediately. If it fails with a retryable
typed error, the retry schedule waits for a jittered exponential delay before
trying again. If the error is `"Rejected"`, the `while` predicate prevents the
retry policy from adding more traffic.

The policy allows at most eight retries after the original attempt, and only
while the elapsed budget is still open. If every allowed retry fails,
`Effect.retry` propagates the last typed failure.

## Variants

For interactive requests, make the policy stricter: start closer to one second,
cap at a few seconds, and use a small retry count or a short `Schedule.during`
budget. Avoid making a user wait through a background-worker retry profile.

For background recovery jobs, use a larger base delay and a smaller retry count
when the dependency is known to be fragile. A policy such as "start at 10
seconds, cap at 2 minutes, retry 5 times" is often clearer than trying to keep
a failing workflow alive indefinitely.

For APIs that return a trusted retry-after signal, keep this overload policy as
the default and handle the server-provided delay in a separate, named policy.
Do not mix "server told us when to return" with "client chose a conservative
backoff" unless the composition is still obvious in review.

## Notes and caveats

`Schedule.exponential`, `Schedule.spaced`, and `Schedule.jittered` do not stop
by themselves. Pair them with `Schedule.recurs`, `Schedule.take`,
`Schedule.during`, or an input-aware condition.

`Schedule.jittered` in Effect uses an 80%-120% range. If the final maximum
delay must be strict, cap after jitter with `Schedule.modifyDelay`.

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. This recipe is about retrying typed
transient failures; polling successful observations should use `Effect.repeat`
and a success-value stop condition instead.
