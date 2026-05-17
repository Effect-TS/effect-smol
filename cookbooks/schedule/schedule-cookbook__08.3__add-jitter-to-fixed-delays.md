---
book: Effect `Schedule` Cookbook
section_number: "8.3"
section_title: "Add jitter to fixed delays"
part_title: "Part II — Core Retry Recipes"
chapter_title: "8. Retry with Jitter"
status: "draft"
code_included: true
---

# 8.3 Add jitter to fixed delays

Use jitter with fixed delays when the cadence is right for one caller, but many
callers may otherwise retry on the same boundary.

## Problem

A fixed delay is simple and often sufficient. The downside is synchronization:
if many callers fail together, they also retry together after the same fixed
wait.

Wrap the fixed schedule with `Schedule.jittered`. A one-second delay becomes a
random delay between 800 milliseconds and 1.2 seconds; a 10 millisecond delay
becomes 8 to 12 milliseconds.

## When to use it

Use this for worker fleets, service clients, queue consumers, reconnect loops,
and background jobs where fixed spacing is acceptable but retry bursts are not.

This is also useful when exponential backoff is unnecessary. Keep the base
policy simple and add only enough randomness to spread callers.

## When not to use it

Do not use fixed-delay jitter when failures should slow retries substantially
over time. Use exponential or capped backoff first, then add jitter.

Do not use jitter as a retry limit or as a safety mechanism for non-idempotent
operations.

## Schedule shape

`Schedule.spaced("20 millis")` waits 20 milliseconds between retries forever.
After `Schedule.jittered`, each delay is randomized between 16 and 24
milliseconds. Pair it with `Schedule.recurs(5)` to stop after five retries.

The first attempt still runs immediately; jitter applies only to delays between
failed attempts.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class ApiUnavailable extends Data.TaggedError("ApiUnavailable")<{
  readonly endpoint: string
}> {}

let attempts = 0

const callApi: Effect.Effect<string, ApiUnavailable> = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`api attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new ApiUnavailable({
      endpoint: "https://api.example.test/items"
    }))
  }

  return "items"
})

const retryWithJitter = Schedule.spaced("20 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

const program = callApi.pipe(
  Effect.retry(retryWithJitter),
  Effect.tap((value) => Console.log(`loaded: ${value}`))
)

Effect.runPromise(program).then(() => undefined, console.error)
```

The call runs immediately. Failed attempts wait around 20 milliseconds, with
each wait randomized between 16 and 24 milliseconds. If the original attempt
and all five retries fail, `Effect.retry` propagates the last typed failure.

## Variants

Use a shorter fixed delay for cheap operations with brief expected recovery
time. Use a longer fixed delay for background work that should place less
pressure on a dependency.

When only some typed failures should retry, keep the same schedule and add a
`while` predicate in `Effect.retry`.

## Notes and caveats

Add jitter after choosing the base schedule. In this recipe, the base schedule
is fixed spacing, so jitter is a small random adjustment around that fixed
delay.

`Schedule.recurs(5)` means five retries after the original attempt, not five
total attempts.

`Effect.retry` retries typed failures from the error channel. Defects and fiber
interruptions are not retried as typed failures.
