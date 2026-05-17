---
book: "Effect `Schedule` Cookbook"
section_number: "3.2"
section_title: "Retry a fixed number of times"
part_title: "Part I — Foundations"
chapter_title: "3. Minimal Building Blocks"
status: "draft"
code_included: true
---

# 3.2 Retry a fixed number of times

Use `Schedule.recurs(n)` with `Effect.retry` when the whole policy is "retry at
most `n` more times". A retry observes typed failures, meaning failures in the
Effect error channel, not defects or interruptions.

## Problem

An effect can fail transiently, and a small immediate retry budget is enough.
There is no delay, backoff, or error-specific filtering yet.

## When to use it

Use this for cheap, idempotent work where retrying immediately is acceptable.
Idempotent means running the operation more than once has the same external
effect as running it once, or the duplicates are safely ignored.

This is also a useful count limit inside a larger policy that later adds timing.

## When not to use it

Do not use immediate retries against overloaded dependencies, rate-limited APIs,
or slow remote calls. Those usually need spacing, backoff, jitter, or a narrower
error predicate.

Do not use retry to handle defects or fiber interruptions. `Effect.retry` only
retries typed failures.

## Schedule shape

`Effect.retry` runs the effect once before the schedule is stepped. Each typed
failure is offered to the schedule:

- `Schedule.recurs(0)` allows no retries.
- `Schedule.recurs(1)` allows one retry, for two attempts total.
- `Schedule.recurs(3)` allows three retries, for four attempts total.

If a later attempt succeeds, retrying stops immediately. If the schedule stops
while the effect is still failing, the last typed failure is returned.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class RequestError extends Data.TaggedError("RequestError")<{
  readonly attempt: number
}> {}

let attempt = 0

const fetchUser = Effect.gen(function*() {
  attempt += 1
  yield* Console.log(`attempt ${attempt}`)

  if (attempt < 4) {
    return yield* Effect.fail(new RequestError({ attempt }))
  }

  return { id: "user-1", name: "Ada" }
})

const program = fetchUser.pipe(
  Effect.retry(Schedule.recurs(3)),
  Effect.tap((user) => Console.log(`loaded ${user.name}`))
)

Effect.runPromise(program)
```

The first three attempts fail. The policy permits exactly three retries, so the
fourth attempt can succeed.

## Variant

For one local call site, `Effect.retry({ times: 3 })` has the same retry-count
meaning as `Schedule.recurs(3)`. Prefer the schedule form when you want to name
the policy, pass it around, or compose it with timing.

## Notes

The retry count is not the total attempt count. If an external requirement says
"try three times total", use `Schedule.recurs(2)` or `times: 2`.

Keep the retry boundary small. Retry the operation that may transiently fail,
not a larger workflow that also performs side effects that should not be
repeated.
