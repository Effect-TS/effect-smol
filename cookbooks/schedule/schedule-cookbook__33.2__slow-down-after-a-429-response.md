---
book: Effect `Schedule` Cookbook
section_number: "33.2"
section_title: "Slow down after a 429 response"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "33. Respect Rate Limits"
status: "draft"
code_included: true
---

# 33.2 Slow down after a 429 response

HTTP `429 Too Many Requests` is a pacing signal. Treat it differently from
ordinary transient failures so retry timing can follow provider guidance.

## Problem

An HTTP API sometimes returns `429`. If the response includes a retry-after
signal, the next attempt should honor it. If the signal is missing, the client
should still wait for a conservative fallback delay. Other failures should not
silently inherit the same policy because they have different operational
meaning.

## When to use it

Use this when the server explicitly says the client is rate limited. Common
sources are a `Retry-After` header, a provider-specific reset header, or a
decoded response field that says when quota should be available again.

This is a good fit for idempotent calls, background sync jobs, polling workers,
and queued writes where waiting is better than turning a temporary quota limit
into a hard failure.

## When not to use it

Do not use this as a generic HTTP retry policy. A `500` or `503` usually means
the service is unhealthy or overloaded; exponential backoff with jitter and a
short budget is usually a better fit.

Do not retry unsafe non-idempotent requests unless the protocol gives you an
idempotency key or another deduplication guarantee. Slowing down prevents bursts;
it does not make repeated writes safe.

## Schedule shape

Build the policy around the typed error value:

- classify retryable errors before scheduling
- use `Schedule.identity<ApiError>()` so the schedule output is the latest error
- use `Schedule.modifyDelay` to choose the next delay from that error
- cap retries with `Schedule.recurs(n)`

Normalize provider headers into a `Duration` before constructing the typed
`RateLimited` error. The schedule should consume domain data, not parse raw HTTP
headers.

## Code

```ts
import { Console, Duration, Effect, Ref, Schedule } from "effect"

type ApiError =
  | {
    readonly _tag: "RateLimited"
    readonly retryAfter: Duration.Duration | undefined
  }
  | {
    readonly _tag: "ServerUnavailable"
  }

const fallback429Delay = Duration.millis(40)

const retryAfter = (error: ApiError): Duration.Duration =>
  error._tag === "RateLimited" && error.retryAfter !== undefined
    ? error.retryAfter
    : fallback429Delay

const isRateLimited = (error: ApiError): boolean =>
  error._tag === "RateLimited"

const rateLimitPolicy = Schedule.identity<ApiError>().pipe(
  Schedule.while(({ input }) => input._tag === "RateLimited"),
  Schedule.modifyDelay((error) => {
    const delay = retryAfter(error)
    return Console.log(`429 delay: ${Duration.toMillis(delay)}ms`).pipe(
      Effect.as(delay)
    )
  }),
  Schedule.both(Schedule.recurs(4))
)

const callApi = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`HTTP attempt ${attempt}`)

  if (attempt === 1) {
    return yield* Effect.fail({
      _tag: "RateLimited",
      retryAfter: Duration.millis(25)
    } as const)
  }

  if (attempt === 2) {
    return yield* Effect.fail({
      _tag: "RateLimited",
      retryAfter: undefined
    } as const)
  }

  return { body: "ok" }
})

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const response = yield* callApi(attempts).pipe(
    Effect.retry({
      schedule: rateLimitPolicy,
      while: isRateLimited
    })
  )
  yield* Console.log(`response: ${response.body}`)
})

Effect.runPromise(program)
```

The first retry uses the provider's 25 millisecond signal. The second retry uses
the fallback because the simulated response omits `retryAfter`. In production,
use durations that match the provider contract rather than documentation-sized
delays.

## Variants

If the provider gives an absolute reset time, convert it into a duration at the
HTTP boundary and store that duration on the `RateLimited` error.

If many workers share the same credential, coordinate through a shared limiter.
Only jitter fallback delays when doing so cannot retry before a required
provider minimum.

If the request is user-facing, combine the retry count with a short elapsed-time
budget. Background jobs can usually afford longer spacing than foreground
requests.

## Notes and caveats

The first call is not delayed. The schedule controls follow-up attempts after
`callApi` fails.

The fallback delay is part of the contract. Without it, a missing retry-after
signal can become a burst of immediate retries, which is what a rate-limit
policy is meant to prevent.
