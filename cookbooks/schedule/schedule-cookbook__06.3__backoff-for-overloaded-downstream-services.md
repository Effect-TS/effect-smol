---
book: Effect `Schedule` Cookbook
section_number: "6.3"
section_title: "Backoff for overloaded downstream services"
part_title: "Part II — Core Retry Recipes"
chapter_title: "6. Retry with Exponential Backoff"
status: "draft"
code_included: true
---

# 6.3 Backoff for overloaded downstream services

A downstream service is telling you it is under pressure: it returns overload errors,
rejects requests, or fails because a connection pool is saturated. Retrying immediately
keeps the pressure high. This recipe keeps the retry policy explicit: the schedule
decides when another typed failure should be attempted again and where retrying stops.
The surrounding Effect code remains responsible for domain safety, including which
failures are transient, whether the operation is idempotent, and how the final failure
is reported.

## Problem

A downstream service is telling you it is under pressure: it returns overload
errors, rejects requests, or fails because a connection pool is saturated.
Retrying immediately keeps the pressure high. Retrying with a small constant
delay can still send a steady stream of work into a dependency that needs room
to recover.

Use `Schedule.exponential(base)` with `Effect.retry` when each consecutive
failure should make the next retry wait longer. Bound the policy with
`Schedule.recurs` so one call does not keep retrying forever.

## When to use it

Use this recipe when the failure is a typed, retryable overload signal from a
remote dependency. Common examples include `503 Service Unavailable`, `429 Too
Many Requests`, temporary queue saturation, and short-lived connection pool
exhaustion.

It fits idempotent reads, idempotent writes, and requests that are safe to
attempt again after the downstream has had more time to recover.

The intent is to reduce load from this caller as failures repeat. Each failed
attempt waits longer before contributing more traffic to the dependency.

## When not to use it

Do not use backoff to hide a permanent failure such as invalid input, missing
authorization, or a request shape the downstream will never accept. Those should
fail fast or be handled by domain logic.

Do not retry non-idempotent work unless the operation has a duplicate-safe
design, such as an idempotency key or a downstream de-duplication mechanism.

Do not treat per-request backoff as the whole overload strategy for a busy
client. If many fibers can call the same service concurrently, also consider
bulkheads, rate limits, queues, or other admission control around the call site.

## Schedule shape

`Schedule.exponential(base)` is an unbounded schedule. With the default factor
of `2`, it produces delays according to `base * 2 ** (n)`, where `n` starts at
`0` for the first retry decision.

For `Schedule.exponential("100 millis")`, the retry delays are:

- first retry: wait 100 milliseconds
- second retry: wait 200 milliseconds
- third retry: wait 400 milliseconds
- fourth retry: wait 800 milliseconds
- fifth retry: wait 1600 milliseconds

With `Effect.retry`, the original effect runs once immediately. If it fails
with a typed error, that error is fed to the schedule. If the schedule
continues, the effect is retried after the schedule's delay. If any attempt
succeeds, the whole effect succeeds with that value.

Combine the exponential schedule with `Schedule.recurs(5)` when you want at
most five retries after the original attempt:

```ts
const overloadBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

`Schedule.both` continues only while both schedules continue. The exponential
schedule contributes the growing delay, and `Schedule.recurs(5)` contributes
the retry limit.

## Code

```ts
import { Data, Effect, Ref, Schedule } from "effect"

class DownstreamOverloaded extends Data.TaggedError("DownstreamOverloaded")<{
  readonly service: string
  readonly attempt: number
}> {}

const callInventory = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)

  if (attempt < 4) {
    return yield* Effect.fail(
      new DownstreamOverloaded({ service: "inventory", attempt })
    )
  }

  return { sku: "sku-123", available: true }
})

const overloadBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  return yield* callInventory(attempts).pipe(
    Effect.retry(overloadBackoff)
  )
})
```

The first call to `callInventory` runs immediately. Attempts 1, 2, and 3 fail
with `DownstreamOverloaded`, so the policy waits 100 milliseconds, then 200
milliseconds, then 400 milliseconds before retrying. Attempt 4 succeeds, so
`program` succeeds with the inventory result.

If the downstream kept returning `DownstreamOverloaded`, the policy would allow
at most five retries after the original attempt. Once `Schedule.recurs(5)` is
exhausted, `Effect.retry` propagates the last typed failure.

## Variants

For a local policy that does not need a separate name, use retry options:

```ts
const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  return yield* callInventory(attempts).pipe(
    Effect.retry({
      schedule: Schedule.exponential("100 millis"),
      times: 5
    })
  )
})
```

`times: 5` has the same retry-count meaning as `Schedule.recurs(5)`: five
retries after the original attempt.

Use a smaller factor when the downstream should get more room than a fixed delay
provides, but doubling is too aggressive for the user-facing latency budget:

```ts
const gentlerBackoff = Schedule.exponential("200 millis", 1.5).pipe(
  Schedule.both(Schedule.recurs(5))
)
```

When the effect can fail with both retryable and non-retryable typed errors,
add a predicate at the retry boundary:

```ts
type DownstreamError =
  | DownstreamOverloaded
  | { readonly _tag: "BadRequest"; readonly message: string }

declare const request: Effect.Effect<
  { readonly sku: string; readonly available: boolean },
  DownstreamError
>

const program = request.pipe(
  Effect.retry({
    schedule: overloadBackoff,
    while: (error) => error._tag === "DownstreamOverloaded"
  })
)
```

The schedule still controls timing and count. The predicate prevents retrying
failures that are not overload signals.

## Notes and caveats

The first attempt is not delayed. Backoff only affects retries after typed
failures.

`Schedule.exponential` is unbounded by itself. Always add a count limit,
deadline, predicate, or another stopping condition unless unbounded retry is
intentional and externally supervised.

Keep the retried effect narrow. Retry the downstream request itself, not a
larger workflow that may have already performed side effects before the
overload error was observed.

This recipe focuses on the basic backoff shape. In high fan-out clients, add a
cap and jitter so many callers do not retry at the same growing intervals.
