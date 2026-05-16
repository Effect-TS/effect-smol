---
book: Effect `Schedule` Cookbook
section_number: "29.1"
section_title: "More stability, less predictability"
part_title: "Part VI — Jitter Recipes"
chapter_title: "29. Jitter Tradeoffs"
status: "draft"
code_included: true
---

# 29.1 More stability, less predictability

Jitter is a tradeoff. It makes the whole system steadier by spreading retries,
polls, or background work across a small random range, but each individual
caller becomes less predictable. A retry that would have waited exactly 1
second may instead wait a little less or a little more.

Use `Schedule.jittered` when synchronized timing is more dangerous than slight
timing uncertainty. In Effect, jitter keeps the schedule's recurrence and output
shape, but randomly adjusts each delay between 80% and 120% of the original
delay.

## Problem

Many clients, workers, or service instances can share the same schedule. If they
start together, fail together, or are deployed together, a precise cadence can
make them move together too. That creates bursts: many callers wake up at the
same instant, retry the same dependency, refresh the same cache, or poll the
same endpoint.

Jitter weakens that alignment. The cost is that the next attempt is no longer
scheduled for an exact wall-clock delay. Operators can still describe the base
policy and the jitter range, but they should not expect every individual caller
to wake up at the same precise offset.

## When to use it

Use jitter when aggregate load matters more than exact per-caller timing:

- retries from many clients after a transient outage
- cache warming from multiple application instances
- polling loops that would otherwise hit a service on the same boundary
- reconnect loops after a broker, database, or gateway interruption

This is especially useful for idempotent operations where a small timing
variation does not change correctness. The schedule still needs an explicit
limit or budget when the workflow must eventually stop.

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
`Schedule.jittered`:

```ts
const policy = Schedule.spaced("1 second").pipe(
  Schedule.jittered
)
```

The base schedule remains visible: "one second between recurrences." Jitter then
turns each one-second delay into a random delay from 800 milliseconds to 1.2
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
import { Effect, Schedule } from "effect"

type GatewayError = { readonly _tag: "GatewayError" }

declare const refreshCacheEntry: Effect.Effect<void, GatewayError>

const refreshPolicy = Schedule.spaced("1 second").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(10))
)

export const program = refreshCacheEntry.pipe(
  Effect.retry(refreshPolicy)
)
```

`program` runs `refreshCacheEntry` once immediately. If it fails, the retry
policy waits around the one-second cadence instead of exactly one second: each
retry delay is randomly adjusted to somewhere between 800 milliseconds and 1.2
seconds. `Schedule.recurs(10)` limits the policy to at most ten retries after
the original attempt.

## Variants

For transient service failures, combine exponential backoff with jitter:

```ts
const retryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(6))
)
```

This keeps the recognizable exponential shape while avoiding synchronized retry
bursts around each exponential step.

For periodic background work, jitter the steady cadence:

```ts
const pollingPolicy = Schedule.spaced("30 seconds").pipe(
  Schedule.jittered
)
```

This is useful when many instances are allowed to poll approximately every 30
seconds, but the service should not receive all polls at exactly the same time.

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
