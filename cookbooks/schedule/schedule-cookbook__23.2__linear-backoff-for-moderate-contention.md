---
book: Effect `Schedule` Cookbook
section_number: "23.2"
section_title: "Linear backoff for moderate contention"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "23. Linear Backoff Recipes"
status: "draft"
code_included: true
---

# 23.2 Linear backoff for moderate contention

Moderate contention means another actor is holding or updating the same resource
for a short time. Linear backoff gives that actor room to finish without backing
off as sharply as an exponential policy.

## Problem

Several workers update the same database row. Most writes succeed immediately,
but an optimistic-lock conflict can occur when another worker commits first.
Retry only that contention signal, and retry it with a small finite delay ladder:

```text
100ms, 200ms, 300ms, 400ms, 500ms
```

Non-contention failures, such as validation errors or missing rows, should
return immediately.

## When to use it

Use this recipe around the smallest duplicate-safe operation: an optimistic row
update, queue lease claim, advisory lock acquisition, or compare-and-set write.

The effect being retried should reload or recheck the state it needs on each
attempt. The schedule controls timing; it does not make stale domain data
correct.

## When not to use it

Do not retry malformed input, authorization failures, missing resources, or
workflow steps that already emitted external side effects. For heavy fleet-wide
contention, add jitter or use a stronger coordination mechanism.

## Schedule shape

`Schedule.recurs(5)` gives five retries after the original attempt and emits a
zero-based retry count. `Schedule.addDelay` turns that count into a linear delay
by using `(retry + 1) * interval`.

With `Effect.retry`, the first update attempt is not delayed. The `while`
predicate decides which typed failures may consume the retry budget.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class RowConflict extends Data.TaggedError("RowConflict")<{
  readonly rowId: string
  readonly expectedVersion: number
}> {}

class RowNotFound extends Data.TaggedError("RowNotFound")<{
  readonly rowId: string
}> {}

class InvalidPatch extends Data.TaggedError("InvalidPatch")<{
  readonly reason: string
}> {}

type UpdateError = RowConflict | RowNotFound | InvalidPatch

interface Account {
  readonly id: string
  readonly version: number
  readonly balance: number
}

let attempts = 0

const updateAccountBalance = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`update attempt ${attempts}`)

  if (attempts <= 2) {
    return yield* Effect.fail(
      new RowConflict({ rowId: "acct_123", expectedVersion: 41 })
    )
  }

  return {
    id: "acct_123",
    version: 42,
    balance: 750
  } satisfies Account
})

const isContention = (error: UpdateError): boolean => {
  switch (error._tag) {
    case "RowConflict":
      return true
    case "RowNotFound":
    case "InvalidPatch":
      return false
  }
}

const updateConflictBackoff = Schedule.recurs(5).pipe(
  Schedule.addDelay((retry) => Effect.succeed(Duration.millis((retry + 1) * 20)))
)

const program = Effect.gen(function*() {
  const account = yield* updateAccountBalance.pipe(
    Effect.retry({
      schedule: updateConflictBackoff,
      while: isContention
    })
  )
  yield* Console.log(`updated ${account.id} at version ${account.version}`)
}).pipe(
  Effect.catch((error) => Console.log(`update failed: ${error._tag}`))
)

Effect.runPromise(program)
```

The code uses 20 millisecond steps to keep the example fast. Use the same shape
with a larger interval for a real database or queue client.

## Variants

For queue lease acquisition, retry only the typed "already leased" failure. For
a busier shared resource, keep the linear shape but apply `Schedule.jittered`
after the base delay is correct.

For user-facing requests, reduce the retry count before increasing the delay.
The caller usually needs a quick answer more than a long contention window.

## Notes and caveats

`Schedule.recurs(5)` means five retries after the original attempt, not five
total executions.

Defects and fiber interruptions are not retried as typed failures. If a retry
needs a fresh row version, put that read inside the retried effect.
