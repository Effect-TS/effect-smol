---
book: Effect `Schedule` Cookbook
section_number: "29.3"
section_title: "Testing with jitter"
part_title: "Part VI — Jitter Recipes"
chapter_title: "29. Jitter Tradeoffs"
status: "draft"
code_included: true
---

# 29.3 Testing with jitter

Jittered schedules should be tested as bounded timing contracts. The exact sleep
can vary; the retry count, stopping behavior, and allowed delay range should not.

## Problem

You have a retry or polling policy that uses `Schedule.jittered`, and you need
tests that are stable. A test that advances the clock by the base delay can
flake because the actual delay may be longer than the base delay. A test that
asserts one exact jittered duration is brittle because the implementation is
random by design.

In Effect, `Schedule.jittered` randomly adjusts each recurrence delay between
80% and 120% of the delay produced by the schedule it wraps. For a base delay
of 100 milliseconds, the recurrence delay is somewhere from 80 to 120
milliseconds. The test should allow that whole range.

## When to use it

Use this testing style when the production policy should keep jitter enabled:
client retries, worker reconnects, polling loops, or any recurrence that may be
run by many fibers or service instances.

Keep the same schedule shape in the test when you want coverage for the real
policy. Use a deterministic random seed only to make the test reproducible, not
to promise that future readers should care about one exact jitter value.

## When not to use it

Do not test a jittered schedule by sleeping the base interval and expecting the
next attempt to have happened. The random delay may legally be up to 120% of
that interval.

Do not remove jitter from the policy under test just to make the clock easier
to drive. That can leave the production composition untested.

Do not use jitter tests to prove load smoothing across a fleet. Unit tests can
check bounds and recurrence behavior. Fleet-level distribution is better
validated with simulation, metrics, or integration tests.

## Schedule shape

Start with the production schedule:

```ts
const retryPolicy = Schedule.spaced("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(2))
)
```

The first attempt is immediate. If it fails, the first retry waits somewhere
from 80 to 120 milliseconds. If that retry fails, the second retry waits in the
same range. `Schedule.recurs(2)` allows at most two retries after the original
attempt.

In a time-driven test, advance the `TestClock` by the upper bound for each
recurrence you expect to pass. For a 100 millisecond base delay, that means
advancing by 120 milliseconds per recurrence, not 100.

## Code

```ts
import { assert, describe, it } from "@effect/vitest"
import { Effect, Fiber, Random, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

describe("retryPolicy", () => {
  it.effect("retries with jitter without assuming exact delays", () =>
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
        Schedule.jittered,
        Schedule.both(Schedule.recurs(2))
      )

      const fiber = yield* operation.pipe(
        Effect.retry(retryPolicy),
        Random.withSeed("retry-policy-test"),
        Effect.fork
      )

      yield* TestClock.adjust("120 millis")
      yield* TestClock.adjust("120 millis")

      const result = yield* Fiber.join(fiber)
      const count = yield* Ref.get(attempts)

      assert.strictEqual(result, "ok")
      assert.strictEqual(count, 3)
    }))
})
```

This test does not assert that either recurrence waited exactly 100
milliseconds. It advances by the maximum delay that `Schedule.jittered` can
produce for the 100 millisecond base interval. The seeded random service makes
the run reproducible, while the assertion stays focused on the retry contract:
the original attempt plus two allowed retries are enough for the operation to
succeed.

## Variants

To test delay bounds directly, inspect schedule delays and assert ranges rather
than exact values:

```ts
import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect, Random, Schedule } from "effect"

describe("jittered spacing", () => {
  it.effect("keeps recurrence delays within the jitter range", () =>
    Effect.gen(function*() {
      const delays: Array<Duration.Duration> = []

      const schedule = Schedule.spaced("1 second").pipe(
        Schedule.jittered,
        Schedule.delays,
        Schedule.tapOutput((delay) =>
          Effect.sync(() => {
            delays.push(delay)
          })
        ),
        Schedule.take(20)
      )

      yield* Effect.void.pipe(
        Effect.repeat(schedule),
        Random.withSeed("jitter-range-test")
      )

      assert.strictEqual(
        delays.every((delay) => {
          const millis = Duration.toMillis(delay)
          return millis >= 800 && millis <= 1200
        }),
        true
      )
    }))
})
```

For polling tests, use the same rule: if a five-second polling interval is
jittered, advance the test clock by six seconds for each recurrence that must
be observed. Then assert the observed status values, stop condition, or call
count. Avoid asserting that a poll happened exactly at the five-second mark.

For policies with exponential backoff, compute the upper bound for each base
delay. A 100 millisecond exponential schedule has base delays of 100, 200, and
400 milliseconds, so the jittered upper bounds are 120, 240, and 480
milliseconds.

## Notes and caveats

`Schedule.jittered` changes delays only. It preserves the output and stopping
behavior of the schedule it wraps.

`Random.withSeed` is useful for reproducible tests, but it should not turn a
reader-facing test into a snapshot of one random sequence. Prefer assertions
about bounds, attempts, outputs, and termination.

`TestClock.adjust` should move far enough for the maximum valid jittered delay.
Moving by the base delay is not enough when the jitter range can be larger than
the base delay.

When you need exact timing semantics, test the deterministic schedule without
jitter. When the production contract includes jitter, keep jitter in the test
and assert the conservative behavior that remains true for every valid random
delay.
