---
book: Effect `Schedule` Cookbook
section_number: "4.5"
section_title: "Retry until the first success"
part_title: "Part II — Core Retry Recipes"
chapter_title: "4. Retry a Few Times"
status: "draft"
code_included: true
---

# 4.5 Retry until the first success

You have an effect that may fail a few times before succeeding, and the first successful
attempt should complete the whole operation. This is the default behavior of
`Effect.retry`. This recipe keeps the retry policy explicit: the schedule decides when
another typed failure should be attempted again and where retrying stops. The
surrounding Effect code remains responsible for domain safety, including which failures
are transient, whether the operation is idempotent, and how the final failure is
reported.

## Problem

You have an effect that may fail a few times before succeeding, and the first
successful attempt should complete the whole operation.

This is the default behavior of `Effect.retry`. The retry policy is only
consulted after typed failures. If any attempt succeeds, retrying stops
immediately and the successful value is returned.

## When to use it

Use this when success means the work is done:

- Connecting to a service that may not be ready yet.
- Reading from a temporarily unavailable dependency.
- Retrying an idempotent request after transient typed failures.
- Waiting for the first successful response from an operation with a small retry
  budget.

The retry schedule should describe how many failed attempts are acceptable and,
when appropriate, how much delay to place between them.

## When not to use it

Do not use retry when the effect should continue after success. Retry is driven
by failures and stops on the first success; use `Effect.repeat` when successful
values should drive additional runs.

Do not use an unbounded retry policy for work that can fail forever unless the
operation is intentionally supervised and externally interruptible. A persistent
failure with `Schedule.forever` or an uncapped spaced schedule can keep running
indefinitely.

Do not retry effects that are unsafe to run more than once unless the repeated
side effects are intentional. Retrying a write usually needs idempotency,
deduplication, or another duplicate-handling strategy.

## Schedule shape

For `Effect.retry`, the schedule input is the typed error from the failed
attempt. The original effect runs once before the schedule is used.

After each typed failure:

- If the schedule continues, the effect is run again.
- If the schedule stops, the last typed failure is returned.
- If the next attempt succeeds, the whole retried effect succeeds immediately.

`Schedule.recurs(n)` allows at most `n` retries after the initial attempt. For
example, `Schedule.recurs(4)` permits up to five total executions, but fewer
executions happen when an earlier attempt succeeds.

## Code

```ts
import { Data, Effect, Ref, Schedule } from "effect"

class TemporaryError extends Data.TaggedError("TemporaryError")<{
  readonly attempt: number
}> {}

const flakyRequest = (attempts: Ref.Ref<number>) =>
  Ref.updateAndGet(attempts, (n) => n + 1).pipe(
    Effect.flatMap((attempt) =>
      attempt < 3
        ? Effect.fail(new TemporaryError({ attempt }))
        : Effect.succeed(`success on attempt ${attempt}`)
    )
  )

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  const value = yield* flakyRequest(attempts).pipe(
    Effect.retry(Schedule.recurs(4))
  )

  const totalAttempts = yield* Ref.get(attempts)
  return { value, totalAttempts }
})
```

`flakyRequest` fails on attempts 1 and 2, then succeeds on attempt 3. The
schedule allows up to four retries, but attempts 4 and 5 never run because
`Effect.retry` stops at the first success.

## Variants

For a count-only policy, the `times` option has the same retry-count meaning:

```ts
const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  return yield* flakyRequest(attempts).pipe(
    Effect.retry({ times: 4 })
  )
})
```

Use a schedule when you also need timing:

```ts
const policy = Schedule.spaced("200 millis").pipe(
  Schedule.take(4)
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  return yield* flakyRequest(attempts).pipe(
    Effect.retry(policy)
  )
})
```

Add `while` or `until` when only some failures should be retried:

```ts
const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  return yield* flakyRequest(attempts).pipe(
    Effect.retry({
      schedule: Schedule.spaced("200 millis").pipe(Schedule.take(4)),
      while: (error) => error._tag === "TemporaryError"
    })
  )
})
```

The first success still wins. The predicate and schedule only decide what to do
after failures.

## Notes and caveats

The Effect tests include a retry case that succeeds immediately with
`times: 10000`; the effect is evaluated once. A large retry budget does not
cause extra executions after success.

Plain `Effect.retry` does not run a fallback when the policy is exhausted. If
all permitted attempts fail and you need recovery behavior, use
`Effect.retryOrElse`.

Retry only observes typed failures. Defects and interruptions are not retried as
typed failures.

Prefer a bounded or otherwise controlled schedule when unbounded retry is risky.
For production dependencies, that usually means combining a retry count with a
delay or backoff policy.
