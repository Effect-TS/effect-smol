---
book: "Effect `Schedule` Cookbook"
section_number: "7.5"
section_title: "Treat rate limits differently from server errors"
part_title: "Part II — Retry Recipes"
chapter_title: "7. Error-Aware Retries"
status: "draft"
code_included: true
---

# 7.5 Treat rate limits differently from server errors

Rate limits and server failures can both be transient, but they communicate
different operational signals. Preserve that difference in the typed error
model and choose a schedule for each case.

## Problem

`503 Service Unavailable` usually means the server failed to handle the
request. `429 Too Many Requests` means the caller is applying too much
pressure. A single generic retry policy hides that distinction.

## Why this comparison matters

For retryable 5xx responses, a short jittered backoff is often enough: probe
again, spread callers around each delay, and stop after a small budget.

For rate limits, prefer provider guidance. If the response carries a
`Retry-After` value or equivalent metadata, use that value instead of guessing
from a generic exponential sequence.

## Schedule shape

Use a finite jittered backoff for server errors. Use a rate-limit-specific
schedule that can read the typed retry input when the error carries the wait
duration.

`Schedule.identity<A>()` outputs the retry input as the schedule output.
`Schedule.addDelay` can then derive the wait from that output.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class ServerError extends Data.TaggedError("ServerError")<{
  readonly status: 500 | 502 | 503 | 504
}> {}

class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly retryAfterMillis: number
}> {}

let serverAttempts = 0

const callServer: Effect.Effect<string, ServerError> = Effect.gen(function*() {
  serverAttempts += 1
  yield* Console.log(`server attempt ${serverAttempts}`)

  if (serverAttempts < 3) {
    return yield* Effect.fail(new ServerError({ status: 503 }))
  }

  return "server value"
})

let rateLimitAttempts = 0

const callRateLimitedApi: Effect.Effect<string, RateLimited> = Effect.gen(function*() {
  rateLimitAttempts += 1
  yield* Console.log(`rate-limit attempt ${rateLimitAttempts}`)

  if (rateLimitAttempts === 1) {
    return yield* Effect.fail(new RateLimited({ retryAfterMillis: 100 }))
  }

  return "rate-limited value"
})

const retryServerErrors = Schedule.exponential("50 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

const retryRateLimits = Schedule.identity<RateLimited>().pipe(
  Schedule.both(Schedule.recurs(2)),
  Schedule.addDelay(([error]) =>
    Effect.succeed(Duration.millis(error.retryAfterMillis))
  )
)

const program = Effect.gen(function*() {
  const serverValue = yield* callServer.pipe(
    Effect.retry({
      schedule: retryServerErrors,
      while: (error) => error.status >= 500 && error.status < 600
    })
  )
  yield* Console.log(`server result: ${serverValue}`)

  const rateLimitedValue = yield* callRateLimitedApi.pipe(
    Effect.retry({
      schedule: retryRateLimits,
      while: (error) => error._tag === "RateLimited"
    })
  )
  yield* Console.log(`rate-limit result: ${rateLimitedValue}`)
})

Effect.runPromise(program)
```

The server policy retries quickly with jitter. The rate-limit policy waits from
the typed retry hint.

## Tradeoffs

The 5xx policy works even when the server gives no retry hint, but it is only a
guess. Keep its retry budget small.

The rate-limit policy is more protocol-aware. It works best when the adapter
preserves `Retry-After` or equivalent quota metadata in the typed error.

## Recommended default

Do not put `429` into the same predicate as generic 5xx failures. Use a
dedicated `RateLimited` error, preserve the retry delay when available, and use
a small retry count.

For retryable 5xx responses, use finite jittered exponential backoff. For rate
limits, prefer provider guidance first and fall back to a fixed or capped delay
only when no retry hint exists.

Retried writes still need idempotency, de-duplication, or a transaction
boundary. A better retry policy does not make duplicate side effects safe.
