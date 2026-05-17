---
book: Effect `Schedule` Cookbook
section_number: "10.1"
section_title: "Retry only transient failures"
part_title: "Part II — Core Retry Recipes"
chapter_title: "10. Retry Only When It Makes Sense"
status: "draft"
code_included: true
---

# 10.1 Retry only transient failures

Use this recipe when only some typed failures should consume retry budget. The
schedule controls retry timing and limits; an error predicate controls retry
eligibility.

## Problem

Given an operation with mixed failure modes, retry only failures that are likely
to be transient. Timeouts, rate limits, and temporary service outages can be
eligible; invalid input, forbidden access, and unsupported operations should
return immediately.

Put the retry decision in `Effect.retry` with a predicate over the typed error:

```ts
const program = request.pipe(
  Effect.retry({
    schedule: Schedule.spaced("200 millis").pipe(Schedule.both(Schedule.recurs(3))),
    while: isTransientApiError
  })
)
```

This keeps timing and retry limits in the schedule while keeping retry
eligibility in one explicit error predicate.

## When to use it

Use this recipe when an effect has a mixed error channel: some failures are
safe to retry, and others should be returned immediately to the caller. It fits
HTTP clients, database calls, message publishing, cache fills, and dependency
readiness checks where the adapter exposes meaningful typed errors.

The key requirement is that the operation is safe to attempt again for the
selected transient failures. Reads are usually safe. Writes should be retried
only when the external protocol is duplicate-safe, for example through an
idempotency key or a transactional boundary.

Use `while` when the predicate reads as "continue while this error is
transient." Use `until` when the predicate reads as "stop once this
non-transient error is seen."

## When not to use it

Do not classify every operational failure as transient. Authentication errors,
authorization errors, validation failures, unsupported operations, and decode
errors usually need a different handler, not another attempt.

Do not rely on a retry count or time budget to protect permanent failures. A
budget limits damage, but it still spends time and capacity on work that could
have stopped immediately with a precise typed error.

Do not retry a large workflow if only one step is transient. Put the retry
around the smallest effect that can safely run more than once.

## Schedule shape

With `Effect.retry`, the schedule input is the typed failure from the effect.
At the type level, the retry options accept:

```ts
schedule?: Schedule.Schedule<any, E, any, any>
while?: (error: E) => boolean | Effect.Effect<boolean, any, any>
until?: (error: E) => boolean | Effect.Effect<boolean, any, any>
```

Here `E` is the effect's error type. The `while` predicate continues retrying
only when it returns `true`. The `until` predicate is the inverse: retrying
continues while it returns `false` and stops when it returns `true`.

If both a predicate and a finite schedule are present, both must allow another
attempt. In this recipe, `Schedule.spaced("200 millis")` provides the delay and
`Schedule.recurs(3)` provides the count limit. The predicate decides whether
the current typed error is eligible for retry at all.

If a predicate returns an effect, that effect is evaluated during the retry
decision. If the predicate effect fails, that failure is propagated instead of
running another attempt.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class Timeout extends Data.TaggedError("Timeout")<{
  readonly operation: string
}> {}

class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly retryAfterMillis: number
}> {}

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly status: 503 | 504
}> {}

class InvalidRequest extends Data.TaggedError("InvalidRequest")<{
  readonly message: string
}> {}

class Unauthorized extends Data.TaggedError("Unauthorized")<{
  readonly reason: "MissingToken" | "ExpiredToken"
}> {}

type ApiError =
  | Timeout
  | RateLimited
  | ServiceUnavailable
  | InvalidRequest
  | Unauthorized

interface ApiResponse {
  readonly id: string
  readonly status: "accepted"
}

declare const request: Effect.Effect<ApiResponse, ApiError>

const isTransientApiError = (error: ApiError): boolean => {
  switch (error._tag) {
    case "Timeout":
    case "RateLimited":
    case "ServiceUnavailable":
      return true
    case "InvalidRequest":
    case "Unauthorized":
      return false
  }
}

const retryTransientFailures = Schedule.spaced("200 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = request.pipe(
  Effect.retry({
    schedule: retryTransientFailures,
    while: isTransientApiError
  })
)
```

`program` runs `request` once immediately. If it fails with `Timeout`,
`RateLimited`, or `ServiceUnavailable`, retrying continues while the schedule
still has retries available. If it fails with `InvalidRequest` or
`Unauthorized`, retrying stops immediately and that typed error is propagated.

If all permitted retries fail with transient errors, `Effect.retry` propagates
the last typed failure. If any attempt succeeds, the whole effect succeeds with
the `ApiResponse`.

## Variants

Use `until` when the predicate names the stopping condition more clearly:

```ts
const isPermanentApiError = (error: ApiError): boolean =>
  error._tag === "InvalidRequest" || error._tag === "Unauthorized"

const program = request.pipe(
  Effect.retry({
    schedule: retryTransientFailures,
    until: isPermanentApiError
  })
)
```

This retries until a permanent error is observed, or until the schedule is
exhausted first.

Use an inline predicate when the transient set is small and local to one call
site:

```ts
const program = request.pipe(
  Effect.retry({
    times: 2,
    while: (error) => error._tag === "Timeout"
  })
)
```

This retries only timeouts, at most twice after the original attempt.

Use the builder form when the schedule itself needs typed access to the retry
input:

```ts
const program = request.pipe(
  Effect.retry(($) =>
    $(Schedule.spaced("200 millis")).pipe(
      Schedule.while(({ input }) => isTransientApiError(input)),
      Schedule.both(Schedule.recurs(3))
    )
  )
)
```

The builder gives the schedule the effect's error type as its input type, so
`input` is typed as `ApiError` inside `Schedule.while`.

## Notes and caveats

The retry predicate sees typed failures from the error channel. Defects and
fiber interruptions are not retried as typed failures.

`while` describes the condition for continuing. `until` describes the condition
for stopping. They are equivalent only when the predicates are exact opposites;
choose the one that makes the transient/permanent classification obvious.

Without `schedule` or `times`, retry options built only from `while` or `until`
can retry indefinitely while the predicate allows it. Use an explicit limit for
one-shot business operations.

The schedule output is not the business result. `Effect.retry` still returns
the successful value of the retried effect, or the final typed failure if the
policy stops while the effect is still failing.
