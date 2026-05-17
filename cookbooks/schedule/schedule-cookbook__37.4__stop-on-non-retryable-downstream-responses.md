---
book: Effect `Schedule` Cookbook
section_number: "37.4"
section_title: "Stop on non-retryable downstream responses"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "37. Stop on Error Conditions"
status: "draft"
code_included: true
---

# 37.4 Stop on non-retryable downstream responses

A downstream response is not automatically retryable just because it is an
error. Most `4xx` responses say that the request, credentials, authorization,
or target resource is wrong for this caller. Retrying the same request usually
adds load and delays the useful failure.

## Problem

You call an HTTP dependency that can fail with both retryable and
non-retryable responses. You want to retry temporary downstream failures such as
timeouts, `429`, and `5xx`, but stop immediately for permanent responses such
as `400`, `401`, `403`, `404`, or `422`.

The policy should make two decisions explicit:

- which responses are safe to retry
- how long and how often retryable failures are attempted again

## When to use it

Use this recipe for idempotent HTTP calls where a later attempt may succeed
because the dependency recovers, a gateway timeout clears, or a rate-limit
window resets.

It is a good fit when callers need the original non-retryable response. For
example, a `401 Unauthorized` should normally flow back as an authorization
failure, not be hidden behind delayed retries.

## When not to use it

Do not use this policy to retry unsafe non-idempotent writes unless the request
has a duplicate-safe design such as an idempotency key.

Do not retry every `4xx`. Some `4xx` statuses can be transient in specific APIs,
such as `408 Request Timeout`, `409 Conflict`, `425 Too Early`, or `429 Too Many
Requests`, but most client errors should fail fast. Classify according to the
contract of the downstream service, not only by status-code family.

Do not use a retry schedule as a replacement for a rate limiter. A schedule
controls this failed call's next attempt; it does not coordinate all callers
sharing the downstream quota.

## Schedule shape

`Effect.retry` feeds typed failures into the retry policy. In this recipe, the
policy has two parts:

- `Schedule.exponential` controls the delay after retryable failures
- `Schedule.recurs(4)` stops after at most four retries after the original call

The `while` predicate is the response classifier. When it returns `false`,
retrying stops immediately and `Effect.retry` propagates that typed failure.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type DownstreamError =
  | { readonly _tag: "NetworkFailure"; readonly reason: string }
  | {
      readonly _tag: "DownstreamResponse"
      readonly status: number
      readonly body: string
    }

type Customer = {
  readonly id: string
  readonly name: string
}

const statuses = [503, 422] as const
let calls = 0

const fetchCustomer = Effect.gen(function*() {
  calls += 1
  const status = statuses[calls - 1] ?? 200

  yield* Console.log(`HTTP attempt ${calls}: ${status}`)

  if (status === 200) {
    return { id: "customer-1", name: "Ada" } satisfies Customer
  }

  return yield* Effect.fail({
    _tag: "DownstreamResponse",
    status,
    body: status === 503 ? "service unavailable" : "invalid filter"
  } as const)
})

const isRetryableDownstreamError = (error: DownstreamError) => {
  if (error._tag === "NetworkFailure") {
    return true
  }

  const { status } = error

  return status === 408 || status === 429 || status >= 500
}

const downstreamRetrySchedule = Schedule.exponential("20 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

const program = fetchCustomer.pipe(
  Effect.retry({
    schedule: downstreamRetrySchedule,
    while: isRetryableDownstreamError
  }),
  Effect.matchEffect({
    onFailure: (error) =>
      Console.log(
        error._tag === "DownstreamResponse"
          ? `stopped on HTTP ${error.status} after ${calls} calls`
          : `stopped on network failure after ${calls} calls`
      ),
    onSuccess: (customer) => Console.log(`loaded ${customer.name}`)
  })
)

Effect.runPromise(program)
```

The `503` response is retried. The later `422` response is not retryable, so no
additional request is sent and the original typed response is reported.

## Variants

If your API treats only server errors as retryable, keep the classifier to
network failures and `5xx` responses.

If the downstream uses `409 Conflict` for optimistic concurrency that may clear
after a short delay, include `409` explicitly and document that service-specific
contract.

For a user-facing path, combine the retry count with `Schedule.during` so the
caller gets a response within a known elapsed budget.

## Notes and caveats

`Schedule.exponential` and `Schedule.recurs` do not decide whether an HTTP
response is retryable. They only describe timing and count after the retry
boundary has accepted a failure.

Keep the classification close to the HTTP adapter or domain client. The rest of
the application should see typed failures such as `DownstreamResponse`, not raw
transport details scattered through business logic.

`Schedule.recurs(4)` means four retries after the original attempt. If all four
retries fail with retryable errors, `Effect.retry` returns the last typed
failure. If a non-retryable response appears earlier, retrying stops at that
response.
