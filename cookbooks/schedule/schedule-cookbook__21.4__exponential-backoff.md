---
book: Effect `Schedule` Cookbook
section_number: "21.4"
section_title: "Exponential backoff"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "21. Choosing a Delay Strategy"
status: "draft"
code_included: true
---

# 21.4 Exponential backoff

Exponential backoff grows the delay after each failed attempt. In Effect, use
`Schedule.exponential` for that growing delay and compose it with an explicit
limit so the retry policy has a clear end.

## Problem

An HTTP API returns a temporary 503, a database is failing over, or a queue
broker is recovering after a restart. Retrying immediately can make the outage
worse. Retrying at a fixed interval can still keep too much steady pressure on
the dependency.

You want the first retry to happen soon, later retries to slow down
aggressively, and the whole policy to stop after a known number of retries.

## When to use it

Use exponential backoff for idempotent remote calls where failures are likely
to be temporary and downstream recovery matters. It is a practical default for
timeouts, connection resets, brief unavailability, and overload responses that
should not be hammered by a tight loop.

The backoff should be visible in the schedule value. A reviewer should be able
to see the starting delay, the growth behavior, and the retry limit without
searching for sleeps or counters elsewhere in the code.

## When not to use it

Do not use exponential backoff to retry permanent errors. Validation failures,
authorization failures, malformed requests, and unsafe non-idempotent writes
should be handled before this policy is applied.

Do not use `Schedule.exponential` by itself as a production retry policy unless
unbounded retrying is intentional. The schedule keeps recurring, so add
`Schedule.recurs`, `Schedule.take`, or another stopping condition.

## Schedule shape

`Schedule.exponential(base)` waits using `base * factor^n`, with a default
factor of `2`. For example, `Schedule.exponential("100 millis")` produces
delays of 100 milliseconds, 200 milliseconds, 400 milliseconds, 800
milliseconds, and so on.

With `Effect.retry`, the first call runs immediately. If it fails with a typed
error, the schedule decides whether to retry and how long to wait before the
next call.

For retries, a common shape is:

```ts
const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

This keeps the growing delay from the exponential schedule and stops after at
most five retries after the original attempt.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class DownstreamError extends Data.TaggedError("DownstreamError")<{
  readonly reason: "Timeout" | "Unavailable" | "Overloaded"
}> {}

declare const fetchCustomerProfile: (
  customerId: string
) => Effect.Effect<
  { readonly customerId: string; readonly plan: "free" | "pro" },
  DownstreamError
>

const retryTransientRemoteFailure = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

export const program = fetchCustomerProfile("customer-123").pipe(
  Effect.retry(retryTransientRemoteFailure)
)
```

`program` calls the remote service once immediately. If the call fails with
`DownstreamError`, it retries after 100 milliseconds, then 200 milliseconds,
400 milliseconds, 800 milliseconds, and 1600 milliseconds. If all retries
fail, `Effect.retry` fails with the last `DownstreamError`.

## Variants

Use a gentler factor when doubling backs off too quickly for the workflow:

```ts
const gentlerBackoff = Schedule.exponential("200 millis", 1.5).pipe(
  Schedule.both(Schedule.recurs(5))
)
```

For repeated successful work, `Schedule.take` can limit how many schedule
outputs are used:

```ts
const limitedBackoff = Schedule.exponential("250 millis").pipe(
  Schedule.take(4)
)
```

This is useful when the schedule is being reused for a bounded repeat or when
you want the limit to read as "take this many backoff decisions" rather than
"retry this many failures."

## Notes and caveats

`Schedule.recurs(5)` means five retries after the original attempt, so the
effect can run up to six times total.

Basic exponential backoff has no maximum delay cap and no jitter. For
user-facing flows, long-running workers, large fleets, or rate-limited APIs,
add the appropriate cap, time budget, or jittered policy in the surrounding
recipe.

The schedule controls recurrence mechanics. It does not decide whether a
domain operation is safe to retry; classify errors and ensure idempotency near
the effect being retried.
