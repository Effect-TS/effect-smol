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
times with the same delay before each retry. Compose the spacing and retry
limit so both concerns are visible at the retry boundary.

## Problem

You need a bounded retry policy for a transient operation such as an inventory
lookup or startup check. The first attempt should happen right away. If it
fails, the next five retries should be spaced by a fixed interval.

The policy should make the off-by-one rule clear: "retry five times" means one
original attempt plus up to five retries, for at most six total attempts.

## When to use it

Use this recipe when the operation is safe to run again and a fixed pause is
enough recovery time. It fits idempotent HTTP requests, short dependency
outages, service startup checks, and reconnect attempts where a steady cadence
is easier to reason about than backoff.

It is also useful when logs and runbooks need a simple answer: the call is tried
once, then retried up to five more times at the chosen spacing.

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

Start with `Schedule.spaced` for the cadence, then add `Schedule.recurs(5)` as
the count guard. Combining them with `Schedule.both` means both schedules must
continue, so the policy stops when the retry count is exhausted.

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
import { Console, Data, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly service: string
}> {}

let attempts = 0

const fetchInventory = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`inventory attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail(
      new ServiceUnavailable({ service: "inventory" })
    )
  }

  return ["sku-123", "sku-456"] as const
})

const retry5TimesWithFixedSpacing = Schedule.spaced("20 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = fetchInventory.pipe(
  Effect.retry(retry5TimesWithFixedSpacing),
  Effect.matchEffect({
    onFailure: (error) =>
      Console.log(`failed with ${error._tag} after ${attempts} attempts`),
    onSuccess: (items) =>
      Console.log(`loaded ${items.length} items after ${attempts} attempts`)
  })
)

Effect.runPromise(program)
```

The example uses `20 millis` so it terminates quickly. Use the same shape with
`1 second`, or any other fixed interval, in application code.

## Variants

If you do not need to keep the output from `Schedule.recurs`, `Schedule.take(5)`
can express the same retry cap directly on the fixed-spacing schedule. For
`Effect.retry`, `take(5)` still means up to five retries after the original
attempt because schedule outputs correspond to scheduled retries.

Use a named count guard when the retry limit is important enough to read as its
own policy. If the requirement is "try the operation five times total", allow
only four retries with `Schedule.recurs(4)`.

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. It does not retry defects
or fiber interruptions as typed failures.

`Schedule.spaced("1 second")` delays retries; it does not delay the first
attempt. The delay happens before each retry begins.

`Schedule.recurs(n)` counts scheduled recurrences, not total executions. With
`Effect.retry`, a recurrence is a retry. With `Effect.repeat`, a recurrence is a
repeat after a successful original execution.
