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

`Schedule.recurs` makes the retry count visible at the policy boundary.

## Problem

An effect may fail transiently, but it must not retry forever. The retry budget
should be reviewable without manual counters, mutable loop state, or sleeps
around the effect.

The first execution is not counted as a retry. `Schedule.recurs(3)` allows at
most three scheduled retries after that first execution, for up to four total
attempts.

## When to use it

Use this for transient failures where a small number of retries is useful:
temporary network errors, retryable rate-limit responses, or dependencies that
may briefly be unavailable.

It also gives operators a concrete answer to "how many times can this call
happen?" `Schedule.recurs(2)` means one initial call plus at most two retries.

## When not to use it

Do not use a retry count to hide permanent failures. Validation errors,
authorization failures, malformed requests, and unsafe non-idempotent writes
should usually fail without retrying.

Do not use `Schedule.recurs` by itself when retry timing matters. It limits the
number of recurrences, but it does not express backoff. Pair it with a timing
schedule when callers should wait between attempts.

## Schedule shape

`Schedule.recurs(n)` can be stepped at most `n` times before it terminates. With
`Effect.retry`, those steps are retries after failed executions of the original
effect.

Name the value after retries, not total attempts:

- `Schedule.recurs(0)` means no retries
- `Schedule.recurs(1)` means one retry, for up to two total attempts
- `Schedule.recurs(3)` means three retries, for up to four total attempts

Combine the count with a cadence using `Schedule.both` when spacing matters.

## Code

```ts
import { Console, Effect, Ref, Schedule } from "effect"

const callInventoryApi = Effect.fnUntraced(function*(
  attempts: Ref.Ref<number>
) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`inventory attempt ${attempt}`)

  if (attempt < 4) {
    return yield* Effect.fail({ _tag: "RemoteError", attempt } as const)
  }

  return "inventory-ok"
})

const retryLimit = Schedule.recurs(3)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const result = yield* callInventoryApi(attempts).pipe(
    Effect.retry(retryLimit)
  )
  yield* Console.log(`result: ${result}`)
})

Effect.runPromise(program)
```

The program succeeds on the fourth total attempt: one original call plus three
retries. If the fourth attempt failed, `Effect.retry` would return that last
typed failure.

## Variants

For user-facing requests, keep the number low so the caller receives a clear
answer quickly. For background workers, combine the count with backoff or an
elapsed-time budget such as `Schedule.during(duration)`.

For fleet-wide behavior, add jitter to the timing schedule so many instances do
not retry together. The count still remains the hard retry budget.

## Notes and caveats

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds
successful values into the schedule. The same `Schedule.recurs(3)` therefore
means three retries with `Effect.retry`, but three successful recurrences after
the first success with `Effect.repeat`.

The output of `Schedule.recurs` is the zero-based recurrence count. Use that for
instrumentation if needed, but keep the operational contract phrased in retries.
