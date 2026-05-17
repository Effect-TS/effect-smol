---
book: "Effect `Schedule` Cookbook"
section_number: "5.5"
section_title: "Backoff with a practical base interval"
part_title: "Part II — Retry Recipes"
chapter_title: "5. Exponential and Capped Backoff"
status: "draft"
code_included: true
---

# 5.5 Backoff with a practical base interval

The `base` passed to `Schedule.exponential(base, factor?)` is the first retry
delay. Choose it from the operation's real latency and recovery expectations,
not from the later delays you eventually want.

## Problem

A base interval that is too small behaves like immediate retry for the first
few failures. A base interval that is too large can make recoverable
user-facing failures feel slow.

## When to use it

Use this when retries should start soon, but repeated failures should become
less frequent. A base of a few hundred milliseconds is often practical for
idempotent remote calls where immediate retry is too aggressive and a
multi-second first retry is too slow.

It is also useful when moving from fixed delays to backoff: keep the first
retry near the fixed delay that already worked, then let the exponential shape
reduce pressure if failures continue.

## When not to use it

Do not use tiny base intervals such as 1 millisecond for remote dependencies.
They can add load before the dependency has had time to recover.

Do not make the base large only because later retries need to be far apart. If
the first retry should be quick but later retries need a ceiling, add a cap as
a separate policy choice.

## Schedule shape

`Schedule.exponential(base, factor?)` always recurs and returns the current
delay. The default factor is `2`, so `Schedule.exponential("500 millis")`
produces approximately 500 milliseconds, 1 second, 2 seconds, and 4 seconds.

With `Effect.retry`, the original attempt runs immediately. The base interval
is the first pause after a typed failure.

## Code

```ts
import { Console, Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class ServiceError extends Data.TaggedError("ServiceError")<{
  readonly attempt: number
  readonly status: number
}> {}

const loadAccount = Effect.fnUntraced(function*(id: string, attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`account attempt ${attempt}`)

  if (attempt < 4) {
    return yield* Effect.fail(new ServiceError({ attempt, status: 503 }))
  }

  return { id, balance: 100 }
})

const isRetryableServiceError = (error: ServiceError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const retryWithPracticalBackoff = {
  schedule: Schedule.exponential("500 millis"),
  times: 4,
  while: isRetryableServiceError
}

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* loadAccount("account-123", attempts).pipe(
    Effect.retry(retryWithPracticalBackoff),
    Effect.forkScoped
  )

  yield* TestClock.adjust("500 millis")
  yield* TestClock.adjust("1 second")
  yield* TestClock.adjust("2 seconds")

  const account = yield* Fiber.join(fiber)
  yield* Console.log(`balance: ${account.balance}`)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program).then(() => undefined)
```

The first retry waits 500 milliseconds, then the next retries wait about 1
second and 2 seconds. The example advances virtual time so the full backoff
shape runs immediately.

## Notes

`Schedule.exponential(base, factor?)` does not stop on its own. For
request/response work, combine it with `times`, `Schedule.recurs`, a predicate,
or another stopping condition.

Choose the base from the operation's timing. Local coordination may only need
tens of milliseconds. External APIs often need a few hundred milliseconds or a
full second. Slow recovery paths should start larger.

Caps and jitter are common production refinements, especially for large fleets
or rate-limited services, but they are separate choices from the base interval.
