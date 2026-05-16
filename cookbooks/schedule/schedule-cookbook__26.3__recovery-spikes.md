---
book: Effect `Schedule` Cookbook
section_number: "26.3"
section_title: "Recovery spikes"
part_title: "Part VI — Jitter Recipes"
chapter_title: "26. Why Jitter Exists"
status: "draft"
code_included: true
---

# 26.3 Recovery spikes

A recovery spike happens after an outage clears and many clients discover the
same fact at roughly the same time. The database is back, the queue accepts
connections again, or the control plane starts answering requests, so every
worker that has been waiting tries to recover at once.

Backoff helps by reducing pressure while the dependency is still unhealthy.
Jittered backoff helps with the moment it becomes healthy again: instead of
every client retrying on the same exponential boundaries, each delay is moved a
little earlier or later. In Effect, `Schedule.jittered` randomizes each delay
between 80% and 120% of the delay produced by the schedule it wraps.

## Problem

You need retries after an outage, but the retry policy must not turn recovery
into another incident. If every process uses the same deterministic sequence,
then `200 millis`, `400 millis`, `800 millis`, and later retry waves can line up
across the fleet.

The first attempt still happens normally. The schedule only decides what to do
after a failure is fed to `Effect.retry`.

## When to use it

Use jittered backoff when many independent clients, workers, pods, or service
instances retry the same dependency. It is especially useful after broker
restarts, database failovers, network partitions, deploy rollbacks, and regional
control plane incidents.

This policy is a good default when the operation is safe to retry and the
downstream system benefits from recovery traffic being spread out.

## When not to use it

Do not use jitter to make unsafe writes look retryable. Classify validation
errors, authorization errors, malformed requests, and non-idempotent operations
before applying a retry schedule.

Also avoid jitter when the timing itself is part of the contract, such as a
fixed-rate heartbeat that another system interprets precisely. For those cases,
choose a schedule whose timing communicates the contract directly.

## Schedule shape

Build the operational shape first, then jitter it:

- `Schedule.exponential("200 millis")` creates the increasing recovery delay.
- `Schedule.jittered` spreads each computed delay by 80% to 120%.
- `Schedule.both(Schedule.recurs(6))` stops after a bounded number of retries.

Keeping those pieces visible makes the policy reviewable: readers can see the
initial delay, the growth behavior, and the retry limit without reverse
engineering sleeps inside a loop.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class DependencyUnavailable extends Data.TaggedError("DependencyUnavailable")<{
  readonly service: string
}> {}

declare const refreshFromDependency: Effect.Effect<
  void,
  DependencyUnavailable
>

const recoveryRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(6))
)

export const program = Effect.retry(
  refreshFromDependency,
  recoveryRetryPolicy
)
```

With the base exponential schedule, retries would be planned around 200ms,
400ms, 800ms, 1.6s, and so on. With `Schedule.jittered`, each client keeps that
same general backoff shape, but each individual delay is randomly adjusted
within the 80% to 120% range. A fleet no longer has to march through identical
retry boundaries during recovery.

## Variants

Use a smaller base delay when the dependency is local and cheap to probe. Use a
larger base delay when the dependency is expensive to warm up or has strict
rate limits.

Add `Schedule.during` when the retry policy should have an elapsed recovery
budget in addition to an attempt count. Keep `Schedule.recurs` when the most
important question is the maximum number of retry attempts.

For long outages, pair jittered backoff with logging or metrics through
`Schedule.tapInput` or `Schedule.tapOutput`, so operators can distinguish a
dependency that is still down from a dependency that is recovering slowly.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. If you need to inspect the
error that caused the retry, use input-aware operators such as
`Schedule.tapInput`.

Jitter is not a rate limiter. It spreads retry timing, but it does not enforce a
global concurrency limit or coordinate work across processes. Use it to avoid
accidental synchronization, and combine it with downstream limits when the
system needs hard protection.
