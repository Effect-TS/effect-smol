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

This recipe shows how to use capped exponential backoff for requests where a person is
waiting for the result.

## Problem

In a user-facing flow, basic exponential backoff can turn a recoverable failure
into a long pause with no useful feedback once later retries become slower than
the product can tolerate.

Compose the cap explicitly:

```ts
const userFacingBackoff = Schedule.exponential("250 millis").pipe(
  Schedule.either(Schedule.spaced("2 seconds")),
  Schedule.both(Schedule.recurs(5))
)
```

`Schedule.either` uses the minimum of the two delays, so the exponential delay
grows until it reaches the fixed `Schedule.spaced` delay. `Schedule.both` then
adds the retry limit.

## When to use it

Use this recipe for idempotent work in an interactive path: loading a dashboard,
refreshing a profile, fetching search results, checking availability, or
building a checkout summary before the user submits anything.

The goal is to absorb brief instability without making the UI wait behind an
unbounded retry delay. A small base interval gives quick recovery from a
transient miss. The cap protects the maximum pause between retries.

This shape is also useful when you know the retry budget in product terms, such
as "try for a few seconds, then show an error state."

## When not to use it

Do not use this policy for non-idempotent writes unless the operation has an
idempotency key, transaction boundary, or another duplicate-safe design.

Do not use a per-retry cap as a total timeout. The cap limits each delay between
retries; it does not include the time spent running each attempt.

Do not ignore protocol-specific guidance. If a provider gives a `Retry-After`
value or endpoint-specific rate-limit policy, model that policy directly
instead of using a generic user-facing cap.

Do not treat capped backoff as the whole protection story for a busy client.
Many concurrent user requests can still retry together. Large fleets usually
need jitter, admission control, or rate limiting around the call site.

## Schedule shape

`Schedule.exponential("250 millis")` is unbounded and produces delays like 250
milliseconds, 500 milliseconds, 1 second, 2 seconds, 4 seconds, and so on.

`Schedule.spaced("2 seconds")` is also unbounded and contributes a constant
2-second delay.

`Schedule.either` continues while either schedule wants to continue and uses the
minimum delay between the two schedules. Since both schedules are unbounded, the
combined delay is the lower of the exponential delay and the fixed cap:

- first retry: wait 250 milliseconds
- second retry: wait 500 milliseconds
- third retry: wait 1 second
- fourth retry: wait 2 seconds
- fifth retry: wait 2 seconds
- later retries would also wait 2 seconds, unless another schedule stops first

Add `Schedule.both(Schedule.recurs(5))` to stop after at most five retries after
the original attempt. `Schedule.both` uses the maximum delay between the two
schedules, and `Schedule.recurs(5)` has no added delay, so the capped backoff
delay is preserved while the count limit stops the policy.

With `Effect.retry`, the original effect runs immediately. The schedule is
consulted only after a typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class UserRequestError extends Data.TaggedError("UserRequestError")<{
  readonly operation: string
  readonly status: number
}> {}

interface SearchResults {
  readonly query: string
  readonly total: number
}

declare const searchProducts: (
  query: string
) => Effect.Effect<SearchResults, UserRequestError>

const isRetryableUserRequestError = (error: UserRequestError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const cappedUserFacingBackoff = Schedule.exponential("250 millis").pipe(
  Schedule.either(Schedule.spaced("2 seconds")),
  Schedule.both(Schedule.recurs(5))
)

const program = searchProducts("running shoes").pipe(
  Effect.retry({
    schedule: cappedUserFacingBackoff,
    while: isRetryableUserRequestError
  })
)
```

`program` calls `searchProducts("running shoes")` immediately. If it fails with
a retryable `UserRequestError`, it retries with delays of about 250
milliseconds, 500 milliseconds, 1 second, 2 seconds, and 2 seconds.

The policy allows at most five retries after the original attempt, so the
effect can run up to six times total. If the error is not retryable, or if all
permitted attempts fail, `Effect.retry` propagates the last typed
`UserRequestError`.

## Variants

Use a smaller cap for flows where the UI should fail quickly:

```ts
const quickScreenBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.either(Schedule.spaced("1 second")),
  Schedule.both(Schedule.recurs(3))
)
```

This shape gives delays of about 100 milliseconds, 200 milliseconds, and 400
milliseconds. The 1-second cap is still present, but the three-retry budget
stops before the exponential delay reaches it.

Use a gentler factor when retries should grow more gradually before they reach
the cap:

```ts
const gentlerUserFacingBackoff = Schedule.exponential("250 millis", 1.5).pipe(
  Schedule.either(Schedule.spaced("2 seconds")),
  Schedule.both(Schedule.recurs(5))
)
```

With a factor of `1.5`, the first delays are about 250 milliseconds, 375
milliseconds, 562 milliseconds, 843 milliseconds, and 1.26 seconds. This can be
useful when the user-facing latency budget allows several short retries but not
a long jump between attempts.

Use a larger cap only when the user already expects the operation to take
longer, such as rebuilding a preview from a slow dependency:

```ts
const slowerPreviewBackoff = Schedule.exponential("500 millis").pipe(
  Schedule.either(Schedule.spaced("3 seconds")),
  Schedule.both(Schedule.recurs(4))
)
```

The cap should still come from the flow's latency budget, not from the
downstream service alone.

## Notes and caveats

There is no special cap API in this recipe. The cap comes from composing
`Schedule.exponential` with `Schedule.spaced` using `Schedule.either`.

Keep the cap greater than or equal to the base interval if you want a visible
backoff shape. If the cap is lower than the base, `Schedule.either` chooses the
cap immediately because it uses the minimum delay.

The cap is a maximum delay between retries, not a maximum total user wait. The
total wait also includes the duration of each attempted request and every delay
before the final attempt.

`Schedule.either` has union-style continuation semantics. In this recipe, both
the exponential schedule and the spaced schedule are unbounded, so
`Schedule.recurs` is the part that stops retrying.

Capped backoff does not add jitter. If many users or fibers can fail at the same
time, add jitter or another load-shaping mechanism before treating this as a
complete production retry policy.
