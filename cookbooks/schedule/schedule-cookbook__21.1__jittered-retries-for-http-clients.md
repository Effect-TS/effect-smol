---
book: "Effect `Schedule` Cookbook"
section_number: "21.1"
section_title: "Jittered retries for HTTP clients"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "21. Jitter in Real Systems"
status: "draft"
code_included: true
---

# 21.1 Jittered retries for HTTP clients

Use jittered retries when many HTTP clients may see the same transient failure
and retry at nearly the same time. `Schedule.jittered` keeps the chosen retry
shape visible while spreading each retry delay across a small random range.

## Problem

An HTTP call can fail because a gateway is overloaded, a request times out, or a
server returns `408`, `429`, or `5xx`. Retrying can help, but only when the
request is safe to repeat. For writes, "safe" usually means idempotent: running
the same request more than once has the same external effect as running it once.

## When to use it

Use it for service-to-service calls, background delivery, and webhooks where a
shared outage can affect many callers. Keep error classification close to the
HTTP operation so the retry policy only sees failures that are worth retrying.

## When not to use it

Do not retry validation errors, malformed requests, authentication failures, or
ordinary `4xx` responses. Do not blindly retry a `POST` that charges a card,
sends an email, or creates external state unless it carries an idempotency key or
another deduplication guarantee.

Jitter also does not replace explicit rate-limit handling. If the server returns
a `Retry-After` value, prefer that server-provided delay for that response.

## Schedule shape

Choose the backoff first, then add jitter. `Schedule.exponential("100 millis")`
produces increasing delays. `Schedule.jittered` modifies each selected delay to
a random value between 80% and 120% of the original delay. Add
`Schedule.recurs` or a time budget so the retry is bounded.

## Example

```ts
import { Data, Effect, Schedule } from "effect"

type HttpMethod = "GET" | "HEAD" | "PUT" | "DELETE" | "POST"

class HttpError extends Data.TaggedError("HttpError")<{
  readonly method: HttpMethod
  readonly status: number
  readonly idempotencyKey?: string
}> {}

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

let attempt = 0

const getProfile = Effect.gen(function*() {
  attempt += 1
  yield* Effect.sync(() => console.log(`GET /profile attempt ${attempt}`))

  if (attempt < 3) {
    return yield* Effect.fail(
      new HttpError({ method: "GET", status: 503 })
    )
  }

  return { id: 123, name: "Ada" }
})

const httpRetryPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

const program = getProfile.pipe(
  Effect.retry({
    schedule: httpRetryPolicy,
    while: isRetrySafe
  }),
  Effect.tap((profile) =>
    Effect.sync(() => console.log(`loaded ${profile.name}`))
  )
)

Effect.runPromise(program)
```

## Variants

For user-facing calls, use fewer retries or a short elapsed-time budget so the
caller gets a timely answer. For background delivery, use a larger base delay
and retry limit, but keep a clear handoff to a dead-letter queue, alert, or
operator-visible failed state.

For writes, keep the safety check stricter than the timing check. Retrying a
`POST` can be reasonable when the downstream service honors an idempotency key.
Without that guarantee, surface the failure instead of risking duplicate side
effects.

## Notes and caveats

`Effect.retry` runs the original request immediately. Jitter affects only waits
between retries after typed failures.

`Schedule.jittered` changes delay only. Keep retry classification, maximum retry
count, and any total time budget explicit.
