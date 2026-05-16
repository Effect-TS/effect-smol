---
book: Effect `Schedule` Cookbook
section_number: "10.5"
section_title: "Treat rate limits differently from server errors"
part_title: "Part II — Core Retry Recipes"
chapter_title: "10. Retry Only When It Makes Sense"
status: "draft"
code_included: true
---

# 10.5 Treat rate limits differently from server errors

A `429 Too Many Requests` response and a `503 Service Unavailable` response can both be
transient, but they do not mean the same thing. A 5xx response usually says the server
failed to handle the request. This recipe keeps the retry policy explicit: the schedule
decides when another typed failure should be attempted again and where retrying stops.
The surrounding Effect code remains responsible for domain safety, including which
failures are transient, whether the operation is idempotent, and how the final failure
is reported.

## Problem

A `429 Too Many Requests` response and a `503 Service Unavailable` response can
both be transient, but they do not mean the same thing.

A 5xx response usually says the server failed to handle the request. The caller
should back off, add jitter, and stop after a small budget. A rate-limit
response usually says the caller is sending too much traffic. The caller should
respect the server's retry guidance, reduce pressure, and avoid turning retries
into more rate-limit traffic.

Model these cases as different typed errors and give them different retry
schedules.

## Why this comparison matters

Using one generic retry policy for both cases hides the operational signal.
Exponential backoff is a reasonable default for many temporary server failures,
but it can be too eager for a provider that explicitly asked the caller to wait.

The reverse is also true. Treating every 5xx response like a rate limit can make
ordinary transient server errors wait longer than necessary, especially when no
`Retry-After` value exists.

Separate policies also make reviews clearer. A server-error policy answers "how
long should I keep probing this unavailable dependency?" A rate-limit policy
answers "how long did the provider ask this caller to stand down?"

## Option 1

Use a short, jittered backoff for retryable 5xx responses:

```ts
import { Data, Effect, Schedule } from "effect"

class ServerError extends Data.TaggedError("ServerError")<{
  readonly status: 500 | 502 | 503 | 504
}> {}

declare const callApi: Effect.Effect<string, ServerError>

const retryServerErrors = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

const program = callApi.pipe(
  Effect.retry({
    schedule: retryServerErrors,
    while: (error) => error.status >= 500 && error.status < 600
  })
)
```

This policy probes again quickly, spreads callers around each exponential delay,
and stops after three retries after the original attempt. It is suitable for
temporary server-side failures where the response does not give a more specific
retry time.

## Option 2

Use a rate-limit-specific schedule when the error carries retry guidance:

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly retryAfterMillis: number
}> {}

declare const callApi: Effect.Effect<string, RateLimited>

const retryRateLimits = Schedule.identity<RateLimited>().pipe(
  Schedule.both(Schedule.recurs(2)),
  Schedule.addDelay(([error]) => Effect.succeed(Duration.millis(error.retryAfterMillis)))
)

const program = callApi.pipe(
  Effect.retry({
    schedule: retryRateLimits,
    while: (error) => error._tag === "RateLimited"
  })
)
```

`Schedule.identity<RateLimited>()` makes the schedule output the typed retry
input. `Schedule.recurs(2)` allows at most two retries after the original
attempt. `Schedule.addDelay` can then read `retryAfterMillis` from the paired
schedule output and use it as the wait before the next retry.

## Tradeoffs

The 5xx policy is simple and works even when the server gives no retry hint. It
is also intentionally conservative: a small retry budget avoids tying up callers
when the dependency remains unavailable.

The rate-limit policy is more protocol-aware. It waits for the provider's
advertised interval instead of guessing from an exponential sequence. That is
usually better for shared APIs, quota-based systems, and endpoints that enforce
per-client budgets.

The cost is that the typed error must preserve the retry hint. If an HTTP
adapter discards `Retry-After` or quota metadata, the caller can only fall back
to a generic delay.

## Recommended default

Do not put `429` into the same predicate as generic 5xx failures. Keep a
dedicated `RateLimited` error, preserve the retry delay if the server provides
one, and use a schedule that waits from that value with a small retry count.

For retryable 5xx responses, use jittered exponential backoff with a finite
budget. For rate limits, prefer provider guidance first; use a fixed or capped
fallback only when no retry hint is available.

## Notes and caveats

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.

The first request is not delayed. Schedules control the waits between retries
after a typed failure.

`Schedule.addDelay` adds to the delay already produced by the schedule. In the
rate-limit example, `Schedule.recurs(2)` contributes no meaningful delay, so the
added delay is the effective wait.

Retried writes still need a domain-level safety guarantee, such as an
idempotency key, deduplication, or a transaction boundary. A better retry policy
does not make duplicate side effects safe by itself.
