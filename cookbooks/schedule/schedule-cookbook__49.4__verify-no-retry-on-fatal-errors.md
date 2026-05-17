---
book: Effect `Schedule` Cookbook
section_number: "49.4"
section_title: "Verify no retry on fatal errors"
part_title: "Part XI — Observability and Testing"
chapter_title: "49. Testing Recipes"
status: "draft"
code_included: true
---

# 49.4 Verify no retry on fatal errors

Retry tests should prove classification as well as timing. A retry schedule may
allow several recurrences, but a fatal domain error should bypass that schedule
and return immediately.

## Problem

The operation exposes one typed error channel with both transient and fatal
cases. The test should run a fatal fixture under a policy that would retry
transient failures, then assert that the fatal error is returned and the attempt
count remains `1`.

## When to use it

Use this test when the retry boundary receives classified domain errors such as
`RateLimited`, `Timeout`, `InvalidCredentials`, or `MalformedRequest`. The test
locks in the contract that only retryable errors are allowed to enter the retry
loop.

## When not to use it

Do not use a schedule predicate as the first place where errors are understood.
Classify errors near the effect that creates them, then let the schedule decide
recurrence for the retryable subset. Also do not use retries for defects or
interruptions; `Effect.retry` does not treat them as typed failures.

## Schedule shape

Use a schedule that would clearly retry if classification allowed it, then add a
classification predicate to the retry options. The assertion should check the
observed error and the attempt count.

```ts
import { assert, describe, it } from "@effect/vitest"
import { Data, Effect, Ref, Schedule } from "effect"

class TransientError extends Data.TaggedError("TransientError")<{
  readonly message: string
}> {}

class FatalError extends Data.TaggedError("FatalError")<{
  readonly message: string
}> {}

type ServiceError = TransientError | FatalError

const isTransient = (error: ServiceError): error is TransientError =>
  error._tag === "TransientError"

describe("retry classification", () => {
  it.effect("does not retry fatal errors", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)

      const request = Ref.updateAndGet(attempts, (n) => n + 1).pipe(
        Effect.flatMap(() =>
          Effect.fail(new FatalError({ message: "invalid credentials" }))
        )
      )

      const error = yield* request.pipe(
        Effect.retry({
          schedule: Schedule.recurs(3),
          while: isTransient
        }),
        Effect.flip
      )

      assert.strictEqual(error._tag, "FatalError")
      assert.strictEqual(yield* Ref.get(attempts), 1)
    }))
})
```

## Why this catches regressions

`Schedule.recurs(3)` would permit up to three retry recurrences after the first
failure. The `while` predicate receives each typed failure before another
attempt is made. Because `FatalError` is not transient, the retry policy stops
immediately and the original fatal error is returned.

The attempt-count assertion is the important part of the test. Without it, the
test might still observe a fatal error after an accidental retry path.

## Variants

Use `until` when the predicate reads more naturally as a stop condition, for
example `until: (error) => error._tag === "FatalError"`. Use `Schedule.spaced`,
`Schedule.exponential`, or a production retry policy in the test when you need
to verify that the same classification wraps the real schedule.

## Notes and caveats

This recipe is about typed domain errors. If an effect dies with a defect or is
interrupted, `Effect.retry` does not feed that cause into the retry schedule.
For typed failures, the schedule input is the failure value, so predicates such
as `while` and schedule combinators such as `Schedule.while` can inspect the
classified error before the next recurrence.
