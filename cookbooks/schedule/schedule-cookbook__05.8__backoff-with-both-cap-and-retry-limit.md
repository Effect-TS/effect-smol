---
book: "Effect `Schedule` Cookbook"
section_number: "5.8"
section_title: "Backoff with both cap and retry limit"
part_title: "Part II — Retry Recipes"
chapter_title: "5. Exponential and Capped Backoff"
status: "draft"
code_included: true
---

# 5.8 Backoff with both cap and retry limit

Most production retry policies need two bounds: the largest delay between
attempts and the maximum number of retries.

## Problem

Exponential backoff alone controls pacing, not total retry effort. A cap keeps
one delay from growing too large. A retry limit stops the operation when the
dependency remains unavailable.

Compose the two bounds explicitly: `Schedule.either` caps the delay, and
`Schedule.both(Schedule.recurs(n))` adds the finite retry budget.

## When to use it

Use this for idempotent calls to HTTP APIs, queues, caches, databases, and
service clients where unlimited retrying would hold resources too long.

This policy is easy to review because the important operational choices are
visible: base delay, maximum delay, and maximum retry count.

## When not to use it

Do not use this for non-idempotent writes unless repeated execution is safe.

Do not treat the cap as a total timeout. A policy capped at one second and
limited to five retries can still spend several seconds retrying.

Do not rely on this alone when many clients may retry together. Add jitter or
another load-shaping mechanism for large caller populations.

## Schedule shape

`Schedule.exponential("10 millis")` grows by the default factor of `2`.
Combining it with `Schedule.spaced("40 millis")` through `Schedule.either`
gives a maximum delay of 40 milliseconds. Combining that capped schedule with
`Schedule.recurs(5)` through `Schedule.both` stops after at most five retries.

The original effect still runs immediately. The schedule is consulted only
after a typed failure.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class GatewayError extends Data.TaggedError("GatewayError")<{
  readonly status: number
}> {}

let attempts = 0

const submitRequest: Effect.Effect<string, GatewayError> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`gateway attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new GatewayError({ status: 503 }))
  }

  return "accepted"
})

const cappedBackoffWithLimit = Schedule.exponential("10 millis").pipe(
  Schedule.either(Schedule.spaced("40 millis")),
  Schedule.both(Schedule.recurs(5))
)

const program = submitRequest.pipe(
  Effect.retry({
    schedule: cappedBackoffWithLimit,
    while: (error) => error.status === 429 || error.status >= 500
  }),
  Effect.tap((value) => Console.log(`result: ${value}`))
)

Effect.runPromise(program).then(() => undefined, console.error)
```

The retryable failures wait 10 milliseconds, 20 milliseconds, then at most 40
milliseconds. If the original attempt and all five retries fail, the program
fails with the last `GatewayError`.

## Variants

For an interactive request, use a smaller cap and fewer retries. For background
work, use a larger cap and budget only when the owning worker or supervisor can
afford the total time.

When only some typed failures should be retried, keep the same schedule and
change the `while` predicate in `Effect.retry`.

## Notes and caveats

Use `Schedule.either(Schedule.spaced(maxDelay))` for the cap. Use
`Schedule.both(Schedule.recurs(n))` for the retry limit.

`Schedule.recurs(n)` counts retries after the original attempt, not total
attempts.

The schedule output is nested composition data from `either` and `both`. Plain
`Effect.retry` uses that output for retry decisions and returns the successful
value of the retried effect.
