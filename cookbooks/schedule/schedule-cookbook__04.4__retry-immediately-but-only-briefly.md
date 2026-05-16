---
book: Effect `Schedule` Cookbook
section_number: "4.4"
section_title: "Retry immediately, but only briefly"
part_title: "Part II — Core Retry Recipes"
chapter_title: "4. Retry a Few Times"
status: "draft"
code_included: true
---

# 4.4 Retry immediately, but only briefly

You have an operation that is worth trying again right away, but only a small number of
times. The failure is expected to be short-lived: a local resource was busy, a cache was
between states, or a dependency was just initialized by another fiber. This recipe keeps
the retry policy explicit: the schedule decides when another typed failure should be
attempted again and where retrying stops. The surrounding Effect code remains
responsible for domain safety, including which failures are transient, whether the
operation is idempotent, and how the final failure is reported.

## Problem

You have an operation that is worth trying again right away, but only a small
number of times. The failure is expected to be short-lived: a local resource was
busy, a cache was between states, or a dependency was just initialized by another
fiber.

Use `Schedule.recurs(n)` when the whole policy is "retry immediately, then stop
quickly". The schedule adds no delay by itself. It only caps how many retry
decisions can happen after the first failed attempt.

## When to use it

Use this recipe when a brief retry burst is acceptable and useful:

- The operation is cheap.
- The operation is safe to run more than once.
- The likely failure is a short local race or momentary unavailability.
- One, two, or three immediate retries are enough.

This is also useful in tests and small adapters where introducing time would
make the example noisier than the behavior being shown.

## When not to use it

Do not use immediate retries against a dependency that may already be
overloaded. Network calls, rate-limited APIs, database reconnects, and queue
consumers usually need a delay, backoff, or another pacing policy.

Do not use it for defects or interruptions. `Effect.retry` retries typed
failures from the error channel. Defects and interruptions are not retried as
typed failures.

Do not use it to hide an unsafe side effect. If the effect may have partly
succeeded before failing, make the operation idempotent or move the retry around
the smallest safe unit of work.

## Schedule shape

`Schedule.recurs(times)` returns a `Schedule<number>`. Its input is ignored, and
its output is the zero-based recurrence count. With `Effect.retry`, the schedule
is fed the typed error from each failed attempt, but the successful result of the
whole program is still the successful value of the original effect.

The count is a retry count, not a total attempt count:

- `Schedule.recurs(0)` allows no retries.
- `Schedule.recurs(1)` allows one retry, for up to two attempts total.
- `Schedule.recurs(2)` allows two retries, for up to three attempts total.

Because `Schedule.recurs` is built from a zero-duration schedule with a count
limit, each permitted retry is immediate. If every attempt fails, `Effect.retry`
propagates the last typed failure.

## Code

```ts
import { Data, Effect, Ref, Schedule } from "effect"

class CacheBusy extends Data.TaggedError("CacheBusy")<{
  readonly attempt: number
}> {}

const readSnapshot = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)

  if (attempt <= 2) {
    return yield* Effect.fail(new CacheBusy({ attempt }))
  }

  return { version: "v1", entries: 42 }
})

const retryBriefly = Schedule.recurs(2)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  return yield* readSnapshot(attempts).pipe(
    Effect.retry(retryBriefly)
  )
})
```

Here the first attempt fails with `CacheBusy`, the first retry fails with
`CacheBusy`, and the second retry succeeds. `Schedule.recurs(2)` is enough
because the policy allows two retries after the original attempt.

If `readSnapshot` failed on the third attempt too, `program` would fail with the
third `CacheBusy` value.

## Variants

For a local policy that does not need to be named or reused, use retry options:

```ts
const program = readSnapshot(attempts).pipe(
  Effect.retry({ times: 2 })
)
```

`times: 2` has the same retry-count meaning: one original attempt plus up to two
more attempts.

For a named policy, keep the schedule separate:

```ts
const retryTwiceImmediately = Schedule.recurs(2)

const program = readSnapshot(attempts).pipe(
  Effect.retry(retryTwiceImmediately)
)
```

This form is easier to pass around, test in isolation, or extend later.

## Notes and caveats

The first attempt always runs. If it succeeds, no retry happens; the
`Effect.retry` tests verify that a successful effect is evaluated once even with
a very large retry count.

Keep the retry count small. "Immediately, but only briefly" usually means one or
two retries, not a tight loop that waits for the world to change.

Remember the off-by-one rule when translating external requirements. If a system
says "try this at most three times total", use `Schedule.recurs(2)`.

This recipe deliberately avoids delay, backoff, and jitter. Once the operation
crosses a process, network, or rate-limit boundary, use a paced retry recipe
instead of an immediate burst.
