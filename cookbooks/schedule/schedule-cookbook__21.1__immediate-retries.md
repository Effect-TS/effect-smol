---
book: Effect `Schedule` Cookbook
section_number: "21.1"
section_title: "Immediate retries"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "21. Choosing a Delay Strategy"
status: "draft"
code_included: true
---

# 21.1 Immediate retries

Immediate retries run the same effect again after a typed failure without
waiting. In Effect, `Schedule.recurs(n)` is the direct way to say how many
extra attempts are allowed.

## Problem

A local operation can lose a brief race with startup, an in-process dependency,
or an optimistic-concurrency update. Add a small, visible retry budget without
adding sleeps or wrapping a larger workflow.

## When to use it

Use immediate retries when all of these are true:

- the operation is safe to repeat
- the expected failure window is shorter than a meaningful delay
- each attempt is cheap for the caller and the dependency
- a small count is enough to show the failure was not momentary

Keep the retry boundary close to the transient operation. Do not wrap unrelated
work that should not be repeated.

## When not to use it

Do not use immediate retries as a default production policy. A tight retry loop
can amplify load while a dependency is already unhealthy.

Do not use it for permanent errors such as validation failures, authorization
failures, missing configuration, malformed requests, or known non-idempotent
writes. Idempotent means repeating the operation has the same domain effect as
running it once.

If many fibers, processes, or nodes may fail together, prefer a delayed policy
and add jitter if synchronized retries are a risk.

## Schedule shape

`Schedule.recurs(2)` allows two recurrences after the first execution. With
`Effect.retry`, that means:

- attempt 1: run immediately
- if attempt 1 fails with a typed error: retry immediately
- if attempt 2 fails with a typed error: retry immediately
- if attempt 3 fails with a typed error: stop and return that failure

There is no scheduled waiting between those retries. The first execution is also
not controlled by the schedule; the schedule decides only whether a failure
should be followed by another attempt.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class LocalCacheError extends Data.TaggedError("LocalCacheError")<{
  readonly reason: string
}> {}

let attempts = 0

const readThroughCache = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`cache attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail(
      new LocalCacheError({ reason: "cache is still warming" })
    )
  }

  return "value-from-cache"
})

const retryTwiceImmediately = Schedule.recurs(2)

const program = readThroughCache.pipe(
  Effect.retry(retryTwiceImmediately)
)

Effect.runPromise(program).then((value) => {
  console.log(`result: ${value}`)
})
```

`program` performs `readThroughCache` once and may retry it twice immediately.
If all three attempts fail, `Effect.retry` returns the last typed failure. A
typed failure is a value in the Effect error channel; defects and interruptions
are not retried as ordinary failures.

## Variants

For a slightly less aggressive policy, use `Schedule.spaced` with
`Schedule.recurs`. For a remote dependency, prefer exponential backoff or
another delayed schedule; the extra latency is usually cheaper than sending
several requests into the same failing system at once.

## Notes and caveats

`Schedule.recurs(n)` counts retries after the original attempt, not total
attempts. `Schedule.recurs(2)` means at most three total executions: the first
try plus two retries.

Keep the count small. Once the policy needs more than a couple of retries, it is
no longer only covering a momentary race and should usually introduce delay.
