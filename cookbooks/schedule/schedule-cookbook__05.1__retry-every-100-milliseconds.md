---
book: Effect `Schedule` Cookbook
section_number: "5.1"
section_title: "Retry every 100 milliseconds"
part_title: "Part II — Core Retry Recipes"
chapter_title: "5. Retry with Fixed Delays"
status: "draft"
code_included: true
---

# 5.1 Retry every 100 milliseconds

`Schedule.spaced("100 millis")` adds a short fixed pause before each retry.
Keep this policy narrow: it is for cheap, idempotent operations where another
attempt after 100 milliseconds is still safe.

## Problem

A local operation can fail because of brief contention or a dependency that is
expected to recover almost immediately. Retrying in a tight loop is too
aggressive, but a long delay would make recovery feel slow.

## When to use it

Use this for cheap idempotent work, such as local coordination, a short-lived
resource race, or a small request that often succeeds on the next attempt.
Idempotent means repeating the operation has the same intended external effect
as running it once.

For request/response code, add a retry limit. An unbounded 100 millisecond loop
is usually appropriate only when the fiber is supervised and can be interrupted.

## When not to use it

Do not use this for expensive work, rate-limited services, overloaded
dependencies, or writes that are not duplicate-safe. A fast retry loop can make
those failures worse.

Do not use it when each failure should increase the delay. Use backoff or
jitter when repeated failures are a signal to slow down.

## Schedule shape

`Schedule.spaced("100 millis")` recurs indefinitely and contributes the same
100 millisecond delay each time. With `Effect.retry`, the first attempt runs
immediately. The schedule is consulted only after a typed failure, meaning an
error produced through the Effect error channel.

The bounded shape below is:

- attempt 1 runs immediately
- failed attempts wait 100 milliseconds before the next retry
- `Schedule.recurs(5)` allows five retries after the original attempt
- if all retries fail, `Effect.retry` returns the last typed failure

## Code

```ts
import { Console, Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly attempt: number
}> {}

const request = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`attempt ${attempt}`)

  if (attempt < 3) {
    return yield* Effect.fail(new RequestError({ attempt }))
  }

  return "ok"
})

const retryEvery100Millis = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* request(attempts).pipe(
    Effect.retry(retryEvery100Millis),
    Effect.forkScoped
  )

  yield* TestClock.adjust("100 millis")
  yield* TestClock.adjust("100 millis")

  const result = yield* Fiber.join(fiber)
  yield* Console.log(`result: ${result}`)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program).then(() => undefined)
```

The example fails twice, advances virtual time twice, and then prints:
`attempt 1`, `attempt 2`, `attempt 3`, and `result: ok`. `TestClock` keeps the
snippet quick when pasted into `scratchpad/repro.ts`; application code usually
uses the live clock.

## Notes

`Schedule.spaced` delays retries, not the original attempt. It also measures
the delay after the failed attempt has completed; it is not a strict
wall-clock cadence.

`Schedule.recurs(5)` means five retries after the original attempt, not five
total attempts.

`Effect.retry` retries typed failures. Defects, thrown exceptions that escape
Effect, and fiber interruptions are not retried as typed failures.
