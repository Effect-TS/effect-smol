---
book: Effect `Schedule` Cookbook
section_number: "5.2"
section_title: "Retry every second"
part_title: "Part II — Core Retry Recipes"
chapter_title: "5. Retry with Fixed Delays"
status: "draft"
code_included: true
---

# 5.2 Retry every second

`Schedule.spaced("1 second")` is the plain fixed-delay retry policy: wait one
second after each typed failure, then try the same effect again.

## Problem

The failure may be temporary, but immediate retries would create noisy logs,
extra load, or confusing traces. You want a readable retry cadence with no
growth, jitter, or error-dependent timing.

## When to use it

Use this for idempotent calls where one retry per second is acceptable:
short reconnects, brief service restarts, status reads, or local coordination.
The delay is long enough to be visible in logs and short enough for many
operator-facing workflows.

Add a retry limit unless some outer scope is responsible for interrupting the
fiber.

## When not to use it

Do not use this for failures that can last a long time when the caller needs a
clear final error. `Schedule.spaced("1 second")` does not stop on its own.

Do not use it for overloaded or rate-limited dependencies that need callers to
spread out over time. Backoff, jitter, or server-provided retry metadata is a
better fit.

## Schedule shape

With `Effect.retry`, the first attempt runs immediately. If it fails with a
typed failure, the schedule waits one second before the next attempt.

Combined with `Schedule.recurs(4)`, the policy permits four retries after the
original attempt. The spaced schedule supplies the delay; the recurrence
schedule supplies the stopping condition.

## Code

```ts
import { Console, Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly attempt: number
}> {}

const fetchStatus = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`status attempt ${attempt}`)

  if (attempt < 3) {
    return yield* Effect.fail(new ServiceUnavailable({ attempt }))
  }

  return { status: "ok" as const, value: "ready" }
})

const retryEverySecond = Schedule.spaced("1 second").pipe(
  Schedule.both(Schedule.recurs(4))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* fetchStatus(attempts).pipe(
    Effect.retry(retryEverySecond),
    Effect.forkScoped
  )

  yield* TestClock.adjust("1 second")
  yield* TestClock.adjust("1 second")

  const result = yield* Fiber.join(fiber)
  yield* Console.log(`status: ${result.status}, value: ${result.value}`)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program).then(() => undefined)
```

The example logs two failed attempts, advances virtual time for the two
one-second delays, and then logs the successful status value.

## Notes

`Schedule.spaced("1 second")` delays retry attempts only. It does not delay the
first execution.

The delay is measured after a failure before the next retry begins. It does not
make the whole operation run on a strict one-second wall-clock interval.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.
