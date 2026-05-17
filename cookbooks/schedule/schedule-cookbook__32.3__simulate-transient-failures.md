---
book: "Effect `Schedule` Cookbook"
section_number: "32.3"
section_title: "Simulate transient failures"
part_title: "Part VIII — Observability and Testing"
chapter_title: "32. Testing Recipes"
status: "draft"
code_included: true
---

# 32.3 Simulate transient failures

Transient-failure tests should use a deterministic fixture. Random failure, a
live dependency, or wall-clock waiting makes the retry behavior hard to inspect.

## Problem

Model the dependency as an effect whose first few evaluations fail and whose
later evaluations may succeed. The tests should cover both sides of the retry
budget: recovery when the failures fit within the schedule, and final failure
when they outlast it.

## Schedule shape

Use a small deterministic policy such as
`Schedule.spaced("100 millis").pipe(Schedule.both(Schedule.recurs(3)))`.
`Schedule.spaced` adds the delay before each retry. `Schedule.recurs(3)` allows
three retries after the initial attempt. If the effect fails four times in a
row, `Effect.retry` returns the fourth failure.

## Example

```ts
import { Console, Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly attempt: number
}> {}

const retryPolicy = Schedule.spaced("100 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const flakyRequest = Effect.fnUntraced(function*(
  failuresBeforeSuccess: number,
  attempts: Ref.Ref<number>
) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`attempt ${attempt}`)

  if (attempt <= failuresBeforeSuccess) {
    return yield* Effect.fail(new ServiceUnavailable({ attempt }))
  }

  return "ok" as const
})

const successfulCase = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* flakyRequest(2, attempts).pipe(
    Effect.retry(retryPolicy),
    Effect.forkScoped
  )

  yield* TestClock.adjust("100 millis")
  yield* TestClock.adjust("100 millis")

  const result = yield* Fiber.join(fiber)
  const count = yield* Ref.get(attempts)
  yield* Console.log(`success case: ${result} after ${count} attempts`)
})

const exhaustedCase = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* flakyRequest(4, attempts).pipe(
    Effect.retry(retryPolicy),
    Effect.flip,
    Effect.forkScoped
  )

  yield* TestClock.adjust("100 millis")
  yield* TestClock.adjust("100 millis")
  yield* TestClock.adjust("100 millis")

  const error = yield* Fiber.join(fiber)
  const count = yield* Ref.get(attempts)
  yield* Console.log(
    `exhausted case: ${error._tag}(${error.attempt}) after ${count} attempts`
  )
})

const program = Effect.gen(function*() {
  yield* Console.log("recovers within budget")
  yield* successfulCase
  yield* Console.log("outlasts retry budget")
  yield* exhaustedCase
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program)
```

## Why this works

The fixture stores its attempt count in a `Ref`, so each call observes and
updates state inside `Effect`. The first run fails twice and succeeds on the
third evaluation. The second run fails four times; the policy allows only three
retries after the initial attempt, so the fourth failure is returned.

## Notes and caveats

Use `TestClock.adjust` for retry delays in tests. Do not make schedule tests
sleep on wall-clock time. Keep jitter out of this fixture; add a separate test
for jitter bounds if production uses `Schedule.jittered`.
