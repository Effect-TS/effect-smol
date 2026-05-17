---
book: "Effect `Schedule` Cookbook"
section_number: "2.2"
section_title: "Retrying failed effects"
part_title: "Part I — Foundations"
chapter_title: "2. `repeat` vs `retry`"
status: "draft"
code_included: true
---

# 2.2 Retrying failed effects

Use `Effect.retry` when a typed failure may be temporary and the same effect may
be attempted again safely.

## Problem

Retrying is not the same as repeating. `retry` is driven by failures. The
original effect runs once. If it succeeds, retrying is never started. If it
fails with a typed error, the retry policy decides whether another attempt is
allowed.

## When to use it

Use `retry` for transient inability to complete an operation: temporary network
errors, rate limits modeled as typed failures, reconnect attempts, resource
contention, or startup dependencies that may become available soon.

Put the retry around the smallest operation that is safe to run more than once.
Retrying an entire workflow can duplicate side effects that already succeeded.

## When not to use it

Do not use `retry` for successful domain states. A successful `"pending"` status
should usually be repeated or polled, not turned into an error only so retry can
see it.

Do not rely on retry for defects or interruptions. `Effect.retry` retries typed
failures from the error channel; defects and interruptions are not retried as
typed failures.

## Schedule shape

The schedule input is the typed failure from the failed attempt. If a later
attempt succeeds, the whole effect succeeds with that value. If the schedule is
exhausted while attempts are still failing, the last typed failure is returned.

`times: 3` and `Schedule.recurs(3)` both mean up to three retries after the first
attempt. The effect may run four times total.

Use a raw schedule when timing, composition, or reuse matters. Use options such
as `while`, `until`, and `times` when the policy is local to one call site.

## Example

This request fails twice with a retryable error, then succeeds:

```ts
import { Console, Data, Effect, Schedule } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{
  readonly status: number
  readonly retryable: boolean
}> {}

let attempts = 0

const request = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`request attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail(
      new HttpError({ status: 503, retryable: true })
    )
  }

  return "response body"
})

const retryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(4))
)

const program = Effect.gen(function*() {
  const body = yield* request.pipe(
    Effect.retry({
      schedule: retryPolicy,
      while: (error) => error.retryable
    })
  )

  yield* Console.log(`retry result: ${body}`)
})

Effect.runPromise(program)
```

The `while` predicate is checked after each typed failure. If it returns
`false`, retrying stops and that error is returned. If it returns `true`, the
schedule still has to allow another attempt.

## Common mistakes

- Counting `times` or `Schedule.recurs` as total executions. They count retries
  after the first attempt.
- Expecting retry to continue after success. The first success completes the
  whole effect.
- Retrying a larger workflow when only one operation is idempotent.
- Using an unbounded schedule when an operational limit is required.
- Treating defects or interruptions as retryable typed failures.

## Practical guidance

Use `retry` when the failure is expected to be temporary and the operation is
safe to attempt again. Add a count, elapsed-time budget, delay, backoff, or
jitter when retrying crosses a process or network boundary.

If all attempts fail and you need a fallback value or recovery effect, use
`Effect.retryOrElse`. Plain `Effect.retry` preserves the final failure.
