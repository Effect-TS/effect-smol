---
book: Effect `Schedule` Cookbook
section_number: "8.2"
section_title: "Add jitter to exponential backoff"
part_title: "Part II — Core Retry Recipes"
chapter_title: "8. Retry with Jitter"
status: "draft"
code_included: true
---

# 8.2 Add jitter to exponential backoff

This recipe shows how to add jitter to exponential backoff so callers do not all retry
on the same growing schedule.

## Problem

Basic exponential backoff reduces pressure over time, but callers that fail
together can still wake up together: 100 milliseconds later, then 200
milliseconds later, then 400 milliseconds later, and so on.

Add jitter by placing `Schedule.jittered` after the exponential schedule:

```ts
const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)
```

This means "start with exponential backoff at 100 milliseconds, randomly adjust
each retry delay between 80% and 120% of that delay, and stop after at most five
retries."

## When to use it

Use jittered exponential backoff when multiple fibers, clients, workers, or
service instances can fail at about the same time and then retry the same
dependency. Jitter spreads retry traffic around each exponential delay so the
downstream service sees fewer synchronized retry bursts.

This is a useful default for idempotent HTTP requests, queue operations, cache
lookups, database calls, and service-to-service requests where failures are
probably transient but repeated callers should not move in lockstep.

Jitter is especially important when the caller population is large. The larger
the group of callers using the same backoff policy, the more valuable it is to
avoid identical retry times.

## When not to use it

Do not use jitter to make unsafe operations safe to retry. Retried writes still
need idempotency, deduplication, transactions, or another domain-level
guarantee.

Do not use jitter as a retry limit. `Schedule.jittered` changes delays; it does
not decide when to stop. Add `Schedule.recurs`, `times`, an elapsed-time limit,
or another stopping condition when the policy must be finite.

Do not use jitter when deterministic timing is part of the requirement, such as
tests that assert exact delays or workflows that must run on fixed intervals.
For those cases, keep the schedule deterministic or test the jittered policy by
checking delay bounds instead of exact values.

## Schedule shape

`Schedule.exponential("100 millis")` is an unbounded schedule. With the default
factor of `2`, its retry delays are 100 milliseconds, 200 milliseconds, 400
milliseconds, 800 milliseconds, and so on.

`Schedule.jittered` returns a new schedule that keeps the same recurrence and
output shape, but randomly modifies each delay. The implementation adjusts each
delay between 80% and 120% of the original delay:

| Retry delay decision | Exponential delay | Jittered delay range |
| -------------------- | ----------------- | -------------------- |
| 1                    | 100 milliseconds  | 80-120 milliseconds  |
| 2                    | 200 milliseconds  | 160-240 milliseconds |
| 3                    | 400 milliseconds  | 320-480 milliseconds |
| 4                    | 800 milliseconds  | 640-960 milliseconds |

`Schedule.both(Schedule.recurs(5))` adds the retry limit. The combined schedule
continues only while both the jittered backoff and the recurrence limit
continue. Since `Schedule.recurs(5)` contributes no meaningful delay, the
jittered exponential backoff controls the wait between retries.

With `Effect.retry`, the original effect runs immediately. If it fails with a
typed error, that error is fed to the schedule. The schedule decides whether
another retry is allowed and how long to wait before that retry. If all allowed
retries fail, `Effect.retry` propagates the last typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class GatewayUnavailable extends Data.TaggedError("GatewayUnavailable")<{
  readonly status: number
}> {}

declare const callGateway: Effect.Effect<string, GatewayUnavailable>

const jitteredBackoff = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

const program = callGateway.pipe(
  Effect.retry(jitteredBackoff)
)
```

`program` calls `callGateway` once immediately. If it fails with a typed
`GatewayUnavailable`, the first retry waits somewhere from 80 to 120
milliseconds. Later failures use the exponential sequence as the base delay,
then jitter each wait: 160 to 240 milliseconds around the 200 millisecond base,
320 to 480 milliseconds around the 400 millisecond base, and so on.

`Schedule.recurs(5)` allows at most five retries after the original attempt. If
any attempt succeeds, `program` succeeds with the string returned by
`callGateway`. If the original attempt and all five retries fail,
`Effect.retry` returns the last `GatewayUnavailable`.

## Variants

Use a smaller base delay for latency-sensitive work:

```ts
const interactiveJitteredBackoff = Schedule.exponential("50 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)
```

This keeps early retries fast while still spreading callers around each
exponential delay.

Use a gentler exponential factor when doubling grows too quickly:

```ts
const gentleJitteredBackoff = Schedule.exponential("250 millis", 1.5).pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(8))
)
```

This starts at 250 milliseconds, grows each base delay by 1.5x, and then
jitters each computed delay between 80% and 120%.

When only some typed failures should be retried, keep the same schedule and add
a predicate at the retry boundary:

```ts
const program = callGateway.pipe(
  Effect.retry({
    schedule: jitteredBackoff,
    while: (error) => error.status === 429 || error.status >= 500
  })
)
```

The schedule controls timing and retry count. The predicate decides which typed
failures are allowed to use that policy.

## Notes and caveats

`Schedule.jittered` does not take a percentage or range argument. In Effect, it
randomly adjusts each delay between 80% and 120% of the original delay.

Place `Schedule.jittered` after `Schedule.exponential(...)` when you want to
jitter the exponential delay itself. Additional composition can then add limits,
caps, predicates, or observability around the jittered backoff.

`Schedule.jittered` changes only the delay. It preserves the schedule output,
so after `Schedule.exponential(...).pipe(Schedule.jittered)`, the output is
still the exponential schedule output. After `Schedule.both(Schedule.recurs(5))`,
the output is paired with the recurrence count. Plain `Effect.retry` uses that
schedule output for retry decisions and returns the successful value of the
retried effect.

The first execution is not delayed. Jitter is applied only to delays between
retry attempts after typed failures.

Jitter spreads retry attempts, but it does not cap the maximum exponential
growth. For long-running retry policies, combine jitter with a cap and a retry
limit that match the caller's latency budget.
