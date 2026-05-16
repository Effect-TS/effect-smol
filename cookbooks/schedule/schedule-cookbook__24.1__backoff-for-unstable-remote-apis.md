---
book: Effect `Schedule` Cookbook
section_number: "24.1"
section_title: "Backoff for unstable remote APIs"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "24. Exponential Backoff Recipes"
status: "draft"
code_included: true
---

# 24.1 Backoff for unstable remote APIs

Remote APIs often fail for reasons that are real but temporary: a gateway timeout,
a short rate-limit window, a rolling deploy, or an overloaded dependency behind
the endpoint. Retrying immediately can turn those failures into more load. A
backoff schedule gives the dependency time to recover while keeping the retry
contract visible in code.

Use `Schedule.exponential` as the base shape when each failed attempt should wait
longer than the previous one. Then add limits so the policy cannot retry
forever.

## Problem

You submit usage events to a billing API. The request is safe to retry because it
uses an idempotency key, but the remote service sometimes returns retryable HTTP
statuses such as `408`, `429`, or `5xx`.

You want a policy that:

- starts with a short delay
- backs off exponentially
- caps the maximum delay
- stops after a small number of retries or an elapsed budget
- does not retry permanent client errors

## When to use it

Use this recipe for idempotent remote calls where retrying can reasonably
succeed: fetching a report, submitting a deduplicated event, refreshing a token
from a temporarily unavailable identity provider, or calling an internal service
that occasionally returns `503`.

It is especially useful when many callers share the same dependency. The policy
is explicit about the load it can create: at most six retries, over at most
twenty seconds, with delays that grow from the base interval.

## When not to use it

Do not use backoff to mask permanent failures. Bad input, missing credentials,
forbidden access, nonexistent resources, and schema mismatches should fail
without retrying.

Be careful with non-idempotent operations. A retry of `POST /payments` can charge
twice unless the API supports an idempotency key or another deduplication
mechanism. Backoff controls timing; it does not make an unsafe side effect safe.

## Schedule shape

`Schedule.exponential("100 millis")` produces delays that grow by the default
factor of `2`: roughly `100ms`, `200ms`, `400ms`, `800ms`, and so on. The recipe
below adds jitter so a fleet of clients does not retry in lockstep, caps each
computed delay at five seconds, and combines the cadence with both a retry count
and an elapsed-time budget.

The `Schedule.while` guard is applied to the error input that `Effect.retry`
feeds into the schedule. That keeps retryability classification close to the
retry policy instead of retrying every failure blindly.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class RemoteApiError extends Data.TaggedError("RemoteApiError")<{
  readonly status: number
  readonly message: string
}> {}

interface UsageReceipt {
  readonly id: string
}

declare const submitUsageEvent: (request: {
  readonly accountId: string
  readonly units: number
  readonly idempotencyKey: string
}) => Effect.Effect<UsageReceipt, RemoteApiError>

const isRetryable = (error: RemoteApiError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const remoteApiBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(6)),
  Schedule.both(Schedule.during("20 seconds")),
  Schedule.while(({ input }) => isRetryable(input))
)

export const program = submitUsageEvent({
  accountId: "acct_123",
  units: 42,
  idempotencyKey: "usage-acct_123-2024-05-16T10:00"
}).pipe(
  Effect.retry(remoteApiBackoff)
)
```

## Variants

For a user-facing request, shorten the budget and reduce the retry count. A
person waiting on an HTTP response usually needs a clear failure more than a long
retry window.

For a background worker, increase the elapsed budget, keep jitter enabled, and
emit metrics from the retry boundary so operators can see when the dependency is
forcing callers into backoff.

If the remote API returns `Retry-After`, prefer honoring that signal where
appropriate. Exponential backoff is a local policy; server-provided rate-limit
guidance is often more precise.

## Notes and caveats

`Effect.retry` feeds failures into the schedule, so `Schedule.while` receives the
`RemoteApiError` as `input`. If the predicate returns `false`, the schedule stops
and the original failure is returned.

`Schedule.exponential` recurs forever by itself. Always pair it with a limit such
as `Schedule.recurs`, `Schedule.take`, `Schedule.during`, or a domain predicate.

Apply jitter when many processes may retry the same dependency at the same time.
Without it, identical clients that fail together can also retry together.

Backoff is only one part of a remote API safety story. Use timeouts, classify
errors before retrying, keep request bodies replayable, and require idempotency
for operations that mutate remote state.
