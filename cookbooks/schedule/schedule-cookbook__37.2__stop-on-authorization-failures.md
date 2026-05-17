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
the caller authenticates differently or access changes.

## Problem

An authenticated operation can fail with transient infrastructure errors or an
authorization error from the protected resource. The retry policy should handle
timeouts and temporary unavailability, but return authorization failures
immediately.

Keep that distinction visible: the schedule controls how transient failures are
retried, and the predicate decides which failures must not be retried.

## When to use it

Use this recipe for authenticated service calls where the error channel
distinguishes transport or dependency failures from authorization failures. It
fits HTTP clients, RPC clients, database access, cloud control-plane calls, and
background workers that use scoped credentials.

This is especially useful when a broad retry policy is already available but
must not be applied blindly. The operation still runs once immediately. The
schedule is consulted only after a typed failure.

## When not to use it

Do not use a retry schedule to refresh credentials implicitly unless the
operation boundary explicitly includes a safe token-refresh step. If the caller
needs to sign in again, choose a failure path that reports that fact.

Do not treat every `401` or `403` as retryable just because some authentication
systems have eventual consistency. Model that case separately, for example as a
short-lived `CredentialsPropagating` or `PermissionPropagationDelay` error, and
keep ordinary authorization failures non-retryable.

Do not rely on `Schedule.recurs`, `Schedule.take`, or `Schedule.during` to make
authorization retries acceptable. A limit bounds repeated work, but the correct
policy is to stop before retrying the non-retryable failure.

## Schedule shape

Use `Effect.retry({ schedule, while })` so the authorization check is applied
before another retry is scheduled. The `while` predicate receives the typed
failure. Returning `false` stops retrying and propagates that failure.

Combine three pieces:

- a delay policy for failures that may recover
- a finite limit so retrying cannot continue forever
- a predicate that rejects authorization failures

Keep the authorization check close to the error model. The schedule should not
guess from strings or status text when the adapter can expose a typed error.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

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

type UserProfile = {
  readonly id: string
  readonly name: string
}

let attempts = 0

const fetchProfile = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`profile attempt ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail(new Timeout({ operation: "fetchProfile" }))
  }
  if (attempts === 2) {
    return yield* Effect.fail(new ServiceUnavailable({ service: "profiles" }))
  }
  if (attempts === 3) {
    return yield* Effect.fail(new Unauthorized({ reason: "ExpiredToken" }))
  }

  return { id: "user-1", name: "Ada" } satisfies UserProfile
})

const retryUnlessUnauthorized = Schedule.exponential("20 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = fetchProfile.pipe(
  Effect.retry({
    schedule: retryUnlessUnauthorized,
    while: (error: ApiError) => error._tag !== "Unauthorized"
  }),
  Effect.matchEffect({
    onFailure: (error) =>
      Console.log(`stopped on ${error._tag} after ${attempts} attempts`),
    onSuccess: (profile) => Console.log(`loaded ${profile.name}`)
  })
)

Effect.runPromise(program)
```

`fetchProfile` runs once immediately. The timeout and service outage are
retried. The expired token is not retried, so the program stops after three
attempts and reports the authorization failure.

## Variants

If the retryable set is smaller than the non-retryable set, name the predicate
after what may continue, such as `isRetryableApiError`, instead of after the
thing that stops.

Use an explicit credential-refresh effect before the protected call when an
expired token can be fixed safely. If refresh itself fails with an authorization
error, the same retry predicate should stop immediately instead of repeatedly
calling the protected endpoint with unusable credentials.

For short-lived permission propagation, model a separate retryable error such
as `PermissionPropagationDelay`. Do not reuse `Unauthorized` for both permanent
and temporary authorization states.

## Notes and caveats

`Effect.retry({ while })` describes the condition for continuing. In this
recipe, retrying continues only while the failure is not an authorization
failure.

`Schedule.recurs(3)` counts retries after the original attempt. It does not
make an authorization failure retryable; it only limits failures that already
passed the predicate.

Use typed errors for the classification. Status codes such as `401` and `403`
are useful at the adapter boundary, but the application retry policy should see
a domain error that clearly means "the caller is not authorized."

If the operation is an unsafe write, solve idempotency separately. Stopping on
authorization failures prevents one class of bad retries, but it does not make a
non-idempotent operation safe to retry for timeouts or service outages.
