---
book: Effect `Schedule` Cookbook
section_number: "44.3"
section_title: "Retry token refresh briefly"
part_title: "Part X — Real-World Recipes"
chapter_title: "44. Frontend and Client Recipes"
status: "draft"
code_included: true
---

# 44.3 Retry token refresh briefly

Refreshing an access token sits on a user-facing path: the caller is usually
waiting to continue an API request, render a page, or keep a session alive. A
short retry can smooth over a dropped connection or temporary auth-service
blip, but a long retry can make the application feel frozen and can create
extra pressure on the same service that is already struggling.

The policy should therefore be narrow: retry only transient refresh failures,
wait for a very small backoff, and stop quickly.

## Problem

An access token has expired and the client needs to exchange a refresh token
for a new access token. The refresh call can fail because the network timed out,
because the auth service returned a temporary `503`, or because the refresh
token is invalid, expired, revoked, or already rotated.

Only the transient cases should be retried. Authentication failures must fail
fast so the client can sign the user out, ask for re-authentication, or follow
your product's session-recovery path.

Use `Effect.retry` with a typed `while` predicate and a small finite `Schedule`.

## When to use it

Use this recipe when token refresh is safe to attempt again and the caller can
tolerate a brief delay. It fits browser clients, mobile clients, and API
gateways that refresh credentials immediately before retrying the original
request.

The refresh operation should have a clear error model. A specific
`RefreshTimeout` or `RefreshServiceUnavailable` tag is better than retrying every
failure from a generic HTTP client.

## When not to use it

Do not retry `invalid_grant`, revoked-token, expired-token, malformed-request,
or client-authentication failures. Those are not made valid by waiting another
hundred milliseconds.

Do not use a long backoff on an interactive token refresh path. If refresh is
still failing after a brief retry window, return control to the caller and let
the application decide whether to show an error, redirect to login, or continue
offline.

Be careful with refresh-token rotation. If your identity provider treats a
duplicate refresh request as token reuse, retry only failures that are safe for
your provider, or use the provider's idempotency mechanism if it offers one.

## Schedule shape

Start with a small exponential delay and bound it by both retry count and
elapsed time:

```ts
const retryTokenRefreshBriefly = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(2)),
  Schedule.both(Schedule.during("1 second"))
)
```

`Schedule.exponential("100 millis")` chooses the next delay after an accepted
failure. `Schedule.jittered` randomizes each delay between 80% and 120% of the
base delay so many clients do not retry at exactly the same moment.

`Schedule.recurs(2)` allows at most two retries after the original refresh
attempt. `Schedule.during("1 second")` adds a short elapsed-time budget. Because
`Schedule.both` continues only while both schedules continue, the retry stops as
soon as either the retry count or the time budget is exhausted.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

interface Tokens {
  readonly accessToken: string
  readonly refreshToken: string
}

class RefreshTimeout extends Data.TaggedError("RefreshTimeout")<{
  readonly endpoint: string
}> {}

class RefreshServiceUnavailable extends Data.TaggedError("RefreshServiceUnavailable")<{
  readonly endpoint: string
}> {}

class RefreshRejected extends Data.TaggedError("RefreshRejected")<{
  readonly reason: "invalid_grant" | "revoked" | "expired"
}> {}

type RefreshError =
  | RefreshTimeout
  | RefreshServiceUnavailable
  | RefreshRejected

declare const postRefreshToken: (
  refreshToken: string
) => Effect.Effect<Tokens, RefreshError>

const isTransientRefreshFailure = (
  error: RefreshError
): error is RefreshTimeout | RefreshServiceUnavailable =>
  error._tag === "RefreshTimeout" ||
  error._tag === "RefreshServiceUnavailable"

const retryTokenRefreshBriefly = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(2)),
  Schedule.both(Schedule.during("1 second"))
)

export const refreshSession = (refreshToken: string) =>
  postRefreshToken(refreshToken).pipe(
    Effect.retry({
      schedule: retryTokenRefreshBriefly,
      while: isTransientRefreshFailure
    })
  )
```

`refreshSession` sends the refresh request once immediately. If the request
fails with `RefreshTimeout` or `RefreshServiceUnavailable`, `Effect.retry`
consults the schedule before trying again.

If the provider rejects the token with `RefreshRejected`, the predicate returns
`false`, so the failure is returned without another refresh request.

## Variants

For a very latency-sensitive path, retry once and use a smaller budget:

```ts
const retryTokenRefreshOnce = Schedule.exponential("50 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(1)),
  Schedule.both(Schedule.during("250 millis"))
)
```

For a backend-for-frontend or gateway where refresh does not block direct UI
interaction, you can allow a little more time while still keeping the policy
bounded:

```ts
const gatewayTokenRefreshRetry = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3)),
  Schedule.both(Schedule.during("2 seconds"))
)
```

Keep the classification predicate separate from the schedule. The predicate
answers whether the failure is retryable; the schedule answers how brief and how
paced the retry window is.

## Notes and caveats

`Effect.retry` retries typed failures from the effect's error channel. Defects
and interruptions are not turned into retryable token-refresh failures by the
schedule.

The first refresh attempt is not delayed. Delays apply only after a failure has
been accepted by the `while` predicate.

`Schedule.recurs(2)` means two retries after the original attempt, not two total
attempts. With the policy above, the client can make up to three refresh
requests total.

Token refresh is security-sensitive. Keep retry brief, classify permanent
authentication failures explicitly, and verify the retry behavior against your
identity provider's refresh-token rotation rules.
