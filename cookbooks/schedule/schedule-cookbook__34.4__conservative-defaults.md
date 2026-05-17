---
book: Effect `Schedule` Cookbook
section_number: "34.4"
section_title: "Conservative defaults"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "34. Stop After N Attempts"
status: "draft"
code_included: true
---

# 34.4 Conservative defaults

Conservative recurrence policies use small counts, visible delays, and explicit
classification at the call site.

## Problem

An unbounded or broadly shared recurrence policy can turn a small failure into a
larger operational problem. A retry loop without a low count can keep pressure
on an unhealthy dependency. A repeat loop without a stop condition can poll
forever. A policy that retries every typed error can hide validation,
authorization, or duplicate-write bugs.

Use a modest default shape: classify first, then retry or repeat with a low
recurrence count and a visible delay.

## When to use it

Use this when adding the first retry or repeat policy to a call site and there
is no stronger domain-specific policy yet.

It fits user-facing requests, control-plane calls, health checks, short polling
loops, and background jobs where a couple of extra attempts are useful but a
long tail would make behavior harder to reason about.

It is also a good review baseline. If a caller needs more retries, faster
spacing, or a longer polling window, that choice should be justified by the
operation's safety and service-level expectations.

## When not to use it

Do not use conservative scheduling to make permanent failures look transient.
Validation errors, authentication failures, authorization failures, malformed
requests, and unsafe non-idempotent writes should fail before the schedule is
applied.

Do not use a low retry count as a substitute for idempotency. Retrying a
non-idempotent operation is still unsafe unless the operation has duplicate
protection such as an idempotency key.

Do not use one default policy everywhere. A UI read, a queue worker, and a
database reconnect loop usually deserve different counts, spacing, and
classification.

## Schedule shape

Start with the smallest useful recurrence budget. For many call sites, that is
two or three retries after the original attempt.

For retrying typed failures, combine spacing with a recurrence limit:
`Schedule.spaced(duration).pipe(Schedule.both(Schedule.recurs(n)))`.

With `Effect.retry`, the first attempt runs immediately and typed failures are
fed into the schedule. With `Effect.repeat`, the first successful value is
produced immediately and successful values are fed into the schedule.

## Code

```ts
import { Console, Effect, Ref, Schedule } from "effect"

type ServiceError = {
  readonly _tag: "ServiceError"
  readonly reason: "Unavailable" | "RateLimited" | "BadRequest"
  readonly attempt: number
}

const isRetryable = (error: ServiceError): boolean =>
  error.reason === "Unavailable" || error.reason === "RateLimited"

const callService = Effect.fnUntraced(function*(
  attempts: Ref.Ref<number>
) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`service attempt ${attempt}`)

  if (attempt === 1) {
    return yield* Effect.fail({
      _tag: "ServiceError",
      reason: "Unavailable",
      attempt
    } as const)
  }

  if (attempt === 2) {
    return yield* Effect.fail({
      _tag: "ServiceError",
      reason: "RateLimited",
      attempt
    } as const)
  }

  return "accepted"
})

const conservativeRetry = Schedule.spaced("20 millis").pipe(
  Schedule.both(Schedule.recurs(2))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const result = yield* callService(attempts).pipe(
    Effect.retry({
      schedule: conservativeRetry,
      while: isRetryable
    })
  )
  yield* Console.log(`result: ${result}`)
})

Effect.runPromise(program)
```

The original call runs immediately. The policy allows at most two retries after
that call, spaced by 20 milliseconds in this runnable example. `BadRequest` is a
typed failure too, but the `while` predicate would stop retrying it immediately.

## Variants

For a slightly more forgiving user-facing read, use exponential backoff but keep
the count small. For background workers started by many processes, add jitter
after the base policy. For short polling, repeat successful checks with a clear
count and a predicate over the status value.

## Notes and caveats

`Schedule.recurs(n)` means `n` recurrences after the original execution. For
`Effect.retry`, that means `n` retries after the first attempt. For
`Effect.repeat`, that means `n` repeats after the first successful run.

Spacing protects the dependency and makes behavior observable. Even a low retry
count can be too aggressive if all retries happen immediately.

Classification belongs next to the effect being retried or repeated. The
schedule should express mechanics: delay, count, jitter, and stop conditions.
The domain code should decide whether a failure or value is eligible to recur.

Low counts are defaults, not guarantees of safety. If many fibers can hit the
same dependency at once, combine conservative schedules with admission control
such as bounded concurrency, queues, or rate limits.
