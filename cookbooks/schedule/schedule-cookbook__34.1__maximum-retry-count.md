---
book: Effect `Schedule` Cookbook
section_number: "34.1"
section_title: "Maximum retry count"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "34. Stop After N Attempts"
status: "draft"
code_included: true
---

# 34.1 Maximum retry count

Use `Schedule.recurs` when a retry policy needs a hard count limit. The count is
part of the schedule, so reviewers can see exactly how many follow-up attempts
may happen after the first failed execution.

## Problem

You have an effect that may fail transiently, but it must not retry forever. The
policy should make the retry budget visible without adding manual counters,
mutable state, or sleeps around the effect.

The important detail is that the first execution is not counted as a retry.
`Effect.retry(effect, Schedule.recurs(3))` runs the effect once, then allows at
most three scheduled retries if the previous attempt fails. That means up to four
total attempts.

## When to use it

Use this recipe for transient failures where a small number of retries is useful:
temporary network errors, rate-limit responses that should be retried later, or
dependencies that may briefly be unavailable.

It is also a good fit when operators need a concrete answer to "how many times
can this call happen?" For example, `Schedule.recurs(2)` means one initial call
plus at most two retries.

## When not to use it

Do not use a retry count to hide permanent failures. Validation errors,
authorization failures, malformed requests, and unsafe non-idempotent writes
should usually fail without retrying.

Do not use `Schedule.recurs` by itself when retry timing matters. It limits the
number of recurrences, but it does not express a production-friendly backoff
shape. Pair it with a timing schedule when the caller should wait between
attempts.

## Schedule shape

`Schedule.recurs(n)` can be stepped at most `n` times before it terminates. With
`Effect.retry`, those steps are retries after failed executions of the original
effect.

Name the limit after retries, not total attempts:

- `Schedule.recurs(0)` means no retries.
- `Schedule.recurs(1)` means one retry, for up to two total attempts.
- `Schedule.recurs(3)` means three retries, for up to four total attempts.

Combine the count with a cadence when you also need spacing. `Schedule.both`
keeps both policies in force, so the retry loop stops when the retry count is
exhausted and uses the delay from the timing schedule.

## Code

```ts
import { Effect, Schedule } from "effect"

type RemoteError = { readonly _tag: "RemoteError" }

declare const callInventoryApi: Effect.Effect<string, RemoteError>

const retryLimit = Schedule.recurs(3)

export const program = callInventoryApi.pipe(
  Effect.retry(retryLimit)
)
```

This policy allows the initial call plus at most three retries. If all attempts
fail, the final failure is returned after the retry budget is exhausted.

Add spacing by composing the count with a timing schedule:

```ts
import { Effect, Schedule } from "effect"

type RemoteError = { readonly _tag: "RemoteError" }

declare const callInventoryApi: Effect.Effect<string, RemoteError>

const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

export const program = callInventoryApi.pipe(
  Effect.retry(retryPolicy)
)
```

## Variants

For a user-facing request, keep the number low so the caller receives a clear
answer quickly:

```ts
const userRequestRetries = Schedule.recurs(1)
```

For a background worker, combine the count with a backoff or elapsed-time budget:

```ts
const workerRetryPolicy = Schedule.exponential("250 millis").pipe(
  Schedule.both(Schedule.recurs(8)),
  Schedule.both(Schedule.during("30 seconds"))
)
```

For a fleet-wide policy, add `Schedule.jittered` to the timing schedule so many
instances do not retry together.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds successful
values into the schedule. The same `Schedule.recurs(3)` limit therefore means
"three retries" with `Effect.retry`, but "three successful recurrences after the
first success" with `Effect.repeat`.

The output of `Schedule.recurs` is the zero-based recurrence count. Use that for
instrumentation if needed, but keep the operational contract phrased in retries:
the original attempt happens before the schedule decides whether to recur.
