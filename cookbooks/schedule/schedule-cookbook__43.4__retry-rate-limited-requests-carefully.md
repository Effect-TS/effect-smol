---
book: Effect `Schedule` Cookbook
section_number: "43.4"
section_title: "Retry rate-limited requests carefully"
part_title: "Part X — Real-World Recipes"
chapter_title: "43. Backend Recipes"
status: "draft"
code_included: true
---

# 43.4 Retry rate-limited requests carefully

Rate-limit retries need a different shape from generic transient-error retries:
they should reduce pressure and honor server guidance such as `Retry-After`.

## Problem

A downstream HTTP API sometimes responds with `429` and may include a
`Retry-After` value. You want to retry those responses without turning every
HTTP failure into a retry and without ignoring a server-supplied delay that is
longer than your local backoff.

The first request still happens outside the schedule. The schedule controls only
the follow-up attempts after a failed request is classified as retryable.

## When to use it

Use this recipe for idempotent requests, safe reads, or writes protected by an
idempotency key when the remote service explicitly reports rate limiting. It is
also useful for background workers that call APIs with shared tenant, account,
or application quotas.

The important precondition is classification. Convert raw HTTP failures into a
small domain error first, and retry only the `RateLimited` case. Timeouts and
`503` responses may have their own retry policy, but `400`, `401`, `403`, `404`,
validation failures, and unsafe non-idempotent writes should not be hidden
behind a rate-limit schedule.

## When not to use it

Do not use this as a generic HTTP retry wrapper. A rate limit says "wait before
asking again"; it does not say the original request is valid, safe to replay, or
worth retrying forever.

Also avoid short fixed delays such as "retry every 100 millis" for `429`
responses. They make recovery look fast in tests but create exactly the kind of
pressure that the server is trying to reduce.

## Schedule shape

Build the policy from four parts:

`Schedule.exponential` spaces retries progressively. `Schedule.jittered`
spreads clients so they do not retry in lockstep. `Schedule.recurs` caps the
number of follow-up attempts. `Schedule.while` stops immediately when the
failure is not rate limited.

To honor `Retry-After`, combine the backoff schedule with `Schedule.identity`.
`Effect.retry` feeds each failure into the schedule, so `identity` lets the
schedule output the current error. Then `Schedule.modifyDelay` can choose the
larger of the local backoff delay and the server-provided retry delay.

## Code

```ts
import { Console, Duration, Effect, Schedule } from "effect"

type HttpError =
  | {
    readonly _tag: "RateLimited"
    readonly retryAfter: Duration.Duration | undefined
  }
  | {
    readonly _tag: "Unauthorized" | "Forbidden" | "BadRequest" | "Unavailable"
  }

let attempts = 0

const callApi: Effect.Effect<string, HttpError> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`calling API, attempt ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail({
      _tag: "RateLimited",
      retryAfter: Duration.millis(30)
    })
  }

  return "accepted"
})

const rateLimitPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.identity<HttpError>()),
  Schedule.modifyDelay(([_, error], delay) =>
    Effect.succeed(
      error._tag === "RateLimited" && error.retryAfter !== undefined
        ? Duration.max(delay, error.retryAfter)
        : delay
    )
  ),
  Schedule.both(Schedule.recurs(5)),
  Schedule.while(({ input }) => input._tag === "RateLimited")
)

const program = Effect.retry(callApi, rateLimitPolicy).pipe(
  Effect.tap((result) => Console.log(`result: ${result}`))
)

Effect.runPromise(program).then(console.log, console.error)
```

## Variants

If the provider returns `Retry-After` as a header, parse it before constructing
the domain error. Header parsing belongs with HTTP decoding, not inside the
schedule. Store the parsed value as a `Duration.Duration`, reject invalid or
negative values, and consider clamping very large values to the caller's
business deadline.

For user-facing calls, keep the recurrence count small and combine the policy
with a short elapsed-time budget so the user gets a clear answer. For background
workers, use a larger base delay and let the queue or work scheduler re-enqueue
the job when the server asks for a long pause.

For APIs with per-tenant quotas, include tenant or account information in
metrics around the retried effect. The schedule controls local timing; it does
not coordinate all callers that share the same quota.

## Notes and caveats

`Schedule.both` continues only while both schedules continue, uses the maximum
delay from the two sides, and returns both outputs as a tuple. In this recipe the
timing side provides the backoff delay, while `Schedule.identity` carries the
current `HttpError` into `modifyDelay`. The recipe then chooses the larger of
the local backoff delay and the parsed `Retry-After` delay.

`Schedule.while` sees schedule metadata, including the latest retry input. When
the predicate returns `false`, the retry stops and the original failure remains
visible to the caller. That is what you want for carefully classified HTTP
errors: retry `429`, but surface authorization, validation, and other permanent
failures immediately.
