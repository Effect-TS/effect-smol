---
book: "Effect `Schedule` Cookbook"
section_number: "5.3"
section_title: "Backoff for overloaded downstream services"
part_title: "Part II — Retry Recipes"
chapter_title: "5. Exponential and Capped Backoff"
status: "draft"
code_included: true
---

# 5.3 Backoff for overloaded downstream services

When a dependency reports overload, each failed retry should reduce this
caller's pressure on that dependency. Exponential backoff gives that behavior
for one call site.

## Problem

A downstream service may return overload errors, reject requests, or fail
because a pool is saturated. Retrying at a fixed rate keeps adding traffic
while the dependency is least able to handle it.

## When to use it

Use this when the failure is a typed retryable overload signal, such as `503
Service Unavailable`, `429 Too Many Requests`, queue saturation, or short-lived
connection pool exhaustion.

The retried operation must be idempotent or otherwise duplicate-safe.

## When not to use it

Do not use backoff to hide permanent failures such as invalid input, missing
authorization, or a request shape the downstream will never accept.

Do not treat per-request backoff as the whole overload strategy for a busy
client. If many fibers can call the same service concurrently, also consider
admission control such as queues, rate limits, or concurrency limits.

## Schedule shape

`Schedule.exponential("100 millis")` yields retry delays of 100 milliseconds,
200 milliseconds, 400 milliseconds, 800 milliseconds, and so on. Combining it
with `Schedule.recurs(5)` permits at most five retries after the original
attempt.

`Schedule.both` requires both schedules to continue. The exponential schedule
contributes the growing delay, and the recurrence schedule contributes the
limit.

## Code

```ts
import { Console, Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class DownstreamOverloaded extends Data.TaggedError("DownstreamOverloaded")<{
  readonly service: string
  readonly attempt: number
}> {}

const callInventory = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`inventory attempt ${attempt}`)

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
  const fiber = yield* callInventory(attempts).pipe(
    Effect.retry(overloadBackoff),
    Effect.forkScoped
  )

  yield* TestClock.adjust("100 millis")
  yield* TestClock.adjust("200 millis")
  yield* TestClock.adjust("400 millis")

  const result = yield* Fiber.join(fiber)
  yield* Console.log(`available: ${result.available}`)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program).then(() => undefined)
```

The first three calls fail with `DownstreamOverloaded`. The retry delays grow
from 100 to 200 to 400 milliseconds, then the fourth call succeeds.

## Notes

Backoff only affects retry attempts after typed failures. It does not delay the
original request.

Keep the retried effect narrow. Retry the downstream request itself, not a
larger workflow that may already have performed local writes or sent
notifications.

In high fan-out clients, add a cap and jitter so many callers do not retry at
the same growing intervals.
