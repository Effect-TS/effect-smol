---
book: Effect `Schedule` Cookbook
section_number: "41.1"
section_title: "Immediate retries first, backoff later"
part_title: "Part IX — Composition Recipes"
chapter_title: "41. Build Multi-Phase Policies"
status: "draft"
code_included: true
---

# 41.1 Immediate retries first, backoff later

Some transient failures clear before a meaningful delay would help. A local
connection pool may hand out a stale connection, a just-started dependency may
need one more check, or a short optimistic-concurrency race may disappear on the
next attempt. Those cases can justify a small burst of immediate retries.

If the failure survives that burst, the policy should stop behaving like the
problem is tiny. Switch to backoff so the caller gives the dependency time to
recover instead of continuing a tight loop.

Use `Schedule.andThen` when the policy has real phases: run the first schedule
to completion, then run the second schedule.

## Problem

Build a retry schedule whose early phase is intentionally tiny and whose later
phase has a different timing shape. The policy should make the phase boundary
visible:

- first, a bounded zero-delay retry burst
- then, a bounded exponential backoff
- finally, the original typed failure if all retries are exhausted

## When to use it

Use this recipe when a failure may be caused by a very short race, but continued
failure means the dependency probably needs breathing room. It fits idempotent
reads, health checks, cache refreshes, and small remote calls where one or two
instant retries are acceptable but an unbounded retry burst is not.

This is also useful when the first retry is part of the normal operational
contract. For example, operators may accept two immediate retries for a local
gateway hiccup, but they still need the later remote recovery phase to back off.

## When not to use it

Do not use this policy for permanent failures such as validation errors,
authorization failures, malformed requests, missing configuration, or known
non-idempotent writes. Classify those before applying the schedule.

Do not use a large immediate phase. If you need many retries, the failure is no
longer likely to be shorter than a delay, and the policy should start with
spacing or backoff instead.

## Schedule shape

`Schedule.andThen(left, right)` sequences schedules. The left schedule runs until
it is done; only then does the right schedule start receiving retry decisions.

That order matters. With `immediate.pipe(Schedule.andThen(backoff))`, the first
retry decisions are immediate and the later decisions are delayed. Reversing the
order would make the policy wait before the early retries, then switch to
immediate retries only after the backoff phase had completed, which is the
opposite operational shape.

For `Effect.retry`, remember that the original effect execution is not counted
by the schedule. The schedule starts only after a typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class GatewayError extends Data.TaggedError("GatewayError")<{
  readonly status: number
  readonly message: string
}> {}

declare const callGateway: Effect.Effect<string, GatewayError>

const isRetryable = (error: GatewayError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const immediateRetries = Schedule.recurs(2)

const delayedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.take(4)
)

const immediateThenBackoff = immediateRetries.pipe(
  Schedule.andThen(delayedBackoff),
  Schedule.while(({ input }) => isRetryable(input))
)

export const program = callGateway.pipe(
  Effect.retry(immediateThenBackoff)
)
```

The retry sequence is:

- attempt 1: run `callGateway`
- retry 1: immediate, if the first attempt fails with a retryable `GatewayError`
- retry 2: immediate, if the second attempt fails with a retryable `GatewayError`
- retry 3: wait about `100 millis`
- retry 4: wait about `200 millis`
- retry 5: wait about `400 millis`
- retry 6: wait about `800 millis`

If all retry decisions are exhausted, `Effect.retry` returns the last typed
failure. If `isRetryable` returns `false`, the schedule stops immediately and
that failure is returned without entering the remaining phase.

## Variants

For a user-facing request, reduce the backoff phase or add a short elapsed
budget with `Schedule.during` so the caller gets a clear answer quickly.

For a fleet-wide remote dependency, consider adding `Schedule.jittered` to the
backoff phase after the base cadence is correct. Jitter belongs in the delayed
phase; adding randomness to the immediate burst makes the "immediate first"
contract harder to reason about.

For startup checks, you can make the immediate phase slightly larger if the
operation is local and cheap. Keep the backoff phase explicit so later startup
failure does not spin.

## Notes and caveats

`Schedule.recurs(2)` means two retry decisions after the original attempt, not
two total executions.

`Schedule.exponential("100 millis")` recurs forever by itself, so the example
uses `Schedule.take(4)` to bound the delayed phase.

`Schedule.andThen` is sequential composition, not parallel composition. Use it
when phase order is part of the policy. Use combinators such as `Schedule.both`
when two constraints should apply at the same time.
