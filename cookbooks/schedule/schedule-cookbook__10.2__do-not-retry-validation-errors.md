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

Retry can handle temporary failures, but it should not hide bad input. Keep
validation failures explicit in the typed error channel and exclude them from
the retry predicate.

## Problem

One operation may fail with transient service errors or permanent request
errors. Retry the transient cases. Return validation and conflict errors
immediately.

## When to use it

Use this for form submission, API clients, command handlers, queue consumers,
and service calls that validate payloads before or during a boundary request.

Use structured typed errors so the retry decision comes from tags and fields,
not from parsing error messages.

## When not to use it

Do not retry invalid input in the hope that it becomes valid. Missing fields,
unsupported enum values, malformed payloads, and domain-rule failures require a
different request.

Do not wrap a large workflow in retry just to handle one transient call. Retry
the smallest idempotent operation that may safely run again.

## Schedule shape

The schedule should still be finite. A common shape is exponential backoff plus
`Schedule.recurs`.

After each typed failure, `while` is checked first. If it returns `false`,
retrying stops with that failure. If it returns `true`, the schedule decides
whether another retry is available and how long to wait.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

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

const isRetryableRegistrationError = (error: RegistrationError): boolean =>
  error._tag === "ServiceUnavailable" || error._tag === "RateLimited"

const retryTransientFailures = Schedule.exponential("50 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

const submitRegistration = (
  input: RegistrationInput
): Effect.Effect<Registration, RegistrationError> => {
  let attempt = 0

  return Effect.gen(function*() {
    attempt += 1
    yield* Console.log(`${input.email}: submit attempt ${attempt}`)

    if (!input.email.includes("@")) {
      return yield* Effect.fail(
        new ValidationError({
          field: "email",
          message: "must contain @"
        })
      )
    }

    if (attempt === 1) {
      return yield* Effect.fail(new ServiceUnavailable({ service: "Accounts" }))
    }

    return { id: `registration-${attempt}`, email: input.email }
  })
}

const runRegistration = (input: RegistrationInput) =>
  submitRegistration(input).pipe(
    Effect.retry({
      schedule: retryTransientFailures,
      while: isRetryableRegistrationError
    }),
    Effect.matchEffect({
      onFailure: (error) => Console.log(`${input.email}: failed with ${error._tag}`),
      onSuccess: (registration) => Console.log(`${input.email}: ${registration.id}`)
    })
  )

const program = Effect.gen(function*() {
  yield* runRegistration({ email: "ada@example.com", plan: "Pro" })
  yield* runRegistration({ email: "not-an-email", plan: "Free" })
})

Effect.runPromise(program)
```

The valid registration retries a temporary account-service failure. The invalid
email fails once with `ValidationError` and does not spend retry budget.

## Variants and caveats

Use `until` when the non-retryable cases are the smaller or clearer set.

Use an effectful predicate only when retryability genuinely depends on an
external policy, such as a feature flag or runtime service. If that predicate
fails, its failure is propagated instead of retrying.

`while` and `until` inspect typed failures after an attempt fails. They do not
inspect successful values, and they do not prevent the original attempt from
running.
