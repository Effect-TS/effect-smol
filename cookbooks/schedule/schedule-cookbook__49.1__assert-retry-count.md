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

Retry-count tests should assert how many times the effect was evaluated, not how
long the retry loop took. A deterministic schedule such as `Schedule.recurs(3)`
is enough when the behavior under test is "retry three times after the first
failure".

## Problem

You have an effect that should retry a fixed number of times, and you want a
test that catches off-by-one mistakes. The common mistake is treating
`Schedule.recurs(3)` as "three total attempts". With `Effect.retry`, the first
attempt happens before the schedule is consulted, so `Schedule.recurs(3)` allows
three retries after that first failed attempt.

## When to use it

Use this recipe when the important assertion is the retry budget itself:

- a permanently failing fixture should be evaluated `1 + retries` times
- a transient fixture should stop as soon as it succeeds
- a count-based policy should be tested without relying on real time

## When not to use it

Do not use this test shape to assert exact delays between attempts. Delay tests
need clock control and should make time advancement explicit. Also avoid
randomized schedules such as jittered policies in a retry-count test; test the
counting policy first, then test timing or jitter behavior separately.

## Schedule shape

Use `Schedule.recurs(n)` for a pure retry-count limit. According to
`Schedule.ts`, `recurs` creates a schedule that can be stepped the specified
number of times before it terminates, and its output is the current zero-based
recurrence count. In a retry loop, those recurrences are retries after failures;
they are not the original attempt.

## Code

```ts
import { assert, describe, it } from "@effect/vitest"
import { Effect, Exit, Ref, Schedule } from "effect"

type TestError = { readonly _tag: "TestError" }
const testError: TestError = { _tag: "TestError" }

describe("retry count", () => {
  it.effect("retries exactly three times after the first failure", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)

      const fixture = Effect.gen(function*() {
        yield* Ref.update(attempts, (n) => n + 1)
        return yield* Effect.fail(testError)
      })

      const exit = yield* fixture.pipe(
        Effect.retry(Schedule.recurs(3)),
        Effect.exit
      )
      const count = yield* Ref.get(attempts)

      assert.strictEqual(count, 4)
      assert.isTrue(Exit.isFailure(exit))
    }))
})
```

## Variants

To prove that retries stop after success, make the fixture fail while the
counter is below a threshold and succeed afterward. For example, with
`Schedule.recurs(3)`, a fixture that succeeds on the third evaluation should
leave the counter at `3`, not `4`, because `Effect.retry` stops once the effect
succeeds.

If the production policy also has spacing or backoff, keep the count assertion
focused on evaluations. For example, adding exponential spacing and combining it
with `Schedule.recurs(3)` still has a three-retry limit, but the elapsed time
depends on the schedule and on how the test advances the clock.

## Notes and caveats

This recipe asserts retry count deterministically. It does not prove that real
wall-clock timing will match a production environment. For timing behavior, use
clock-controlled tests and assert the schedule's delay behavior separately.

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. The same `Schedule.recurs(3)` value has
different meaning in those two contexts because retry recurrences follow
failures, while repeat recurrences follow successes.
