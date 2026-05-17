---
book: "Effect `Schedule` Cookbook"
section_number: "32.2"
section_title: "Assert delays between retries"
part_title: "Part VIII — Observability and Testing"
chapter_title: "32. Testing Recipes"
status: "draft"
code_included: true
---

# 32.2 Assert delays between retries

Retry timing is observable behavior. Use `TestClock` to move virtual time
instead of making a test wait on the machine clock.

## Problem

Counting attempts proves the retry limit, but it does not prove that retries
waited. For a policy with `Schedule.spaced("100 millis")`, check both sides of
the boundary: no retry at 99 milliseconds, then one retry after the remaining
millisecond.

## When to use it

Use this recipe when immediate retry would change the contract or increase load:
HTTP retries, reconnect loops, startup dependency checks, and background worker
retries are common examples.

## When not to use it

Do not use a timing test to decide whether an error should be retried. Classify
validation failures, authorization failures, malformed requests, and unsafe
non-idempotent writes before applying the retry policy.

Do not assert exact timestamps for `Schedule.jittered`; jitter intentionally
changes each delay. Assert bounds or test the deterministic policy before jitter
is added.

## Schedule shape

Combine a deterministic delay with a retry limit. With
`Schedule.spaced("100 millis").pipe(Schedule.both(Schedule.recurs(2)))`, the
original attempt runs immediately. Each failed attempt schedules the next retry
100 milliseconds later, up to two retries.

## Code

```ts
import { Console, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

const retryPolicy = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(2))
)

const operation = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`attempt ${attempt}`)

  if (attempt < 3) {
    return yield* Effect.fail("transient" as const)
  }

  return "ok" as const
})

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* operation(attempts).pipe(
    Effect.retry(retryPolicy),
    Effect.forkScoped
  )

  yield* Effect.yieldNow
  const afterStart = yield* Ref.get(attempts)
  yield* Console.log(`after start: ${afterStart}`)

  yield* TestClock.adjust("99 millis")
  const beforeDelay = yield* Ref.get(attempts)
  yield* Console.log(`after 99ms: ${beforeDelay}`)

  yield* TestClock.adjust("1 millis")
  const afterFirstDelay = yield* Ref.get(attempts)
  yield* Console.log(`after 100ms: ${afterFirstDelay}`)

  yield* TestClock.adjust("100 millis")
  const result = yield* Fiber.join(fiber)
  const finalAttempts = yield* Ref.get(attempts)

  yield* Console.log(`result: ${result}`)
  yield* Console.log(`total attempts: ${finalAttempts}`)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

The retrying operation runs in a fiber because it sleeps after each failure.
Advancing by 99 milliseconds shows that no retry has started early. Advancing by
the remaining millisecond releases the first sleep. The final adjustment
releases the second retry, which succeeds.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. It returns the successful value
from the retried effect, or the last failure if the retry policy is exhausted.
The schedule output is useful for composition and observation, but it is not the
result returned by the retrying operation.

`Schedule.spaced` contributes a constant delay between recurrence decisions.
`Schedule.recurs(n)` bounds the number of recurrences, so with retry it permits
`n` retries after the original attempt.

Use `Schedule.delays` when you want to test the delay sequence as schedule data.
Use `TestClock.adjust` when the test runs a real retry loop.
