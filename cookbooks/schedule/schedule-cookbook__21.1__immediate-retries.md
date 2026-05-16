---
book: Effect `Schedule` Cookbook
section_number: "21.1"
section_title: "Immediate retries"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "21. Choosing a Delay Strategy"
status: "draft"
code_included: true
---

# 21.1 Immediate retries

Immediate retries are the smallest retry policy: after a typed failure, try the
same effect again without adding a delay. In Effect, that policy is expressed
with `Schedule.recurs(n)`, where `n` is the maximum number of retry decisions
after the original attempt.

Use this only when a failure is likely to clear almost instantly and another
attempt is cheap. A brief race with a local resource, a just-started in-process
dependency, or a transient optimistic-concurrency conflict can fit this shape.
Remote APIs, overloaded services, rate limits, and user-facing workflows usually
need spacing, backoff, jitter, or a time budget instead.

## Problem

You want to retry a small transient failure a few times, but you do not want a
loop with hidden counters or sleeps. The retry policy should make it clear that
there is no delay and that the number of extra attempts is deliberately small.

Use `Schedule.recurs` with `Effect.retry` for this policy.

## When to use it

Use immediate retries when all of these are true:

- the operation is safe to repeat
- the expected failure window is shorter than a meaningful delay
- each attempt is cheap for the caller and the dependency
- a small fixed retry count is enough to prove the failure was not momentary

This is most appropriate around narrow operations. Keep the retry boundary close
to the effect that can fail transiently, not around a larger workflow that also
performs non-repeatable work.

## When not to use it

Do not use immediate retries as a default production retry policy. A tight
retry loop can amplify load at exactly the point where a dependency is already
unhealthy.

Do not use it for permanent errors such as validation failures, authorization
failures, missing configuration, malformed requests, or known non-idempotent
writes. Classify those failures before applying the schedule.

Do not use it when many fibers, processes, or nodes may fail together. If the
same policy can run across a fleet, prefer a delayed policy and consider jitter
after the base cadence is correct.

## Schedule shape

`Schedule.recurs(2)` allows two recurrences after the first execution. With
`Effect.retry`, that means:

- attempt 1: run immediately
- if attempt 1 fails with a typed error: retry immediately
- if attempt 2 fails with a typed error: retry immediately
- if attempt 3 fails with a typed error: stop and return that failure

There is no scheduled waiting between those retries. The first execution is also
not controlled by the schedule; the schedule decides only whether a failure
should be followed by another attempt.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class LocalCacheError extends Data.TaggedError("LocalCacheError")<{
  readonly reason: string
}> {}

declare const readThroughCache: Effect.Effect<string, LocalCacheError>

const retryTwiceImmediately = Schedule.recurs(2)

export const program = readThroughCache.pipe(
  Effect.retry(retryTwiceImmediately)
)
```

`program` performs `readThroughCache` once. If it fails with a typed
`LocalCacheError`, it may retry up to two more times immediately. If all three
attempts fail, `Effect.retry` returns the last typed failure.

## Variants

For a slightly less aggressive policy, add a small fixed delay with
`Schedule.spaced` and combine it with `Schedule.recurs`.

For a remote dependency, use exponential backoff or another delayed schedule
instead of immediate retries. The extra latency is usually cheaper than sending
several requests into the same failing system at once.

## Notes and caveats

`Schedule.recurs(n)` counts retries after the original attempt, not total
attempts. `Schedule.recurs(2)` means at most three total executions: the first
try plus two retries.

Keep the count small. Immediate retries are useful because they are brief; once
you need more than a couple of retries, the policy is no longer just handling a
momentary failure and should usually introduce delay.
