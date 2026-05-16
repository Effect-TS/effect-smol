---
book: Effect `Schedule` Cookbook
section_number: "33.5"
section_title: "Coordinate retry and rate-limit handling"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "33. Respect Rate Limits"
status: "draft"
code_included: true
---

# 33.5 Coordinate retry and rate-limit handling

Retries and rate limits answer different questions. Retry classification decides
whether another attempt is allowed at all. The schedule decides when that attempt
may happen. Keep those decisions close together, but do not blur them into one
generic "try again later" policy.

For rate-limited calls, the retry error often contains useful protocol data:
`Retry-After`, reset time, remaining quota, or a provider-specific cooldown. A
good schedule should preserve that signal instead of treating a `429` like an
ordinary temporary failure.

## Problem

You call an external API that can fail in several ways:

- `RateLimited`: retryable, but only after the provider's requested delay.
- `ServiceUnavailable`: retryable with ordinary backoff.
- `BadRequest`: not retryable; the request must be fixed.

The retry policy needs to make both decisions explicit. The `BadRequest` should
not enter the retry schedule. The `RateLimited` case should wait at least as long
as the provider asked. The `ServiceUnavailable` case can use a normal backoff.

## Recommended policy

Classify the error first with `Effect.retry({ while })`. Then use a schedule that
can observe the typed retry input. `Effect.retry` feeds failures into the
schedule, so `Schedule.identity<ApiError>()` can expose the current failure as
the schedule output. From there, `Schedule.modifyDelay` can choose a delay that
matches the error.

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly retryAfter: Duration.Duration
}> {}

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{}> {}

class BadRequest extends Data.TaggedError("BadRequest")<{
  readonly reason: string
}> {}

type ApiError = RateLimited | ServiceUnavailable | BadRequest

declare const callProvider: Effect.Effect<string, ApiError>

const isRetryable = (error: ApiError) =>
  error._tag === "RateLimited" || error._tag === "ServiceUnavailable"

const retryPolicy = Schedule.identity<ApiError>().pipe(
  Schedule.both(Schedule.exponential("200 millis")),
  Schedule.modifyDelay(([error], computedDelay) =>
    Effect.succeed(
      error._tag === "RateLimited"
        ? Duration.max(computedDelay, error.retryAfter)
        : computedDelay
    )
  ),
  Schedule.both(Schedule.recurs(5))
)

export const program = callProvider.pipe(
  Effect.retry({
    schedule: retryPolicy,
    while: isRetryable
  })
)
```

This policy allows at most five retries after the original call. For ordinary
service unavailability, it follows the exponential delay. For rate limits, it
uses the larger of the exponential delay and the provider's `retryAfter` value,
so the client never retries earlier than the rate-limit response requested.

## Why the pieces are separate

The `while` predicate is the classification boundary. It says which typed errors
are safe to retry. That is where permanent failures, validation failures,
authorization failures, and unsafe write failures should be rejected.

The `Schedule` is the timing boundary. It says how retryable failures are paced
after classification has already allowed them. Because schedules receive retry
failures as input, the timing policy can still distinguish a rate-limit response
from a server-unavailable response without making the whole operation retry every
error.

`Schedule.both` combines the typed input schedule with exponential backoff. The
combined schedule recurs only while both sides recur, and it uses the maximum of
their delays. `Schedule.recurs(5)` adds a hard retry count so the policy cannot
continue forever.

## Variants

If provider guidance must be followed exactly, use a schedule whose base delay
does not add extra backoff for `RateLimited` errors. A common shape is
`Schedule.identity<ApiError>()` plus `Schedule.addDelay` from the error's retry
metadata and a small `Schedule.recurs` limit.

If many clients may retry together, add jitter only after deciding whether it is
allowed for the provider contract. Randomizing below a required `Retry-After`
delay can violate the rate-limit signal; randomizing extra delay above that
minimum is usually safer.

If the operation is user-facing, combine the retry count with a time budget such
as `Schedule.during("10 seconds")` so callers get a bounded response. For
background workers, prefer longer budgets and clear observability around the
rate-limited path.

## Notes and caveats

`Effect.retry` schedules typed failures from the error channel. It does not turn
defects or interruptions into retryable errors.

The first call is not delayed. The schedule controls the waits between retry
attempts after a failure.

`Schedule.modifyDelay` replaces the delay chosen by the schedule. Use it when the
rate-limit delay should be compared with, or override, the computed backoff. Use
`Schedule.addDelay` when the provider delay should be added on top of an existing
delay.

Retries do not make side effects safe by themselves. For writes, classification
must also account for idempotency keys, deduplication, or another domain-level
guarantee before any schedule is applied.
