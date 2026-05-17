---
book: "Effect `Schedule` Cookbook"
section_number: "7.1"
section_title: "Retry only transient failures"
part_title: "Part II — Retry Recipes"
chapter_title: "7. Error-Aware Retries"
status: "draft"
code_included: true
---

# 7.1 Retry only transient failures

Use a retry predicate when only some typed failures should spend retry budget.
The schedule controls timing and limits; the predicate controls eligibility.

## Problem

An operation can fail for temporary reasons and permanent reasons. Retry the
temporary cases, such as timeouts, rate limits, and service unavailability.
Return invalid input, authorization failures, and unsupported operations
immediately.

## When to use it

Use this when the effect has a meaningful typed error channel and only part of
that channel is retryable. It fits HTTP clients, database calls, cache fills,
message publishing, and dependency probes.

The operation must still be safe to run again for the selected failures. Reads
are usually safe. Writes need an idempotency key, transaction boundary, or
another duplicate-safety guarantee.

## When not to use it

Do not classify every operational failure as transient. Authentication,
authorization, validation, decoding, and unsupported-operation errors usually
need a different handler, not another attempt.

Do not retry a large workflow when only one boundary call is transient. Put
`Effect.retry` around the smallest effect that can safely run more than once.

## Schedule shape

With `Effect.retry`, the schedule input is the typed failure from the effect.
The options form accepts `while` and `until` predicates over that same error
type.

`while` means "continue while this predicate is true." `until` means "continue
until this predicate becomes true." If a predicate and a finite schedule are
both present, both must allow another attempt.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

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

const isTransientApiError = (error: ApiError): boolean =>
  error._tag === "Timeout" ||
  error._tag === "RateLimited" ||
  error._tag === "ServiceUnavailable"

const retryTransientFailures = Schedule.spaced("50 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const makeRequest = (
  label: string,
  failures: ReadonlyArray<ApiError>
): Effect.Effect<ApiResponse, ApiError> => {
  let attempt = 0

  return Effect.gen(function*() {
    attempt += 1
    yield* Console.log(`${label}: attempt ${attempt}`)

    const failure = failures[attempt - 1]
    if (failure !== undefined) {
      return yield* Effect.fail(failure)
    }

    return { id: label, status: "accepted" }
  })
}

const runRequest = (
  label: string,
  request: Effect.Effect<ApiResponse, ApiError>
) =>
  request.pipe(
    Effect.retry({
      schedule: retryTransientFailures,
      while: isTransientApiError
    }),
    Effect.matchEffect({
      onFailure: (error) => Console.log(`${label}: failed with ${error._tag}`),
      onSuccess: (response) => Console.log(`${label}: ${response.status}`)
    })
  )

const program = Effect.gen(function*() {
  yield* runRequest(
    "transient",
    makeRequest("transient", [
      new Timeout({ operation: "create-job" }),
      new ServiceUnavailable({ status: 503 })
    ])
  )

  yield* runRequest(
    "permanent",
    makeRequest("permanent", [
      new InvalidRequest({ message: "missing id" })
    ])
  )
})

Effect.runPromise(program)
```

The transient request retries and then succeeds. The permanent request stops
after the first `InvalidRequest`.

## Variants and caveats

Use `until` when the stopping condition is clearer, for example "retry until a
permanent error is observed."

Without `schedule` or `times`, retry options built only from `while` or
`until` can retry indefinitely while the predicate allows it.

The predicate sees typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.
