---
book: Effect `Schedule` Cookbook
section_number: "37.2"
section_title: "Stop on authorization failures"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "37. Stop on Error Conditions"
status: "draft"
code_included: true
---

# 37.2 Stop on authorization failures

Authorization failures are usually not timing problems. A missing token, expired
session, disabled account, or missing permission will normally fail again until
the caller authenticates differently or an operator changes access. Retrying
those failures only adds latency and load while hiding the error that the caller
needs to act on.

Classify authorization failures before applying the retry schedule. Let the
schedule handle transient failures such as timeouts or temporary unavailability,
and stop immediately when the typed failure says the request is not authorized.

## Problem

You have an operation that can fail with both transient infrastructure errors
and authorization errors. The transient errors should receive a small retry
policy, but authorization failures should be returned immediately.

The schedule should make that distinction visible. A bounded backoff answers
"how often may transient failures be retried?" The authorization predicate
answers "which failures must not be retried at all?"

## When to use it

Use this recipe for authenticated service calls where the error channel
distinguishes transport or dependency failures from authorization failures. It
fits HTTP clients, RPC clients, database access, cloud control-plane calls, and
background workers that use scoped credentials.

This is especially useful when a broad retry policy is already available but
must not be applied blindly. The operation still runs once immediately. The
schedule only decides whether a failed attempt should be followed by another
attempt.

## When not to use it

Do not use a retry schedule to refresh credentials implicitly unless the
operation boundary explicitly includes a safe token-refresh step. If the caller
needs to sign in again, choose a failure path that reports that fact.

Do not treat every `401` or `403` as retryable just because some authentication
systems have eventual consistency. Model that case separately, for example as a
short-lived `CredentialsPropagating` or `PermissionPropagationDelay` error, and
keep ordinary authorization failures non-retryable.

Do not rely on `Schedule.recurs`, `Schedule.take`, or `Schedule.during` to make
authorization retries acceptable. A limit bounds the damage, but the correct
policy is still to stop before retrying the non-retryable failure.

## Schedule shape

With `Effect.retry`, failed values from the effect become inputs to the
schedule. `Schedule.while` receives schedule metadata that includes that input.
When the predicate returns `false`, the schedule stops and the current typed
failure is propagated.

Combine three pieces:

- a delay policy for failures that may recover
- a finite limit so retrying cannot continue forever
- a schedule predicate that stops on authorization failures

Keep the authorization check close to the error model. The schedule should not
guess from strings or status text when the adapter can expose a typed error.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class Timeout extends Data.TaggedError("Timeout")<{
  readonly operation: string
}> {}

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly service: string
}> {}

class Unauthorized extends Data.TaggedError("Unauthorized")<{
  readonly reason: "MissingToken" | "ExpiredToken" | "PermissionDenied"
}> {}

type ApiError = Timeout | ServiceUnavailable | Unauthorized

interface UserProfile {
  readonly id: string
  readonly name: string
}

declare const fetchProfile: Effect.Effect<UserProfile, ApiError>

const isAuthorizationFailure = (error: ApiError): boolean =>
  error._tag === "Unauthorized"

const retryUnlessUnauthorized = Schedule.exponential("200 millis").pipe(
  Schedule.setInputType<ApiError>(),
  Schedule.while(({ input }) => !isAuthorizationFailure(input)),
  Schedule.both(Schedule.recurs(3))
)

export const program = fetchProfile.pipe(
  Effect.retry(retryUnlessUnauthorized)
)
```

`program` runs `fetchProfile` once immediately. If it fails with `Timeout` or
`ServiceUnavailable`, the retry policy waits with exponential backoff while the
three-retry limit still allows another attempt. If it fails with `Unauthorized`,
`Schedule.while` returns `false`, no retry delay is scheduled, and the
`Unauthorized` value is propagated.

The predicate runs before the retry schedule commits to another recurrence.
That is the important part: authorization is classified as non-retryable before
the timing policy is allowed to spend another attempt.

## Variants

If the retryable set is smaller than the non-retryable set, name the predicate
after what may continue:

```ts
const isRetryableApiError = (error: ApiError): boolean => {
  switch (error._tag) {
    case "Timeout":
    case "ServiceUnavailable":
      return true
    case "Unauthorized":
      return false
  }
}

const retryRetryableFailures = Schedule.spaced("500 millis").pipe(
  Schedule.setInputType<ApiError>(),
  Schedule.while(({ input }) => isRetryableApiError(input)),
  Schedule.both(Schedule.recurs(2))
)
```

Use a credential-refresh effect before the protected call when an expired token
can be fixed safely:

```ts
declare const refreshToken: Effect.Effect<void, Unauthorized>

const fetchWithExplicitRefresh = refreshToken.pipe(
  Effect.andThen(fetchProfile),
  Effect.retry(retryUnlessUnauthorized)
)
```

This shape keeps token refresh explicit. If refresh itself fails with
`Unauthorized`, the same retry policy stops immediately instead of repeatedly
calling the protected endpoint with unusable credentials.

## Notes and caveats

`Schedule.while` describes the condition for continuing. In this recipe the
schedule continues while the input is not an authorization failure.

`Schedule.recurs(3)` counts retries after the original attempt. It does not
make an authorization failure retryable; it only limits failures that already
passed the schedule predicate.

Use typed errors for the classification. Status codes such as `401` and `403`
are useful at the adapter boundary, but the application retry policy should see
a domain error that clearly means "the caller is not authorized."

If the operation is an unsafe write, solve idempotency separately. Stopping on
authorization failures prevents one class of bad retries, but it does not make a
non-idempotent operation safe to retry for timeouts or service outages.
