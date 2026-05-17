---
book: Effect `Schedule` Cookbook
section_number: "49.5"
section_title: "Test capped backoff behavior"
part_title: "Part XI — Observability and Testing"
chapter_title: "49. Testing Recipes"
status: "draft"
code_included: true
---

# 49.5 Test capped backoff behavior

Capped backoff tests should prove the policy shape without depending on the
machine clock.

## Problem

Given a retry policy that starts with exponential backoff and then stops growing
after a maximum delay, the test needs to show the exact contract:

- early retries use the exponential curve
- later retries never wait longer than the cap
- the retry limit still counts retries after the original attempt

A test that sleeps in real time is slow and flaky. A test that includes
`Schedule.jittered` and asserts exact moments is also fragile, because jitter
intentionally changes each delay.

## When to use it

Use this recipe when a retry policy has a hard maximum delay and you want a
fast test that explains the timing contract. It is a good fit for client
libraries, background workers, polling loops, and reconcilers where the cap is
part of the operational guarantee.

It is especially useful when production adds jitter before the hard cap. Test
the deterministic capped policy directly, then have a smaller jitter test that
checks bounds rather than exact delays.

## When not to use it

Do not test capped backoff by waiting for real milliseconds to pass. That makes
the test depend on scheduler load and wall-clock timing.

Do not assert exact delays for a policy after `Schedule.jittered` has been
applied. `Schedule.jittered` randomly adjusts each recurrence delay between 80%
and 120% of the original delay, so exact timestamps are not the contract.

## Schedule shape

Build the cap with `Schedule.modifyDelay`. `Schedule.exponential` computes the
backoff duration, and `modifyDelay` replaces the next recurrence delay with the
minimum of that duration and the cap:

```ts
import { Duration, Effect, Schedule } from "effect"

const cappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(250)))
  ),
  Schedule.both(Schedule.recurs(5))
)
```

For this policy, the deterministic recurrence delays are 100, 200, 250, 250,
and 250 milliseconds. The first two values come from the exponential curve. The
later values prove that the cap is applied after the curve is computed.

## Code

```ts
import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect, Schedule } from "effect"

const cappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(250)))
  )
)

describe("capped backoff", () => {
  it.effect("caps the exponential delay curve", () =>
    Effect.gen(function*() {
      const delays: Array<Duration.Duration> = []

      const schedule = cappedBackoff.pipe(
        Schedule.delays,
        Schedule.tapOutput((delay) =>
          Effect.sync(() => {
            delays.push(delay)
          })
        ),
        Schedule.take(5)
      )

      yield* Effect.void.pipe(Effect.repeat(schedule))

      assert.deepStrictEqual(delays.map(Duration.toMillis), [
        100,
        200,
        250,
        250,
        250
      ])
    }))
})
```

This test never starts a retrying fiber and never advances real time. It runs
the schedule itself, records the delays that would be used for recurrence, and
asserts the contract as plain numbers.

## Variants

When you need to test the whole retry loop, use `TestClock` and assert the
observable result rather than measuring elapsed wall-clock time:

```ts
import { assert, describe, it } from "@effect/vitest"
import { Duration, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

const cappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(250)))
  ),
  Schedule.both(Schedule.recurs(4))
)

describe("retry with capped backoff", () => {
  it.effect("succeeds after advancing the virtual clock", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)

      const operation = Ref.updateAndGet(attempts, (n) => n + 1).pipe(
        Effect.flatMap((attempt) =>
          attempt < 5
            ? Effect.fail("transient" as const)
            : Effect.succeed("ok" as const)
        )
      )

      const fiber = yield* operation.pipe(
        Effect.retry(cappedBackoff),
        Effect.fork
      )

      yield* TestClock.adjust("100 millis")
      yield* TestClock.adjust("200 millis")
      yield* TestClock.adjust("250 millis")
      yield* TestClock.adjust("250 millis")

      const result = yield* Fiber.join(fiber)
      const count = yield* Ref.get(attempts)

      assert.strictEqual(result, "ok")
      assert.strictEqual(count, 5)
    }))
})
```

This version proves that the policy works inside `Effect.retry`: the original
attempt runs immediately, then four retries are unlocked by the virtual clock.
It still does not sleep in real time.

If the production policy is jittered, keep the cap test deterministic and keep
the hard cap after jitter:

```ts
const productionBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(250)))
  )
)
```

Then test the jittered policy by seeding randomness or by asserting bounds. Do
not combine "capped" and "exact jittered delay" in the same assertion.

## Notes and caveats

`Schedule.exponential(base, factor)` computes delays as `base * factor ** n`,
where `n` is the number of recurrences so far. Its output is the current
duration, and the recurrence delay is the same duration.

`Schedule.modifyDelay` changes the delay used before the next recurrence. It
does not change the schedule output. Use `Schedule.delays` when the test should
observe the actual delay after modifiers have been applied.

`Schedule.recurs(n)` allows at most `n` retries when used with `Effect.retry`.
Those retries happen after the original attempt; they are not counted as part of
the first evaluation.
