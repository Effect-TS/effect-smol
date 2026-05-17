---
book: "Effect `Schedule` Cookbook"
section_number: "6.1"
section_title: "Retry for at most 10 seconds"
part_title: "Part II — Retry Recipes"
chapter_title: "6. Retry Budgets and Deadlines"
status: "draft"
code_included: true
---

# 6.1 Retry for at most 10 seconds

Use a short elapsed retry window when the caller can tolerate brief recovery
work, but not an open-ended retry loop. The schedule controls retry timing and
stopping. Error classification still belongs in the surrounding `Effect.retry`
options.

## Problem

Retry transient typed failures with exponential backoff while a 10 second
schedule window remains open. The first attempt runs immediately; the window is
consulted only after a typed failure.

## When to use it

Use this for idempotent service calls, gateway requests, and short dependency
recovery windows where elapsed retry time matters more than an exact retry
count. It is a good fit for temporary unavailability, overload, and network
failures that often clear quickly.

## When not to use it

Do not use this as a hard timeout. `Schedule.during("10 seconds")` does not
interrupt the original attempt or any later attempt already in progress.

Do not retry unsafe writes unless the operation has an idempotency key,
transaction boundary, de-duplication, or another guarantee that repeated
execution is safe.

Do not use `Schedule.during` by itself for real retry traffic. It supplies a
time window, not a useful delay.

## Schedule shape

`Schedule.exponential("100 millis")` produces the retry delays. With the
default factor of `2`, the delays are 100 milliseconds, 200 milliseconds, 400
milliseconds, and so on.

`Schedule.during("10 seconds")` supplies the elapsed schedule window. In a
retry policy, that window starts when the schedule is first stepped after the
first typed failure.

`Schedule.both` requires both schedules to continue and uses the maximum delay.
Here the exponential schedule supplies the wait, and `during` supplies the
stopping condition. A retry decision made just inside the window may still
sleep and run the next attempt after the nominal 10 second boundary.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class GatewayError extends Data.TaggedError("GatewayError")<{
  readonly reason: "Unavailable" | "Overloaded" | "BadRequest"
}> {}

interface GatewayResponse {
  readonly body: string
}

let attempts = 0

const callGateway: Effect.Effect<GatewayResponse, GatewayError> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`gateway attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail(
      new GatewayError({
        reason: attempts === 1 ? "Unavailable" : "Overloaded"
      })
    )
  }

  return { body: "ok" }
})

const isRetryableGatewayError = (error: GatewayError): boolean =>
  error.reason === "Unavailable" || error.reason === "Overloaded"

const retryForAtMost10Seconds = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.during("10 seconds"))
)

const program = Effect.gen(function*() {
  const response = yield* callGateway.pipe(
    Effect.retry({
      schedule: retryForAtMost10Seconds,
      while: isRetryableGatewayError
    })
  )

  yield* Console.log(`gateway response: ${response.body}`)
})

Effect.runPromise(program)
```

`BadRequest` would stop immediately because the `while` predicate returns
`false`. If retryable failures continue until the schedule window closes,
`Effect.retry` propagates the last `GatewayError`.

## Variants and caveats

Use `Schedule.spaced("500 millis").pipe(Schedule.both(Schedule.during("10 seconds")))`
when a fixed cadence is easier on the dependency than exponential backoff.

Add `Schedule.recurs(8)` with another `Schedule.both` when eight retries is
also a real operational cap. The policy then stops when either the time budget
or the retry count is exhausted.

Plain `Effect.retry` uses the schedule for timing and stopping. The successful
value is still the value produced by the retried effect; the composed schedule
output is not returned.
