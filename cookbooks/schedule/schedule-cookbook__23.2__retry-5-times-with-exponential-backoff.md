---
book: "Effect `Schedule` Cookbook"
section_number: "23.2"
section_title: "Retry 5 times with exponential backoff"
part_title: "Part VI — Composition and Termination"
chapter_title: "23. Combine Limits and Delays"
status: "draft"
code_included: true
---

# 23.2 Retry 5 times with exponential backoff

Exponential backoff is a good default when a failure may be temporary but
retrying immediately would add pressure to the dependency. The retry limit is
what makes that policy operationally bounded.

## Problem

You call a dependency that sometimes fails with a transient error. The operation
is safe to retry, but it should not retry forever and it should not hammer the
dependency while it is unhealthy.

You want the policy to say three things clearly:

- run the original attempt immediately
- after each failure, wait with exponential backoff
- stop after five scheduled retries

## When to use it

Use this recipe for idempotent work where a later attempt can reasonably
succeed: reading from an overloaded service, refreshing cached metadata,
submitting a deduplicated event, or calling an internal API during a short
deploy window.

It is especially useful when code reviewers and operators need an exact answer
to "how many times can this run?" With `Schedule.recurs(5)`, the answer is one
original attempt plus at most five retries.

## When not to use it

Do not use backoff to hide permanent failures. Bad input, forbidden access,
missing credentials, nonexistent resources, and schema errors should fail
without retrying.

Do not retry unsafe writes unless the operation has an idempotency key,
transaction boundary, or another guarantee that repeated execution cannot
duplicate the side effect.

Do not treat a retry count as a latency budget. Five retries can still take too
long if each attempt blocks before failing. If callers need a hard elapsed-time
limit, add `Schedule.during` or put an explicit timeout around the operation.

## Schedule shape

Start with the delay shape, then add the retry limit.
`Schedule.exponential("200 millis")` starts with a 200 millisecond delay and,
with the default factor, doubles the delay on later recurrences.

`Schedule.recurs(5)` allows five scheduled recurrences. With `Effect.retry`,
those recurrences are retries after failures. `Schedule.both` requires both
schedules to continue, so the combined policy stops when the retry count is
exhausted.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type TransientError = {
  readonly _tag: "Timeout" | "Unavailable" | "RateLimited"
}

let attempts = 0

const callDownstream = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`downstream attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail({
      _tag: attempts === 1 ? "Timeout" : "Unavailable"
    } as TransientError)
  }

  return "response body"
})

const retryPolicy = Schedule.exponential("20 millis").pipe(
  Schedule.both(Schedule.recurs(5))
)

const program = callDownstream.pipe(
  Effect.retry(retryPolicy),
  Effect.matchEffect({
    onFailure: (error) =>
      Console.log(`failed with ${error._tag} after ${attempts} attempts`),
    onSuccess: (value) =>
      Console.log(`succeeded with "${value}" after ${attempts} attempts`)
  })
)

Effect.runPromise(program)
```

The example uses a `20 millis` base interval so it terminates quickly. With this
policy, `callDownstream` can run at most six times total: one original attempt
plus five retries.

## Variants

Use a larger base interval when the dependency needs more time to recover.

Use a smaller retry limit for user-facing requests where returning a clear error
quickly matters more than exhausting every recovery chance.

For fleet-wide retries, add jitter after the exponential cadence so identical
clients do not retry in lockstep.

## Notes and caveats

`Schedule.exponential` is unbounded on its own. Always combine it with a retry
limit, elapsed-time budget, predicate, or another stopping condition for
request/response work.

`Schedule.recurs(5)` counts retries, not total executions. If a requirement says
"try five times total", use `Schedule.recurs(4)`.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as ordinary typed failures.
