---
book: "Effect `Schedule` Cookbook"
section_number: "4.6"
section_title: "Retry with different fixed delays for different environments"
part_title: "Part II — Retry Recipes"
chapter_title: "4. Retry Limits and Simple Delays"
status: "draft"
code_included: true
---

# 4.6 Retry with different fixed delays for different environments

Keep the retry shape stable and select only the delay from configuration. The
operation, retry budget, and retryability rules should not drift just because
the program is running locally, in staging, or in production.

## Problem

Development often benefits from shorter retry delays, while production should
avoid fast retry pressure. You need the environment to choose the fixed delay
without changing the rest of the policy.

## When to use it

Use this when the operation is safe to retry and timing is the only
environment-specific difference. It fits idempotent service calls, reconnects,
and dependency probes where local responsiveness and production restraint are
both useful.

## When not to use it

Do not use environment-specific delays to hide a different policy. If
production needs fewer retries, stricter error filtering, backoff, jitter, or a
fallback path, model that explicitly.

Do not make a non-idempotent operation safe by changing the delay. Duplicate
side effects still need a domain-level guarantee such as an idempotency key.

## Schedule shape

The environment selects a `Duration.Input`, and `Schedule.spaced(delay)` uses
that same delay before each retry.

Combining it with `Schedule.recurs(3)` keeps the shape bounded: one original
attempt, then at most three retries. `Schedule.both` requires both schedules to
continue; the spaced schedule supplies the delay, and the recurrence schedule
supplies the limit.

## Example

```ts
import { Console, Data, Duration, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

type Environment = "development" | "staging" | "production"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly attempt: number
}> {}

const request = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`request attempt ${attempt}`)

  if (attempt < 3) {
    return yield* Effect.fail(new RequestError({ attempt }))
  }

  return "accepted"
})

const retryDelays: Record<Environment, Duration.Input> = {
  development: "50 millis",
  staging: "250 millis",
  production: "1 second"
}

const retryPolicy = (environment: Environment) =>
  Schedule.spaced(retryDelays[environment]).pipe(
    Schedule.both(Schedule.recurs(3))
  )

const runRequest = Effect.fnUntraced(function*(
  environment: Environment,
  attempts: Ref.Ref<number>
) {
  return yield* request(attempts).pipe(
    Effect.retry(retryPolicy(environment))
  )
})

const program = Effect.gen(function*() {
  const environment: Environment = "production"
  const attempts = yield* Ref.make(0)
  const fiber = yield* runRequest(environment, attempts).pipe(Effect.forkScoped)

  yield* TestClock.adjust(retryDelays[environment])
  yield* TestClock.adjust(retryDelays[environment])

  const result = yield* Fiber.join(fiber)
  yield* Console.log(`result in ${environment}: ${result}`)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program).then(() => undefined)
```

The example uses the production delay, so each retry waits one virtual second.
Changing `environment` to `"development"` keeps the same retry limit and uses
50 milliseconds instead.

## Notes

`Schedule.spaced` is the usual fixed-delay constructor for retry policies. It
waits after a failure before the next attempt. `Schedule.fixed` is for
maintaining a recurring wall-clock cadence and is not the right default here.

The environment is selected when the policy is built. If configuration can
change at runtime, rebuild the policy at the boundary where `Effect.retry` is
called.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.
