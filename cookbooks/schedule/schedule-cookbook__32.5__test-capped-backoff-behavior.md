---
book: "Effect `Schedule` Cookbook"
section_number: "32.5"
section_title: "Test capped backoff behavior"
part_title: "Part VIII — Observability and Testing"
chapter_title: "32. Testing Recipes"
status: "draft"
code_included: true
---

# 32.5 Test capped backoff behavior

Capped backoff tests should prove the delay sequence without depending on the
machine clock.

## Problem

Given a retry policy that starts with exponential backoff and then stops growing
at a maximum delay, the test should show three facts:

- early retries use the exponential curve
- later retries never wait longer than the cap
- the retry limit still counts retries after the original attempt

A real-time sleep is slow and flaky. Exact assertions after `Schedule.jittered`
are also wrong because jitter intentionally changes each delay.

## When to use it

Use this recipe when a retry policy has a hard maximum delay and you want a
fast test for the timing contract. It is a good fit for client libraries,
background workers, polling loops, and reconcilers where the cap is part of the
operational guarantee.

## When not to use it

Do not test capped backoff by waiting for real milliseconds to pass. That makes
the test depend on scheduler load and wall-clock timing.

Do not assert exact delays for a policy after `Schedule.jittered` has been
applied. `Schedule.jittered` randomly adjusts each recurrence delay between 80%
and 120% of the original delay, so exact timestamps are not the contract.

## Schedule shape

Build the cap with `Schedule.modifyDelay`. `Schedule.exponential` computes each
backoff duration, and `modifyDelay` replaces the next recurrence delay with the
minimum of that duration and the cap. For a base of 100 milliseconds and a cap
of 250 milliseconds, the first five delays are 100, 200, 250, 250, and 250
milliseconds.

## Example

```ts
import { Console, Duration, Effect, Fiber, Schedule } from "effect"
import { TestClock } from "effect/testing"

const cappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.millis(250)))
  ),
  Schedule.delays,
  Schedule.tapOutput((delay) =>
    Console.log(`scheduled delay: ${Duration.toMillis(delay)}ms`)
  ),
  Schedule.take(5)
)

const program = Effect.gen(function*() {
  const fiber = yield* Effect.void.pipe(
    Effect.repeat(cappedBackoff),
    Effect.forkScoped
  )

  yield* Effect.yieldNow
  yield* TestClock.adjust("2 seconds")
  yield* Fiber.join(fiber)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

The program repeats a no-op effect under the schedule, logs the computed delays,
and uses `TestClock` so the two seconds of virtual time pass immediately.

## Variants

If the production policy is jittered, keep the cap test deterministic and keep
the hard cap after jitter. Test the jittered policy by seeding randomness or by
asserting bounds. Do not combine "capped" and "exact jittered delay" in the same
assertion.

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
