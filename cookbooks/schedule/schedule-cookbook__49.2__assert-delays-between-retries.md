---
book: Effect `Schedule` Cookbook
section_number: "49.2"
section_title: "Assert delays between retries"
part_title: "Part XI — Observability and Testing"
chapter_title: "49. Testing Recipes"
status: "draft"
code_included: true
---

# 49.2 Assert delays between retries

Retry timing is part of the behavior you should test. A retry policy that says
"wait 100 milliseconds between attempts" should not be tested with real time,
and it should not be tested only by counting attempts. Use `TestClock` to drive
the sleeping retry fiber deterministically, and assert the observable contract:
the next attempt does not happen before the delay, does happen after the delay,
and the retry budget produces the expected number of attempts.

For tests that only need to verify the schedule shape, inspect the schedule with
`Schedule.delays`. For tests that need to verify an operation wired through
`Effect.retry`, fork the retrying effect and move the `TestClock` forward.

## Problem

You have a retry policy such as `Schedule.spaced("100 millis").pipe(
Schedule.both(Schedule.recurs(2)))`, and you need a stable test proving that the
operation waits between retries.

Sleeping for real time makes the test slow and flaky. Counting calls proves the
retry limit, but it does not prove that retries were spaced. The test should
control virtual time and check both sides of the boundary: before the scheduled
delay and after it.

## When to use it

Use this recipe when retry spacing matters to the contract of the operation:
HTTP client retries, reconnect loops, startup dependency checks, background
worker retries, or any code where an accidental immediate retry would increase
load on a downstream system.

It is especially useful when a schedule is composed from a delay and a retry
limit. The count limit tells you how many retries are allowed; the delay tells
you when each retry may begin.

## When not to use it

Do not use a timing test to decide whether an error should be retried. Classify
validation failures, authorization failures, malformed requests, and unsafe
non-idempotent writes before applying the retry policy.

Do not assert exact delays for schedules that intentionally randomize timing,
such as `Schedule.jittered`, unless the test is specifically about a seeded
random sequence. For jittered policies, assert a range or advance the test clock
by the maximum allowed delay.

Do not test long production intervals by waiting in live time. If an operation
waits one minute, the test clock should move by one minute.

## Schedule shape

Keep the deterministic policy under test small and named:

```ts
const retryPolicy = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(2))
)
```

With `Effect.retry`, the original effect runs immediately. If it fails, the
first retry is scheduled after 100 milliseconds. If that retry fails, the second
retry is scheduled after another 100 milliseconds. `Schedule.recurs(2)` means at
most two retries after the original attempt.

The delay belongs to the retry decision. It is not a delay before the original
attempt.

## Code

```ts
import { assert, describe, it } from "@effect/vitest"
import { Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

describe("retryPolicy", () => {
  it.effect("waits between retry attempts", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)

      const operation = Ref.updateAndGet(attempts, (n) => n + 1).pipe(
        Effect.flatMap((attempt) =>
          attempt < 3
            ? Effect.fail("transient" as const)
            : Effect.succeed("ok" as const)
        )
      )

      const retryPolicy = Schedule.spaced("100 millis").pipe(
        Schedule.both(Schedule.recurs(2))
      )

      const fiber = yield* operation.pipe(
        Effect.retry(retryPolicy),
        Effect.fork
      )

      yield* Effect.yieldNow

      assert.strictEqual(yield* Ref.get(attempts), 1)
      assert.strictEqual(fiber.pollUnsafe(), undefined)

      yield* TestClock.adjust("99 millis")

      assert.strictEqual(yield* Ref.get(attempts), 1)
      assert.strictEqual(fiber.pollUnsafe(), undefined)

      yield* TestClock.adjust("1 millis")

      assert.strictEqual(yield* Ref.get(attempts), 2)
      assert.strictEqual(fiber.pollUnsafe(), undefined)

      yield* TestClock.adjust("100 millis")

      const result = yield* Fiber.join(fiber)

      assert.strictEqual(result, "ok")
      assert.strictEqual(yield* Ref.get(attempts), 3)
    }))
})
```

The test starts the retrying operation in a fiber because the operation is
waiting on the schedule after the first failure. Advancing the clock by 99
milliseconds proves that the first retry has not started early. Advancing by
the remaining millisecond releases the scheduled sleep and allows the second
attempt to run. The final 100 millisecond adjustment releases the second retry,
which succeeds.

The assertions are about behavior the caller depends on:

- the original attempt is immediate
- no retry occurs before the configured delay
- each configured delay permits one next retry
- the final result is the business result, not the schedule output
- the total attempts are the original attempt plus the allowed retries

## Variants

If the operation wiring is not important, assert the schedule delays directly.
`Schedule.delays` returns a schedule whose output is the computed recurrence
delay, which is useful for testing the timing policy as data:

```ts
import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect, Schedule } from "effect"

describe("retryPolicy delays", () => {
  it.effect("produces the expected deterministic delays", () =>
    Effect.gen(function*() {
      const delays: Array<Duration.Duration> = []

      const retryPolicy = Schedule.spaced("100 millis").pipe(
        Schedule.both(Schedule.recurs(2)),
        Schedule.delays,
        Schedule.tapOutput((delay) =>
          Effect.sync(() => {
            delays.push(delay)
          })
        )
      )

      yield* Effect.void.pipe(
        Effect.repeat(retryPolicy)
      )

      assert.deepStrictEqual(delays, [
        Duration.millis(100),
        Duration.millis(100)
      ])
    }))
})
```

This form proves the deterministic delay sequence without starting a retrying
fiber. It is a good fit when the schedule is built in one module and reused by
several operations.

For exponential or linear backoff, assert the exact deterministic sequence
before adding jitter. For a capped policy, include the cap in the expected
sequence so the test proves that later retries stop growing.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. It returns the successful value
from the retried effect, or the last failure if the retry policy is exhausted.
The schedule output is useful for composition and observation, but it is not the
result returned by the retrying operation.

`Schedule.spaced` contributes a constant delay between recurrence decisions.
`Schedule.recurs(n)` bounds the number of recurrences, so with retry it permits
`n` retries after the original attempt.

Use `TestClock.adjust` for tests that exercise real sleeping behavior through
`Effect.retry`. Use `Schedule.delays` when you want to test the schedule value
itself without running an operation through retry.
