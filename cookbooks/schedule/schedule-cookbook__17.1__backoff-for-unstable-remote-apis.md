---
book: "Effect `Schedule` Cookbook"
section_number: "17.1"
section_title: "Backoff for unstable remote APIs"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "17. Operational Backoff Recipes"
status: "draft"
code_included: true
---

# 17.1 Backoff for unstable remote APIs

Remote APIs can fail for temporary reasons: gateway timeouts, short rate-limit
windows, deploys, or overloaded dependencies behind the endpoint. A bounded
exponential backoff gives the service time to recover while keeping retry load
explicit.

## Problem

You submit usage events to a billing API. The request is safe to retry because
it uses an idempotency key, but the API sometimes returns retryable statuses
such as `408`, `429`, or `5xx`.

The policy should start with a short delay, grow exponentially, cap long waits,
stop after a small budget, and avoid retrying permanent client errors.

## When to use it

Use this for idempotent remote calls: fetching a report, submitting a
deduplicated event, refreshing a token from a temporarily unavailable identity
provider, or calling an internal service that occasionally returns `503`.

It is useful when many callers share the dependency because the retry count,
elapsed budget, cap, and jitter are visible in one schedule.

## When not to use it

Do not retry bad input, missing credentials, forbidden access, nonexistent
resources, or schema mismatches. Be careful with non-idempotent operations:
backoff controls timing, not duplicate side effects.

## Schedule shape

`Schedule.exponential("100 millis")` produces delays that grow by the default
factor of `2`. Add `Schedule.jittered` when many clients may fail together. Use
`Schedule.modifyDelay` with `Duration.min` to cap each delay, then combine the
cadence with `Schedule.recurs` and `Schedule.during` for count and time bounds.

Use the `while` option on `Effect.retry` to classify retryable errors.

## Example

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class RemoteApiError extends Data.TaggedError("RemoteApiError")<{
  readonly status: number
  readonly message: string
}> {}

interface UsageReceipt {
  readonly id: string
}

interface UsageRequest {
  readonly accountId: string
  readonly units: number
  readonly idempotencyKey: string
}

const statuses = [503, 429, 200] as const
let attempts = 0

const submitUsageEvent = (request: UsageRequest) =>
  Effect.gen(function*() {
    attempts += 1
    const status = statuses[Math.min(attempts - 1, statuses.length - 1)]
    yield* Console.log(`billing attempt ${attempts}: HTTP ${status}`)

    if (status !== 200) {
      return yield* Effect.fail(
        new RemoteApiError({ status, message: "temporary billing failure" })
      )
    }

    return {
      id: `receipt-${request.idempotencyKey}`
    } satisfies UsageReceipt
  })

const isRetryable = (error: RemoteApiError) =>
  error.status === 408 || error.status === 429 || error.status >= 500

const remoteApiBackoff = Schedule.exponential("20 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(80)))
  ),
  Schedule.both(Schedule.recurs(4)),
  Schedule.both(Schedule.during("1 second"))
)

const program = Effect.gen(function*() {
  const receipt = yield* submitUsageEvent({
    accountId: "acct_123",
    units: 42,
    idempotencyKey: "usage-acct_123-demo"
  }).pipe(
    Effect.retry({
      schedule: remoteApiBackoff,
      while: isRetryable
    })
  )
  yield* Console.log(`accepted usage event: ${receipt.id}`)
}).pipe(
  Effect.catch((error) =>
    Console.log(`usage event failed without retrying further: ${error._tag}`)
  )
)

Effect.runPromise(program)
```

The example uses millisecond-scale delays so it is quick to run. Increase the
base, cap, and budget for a real remote API.

## Variants

For a user-facing request, shorten the elapsed budget and retry count. For a
background worker, keep jitter enabled and emit metrics at the retry boundary so
operators can see when the dependency is forcing callers into backoff.

If the API returns `Retry-After`, prefer that server-provided timing for rate
limits. Exponential backoff is a local fallback when the remote service gives no
better signal.

## Notes and caveats

`Schedule.exponential` recurs forever by itself. Always pair it with a count
limit, elapsed budget, or domain predicate.

Backoff is only one part of remote API safety. Use timeouts, classify errors,
keep request bodies replayable, and require idempotency for mutating calls.
