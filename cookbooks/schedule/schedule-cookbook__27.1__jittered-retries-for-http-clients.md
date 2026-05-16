---
book: Effect `Schedule` Cookbook
section_number: "27.1"
section_title: "Jittered retries for HTTP clients"
part_title: "Part VI — Jitter Recipes"
chapter_title: "27. Jitter for Retry"
status: "draft"
code_included: true
---

# 27.1 Jittered retries for HTTP clients

HTTP clients are a common place to add jitter because failures often affect many callers at once. If every process retries after the same backoff delay, a temporary 503 or network flap can turn into another synchronized burst. `Schedule.jittered` keeps the base retry policy recognizable while spreading each retry delay across a small random range.

## Problem

You need an HTTP retry policy that backs off after transient failures, avoids retrying unsafe requests, and prevents a fleet of clients from retrying in lockstep. The first HTTP request is still made by the effect itself. The schedule only decides whether to make another attempt, and how long to wait before that next attempt.

## When to use it

Use this recipe for transient HTTP failures such as timeouts, 408, 429, and 5xx responses where another attempt is expected to be safe. It is especially useful for service-to-service calls, background workers, and webhook delivery paths where many clients can observe the same outage window.

Keep the retry boundary close to the HTTP operation. The schedule can handle timing and limits, but the operation should still classify errors so the retry policy only sees failures that can be safely retried.

## When not to use it

Do not retry validation errors, malformed requests, authentication failures, authorization failures, or normal 4xx responses. Also do not blindly retry non-idempotent writes. A `POST` that creates a charge, sends an email, or mutates external state needs an idempotency key or another application-level safety mechanism before it belongs behind a retry schedule.

Jitter also does not replace rate-limit handling. If the server gives a specific `Retry-After` policy, model that explicitly instead of pretending every response should follow the same client-side backoff curve.

## Schedule shape

Start with the operational shape you would want without jitter, then apply `Schedule.jittered` to that base cadence. In `Schedule.ts`, `Schedule.exponential("100 millis")` produces an exponential sequence of delays, and `Schedule.jittered` modifies each delay to a random value between 80% and 120% of the original delay.

Combine the jittered backoff with a stop condition such as `Schedule.recurs(5)`. `Schedule.both` uses intersection semantics, so the retry continues only while both schedules continue.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

type HttpMethod = "GET" | "HEAD" | "PUT" | "DELETE" | "POST"

class HttpError extends Data.TaggedError("HttpError")<{
  readonly method: HttpMethod
  readonly status: number
  readonly idempotencyKey?: string
}> {}

declare const getJson: (
  url: string
) => Effect.Effect<unknown, HttpError>

const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500

const isRetrySafe = (error: HttpError) =>
  isRetryableStatus(error.status) &&
  (
    error.method === "GET" ||
    error.method === "HEAD" ||
    error.method === "PUT" ||
    error.method === "DELETE" ||
    error.idempotencyKey !== undefined
  )

const httpRetryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
  Schedule.while(({ input }) => isRetrySafe(input))
)

export const program = Effect.retry(
  getJson("https://api.example.com/profile"),
  httpRetryPolicy
)
```

## Variants

For user-facing requests, use fewer recurrences or add a short elapsed-time budget so the caller gets a timely answer. For background delivery, use a larger base delay and a larger retry limit, but keep the policy bounded so failed work eventually moves to a dead-letter path or operator-visible state.

For writes, keep the safety check stricter than the timing check. Retrying a `POST` can be reasonable when the request carries an idempotency key and the downstream service honors it. Without that guarantee, prefer surfacing the failure over creating duplicate side effects.

## Notes and caveats

`Effect.retry` feeds failures into the schedule as inputs. That is why the example can use `Schedule.while(({ input }) => isRetrySafe(input))` to stop retrying when the HTTP error is not safe to repeat.

`Schedule.jittered` changes the delay, not the retry decision. Keep retry classification, maximum retry count, and any total time budget explicit in the surrounding schedule composition.
