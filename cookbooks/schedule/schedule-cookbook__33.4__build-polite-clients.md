---
book: Effect `Schedule` Cookbook
section_number: "33.4"
section_title: "Build polite clients"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "33. Respect Rate Limits"
status: "draft"
code_included: true
---

# 33.4 Build polite clients

External dependencies are shared systems. A polite client makes retry spacing,
caps, jitter, and safety assumptions visible in the `Schedule` value.

## Problem

You call an external API that can fail transiently with timeouts, overload, or rate-limit responses. Retrying immediately would make the dependency's bad moment worse, but never retrying would make the client brittle. You need a policy that spaces follow-up attempts, gives up after a clear cap, and avoids synchronized retries across many instances.

The first call still happens normally. The schedule controls only what happens after a retryable failure.

## When to use it

Use this recipe for idempotent reads, status checks, reconnects, and writes protected by an idempotency key. It is especially useful when many processes may call the same dependency, because the schedule documents both per-client behavior and aggregate pressure.

Good polite-client policies answer four questions:

- How long do we wait between retries?
- What is the maximum number of retries or elapsed time?
- Are clients desynchronized with jitter?
- Is the operation safe to perform more than once?

## When not to use it

Do not use a schedule to make an unsafe operation appear safe. Retrying a non-idempotent write can create duplicate payments, duplicate emails, duplicate orders, or repeated mutations in another system. Add an idempotency key, use a status lookup, or move the work behind a queue before applying retry.

Also avoid this recipe for validation errors, malformed requests, permission failures, and other permanent failures. Classify those before `Effect.retry` sees them.

## Schedule shape

A practical default is exponential backoff, a retry cap, and jitter:

- `Schedule.exponential("200 millis")` increases spacing after each retryable failure.
- `Schedule.recurs(5)` caps the number of retries.
- `Schedule.both` keeps both policies active and stops when either one stops.
- `Schedule.jittered` adjusts each delay to roughly 80-120% of the computed delay so a fleet does not retry in lockstep.

Use `Schedule.spaced` instead of exponential backoff when the dependency asks for a steady cadence, such as polling every few seconds. Use `Schedule.during` when the important cap is elapsed time rather than attempt count.

## Code

```ts
import { Effect, Schedule } from "effect"

type RetryableHttpError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "Unavailable" }
  | { readonly _tag: "RateLimited" }

declare const fetchAccount: Effect.Effect<string, RetryableHttpError>

const politeRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.both(Schedule.recurs(5)),
  Schedule.jittered
)

export const getAccount = Effect.retry(fetchAccount, politeRetryPolicy)
```

For a write, make idempotency part of the operation before attaching the same kind of retry policy:

```ts
import { Effect, Schedule } from "effect"

type RetryableHttpError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "Unavailable" }
  | { readonly _tag: "RateLimited" }

type ChargeId = string

declare const createCharge: (
  idempotencyKey: string
) => Effect.Effect<ChargeId, RetryableHttpError>

const politeWriteRetryPolicy = Schedule.exponential("500 millis").pipe(
  Schedule.both(Schedule.recurs(4)),
  Schedule.jittered
)

export const chargeOnce = (idempotencyKey: string) =>
  Effect.retry(createCharge(idempotencyKey), politeWriteRetryPolicy)
```

## Variants

- For user-facing calls, keep the cap small so callers receive a clear failure quickly.
- For background work, prefer a longer base delay and a stricter aggregate budget.
- For APIs that publish explicit rate-limit reset times, derive the delay from the response metadata instead of guessing.
- For steady polling, use `Schedule.spaced("5 seconds")` with `Schedule.jittered` if many clients poll the same service.

## Notes and caveats

`Effect.retry` feeds failures into the schedule, so classify errors before retrying. A timeout, a 503, or a rate-limit response may be retryable; a 400 or an authorization failure usually is not.

Jitter reduces synchronized load, but it also makes exact timing less predictable in logs and tests. Keep the base policy understandable before adding jitter, then add `Schedule.jittered` at the edge where many clients might otherwise move together.

The schedule controls recurrence. It does not provide rate limiting across processes, enforce provider quotas, or make side effects idempotent. Use it alongside client-side concurrency limits, provider-specific rate-limit handling, and idempotency keys.
