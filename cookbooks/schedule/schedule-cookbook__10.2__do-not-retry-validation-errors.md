---
book: Effect `Schedule` Cookbook
section_number: "10.2"
section_title: "Do not retry validation errors"
part_title: "Part II — Core Retry Recipes"
chapter_title: "10. Retry Only When It Makes Sense"
status: "draft"
code_included: true
---

# 10.2 Do not retry validation errors

Use this recipe to let retry handle temporary failures without hiding permanent
request problems. The schedule defines the retry budget; a predicate keeps
validation failures out of that budget.

## Problem

Model transient cases and validation cases in the typed error channel, then use
`Effect.retry` with a predicate that accepts only retryable failures:

```ts
const program = submitRegistration(input).pipe(
  Effect.retry({
    schedule: retryTransientFailures,
    while: isRetryableRegistrationError
  })
)
```

The schedule controls when and how long retrying may continue. The predicate
controls which typed failures are eligible for retry at all.

## When to use it

Use this recipe when one operation can fail with both transient failures and
client-side or validation failures. Common examples include form submission,
API clients, command handlers, queue consumers that validate payloads, and
service calls that distinguish bad requests from temporary downstream
problems.

It is especially useful when the retry policy already has a good delay shape,
such as exponential backoff, but should not spend that retry budget on errors
that waiting cannot fix.

Use tagged errors or another precise typed error model so the predicate can
make the decision from structured data instead of from error messages.

## When not to use it

Do not use retry to make invalid input eventually valid. If the request is
missing a required field, has an unsupported enum value, or violates a domain
rule, fail fast and return the validation failure to the caller.

Do not retry authentication, authorization, tenant, or malformed-request
failures unless your domain has a specific reason to treat them as temporary.
Most of these failures require a different request, different credentials, or
an operator fix.

Do not put `Effect.retry` around a large workflow just to filter one call's
errors. Retry the smallest idempotent operation that may transiently fail, so a
validation failure does not cause already-completed work to run again.

## Schedule shape

The retry schedule should still be finite. A common shape is exponential
backoff plus a retry limit:

```ts
const retryTransientFailures = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)
```

`Schedule.exponential("100 millis")` supplies the delay between retry attempts.
`Schedule.recurs(4)` limits the policy to four retries after the original
attempt. `Schedule.both` requires both schedules to continue, so the combined
policy stops when the retry count is exhausted.

With `Effect.retry`, the original effect runs immediately. After each typed
failure:

- if the `while` predicate returns `false`, retrying stops with that failure
- if the `while` predicate returns `true`, the schedule decides whether another
  retry is still available
- if the schedule is exhausted, the last typed failure is propagated
- if a later attempt succeeds, the whole effect succeeds immediately

Use `until` when the predicate is easier to write as a stopping condition. This
is equivalent in intent:

```ts
const program = submitRegistration(input).pipe(
  Effect.retry({
    schedule: retryTransientFailures,
    until: isNonRetryableRegistrationError
  })
)
```

In the options form, `while` means "retry while this predicate is true."
`until` means "retry until this predicate becomes true."

## Code

```ts
import { Data, Effect, Schedule } from "effect"

interface RegistrationInput {
  readonly email: string
  readonly plan: "Free" | "Pro"
}

interface Registration {
  readonly id: string
  readonly email: string
}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
}> {}

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly service: "Accounts" | "Billing"
}> {}

class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly retryAfterMillis: number
}> {}

class ConflictError extends Data.TaggedError("ConflictError")<{
  readonly resource: "Email"
}> {}

type RegistrationError =
  | ValidationError
  | ServiceUnavailable
  | RateLimited
  | ConflictError

declare const submitRegistration: (
  input: RegistrationInput
) => Effect.Effect<Registration, RegistrationError>

const isRetryableRegistrationError = (error: RegistrationError): boolean => {
  switch (error._tag) {
    case "ServiceUnavailable":
    case "RateLimited":
      return true
    case "ValidationError":
    case "ConflictError":
      return false
  }
}

const retryTransientFailures = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

const input: RegistrationInput = {
  email: "ada@example.com",
  plan: "Pro"
}

const program = submitRegistration(input).pipe(
  Effect.retry({
    schedule: retryTransientFailures,
    while: isRetryableRegistrationError
  })
)
```

`program` submits the registration once immediately. If the attempt fails with
`ServiceUnavailable` or `RateLimited`, it retries with exponential backoff for
up to four retries.

If the attempt fails with `ValidationError`, retrying stops immediately and the
validation error is returned. The same is true for `ConflictError`: trying the
same request again is unlikely to change the fact that the email is already in
use.

## Variants

Use `until` when the non-retryable cases are the smaller or clearer set:

```ts
const isNonRetryableRegistrationError = (
  error: RegistrationError
): boolean => {
  switch (error._tag) {
    case "ValidationError":
    case "ConflictError":
      return true
    case "ServiceUnavailable":
    case "RateLimited":
      return false
  }
}

const program = submitRegistration(input).pipe(
  Effect.retry({
    schedule: retryTransientFailures,
    until: isNonRetryableRegistrationError
  })
)
```

Use the `times` option for a local count limit when you do not need to reuse the
schedule:

```ts
const program = submitRegistration(input).pipe(
  Effect.retry({
    schedule: Schedule.exponential("100 millis"),
    times: 4,
    while: isRetryableRegistrationError
  })
)
```

Use an effectful predicate when retryability depends on a service, feature
flag, or operational policy:

```ts
declare const shouldRetryRegistrationError: (
  error: RegistrationError
) => Effect.Effect<boolean>

const program = submitRegistration(input).pipe(
  Effect.retry({
    schedule: retryTransientFailures,
    while: shouldRetryRegistrationError
  })
)
```

If the predicate effect fails, that failure is propagated instead of retrying.
Use this shape only when the retry decision genuinely needs effectful work.

## Notes and caveats

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.

The first attempt always runs. A `while` predicate that returns `false` for the
first failure prevents the second attempt; it does not prevent the original
effect from running.

`while` and `until` inspect the typed failure after an attempt fails. They do
not inspect successful values.

Keep validation failures precise. A broad `HttpError` with only a status code
can work, but a domain-specific `ValidationError` is usually clearer at the
retry boundary.

Avoid spending retry budgets on failures that require a different request.
Invalid input, malformed payloads, missing permissions, and duplicate resource
conflicts should normally fail fast so callers can correct the cause.
