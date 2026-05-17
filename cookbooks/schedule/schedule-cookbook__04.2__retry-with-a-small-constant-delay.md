---
book: "Effect `Schedule` Cookbook"
section_number: "4.2"
section_title: "Retry with a small constant delay"
part_title: "Part II — Retry Recipes"
chapter_title: "4. Retry Limits and Simple Delays"
status: "draft"
code_included: true
---

# 4.2 Retry with a small constant delay

Combine `Schedule.spaced(duration)` with a count limit when immediate retries
are too aggressive but full backoff is unnecessary.

## Problem

The retry policy needs two constraints: wait a fixed amount before each retry,
and stop after a small number of retries.

## When to use it

Use this for short-lived failures where a tiny pause helps: local service
startup, brief lock contention, or an idempotent request to a dependency that
usually recovers quickly.

Do not use a constant delay as the default for overloaded or rate-limited
systems. Those usually need backoff, jitter, or error-specific handling.

## Schedule shape

`Schedule.spaced(duration)` keeps recurring with the same delay. `Schedule.recurs(n)`
caps the retry count. `Schedule.both` combines them with intersection semantics:
both schedules must continue, and the combined delay is the maximum of their
delays.

```ts
import { Console, Data, Effect, Schedule } from "effect"

class TemporaryRequestError extends Data.TaggedError("TemporaryRequestError")<{
  readonly attempt: number
}> {}

let attempt = 0

const request = Effect.gen(function*() {
  attempt += 1
  yield* Console.log(`attempt ${attempt}`)

  if (attempt < 4) {
    return yield* Effect.fail(new TemporaryRequestError({ attempt }))
  }

  return { id: "user-1", name: "Ada" }
})

const retryPolicy = Schedule.spaced("25 millis").pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = request.pipe(
  Effect.retry(retryPolicy),
  Effect.tap((user) => Console.log(`loaded ${user.name}`))
)

Effect.runPromise(program)
```

The policy allows three retries and waits 25 milliseconds before each retry.
The first execution is not delayed.

## Variants

For a local policy, `Effect.retry({ schedule: Schedule.spaced("25 millis"), times: 3 })`
expresses the same count and delay. Use the explicit schedule composition when
you want to name, reuse, or extend the policy.

Changing the duration changes only the pause between attempts; the retry count
is still controlled by `Schedule.recurs(3)`.

## Notes

`Effect.retry` stops at the first success. The combined schedule output is not
the final success value; it only controls whether and when another retry should
happen.

Keep the retried effect small and safe to run more than once.
