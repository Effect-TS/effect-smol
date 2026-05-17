---
book: "Effect `Schedule` Cookbook"
section_number: "16.3"
section_title: "Exponential backoff"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "16. Choose a Delay Strategy"
status: "draft"
code_included: true
---

# 16.3 Exponential backoff

Exponential backoff grows the delay after each failed attempt. In Effect, use
`Schedule.exponential` for that growing delay and compose it with an explicit
limit so the retry policy has a clear end.

## Problem

An HTTP API returns a temporary 503, a database is failing over, or a queue
broker is recovering after a restart. Retrying immediately can make the outage
worse. Retrying at a fixed interval can still keep too much steady pressure on
the dependency.

Use exponential backoff when the first retry should happen soon, later retries
should slow down aggressively, and the whole policy should stop after a known
number of retries.

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

Combine `Schedule.exponential(base)` with `Schedule.recurs(n)` to keep the
growing delay but bound the number of retries.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class DownstreamError extends Data.TaggedError("DownstreamError")<{
  readonly reason: "Timeout" | "Unavailable" | "Overloaded"
}> {}

let attempts = 0

const fetchCustomerProfile = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`profile API attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new DownstreamError({ reason: "Unavailable" }))
  }

  return { customerId: "customer-123", plan: "pro" as const }
})

const retryTransientRemoteFailure = Schedule.exponential("20 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = fetchCustomerProfile.pipe(
  Effect.retry(retryTransientRemoteFailure)
)

Effect.runPromise(program).then((profile) => {
  console.log(`${profile.customerId} plan: ${profile.plan}`)
})
```

The example uses 20 milliseconds as the base so it finishes quickly. With a
100 millisecond base, the first five retry delays would be 100ms, 200ms, 400ms,
800ms, and 1600ms. If all retries fail, `Effect.retry` returns the last
`DownstreamError`.

## Variants

Use a gentler factor, such as `Schedule.exponential("200 millis", 1.5)`, when
doubling backs off too quickly for the workflow. For repeated successful work,
`Schedule.take` can limit how many schedule outputs are used.

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
