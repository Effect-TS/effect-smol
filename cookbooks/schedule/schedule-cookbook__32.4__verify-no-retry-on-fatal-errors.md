---
book: "Effect `Schedule` Cookbook"
section_number: "32.4"
section_title: "Verify no retry on fatal errors"
part_title: "Part VIII — Observability and Testing"
chapter_title: "32. Testing Recipes"
status: "draft"
code_included: true
---

# 32.4 Verify no retry on fatal errors

Retry tests should prove classification as well as timing. A schedule may allow
several recurrences, but a fatal domain error should bypass the retry loop.

## Problem

The operation exposes one typed error channel with both transient and fatal
cases. Run a fatal fixture under a policy that would retry transient failures,
then check that the fatal error is returned after one evaluation.

## When to use it

Use this test when the retry boundary receives classified domain errors such as
`RateLimited`, `Timeout`, `InvalidCredentials`, or `MalformedRequest`.

## When not to use it

Do not use a schedule predicate as the first place where errors are understood.
Classify errors near the effect that creates them, then let the schedule decide
recurrence for the retryable subset. Defects and interruptions are not typed
failures, so `Effect.retry` does not feed them into the retry schedule.

## Schedule shape

Use a schedule that would clearly retry if classification allowed it, then add a
classification predicate to the retry options.

```ts
import { Console, Data, Effect, Ref, Schedule } from "effect"

class TransientError extends Data.TaggedError("TransientError")<{
  readonly message: string
}> {}

class FatalError extends Data.TaggedError("FatalError")<{
  readonly message: string
}> {}

type ServiceError = TransientError | FatalError

const isTransient = (error: ServiceError): error is TransientError =>
  error._tag === "TransientError"

const request = Effect.fnUntraced(function*(
  attempts: Ref.Ref<number>,
  error: ServiceError
) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`attempt ${attempt}: ${error._tag}`)
  return yield* Effect.fail(error)
})

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  const error = yield* request(
    attempts,
    new FatalError({ message: "invalid credentials" })
  ).pipe(
    Effect.retry({
      schedule: Schedule.recurs(3),
      while: isTransient
    }),
    Effect.flip
  )

  const count = yield* Ref.get(attempts)
  yield* Console.log(`returned: ${error._tag}`)
  yield* Console.log(`total attempts: ${count}`)
})

Effect.runPromise(program)
```

## Why this catches regressions

`Schedule.recurs(3)` would permit up to three retry recurrences after the first
failure. The `while` predicate receives each typed failure before another
attempt is made. Because `FatalError` is not transient, the retry policy stops
immediately.

## Variants

Use `until` when the predicate reads more naturally as a stop condition, for
example `until: (error) => error._tag === "FatalError"`. Use `Schedule.spaced`,
`Schedule.exponential`, or a production retry policy in the test when you need
to verify that the same classification wraps the real schedule.

## Notes and caveats

This recipe is about typed domain errors. If an effect dies with a defect or is
interrupted, `Effect.retry` does not feed that cause into the retry schedule.
For typed failures, the schedule input is the failure value, so predicates such
as `while` and `until` can inspect the classified error before the next
recurrence.
