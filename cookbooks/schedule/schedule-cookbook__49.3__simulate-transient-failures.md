---
book: Effect `Schedule` Cookbook
section_number: "49.3"
section_title: "Simulate transient failures"
part_title: "Part XI — Observability and Testing"
chapter_title: "49. Testing Recipes"
status: "draft"
code_included: true
---

# 49.3 Simulate transient failures

Transient-failure tests should prove two things: the operation eventually
recovers when the retry budget is large enough, and the same policy stops when
the failures outlast that budget. Keep the fixture deterministic. The test
should not depend on a real clock, random failure, or a live remote service.

## Problem

You have an effect that represents a flaky dependency. The first few calls may
fail, later calls may succeed, and production code retries those failures with a
`Schedule`. You want a test that demonstrates the success case without waiting
in real time, and another test that verifies the schedule does not retry
forever.

## Schedule shape

Use a deterministic schedule for the test:

```ts
const retryPolicy = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)
```

`Schedule.spaced("100 millis")` adds a fixed delay before each retry.
`Schedule.recurs(3)` allows three recurrences after the initial attempt. With
`Effect.retry`, the schedule receives each failure as input. If the effect fails
four times in a row, the final failure is returned to the caller.

## Code

```ts
import { assert, describe, it } from "@effect/vitest"
import { Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly attempt: number
}> {}

const flakyRequest = (
  failuresBeforeSuccess: number,
  attempts: Ref.Ref<number>
) =>
  Effect.gen(function*() {
    const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)

    if (attempt <= failuresBeforeSuccess) {
      return yield* Effect.fail(new ServiceUnavailable({ attempt }))
    }

    return "ok"
  })

const retryPolicy = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

describe("transient failures", () => {
  it.effect("fails twice, then succeeds within the retry policy", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)

      const fiber = yield* Effect.retry(
        flakyRequest(2, attempts),
        retryPolicy
      ).pipe(Effect.fork)

      yield* TestClock.adjust("100 millis")
      yield* TestClock.adjust("100 millis")

      const result = yield* Fiber.join(fiber)
      const attemptCount = yield* Ref.get(attempts)

      assert.strictEqual(result, "ok")
      assert.strictEqual(attemptCount, 3)
    }))

  it.effect("returns the final failure after the retry policy is exhausted", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)

      const fiber = yield* Effect.retry(
        flakyRequest(4, attempts),
        retryPolicy
      ).pipe(Effect.flip, Effect.fork)

      yield* TestClock.adjust("100 millis")
      yield* TestClock.adjust("100 millis")
      yield* TestClock.adjust("100 millis")

      const error = yield* Fiber.join(fiber)
      const attemptCount = yield* Ref.get(attempts)

      assert.strictEqual(error._tag, "ServiceUnavailable")
      assert.strictEqual(error.attempt, 4)
      assert.strictEqual(attemptCount, 4)
    }))
})
```

## Why this works

The fixture stores its attempt count in a `Ref`, so each call observes and
updates state inside `Effect`. The first test configures two failures before
success. The initial attempt fails immediately, the first clock adjustment
releases retry one, the second releases retry two, and the fiber completes with
`"ok"`.

The second test configures four failures before success. The policy allows only
three retries after the initial attempt, so the fourth failure is returned. The
assertion on `attemptCount` is the important retry-policy check: it proves the
effect ran exactly once plus the three scheduled retries, and did not make a
fifth call.

## Notes and caveats

Use `TestClock.adjust` for retry delays in tests. Do not make schedule tests
sleep on wall-clock time. Keep jitter out of this particular test; add
`Schedule.jittered` in production only after the base retry policy is already
covered by deterministic tests.
