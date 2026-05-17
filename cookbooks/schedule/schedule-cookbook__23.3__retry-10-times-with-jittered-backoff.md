---
book: "Effect `Schedule` Cookbook"
section_number: "23.3"
section_title: "Retry 10 times with jittered backoff"
part_title: "Part VI — Composition and Termination"
chapter_title: "23. Combine Limits and Delays"
status: "draft"
code_included: true
---

# 23.3 Retry 10 times with jittered backoff

Use this policy when a transient failure should get several chances to recover
without every caller retrying at the same moments.

## Problem

You have an effect that may fail because a dependency is restarting,
overloaded, briefly unreachable, or returning a retryable service error. A plain
`Schedule.exponential` retry policy backs off over time, but it is unbounded by
itself. If many workers use the same deterministic backoff, they can also retry
at the same boundaries and create bursts.

You want the operation to retry at most ten times after the original attempt,
with exponential delays that are randomly adjusted around each computed delay.

## When to use it

Use this recipe for retryable, idempotent work that crosses a process or network
boundary: service calls, queue operations, cache fetches, database reconnects,
or client initialization. Ten retries is enough to ride out many short
incidents while still making exhaustion explicit.

It is especially useful when the same retry policy can run across many fibers,
workers, pods, or service instances. Jitter spreads retry traffic so fleet-wide
load is less likely to arrive as one coordinated spike.

## When not to use it

Do not use this policy for permanent failures such as validation errors,
authorization failures, malformed requests, or missing configuration. Classify
those errors before retrying.

Do not use it to make unsafe writes safe. Retried writes still need idempotency,
deduplication, transactions, or another domain guarantee that repeated
execution is acceptable.

Do not use ten retries as a default latency budget for interactive paths. A
user-facing request may need fewer retries, a smaller elapsed-time bound, or a
fallback once the dependency is still unavailable.

## Schedule shape

`Schedule.exponential("200 millis")` starts with a 200 millisecond delay and
doubles the base delay after each failed attempt.

`Schedule.jittered` modifies each recurrence delay between 80% and 120% of the
delay chosen by the schedule it wraps. With a 200 millisecond base, the first
retry waits somewhere from 160 to 240 milliseconds, the next retry is jittered
around 400 milliseconds, and so on.

`Schedule.both(Schedule.recurs(10))` adds the stopping condition. Both sides of
the composed schedule must continue, so the exponential schedule supplies the
delay while `Schedule.recurs(10)` supplies the retry limit.

With `Effect.retry`, the original effect runs immediately. `Schedule.recurs(10)`
means ten retries after that original execution, for up to eleven executions in
total.

## Example

```ts
import { Console, Data, Effect, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly status: number
}> {}

const statuses = [503, 503, 200] as const
let attempts = 0

const callService = Effect.gen(function*() {
  attempts += 1
  const status = statuses[attempts - 1] ?? 200

  yield* Console.log(`service attempt ${attempts}: ${status}`)

  if (status === 200) {
    return "ok"
  }

  return yield* Effect.fail(new ServiceUnavailable({ status }))
})

const retryTenTimesWithJitteredBackoff = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(10))
)

const program = callService.pipe(
  Effect.retry({
    schedule: retryTenTimesWithJitteredBackoff,
    while: (error) => error.status === 429 || error.status >= 500
  }),
  Effect.matchEffect({
    onFailure: (error) =>
      Console.log(`failed with HTTP ${error.status} after ${attempts} attempts`),
    onSuccess: (value) =>
      Console.log(`succeeded with ${value} after ${attempts} attempts`)
  })
)

Effect.runPromise(program)
```

The example uses a `10 millis` base interval so it terminates quickly. The
`while` predicate keeps non-retryable typed failures out of the schedule. If all
ten retries fail, `program` fails with the last `ServiceUnavailable`.

## Variants

Use a smaller retry budget when the caller needs a quick answer. Use a larger
starting delay when the dependency is already under pressure.

If the operation has a hard elapsed-time budget, add a time limit alongside the
attempt limit instead of relying on retry count alone.

## Notes and caveats

`Schedule.exponential` is unbounded by itself. Pair it with an attempt limit,
elapsed-time limit, predicate, or another stopping condition before using it as
a production retry policy.

`Schedule.jittered` changes timing only. It does not reduce the number of
callers that may retry, and it does not decide which failures are safe to retry.
Use admission control, concurrency limits, circuit breakers, or load shedding
when the fleet can still produce more retry traffic than the dependency can
handle.

The composed schedule output is a pair of outputs from the jittered exponential
schedule and the recurrence counter. Plain `Effect.retry` uses the schedule for
retry decisions and returns the retried effect's successful value, so that
nested output usually does not appear in application code.
