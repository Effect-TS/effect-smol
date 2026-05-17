---
book: "Effect `Schedule` Cookbook"
section_number: "20.6"
section_title: "More stability, less predictability"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "20. Jitter Concepts and Tradeoffs"
status: "draft"
code_included: true
---

# 20.6 More stability, less predictability

Jitter keeps the base cadence visible while making each individual delay
approximate. The point is to protect aggregate load, not to make one caller more
precise.

## Problem

Many clients, workers, or service instances can start the same schedule at the
same time after a deploy, outage, or restart. Without jitter, they can also wake
up together and send a burst of retries, cache refreshes, or polls to the same
dependency.

The policy should weaken that alignment without hiding the intended cadence.
Operators can still describe the base delay and the jitter range; they should
not expect every caller to wake at the exact same offset.

## When to use it

Use jitter when aggregate load matters more than exact per-caller timing:

- retries from many clients after a transient outage
- cache warming from multiple application instances
- polling loops that would otherwise hit a service on the same boundary
- reconnect loops after a broker, database, or gateway interruption

This fits idempotent operations, where repeating the same request does not
change correctness. The schedule still needs a count limit, time budget, or
external lifetime when the workflow must stop.

## When not to use it

Do not use jitter when exact timing is part of the requirement. Fixed reporting
windows, protocol heartbeats with strict deadlines, tests that assert precise
delays, and workflows coordinated by a shared clock usually need deterministic
timing.

Do not use jitter to make unsafe retries safe. Retried writes still need
idempotency, deduplication, transactions, or another domain-level guarantee.
Jitter changes when the next attempt happens; it does not change whether the
attempt is valid.

## Schedule shape

Start with the cadence you would have used without jitter, then apply
`Schedule.jittered`. For example, adding `Schedule.jittered` after
`Schedule.spaced("1 second")` still says "one second between recurrences", but
each one-second delay is randomized to roughly 800 milliseconds through 1.2
seconds.

For an exponential policy, each computed exponential delay is jittered:

| Base delay | Jittered delay range |
| ---------- | -------------------- |
| 200 ms     | 160-240 ms           |
| 400 ms     | 320-480 ms           |
| 800 ms     | 640-960 ms           |
| 1.6 s      | 1.28-1.92 s          |

The benefit is smoother aggregate load. The tradeoff is less exact timing for
any one fiber or process.

## Code

```ts
import { Console, Effect, Random, Ref, Schedule } from "effect"

type GatewayError = {
  readonly _tag: "GatewayError"
  readonly attempt: number
}

const refreshPolicy = Schedule.spaced("20 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  const refreshCacheEntry: Effect.Effect<string, GatewayError> = Effect.gen(
    function*() {
      const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
      yield* Console.log(`refresh attempt ${attempt}`)

      if (attempt < 3) {
        return yield* Effect.fail({ _tag: "GatewayError", attempt } as const)
      }

      return "cache refreshed"
    }
  )

  const result = yield* refreshCacheEntry.pipe(
    Effect.retry(refreshPolicy),
    Random.withSeed("cache-refresh-demo")
  )

  yield* Console.log(result)
})

Effect.runPromise(program)
```

`program` runs the cache refresh immediately, then retries around a 20
millisecond cadence instead of exactly every 20 milliseconds. The seeded random
service makes the demo reproducible; production code usually uses the default
random service.

## Variants

For transient service failures, combine exponential backoff with jitter. That
keeps the exponential shape while avoiding synchronized retry bursts around each
step.

For periodic background work, jitter the steady cadence. This is useful when
many instances may poll approximately every 30 seconds, but the service should
not receive all polls on the same boundary.

## Notes and caveats

`Schedule.jittered` does not accept a custom percentage. The implementation in
`packages/effect/src/Schedule.ts` adjusts each delay between 80% and 120% of the
original delay.

Jitter changes only delays. It preserves the schedule output, input handling,
and stopping behavior. Add `Schedule.recurs`, `Schedule.take`,
`Schedule.during`, or another limit when the policy must be finite.

With `Effect.retry`, the first attempt is not delayed. Jitter applies to waits
between retry attempts after typed failures. With `Effect.repeat`, jitter
applies to waits between successful repetitions.

For tests, avoid asserting an exact jittered delay. Either keep the schedule
deterministic in that test or assert the allowed bounds.
