---
book: Effect `Schedule` Cookbook
section_number: "4.4"
section_title: "Retry immediately, but only briefly"
part_title: "Part II — Core Retry Recipes"
chapter_title: "4. Retry a Few Times"
status: "draft"
code_included: true
---

# 4.4 Retry immediately, but only briefly

Use `Schedule.recurs(n)` when a failure is likely to disappear right away and
only a small retry burst is acceptable.

## Problem

The policy should retry without delay, but it still needs a hard cap. The count
limit prevents an immediate retry loop from continuing indefinitely.

## When to use it

Use this when the operation is cheap, safe to repeat, and likely failing because
of a short local race or momentary unavailability. One or two immediate retries
is often enough.

Do not use this against dependencies that may be overloaded. Remote calls,
database reconnects, queue consumers, and rate-limited APIs usually need delay
or backoff.

## Schedule shape

`Schedule.recurs(times)` ignores its input and outputs a zero-based recurrence
count. With `Effect.retry`, the input is the typed error from the failed
attempt, but the successful result is still the value produced by the retried
effect.

The count is a retry count:

- `Schedule.recurs(0)` allows no retries.
- `Schedule.recurs(1)` allows one retry.
- `Schedule.recurs(2)` allows two retries.

## Code

```ts
import { Console, Data, Effect, Ref, Schedule } from "effect"

class CacheBusy extends Data.TaggedError("CacheBusy")<{
  readonly attempt: number
}> {}

const readSnapshot = Effect.fnUntraced(function*(attempts: Ref.Ref<number>) {
  const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
  yield* Console.log(`attempt ${attempt}`)

  if (attempt <= 2) {
    return yield* Effect.fail(new CacheBusy({ attempt }))
  }

  return { version: "v1", entries: 42 }
})

const retryBriefly = Schedule.recurs(2)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  const snapshot = yield* readSnapshot(attempts).pipe(
    Effect.retry(retryBriefly)
  )

  yield* Console.log(`snapshot ${snapshot.version}: ${snapshot.entries} entries`)
})

Effect.runPromise(program)
```

The first two attempts fail, and the second retry succeeds. If the third attempt
failed too, `Effect.retry` would return that final `CacheBusy` failure.

## Variants

For a local policy, `Effect.retry({ times: 2 })` has the same retry-count
meaning. Keep `Schedule.recurs(2)` when the policy should be named, shared, or
combined with timing later.

## Notes

The first attempt always runs. If it succeeds, no retry happens.

This recipe deliberately avoids delay, backoff, and jitter. Once the operation
crosses a process, network, or rate-limit boundary, use a paced retry policy.
