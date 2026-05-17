---
book: Effect `Schedule` Cookbook
section_number: "5.3"
section_title: "Retry every 5 seconds"
part_title: "Part II — Core Retry Recipes"
chapter_title: "5. Retry with Fixed Delays"
status: "draft"
code_included: true
---

# 5.3 Retry every 5 seconds

`Schedule.spaced("5 seconds")` gives a slower fixed-delay retry policy for work
that should not press an unhealthy dependency every few milliseconds.

## Problem

A remote dependency may need real recovery time before the next attempt is
useful. Retrying immediately, or every few hundred milliseconds, can add load
without increasing the chance of success.

## When to use it

Use this for idempotent calls to remote services, reconnect loops, or polling a
temporarily unavailable dependency when a five-second pause is acceptable.

It is also a simple default when a provider asks clients to slow down but does
not give a precise retry-after value.

## When not to use it

Do not leave this unbounded for request/response work. A five-second delay can
still accumulate quickly when the dependency stays down.

Do not use a fixed interval when each failure should change the delay. Rate
limits, overload, and fleet-wide retries usually need backoff, jitter, or
provider-specific timing.

## Schedule shape

With `Effect.retry`, the first call runs immediately. Each typed failure waits
five seconds before the next retry.

`Schedule.spaced("5 seconds").pipe(Schedule.both(Schedule.recurs(3)))` allows
the original attempt plus at most three retries. If all retries fail,
`Effect.retry` propagates the last typed failure.

## Code

```ts
import { Console, Data, Effect, Fiber, Ref, Schedule } from "effect"
import { TestClock } from "effect/testing"

class InventoryUnavailable extends Data.TaggedError("InventoryUnavailable")<{
  readonly attempt: number
}> {}

const fetchInventory = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`inventory attempt ${attempt}`)

  if (attempt < 2) {
    return yield* Effect.fail(new InventoryUnavailable({ attempt }))
  }

  return ["sku-123", "sku-456"]
})

const retryEvery5Seconds = Schedule.spaced("5 seconds").pipe(
  Schedule.both(Schedule.recurs(3))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)
  const fiber = yield* fetchInventory(attempts).pipe(
    Effect.retry(retryEvery5Seconds),
    Effect.forkScoped
  )

  yield* TestClock.adjust("5 seconds")

  const skus = yield* Fiber.join(fiber)
  yield* Console.log(`loaded ${skus.length} inventory records`)
}).pipe(Effect.provide(TestClock.layer()), Effect.scoped)

Effect.runPromise(program).then(() => undefined)
```

The retry policy contains a real five-second delay. The snippet advances a
virtual clock, so it still terminates immediately in `scratchpad/repro.ts`.

## Notes

`Schedule.spaced` waits after a typed failure; it does not delay the original
attempt.

`Schedule.recurs(3)` means three retries after the original attempt, not three
total attempts.

Keep the retry boundary around the transient operation itself, not around a
larger workflow that includes side effects that should not be repeated.
