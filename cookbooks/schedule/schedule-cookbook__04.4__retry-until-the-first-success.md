---
book: "Effect `Schedule` Cookbook"
section_number: "4.4"
section_title: "Retry until the first success"
part_title: "Part II — Retry Recipes"
chapter_title: "4. Retry Limits and Simple Delays"
status: "draft"
code_included: true
---

# 4.4 Retry until the first success

`Effect.retry` stops as soon as one attempt succeeds. The schedule is only
consulted after typed failures.

## Problem

The operation may fail a few times, but the first success should complete the
whole workflow and leave any remaining retry budget unused.

## When to use it

Use this when success means the work is done: connecting to a service, reading a
temporarily unavailable value, or retrying an idempotent request after transient
typed failures.

Use `Effect.repeat` instead when successful values should drive more executions.

## Schedule shape

For `Effect.retry`, each typed failure is offered to the schedule:

- If the schedule continues, the effect is run again.
- If the schedule stops, the last typed failure is returned.
- If the next attempt succeeds, the whole retried effect succeeds immediately.

`Schedule.recurs(4)` permits up to five total executions, but fewer executions
happen when an earlier attempt succeeds.

## Code

```ts
import { Console, Data, Effect, Ref, Schedule } from "effect"

class TemporaryError extends Data.TaggedError("TemporaryError")<{
  readonly attempt: number
}> {}

const flakyRequest = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`attempt ${attempt}`)

  if (attempt < 3) {
    return yield* Effect.fail(new TemporaryError({ attempt }))
  }

  return `success on attempt ${attempt}`
})

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  const value = yield* flakyRequest(attempts).pipe(
    Effect.retry(Schedule.recurs(4))
  )

  const totalAttempts = yield* Ref.get(attempts)
  yield* Console.log(`${value}; total attempts: ${totalAttempts}`)
})

Effect.runPromise(program)
```

The schedule allows four retries, but attempts 4 and 5 never run because
attempt 3 succeeds.

## Variants

`Effect.retry({ times: 4 })` has the same count-only behavior. Add a schedule,
such as `Schedule.spaced("200 millis").pipe(Schedule.take(4))`, when failures
should be paced. Add `while` or `until` when only some typed failures should be
retried.

The first success still wins. Predicates and schedules only decide what happens
after failures.

## Notes

Plain `Effect.retry` does not run a fallback when the policy is exhausted. Use
`Effect.retryOrElse` when final failure should trigger recovery.

Prefer a bounded or otherwise controlled schedule when unbounded retry is risky.
For production dependencies, that usually means combining a retry count with a
delay or backoff policy.
