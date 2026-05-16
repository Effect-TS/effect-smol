---
book: Effect `Schedule` Cookbook
section_number: "30.4"
section_title: "Slow down retries against a struggling service"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "30. Space Requests Intentionally"
status: "draft"
code_included: true
---

# 30.4 Slow down retries against a struggling service

When a dependency is already struggling, fast retries are not neutral. They can
turn a temporary overload into a larger incident by sending the same work back
to the service before it has recovered.

Use a backoff schedule when retrying might help, but each retry should apply less
pressure than the previous one. The delay is not just waiting for success. It is
load protection for the service you are calling.

## Problem

You call a catalog service from a worker. The service is safe to retry because
the request is read-only, but it sometimes fails with a retryable overload
signal while a deploy, cache warmup, or database incident is in progress.

You want retries that:

- start soon enough to recover from short transient failures
- slow down as failures continue
- stop after a bounded number of retries or elapsed time
- retry overload and temporary network failures only
- avoid synchronized retry waves from many workers

## When to use it

Use this recipe for idempotent calls to a dependency that may be overloaded:
internal HTTP APIs, database-backed search services, metadata services, feature
flag services, or cache fill paths.

It is especially useful when many callers share the same downstream service.
Backoff makes the client behave more gently under stress: each failed attempt
pushes the next attempt farther away, and jitter prevents every worker from
retrying at the same instant.

## When not to use it

Do not use backoff for permanent failures such as bad input, missing
authorization, unsupported resources, or schema errors. Classify those failures
before retrying.

Also avoid retrying unsafe mutations unless the operation is explicitly
idempotent. Backoff changes timing; it does not make duplicate side effects safe.

## Schedule shape

`Schedule.exponential("200 millis")` starts with a `200ms` delay and doubles by
default: `200ms`, `400ms`, `800ms`, and so on. That increasing delay gives the
struggling service more recovery time after each failed attempt.

The policy below adds `Schedule.jittered` so a fleet of workers does not retry in
lockstep, caps each delay at five seconds, and combines the cadence with both a
retry-count limit and an elapsed-time budget. The `Schedule.while` predicate
looks at the error input that `Effect.retry` feeds into the schedule, so only
retryable overload-style failures continue.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

class CatalogServiceError extends Data.TaggedError("CatalogServiceError")<{
  readonly reason: "Overloaded" | "Unavailable" | "InvalidProductId"
  readonly message: string
}> {}

interface ProductSnapshot {
  readonly id: string
  readonly available: boolean
}

declare const overloadedCatalogService: {
  readonly getProduct: (
    productId: string
  ) => Effect.Effect<ProductSnapshot, CatalogServiceError>
}

const isRetryable = (error: CatalogServiceError) =>
  error.reason === "Overloaded" || error.reason === "Unavailable"

const slowDownRetries = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  ),
  Schedule.both(Schedule.recurs(6)),
  Schedule.both(Schedule.during("20 seconds")),
  Schedule.while(({ input }) => isRetryable(input))
)

export const program = overloadedCatalogService.getProduct("sku-123").pipe(
  Effect.retry(slowDownRetries)
)
```

## Variants

For user-facing requests, use fewer retries and a shorter elapsed budget. A
caller waiting on a response often needs a clear failure faster than a worker
does.

For background workers, keep the backoff and jitter, but consider a larger
budget if the work is durable and can wait. Pair the retry policy with metrics so
operators can see when the service is forcing callers into slower retry lanes.

If the service returns an explicit retry hint such as `Retry-After`, prefer that
signal when it is trustworthy. Exponential backoff is a local protection policy;
server-provided guidance can be more precise.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. In this recipe,
`Schedule.while` receives each `CatalogServiceError` as `input` and stops when
the error is not retryable.

`Schedule.exponential` recurs forever on its own. Always combine it with limits
such as `Schedule.recurs`, `Schedule.during`, `Schedule.take`, or a domain
predicate.

The cap in `Schedule.modifyDelay` prevents very long sleeps after repeated
failures. The cap should reflect the caller's tolerance for waiting and the
downstream service's recovery profile.
