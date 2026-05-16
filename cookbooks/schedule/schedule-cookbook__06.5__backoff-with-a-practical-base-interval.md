---
book: Effect `Schedule` Cookbook
section_number: "6.5"
section_title: "Backoff with a practical base interval"
part_title: "Part II — Core Retry Recipes"
chapter_title: "6. Retry with Exponential Backoff"
status: "draft"
code_included: true
---

# 6.5 Backoff with a practical base interval

You want exponential backoff, but the starting delay matters. A base interval that is
too small can behave like immediate retry for the first few failures. A base interval
that is too large can make recoverable user-facing failures feel slow. This recipe keeps
the retry policy explicit: the schedule decides when another typed failure should be
attempted again and where retrying stops. The surrounding Effect code remains
responsible for domain safety, including which failures are transient, whether the
operation is idempotent, and how the final failure is reported.

## Problem

You want exponential backoff, but the starting delay matters. A base interval
that is too small can behave like immediate retry for the first few failures. A
base interval that is too large can make recoverable user-facing failures feel
slow.

Use `Schedule.exponential(base, factor?)` and choose `base` as the first real
pause you want after the original attempt fails. The default `factor` is `2`,
so `Schedule.exponential("500 millis")` waits about 500 milliseconds, then 1
second, then 2 seconds, then 4 seconds, and so on.

## When to use it

Use this recipe when retries should start quickly enough to recover from a
brief transient failure, but should become less frequent after repeated
failures. A base interval around a few hundred milliseconds is often practical
for idempotent calls to remote services where an immediate retry is too
aggressive but a multi-second first retry is unnecessarily slow.

It is also a good default when moving from fixed delays to backoff. Keep the
first retry in the same rough range as the fixed delay that already worked, then
let the exponential shape reduce pressure if failures continue.

## When not to use it

Do not use a tiny base interval such as 1 millisecond for remote dependencies.
The first retries still happen very quickly, and the policy can add load before
the dependency has had time to recover.

Do not choose a large base interval only because later retries need to be far
apart. The base controls the first retry. If the first retry should be quick but
later retries need a ceiling, that is a separate policy choice.

Do not retry non-idempotent writes unless the operation has a deduplication key,
transaction boundary, or another guarantee that repeated execution is safe.

## Schedule shape

`Schedule.exponential(base, factor?)` is an unbounded schedule. It always recurs
and returns the current duration between recurrences.

The delay formula is:

```ts
base * factor ** n
```

where `n` is the number of repetitions so far. With the default factor of `2`,
the delays double each time.

For a 500 millisecond base interval, the retry shape is:

- attempt 1: run immediately
- if attempt 1 fails: wait 500 milliseconds
- attempt 2: run again
- if attempt 2 fails: wait 1 second
- attempt 3: run again
- if attempt 3 fails: wait 2 seconds
- continue until an attempt succeeds, the fiber is interrupted, or a bounded
  variant stops the schedule

With `Effect.retry`, the first attempt is not delayed. The exponential schedule
is consulted only after a typed failure.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

class ServiceError extends Data.TaggedError("ServiceError")<{
  readonly status: number
}> {}

interface Account {
  readonly id: string
  readonly balance: number
}

declare const loadAccount: (id: string) => Effect.Effect<Account, ServiceError>

const isRetryableServiceError = (error: ServiceError) =>
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

const retryWithPracticalBackoff = {
  schedule: Schedule.exponential("500 millis"),
  times: 4,
  while: isRetryableServiceError
}

const program = loadAccount("account-123").pipe(
  Effect.retry(retryWithPracticalBackoff)
)
```

`program` calls `loadAccount("account-123")` once immediately. If it fails with
a retryable `ServiceError`, it waits 500 milliseconds and tries again. With the
default factor, later retry delays are about 1 second, 2 seconds, and 4 seconds.

The policy allows at most four retries after the original attempt. If the error
is not retryable, or if all permitted attempts fail, `Effect.retry` propagates
the last typed `ServiceError`.

## Variants

Use an explicit factor when the default doubling is too steep:

```ts
const retryWithGentlerBackoff = {
  schedule: Schedule.exponential("500 millis", 1.5),
  times: 4,
  while: isRetryableServiceError
}
```

With a 500 millisecond base and a factor of `1.5`, the first delays are about
500 milliseconds, 750 milliseconds, 1.125 seconds, and 1.687 seconds. This is
useful when you want backoff, but the operation is still expected to recover
quickly.

Use a named schedule when the retryability decision is handled elsewhere:

```ts
const retryBackoffUpTo4Times = Schedule.exponential("500 millis").pipe(
  Schedule.both(Schedule.recurs(4))
)

const program = loadAccount("account-123").pipe(
  Effect.retry(retryBackoffUpTo4Times)
)
```

This keeps the same base interval and retry budget, but retries every typed
failure produced by `loadAccount`.

## Notes and caveats

The base interval is the first delay after a typed failure, not a delay before
the original attempt.

`Schedule.exponential(base, factor?)` does not stop on its own. For
request/response work, combine it with `times`, `Schedule.recurs`, a predicate,
or another stopping condition.

The base should be chosen from the operation's real timing. For local
coordination, tens of milliseconds may be enough. For an external API, a few
hundred milliseconds or one second is usually more realistic than a tiny delay.
For slow recovery paths, start larger.

Caps and jitter are often important in production retry policies, especially
for large fleets or rate-limited services, but they are separate refinements.
This recipe is only about choosing a practical base interval for the exponential
shape.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.
