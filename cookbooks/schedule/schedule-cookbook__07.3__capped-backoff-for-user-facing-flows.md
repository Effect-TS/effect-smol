---
book: Effect `Schedule` Cookbook
section_number: "7.3"
section_title: "Capped backoff for user-facing flows"
part_title: "Part II — Core Retry Recipes"
chapter_title: "7. Retry with Capped Backoff"
status: "draft"
code_included: true
---

# 7.3 Capped backoff for user-facing flows

For user-facing work, capped backoff should absorb brief instability without
making a person wait behind an unbounded retry delay.

## Problem

An interactive request has a small usefulness window. A few fast retries can
recover from a transient miss; a long silent pause usually makes the experience
worse.

Use a small exponential base, cap the delay with `Schedule.either`, and add a
short retry budget with `Schedule.recurs`.

## When to use it

Use this for idempotent interactive reads or pre-submit work: dashboard loads,
profile refreshes, search results, availability checks, and checkout summaries.

The cap should come from the product latency budget. For example, if the UI
should show an error state after a few seconds, the schedule should not contain
multi-second waits that push past that budget.

## When not to use it

Do not use this for non-idempotent writes unless repeated execution is safe by
construction.

Do not ignore protocol-specific guidance. If a provider sends `Retry-After` or
documents endpoint-specific rate-limit behavior, model that policy directly.

Do not treat the cap as total user wait. Total time also includes the duration
of every attempted request.

## Schedule shape

For a quick flow, `Schedule.exponential("20 millis")` capped by
`Schedule.spaced("80 millis")` gives waits of 20 milliseconds, 40 milliseconds,
80 milliseconds, then 80 milliseconds for later retries. `Schedule.recurs(4)`
allows four retries after the original attempt.

`Schedule.either` creates the cap by choosing the lower delay. `Schedule.both`
adds the count limit by requiring both the capped schedule and the recurrence
schedule to continue.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class UserRequestError extends Data.TaggedError("UserRequestError")<{
  readonly operation: string
  readonly status: number
}> {}

interface SearchResults {
  readonly query: string
  readonly total: number
}

let attempts = 0

const searchProducts = (query: string): Effect.Effect<SearchResults, UserRequestError> =>
  Effect.gen(function*() {
    attempts += 1
    yield* Console.log(`search attempt ${attempts}`)

    if (attempts < 3) {
      return yield* Effect.fail(new UserRequestError({
        operation: "search",
        status: 503
      }))
    }

    return { query, total: 18 }
  })

const isRetryableUserRequestError = (error: UserRequestError) =>
  error.status === 408 || error.status === 429 || error.status >= 500

const cappedUserFacingBackoff = Schedule.exponential("20 millis").pipe(
  Schedule.either(Schedule.spaced("80 millis")),
  Schedule.both(Schedule.recurs(4))
)

const program = searchProducts("running shoes").pipe(
  Effect.retry({
    schedule: cappedUserFacingBackoff,
    while: isRetryableUserRequestError
  }),
  Effect.tap((results) => Console.log(`results: ${results.total}`))
)

Effect.runPromise(program).then(() => undefined, console.error)
```

The request runs once immediately. Retryable typed failures wait 20
milliseconds, then 40 milliseconds, then at most 80 milliseconds. A
non-retryable `UserRequestError` skips the schedule and fails immediately.

## Variants

Use a smaller cap when the UI should fail quickly. Use a larger cap only when
the user already expects the operation to take longer, such as rebuilding a
preview from a slow dependency.

Use a gentler exponential factor, such as `1.5`, when retries should grow more
gradually before they reach the cap.

## Notes and caveats

Keep the cap greater than or equal to the base interval if you want visible
backoff. If the cap is lower than the base, `Schedule.either` chooses the cap
immediately.

`Schedule.recurs(n)` counts retries after the original attempt, not total
attempts.

Capped backoff does not add jitter. If many users or fibers can fail at the
same time, jitter or another load-shaping mechanism is still needed.
