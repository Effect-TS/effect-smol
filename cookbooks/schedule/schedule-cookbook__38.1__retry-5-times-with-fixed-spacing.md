---
book: Effect `Schedule` Cookbook
section_number: "38.1"
section_title: "Retry 5 times with fixed spacing"
part_title: "Part IX — Composition Recipes"
chapter_title: "38. Combine Attempt Limits and Delays"
status: "draft"
code_included: true
---

# 38.1 Retry 5 times with fixed spacing

You want a failing effect to run once immediately, then retry at most five
times with the same delay before each retry. The delay should be obvious in the
schedule, and the retry limit should be visible at the same boundary.

This is a composition of two ideas:

- `Schedule.spaced("1 second")` decides when the next retry may happen
- `Schedule.recurs(5)` decides how many retries are allowed after the original
  attempt

## Problem

You need a bounded retry policy for a transient operation. The first attempt
should happen right away. If it fails, the next five retries should be spaced by
a fixed interval.

The policy should make the off-by-one rule clear: "retry five times" means one
original attempt plus up to five retries, for at most six total attempts.

## When to use it

Use this recipe when the operation is safe to run again and a fixed pause is
enough recovery time. It fits idempotent HTTP requests, short dependency
outages, service startup checks, and reconnect attempts where a steady cadence
is easier to reason about than backoff.

It is also useful when logs and operational runbooks need a simple answer:
"the call is tried once, then retried up to five more times, one second apart."

## When not to use it

Do not use retries to hide permanent failures. Bad input, invalid credentials,
authorization failures, and unsafe non-idempotent writes should be classified
before the retry policy is applied.

Do not use a fixed spacing policy for overloaded or rate-limited dependencies
that need callers to spread out over time. Those cases usually call for
exponential backoff, jitter, server-provided retry metadata, or a time budget.

Do not use `Schedule.recurs(5)` when the requirement is five total attempts. In
that case the first attempt counts too, so the retry limit would be
`Schedule.recurs(4)`.

## Schedule shape

Start with the cadence, then add the count guard:

```ts
import { Schedule } from "effect"

const retry5TimesWithFixedSpacing = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(5))
)
```

`Schedule.spaced("1 second")` recurs continuously and waits one second between
recurrences. `Schedule.recurs(5)` allows five scheduled recurrences. Combining
them with `Schedule.both` means both schedules must continue, so the policy
stops when the retry count is exhausted.

With `Effect.retry`, the first execution is not scheduled. It runs immediately.
Only failures after that first execution are fed to the schedule:

- attempt 1: run immediately
- if attempt 1 fails: wait 1 second
- attempt 2: retry 1
- if attempt 2 fails: wait 1 second
- continue through retry 5
- if retry 5 fails: propagate the last typed failure

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly service: string
}> {}

declare const fetchInventory: Effect.Effect<ReadonlyArray<string>, ServiceUnavailable>

const retry5TimesWithFixedSpacing = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(5))
)

export const program = fetchInventory.pipe(
  Effect.retry(retry5TimesWithFixedSpacing)
)
```

`program` calls `fetchInventory` once immediately. If that attempt fails with a
typed `ServiceUnavailable`, it waits one second and retries. It can retry at
most five times. If every allowed attempt fails, `Effect.retry` propagates the
last typed failure.

## Variants

If you do not need to keep the output from `Schedule.recurs`, `Schedule.take(5)`
can express the same retry cap directly on the fixed-spacing schedule:

```ts
const retry5TimesWithTake = Schedule.spaced("1 second").pipe(
  Schedule.take(5)
)
```

For `Effect.retry`, this still means up to five retries after the original
attempt. `take(5)` limits the number of schedule outputs, and those outputs
correspond to scheduled retries.

Use a named count guard when the retry limit is important enough to read as its
own policy:

```ts
const cadence = Schedule.spaced("1 second")
const retryLimit = Schedule.recurs(5)

const policy = cadence.pipe(
  Schedule.both(retryLimit)
)
```

If the requirement is "try the operation five times total", allow only four
retries:

```ts
const fiveTotalAttempts = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(4))
)
```

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. It does not retry defects
or fiber interruptions as typed failures.

`Schedule.spaced("1 second")` delays retries; it does not delay the first
attempt. The delay happens before each retry begins.

`Schedule.recurs(n)` counts scheduled recurrences, not total executions. With
`Effect.retry`, a recurrence is a retry. With `Effect.repeat`, a recurrence is a
repeat after a successful original execution.
