---
book: Effect `Schedule` Cookbook
section_number: "49.1"
section_title: "Assert retry count"
part_title: "Part XI — Observability and Testing"
chapter_title: "49. Testing Recipes"
status: "draft"
code_included: true
---

# 49.1 Assert retry count

Retry-count tests should count effect evaluations. They should not infer retry
count from elapsed time or from the schedule output.

## Problem

`Schedule.recurs(3)` is often misread as "three total attempts". With
`Effect.retry`, the original attempt runs first. The schedule is consulted only
after a typed failure, so three recurrences means three retries after that
original attempt.

## When to use it

Use this shape when the contract is the retry budget:

- a permanently failing fixture should be evaluated `1 + retries` times
- a transient fixture should stop as soon as it succeeds
- a count-based policy should be tested without relying on real time

## When not to use it

Do not use a count test to prove delay behavior. Delay tests need clock control.
Also keep jitter out of this test; random delay changes make the timing
contract harder to see and do not affect the retry count.

## Schedule shape

Use `Schedule.recurs(n)` for a pure retry-count limit. Its output is the
zero-based recurrence count, but for this test the important value is the number
of times the effect itself was evaluated.

## Code

```ts
import { Console, Effect, Exit, Ref, Schedule } from "effect"

type TestError = { readonly _tag: "TestError" }
const testError: TestError = { _tag: "TestError" }

const alwaysFails = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`attempt ${attempt}`)
  return yield* Effect.fail(testError)
})

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  const exit = yield* alwaysFails(attempts).pipe(
    Effect.retry(Schedule.recurs(3)),
    Effect.exit
  )

  const totalAttempts = yield* Ref.get(attempts)
  yield* Console.log(`total attempts: ${totalAttempts}`)
  yield* Console.log(`failed: ${Exit.isFailure(exit)}`)
})

Effect.runPromise(program)
```

## Variants

To prove early success, make the fixture fail while the counter is below a
threshold and succeed afterward. With `Schedule.recurs(3)`, a fixture that
succeeds on the third evaluation should leave the counter at `3`, because
`Effect.retry` stops as soon as the effect succeeds.

If the production policy also has spacing or backoff, keep the count assertion
focused on evaluations. The timing policy can be tested separately with
`TestClock`.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. The same `Schedule.recurs(3)` value has
different operational meaning in those two contexts because retry recurrences
follow failures, while repeat recurrences follow successes.
