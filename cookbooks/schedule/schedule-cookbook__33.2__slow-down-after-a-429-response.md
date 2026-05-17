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

HTTP `429 Too Many Requests` is a server pacing signal. This recipe uses a typed
rate-limit error as schedule input so retry timing can follow provider guidance
instead of ordinary transient-failure backoff.

## Problem

You call an HTTP API that sometimes returns `429`. When the response includes a
retry-after signal, the next attempt should honor it. When the signal is absent,
the retry should still slow down with a conservative fallback delay. Other
failures, especially `5xx` failures, should not accidentally inherit the same
policy because they have different operational meaning.

## When to use it

Use this recipe when a server explicitly tells the client it is being rate
limited. Typical sources are a `Retry-After` header, a provider-specific reset
header, or a decoded response body field that says when quota is expected to be
available again.

This is especially useful for clients that perform idempotent calls, background
sync jobs, polling workers, or queued writes where waiting is better than
turning a temporary quota limit into a hard failure.

## When not to use it

Do not use this policy as a generic HTTP retry policy. A `500` or `503` often
means the service is unhealthy or overloaded; exponential backoff with jitter and
a short budget is usually a better fit. A `429` means the server understood
enough to apply a quota rule, so the client should respect that quota boundary.

Also avoid retrying unsafe non-idempotent requests unless the protocol gives you
an idempotency key or another deduplication guarantee. Slowing down prevents
bursts, but it does not make repeated writes safe by itself.

## Schedule shape

Build the policy around the error value:

- keep retrying only while the input is a rate-limit error
- preserve the input as the schedule output with `Schedule.passthrough`
- replace the recurrence delay with the server-provided retry-after duration
- use a fallback delay when the server does not provide one
- cap the number of retries so a stuck quota does not hold the caller forever

`Schedule.recurs` supplies the retry count limit. `Schedule.passthrough` makes
the latest failure available as the schedule output. `Schedule.modifyDelay`
chooses the actual spacing for the next retry.

## Code

```ts
import { Duration, Effect, Schedule } from "effect"

type Response = {
  readonly body: string
}

type ApiError =
  | {
    readonly _tag: "RateLimited"
    readonly retryAfter: Duration.Duration | undefined
  }
  | {
    readonly _tag: "ServerUnavailable"
  }

declare const callApi: Effect.Effect<Response, ApiError>

const fallback429Delay = Duration.seconds(5)

const retryAfter = (error: ApiError): Duration.Duration =>
  error._tag === "RateLimited" && error.retryAfter !== undefined
    ? error.retryAfter
    : fallback429Delay

const rateLimitPolicy = Schedule.recurs(4).pipe(
  Schedule.passthrough,
  Schedule.while(({ input }) => input._tag === "RateLimited"),
  Schedule.modifyDelay((error, _delay) => Effect.succeed(retryAfter(error)))
)

export const program = Effect.retry(callApi, rateLimitPolicy)
```

## Variants

- If the provider gives an absolute reset time, convert it into a duration at
  the HTTP boundary and store that duration on the `RateLimited` error. Keep the
  schedule focused on recurrence rather than header parsing.
- If many workers share the same credential, add jitter around the fallback path
  or coordinate through a shared limiter. A precise `Retry-After` value should
  usually be respected; a guessed fallback is safer to spread out.
- If a user is waiting on the request, combine the policy with a shorter retry
  count or elapsed-time budget. A background job can afford longer spacing; a
  foreground request usually needs a clear answer quickly.
- If the same client also retries `5xx` failures, keep that as a separate policy
  and select the policy after error classification. Rate limits are about client
  pacing; `5xx` failures are about server recovery.

## Notes and caveats

The first call is not delayed by this schedule. The schedule controls only the
follow-up attempts after `callApi` fails.

`Retry-After` can be encoded by providers in different ways. Normalize that
signal before constructing the `RateLimited` error, then let the schedule consume
a `Duration`. This keeps rate-limit parsing near the HTTP response and keeps the
retry policy easy to inspect.

The fallback delay is part of the contract. Without it, a missing retry-after
signal can turn into a burst of immediate retries, which is exactly what a rate
limit policy is supposed to prevent.
