---
book: "Effect `Schedule` Cookbook"
section_number: "5.6"
section_title: "Exponential backoff with a maximum delay"
part_title: "Part II — Retry Recipes"
chapter_title: "5. Exponential and Capped Backoff"
status: "draft"
code_included: true
---

# 5.6 Exponential backoff with a maximum delay

Use capped exponential backoff when early retries should spread out quickly, but
no single wait should exceed a known maximum.

## Problem

Plain `Schedule.exponential` keeps growing. That is useful at first, but later
delays can exceed the request budget, worker lease, or supervisor timeout.

Cap the delay by combining exponential backoff with `Schedule.spaced(maxDelay)`
using `Schedule.either`. `either` continues while either schedule continues and
uses the smaller delay. Add `Schedule.recurs(n)` with `Schedule.both` when the
policy also needs a retry limit.

## When to use it

Use this shape for transient failures in idempotent calls: external APIs,
databases, queues, caches, and service clients. The first retries happen soon,
then the delay settles at the cap instead of growing without bound.

The cap is a per-retry maximum. It is not a total timeout and does not interrupt
an attempt that is already running.

## When not to use it

Do not retry operations that are unsafe to run more than once unless the call is
made idempotent with a key, transaction, de-duplication, or another domain
guarantee.

Do not use capped backoff alone for high fan-out clients. If many callers can
fail together, combine the policy with jitter, admission control, or rate
limits.

## Schedule shape

With a base of 10 milliseconds and a cap of 40 milliseconds, the delay sequence
is 10 milliseconds, 20 milliseconds, 40 milliseconds, 40 milliseconds, and so
on. The exponential side wants to continue forever, and the spaced side also
wants to continue forever, so `Schedule.recurs(n)` supplies the stopping point.

`Schedule.both(Schedule.recurs(n))` keeps the capped delay because `recurs`
adds no meaningful wait. It only contributes the retry budget. `Schedule.recurs(4)`
means four retries after the original attempt, so the effect can run up to five
times total.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class ApiError extends Data.TaggedError("ApiError")<{
  readonly status: number
}> {}

let attempts = 0

const request = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`request attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new ApiError({ status: 503 }))
  }

  return "response body"
})

const cappedBackoff = Schedule.exponential("10 millis").pipe(
  Schedule.either(Schedule.spaced("40 millis")),
  Schedule.both(Schedule.recurs(4))
)

const program = request.pipe(
  Effect.retry(cappedBackoff),
  Effect.tap((body) => Console.log(`success: ${body}`))
)

Effect.runPromise(program).then(() => undefined, console.error)
```

The first call is immediate. If it fails with a typed `ApiError`, the next waits
10 milliseconds. Later failures wait 20 milliseconds, then 40 milliseconds, and
the cap prevents longer waits. If all four retries fail, `Effect.retry`
propagates the last `ApiError`.

## Variants

For interactive work, use a small base, a small cap, and a short retry budget,
for example a 50 millisecond base capped at 1 second with three to five
retries.

For background work, use a larger base and cap, such as 500 milliseconds capped
at 30 seconds, but still keep an explicit retry count unless retrying forever is
intentional.

When only some typed failures are retryable, keep the capped schedule and pass
`Effect.retry({ schedule, while })`. The `while` predicate decides which errors
may consume retry budget; the schedule still decides timing and count.

## Notes and caveats

There is no dedicated cap constructor in this recipe. The cap comes from
`Schedule.either(Schedule.spaced(maxDelay))`.

Do not replace `either` with `both` for the cap. `Schedule.both` uses the larger
delay, so pairing exponential backoff directly with fixed spacing would wait at
least the fixed duration from the first retry.

The composed schedule output is nested composition data. Plain `Effect.retry`
uses it for timing and stopping, then returns the successful value produced by
the retried effect.
