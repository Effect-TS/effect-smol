---
book: Effect `Schedule` Cookbook
section_number: "39.4"
section_title: "Retry with cap plus max attempts"
part_title: "Part IX — Composition Recipes"
chapter_title: "39. Combine Delay Strategies and Stop Conditions"
status: "draft"
code_included: true
---

# 39.4 Retry with cap plus max attempts

Capped backoff combines early pressure relief with a visible ceiling on retry
delay and retry count.

This is a retry policy, so the first call still happens immediately.
`Schedule` controls only the decisions after a failure.

## Problem

You call a dependency that may fail briefly during deploys, restarts, or load
spikes. Immediate retries create pressure, but pure exponential backoff can
eventually wait longer than the caller can tolerate. Reviewers should be able to
see both the maximum delay and the maximum number of follow-up attempts.

You want a policy that:

- starts with a small exponential delay
- never waits more than a fixed cap between retries
- stops after a fixed number of retry attempts
- makes the total number of executions obvious in code review

## When to use it

Use this recipe for retryable, idempotent operations where a short recovery
window is useful: a control-plane request, a cache fill, a metadata fetch, or an
internal service call that sometimes returns a transient `5xx`.

It is a good default when you need a clear ceiling. For example,
`Schedule.recurs(5)` means at most five retries after the original attempt, so
the effect can execute at most six times total.

## When not to use it

Do not use capped backoff to retry permanent failures. Bad input, authorization
failures, missing resources, and unsafe non-idempotent writes should usually fail
without retrying.

Also avoid treating the delay cap as a full request timeout. The schedule limits
the wait between retries. It does not interrupt one slow in-flight attempt.

## Schedule shape

Start with `Schedule.exponential` for the growing delay curve. Use
`Schedule.modifyDelay` to replace any delay above the cap with the cap. Then
combine the capped delay schedule with `Schedule.recurs` so both constraints must
continue for another retry to happen.

`Schedule.both` has intersection semantics: the combined schedule recurs only
while both schedules recur, and it uses the larger of their delays. Since
`Schedule.recurs(5)` has no meaningful delay of its own, the capped backoff side
provides the wait time and the recurrence side provides the retry count.

## Code

```ts
import { Duration, Effect, Schedule } from "effect"

type TransientError = { readonly _tag: "TransientError" }

declare const fetchMetadata: Effect.Effect<string, TransientError>

const retryWithCappedBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(2)))
  ),
  Schedule.both(Schedule.recurs(5))
)

export const program = fetchMetadata.pipe(
  Effect.retry(retryWithCappedBackoff)
)
```

The retry delays start at roughly `100ms`, then `200ms`, `400ms`, `800ms`,
`1600ms`, and then remain capped at `2s` for later retries. The policy allows at
most five retries after the original call.

## Variants

If you want the count limit to read as "take this many outputs from the backoff
schedule", put the limit directly on the backoff schedule:

```ts
const retryWithTake = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(2)))
  ),
  Schedule.take(5)
)
```

Use `Schedule.recurs` when you want the retry-count guard to stand out as a
separate policy. Use `Schedule.take` when the count is simply part of shaping one
schedule.

For a fleet of clients, add `Schedule.jittered` before the delay cap and keep
`Schedule.modifyDelay` after it, so randomization cannot push a computed delay
past the maximum.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. If only some errors are
retryable, classify them before applying the policy or add a schedule predicate
that stops on non-retryable failures.

`Schedule.exponential` is unbounded by itself. Pair it with `Schedule.recurs`,
`Schedule.take`, `Schedule.during`, or a domain-specific stop condition whenever
the policy can run in production.
