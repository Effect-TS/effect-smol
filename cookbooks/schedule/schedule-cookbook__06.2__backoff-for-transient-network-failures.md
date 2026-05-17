---
book: Effect `Schedule` Cookbook
section_number: "6.2"
section_title: "Backoff for transient network failures"
part_title: "Part II — Core Retry Recipes"
chapter_title: "6. Retry with Exponential Backoff"
status: "draft"
code_included: true
---

# 6.2 Backoff for transient network failures

This recipe applies exponential backoff to retryable network failures from a remote
service call. The schedule controls the growing retry delays, while the surrounding
Effect code remains responsible for filtering typed failures and preserving
idempotency.

## Problem

Remote calls can fail for temporary transport reasons such as connection resets,
timeouts, temporary DNS failures, or gateway errors. You need retries that slow
down after repeated failures so a brief network hiccup does not become extra
pressure on the service or on your own client.

Use exponential backoff for the delay, add a finite retry budget, and filter the
typed failures so only retryable network errors are retried.

```ts
const networkBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

Pass that schedule to `Effect.retry` with a `while` predicate when the effect
can fail with both retryable and non-retryable typed errors.

## When to use it

Use this recipe for idempotent network calls where the same request can safely
be attempted again after a short wait. It fits reads, status checks, reconnect
attempts, and writes protected by an idempotency key.

It is especially useful when failures are caused by the transport or by
temporary gateway behavior rather than by the request itself. A timeout or
connection reset may succeed on a later attempt; an authentication failure or
invalid request usually will not.

Use a finite retry limit with the backoff. Network failures can persist longer
than the caller should wait, and `Schedule.exponential` does not stop on its
own.

## When not to use it

Do not retry errors that describe permanent request problems, such as invalid
input, authentication failure, authorization failure, or a response body that
your client cannot decode. Backoff does not make those errors more likely to
succeed.

Do not retry non-idempotent writes unless the operation has a duplicate-safe
design. If the first request reached the server but the response was lost,
retrying an unsafe write can duplicate external side effects.

Do not treat client-side backoff as a substitute for server-provided retry
guidance. If an API returns a `Retry-After` value or endpoint-specific
rate-limit policy, prefer a policy that honors that contract.

## Schedule shape

`Schedule.exponential("100 millis")` starts with a 100 millisecond delay and,
with the default factor of `2`, doubles the delay after each retry decision:
100 milliseconds, 200 milliseconds, 400 milliseconds, 800 milliseconds, and so
on.

`Schedule.both(Schedule.recurs(5))` adds the retry limit. Both schedules must
continue, so the policy allows at most five retries after the original attempt.
The exponential schedule contributes the growing delay, and `Schedule.recurs(5)`
contributes the stopping condition.

With `Effect.retry`, the original request runs immediately. After each typed
failure:

- if the `while` predicate returns `false`, retrying stops with that error
- if the predicate returns `true` and retries remain, the policy waits using the
  exponential backoff delay
- if the next attempt succeeds, the whole effect succeeds immediately
- if every permitted retry fails, `Effect.retry` propagates the last typed
  failure

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class NetworkFailure extends Data.TaggedError("NetworkFailure")<{
  readonly reason: "ConnectionReset" | "Timeout" | "TemporaryDnsFailure"
}> {}

class HttpFailure extends Data.TaggedError("HttpFailure")<{
  readonly status: number
}> {}

class DecodeFailure extends Data.TaggedError("DecodeFailure")<{
  readonly message: string
}> {}

type FetchUserError = NetworkFailure | HttpFailure | DecodeFailure

interface User {
  readonly id: string
  readonly name: string
}

declare const fetchUser: (id: string) => Effect.Effect<User, FetchUserError>

const isRetryableNetworkFailure = (error: FetchUserError): boolean => {
  switch (error._tag) {
    case "NetworkFailure":
      return true
    case "HttpFailure":
      return error.status === 408 || error.status === 502 || error.status === 504
    case "DecodeFailure":
      return false
  }
}

const networkBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = fetchUser("user-123").pipe(
  Effect.retry({
    schedule: networkBackoff,
    while: isRetryableNetworkFailure
  })
)
```

`program` runs `fetchUser("user-123")` once immediately. If it fails with
`NetworkFailure`, or with one of the selected retryable HTTP status failures,
the policy backs off and tries again.

If the failure is `DecodeFailure`, or an `HttpFailure` with a non-retryable
status, the `while` predicate returns `false` and `Effect.retry` returns that
typed failure without spending the retry budget.

## Variants

If your adapter exposes only retryable network failures in the error channel,
you can use the schedule directly:

```ts
declare const connect: Effect.Effect<void, NetworkFailure>

const program = connect.pipe(
  Effect.retry(networkBackoff)
)
```

For a one-off call site, keep the same shape in the options form and let
`times` provide the retry limit:

```ts
const program = fetchUser("user-123").pipe(
  Effect.retry({
    schedule: Schedule.exponential("100 millis"),
    times: 5,
    while: isRetryableNetworkFailure
  })
)
```

Use a slower base delay when the network call is expensive or when the caller
can tolerate more latency:

```ts
const slowerNetworkBackoff = Schedule.exponential("500 millis", 1.5).pipe(
  Schedule.both(Schedule.recurs(4))
)
```

This starts at 500 milliseconds and grows by 1.5x instead of doubling. It also
uses four retries instead of five.

## Notes and caveats

The first request is not delayed. Backoff begins only after the effect fails
with a typed error.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.

`Schedule.exponential` is unbounded by itself. Pair it with `Schedule.recurs`,
`times`, a deadline, or another stopping condition unless unbounded retry is
intentional.

`times: 5` and `Schedule.recurs(5)` both mean five retries after the original
attempt, not five total executions.

For many concurrent callers, jitter is a useful later refinement so callers do
not all retry on the same exponential intervals.

Keep the retry boundary narrow. Retry the single network operation that is safe
to attempt again, not a larger workflow that may already have performed local
writes, notifications, or other side effects before the network failure was
observed.
