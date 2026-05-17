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

Tests for `Schedule.jittered` should not assume the base delay is the actual
delay. The actual delay may be shorter or longer, and asserting one exact
jittered value turns deliberate randomness into a brittle snapshot.

In Effect, `Schedule.jittered` randomly adjusts each recurrence delay between
80% and 120% of the delay produced by the schedule it wraps. For a base delay
of 100 milliseconds, the recurrence delay is somewhere from 80 to 120
milliseconds. The test should allow that whole range.

## When to use it

Use this testing style when the production policy should keep jitter enabled:
client retries, worker reconnects, polling loops, or any recurrence that may be
run by many fibers or service instances.

Keep the same schedule shape in the test when you want coverage for the real
policy. Use a deterministic random seed to make the run reproducible, not to make
one random value part of the public contract.

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

Start with the production schedule. For a 100 millisecond spaced schedule with
`Schedule.jittered` and `Schedule.both(Schedule.recurs(2))`, the first attempt
is immediate. If it fails, the first retry waits somewhere from 80 to 120
milliseconds. If that retry fails, the second retry waits in the same range.
`Schedule.recurs(2)` allows at most two retries after the original attempt.

In a time-driven test, advance the `TestClock` by the upper bound for each
recurrence you expect to pass. For a 100 millisecond base delay, that means
advancing by 120 milliseconds per recurrence, not 100.

## Code

```ts
import { Console, Duration, Effect, Random, Ref, Schedule } from "effect"

const assertInRange = (
  label: string,
  delay: Duration.Duration,
  minMillis: number,
  maxMillis: number
) =>
  Effect.gen(function*() {
    const millis = Duration.toMillis(delay)
    yield* Console.log(`${label}: ${millis.toFixed(2)}ms`)

    if (millis < minMillis || millis > maxMillis) {
      return yield* Effect.fail(
        `${label} was outside ${minMillis}-${maxMillis}ms`
      )
    }
  })

const program = Effect.gen(function*() {
  const checked = yield* Ref.make(0)

  const schedule = Schedule.spaced("20 millis").pipe(
    Schedule.jittered,
    Schedule.delays,
    Schedule.tapOutput((delay) =>
      Ref.updateAndGet(checked, (n) => n + 1).pipe(
        Effect.flatMap((n) => assertInRange(`delay ${n}`, delay, 16, 24))
      )
    ),
    Schedule.take(5)
  )

  yield* Effect.succeed("tick").pipe(
    Effect.repeat(schedule),
    Random.withSeed("jitter-range-demo")
  )

  const total = yield* Ref.get(checked)
  yield* Console.log(`checked ${total} jittered delays`)
})

Effect.runPromise(program)
```

This is a scratchpad-sized version of the assertion you would put in an
`it.effect` test. It checks bounds, not exact values. In a clock-driven unit
test, advance `TestClock` by the upper bound for each recurrence that must
complete.

## Variants

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
