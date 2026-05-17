---
book: "Effect `Schedule` Cookbook"
section_number: "6.4"
section_title: "Retry within a fixed operational budget"
part_title: "Part II — Retry Recipes"
chapter_title: "6. Retry Budgets and Deadlines"
status: "draft"
code_included: true
---

# 6.4 Retry within a fixed operational budget

Use this when retries must fit inside a known operational window while still
using a normal delay policy.

## Problem

Retry with exponential backoff, but schedule more attempts only while a 30
second elapsed retry budget remains open.

## When to use it

Use this for background jobs, webhook delivery, connection setup, cache
refresh, and service calls that should get a short recovery window without
continuing indefinitely.

This shape is useful when the caller cares more about total retry time than the
exact number of retries. Fast failures may get more attempts than slow
failures, but both are bounded by the same schedule window.

## When not to use it

Do not use this as a hard deadline for an individual attempt. A schedule is
consulted after an attempt fails with a typed error; it does not interrupt
in-flight work.

Do not use a time budget to hide permanent failures. Invalid credentials, bad
input, forbidden tenants, and misconfiguration should usually stop through a
retry predicate.

## Schedule shape

`Schedule.exponential("200 millis")` supplies the retry delay. With the default
factor of `2`, it grows as 200 milliseconds, 400 milliseconds, 800
milliseconds, 1.6 seconds, and so on.

`Schedule.during("30 seconds")` supplies the elapsed recurrence window and no
practical delay.

`Schedule.both` requires both sides to continue and uses the maximum delay, so
the backoff is preserved while the `during` side determines when retry
scheduling must stop.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class TemporaryGatewayError extends Data.TaggedError("TemporaryGatewayError")<{
  readonly status: 429 | 500 | 502 | 503 | 504
}> {}

let attempts = 0

const callGateway: Effect.Effect<string, TemporaryGatewayError> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`gateway call ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail(new TemporaryGatewayError({ status: 503 }))
  }

  return "accepted"
})

const retryWithinBudget = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.during("30 seconds"))
)

const program = Effect.gen(function*() {
  const result = yield* callGateway.pipe(
    Effect.retry({
      schedule: retryWithinBudget,
      while: (error) => error.status === 429 || error.status >= 500
    })
  )

  yield* Console.log(`gateway result: ${result}`)
})

Effect.runPromise(program)
```

If retryable failures continue until the 30 second window closes,
`Effect.retry` returns the last `TemporaryGatewayError`.

## Variants and caveats

Use `Schedule.spaced("1 second").pipe(Schedule.both(Schedule.during("20 seconds")))`
when the dependency should see a steady retry cadence inside the budget.

Use `Schedule.exponential("50 millis").pipe(Schedule.both(Schedule.during("2 seconds")))`
for interactive paths that should retry only briefly.

Add a count guard with `Schedule.recurs` only when the retry count is itself an
operational requirement. The number of retries inside a time budget depends on
both the delay policy and the time spent in failed attempts.
