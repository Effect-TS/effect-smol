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

Linear backoff is a retry shape for contention that should clear quickly. It
gives competing work a little room without jumping straight to long exponential
delays.

In Effect, there is no special `Schedule.linear` constructor. Build the shape
from a finite counter schedule and add a delay derived from the retry count.

## Problem

Several workers update the same database row. Most updates succeed immediately,
but sometimes one worker loses an optimistic-lock race and receives a conflict.
Retrying immediately tends to collide with the transaction that just won. Waiting
too long hurts throughput because the conflict usually clears quickly.

Use a small, finite linear backoff for conflicts, and return non-contention
failures immediately.

```ts
const updateConflictBackoff = Schedule.recurs(5).pipe(
  Schedule.addDelay((retry) => Effect.succeed(Duration.millis((retry + 1) * 100)))
)
```

This retries at most five times after the original attempt, with additional
delays of 100ms, 200ms, 300ms, 400ms, and 500ms.

## When to use it

Use this recipe for moderate contention where a short wait usually gives another
actor time to release the shared resource: optimistic database row updates,
queue lease acquisition, advisory locks, or compare-and-set writes.

The operation must be safe to attempt again. For a row update, that usually
means the effect reloads the current row version or submits a conditional update
that the database can reject without applying partial changes.

Linear backoff is a good middle ground when fixed delay is too aggressive under
contention, but exponential backoff would slow recovery more than the domain
requires.

## When not to use it

Do not retry errors that are not contention signals. Validation failures,
missing rows, authorization failures, and malformed updates should surface
without spending the retry budget.

Do not use this around a broad workflow that has already emitted notifications,
published messages, or made non-idempotent external calls. Put the retry around
the smallest duplicate-safe operation.

For heavy fleet-wide contention, add jitter or use a stronger coordination
strategy. A deterministic linear schedule can still synchronize many workers if
they all start at the same time.

## Schedule shape

`Schedule.recurs(5)` supplies the retry budget and outputs a zero-based retry
count. `Schedule.addDelay` computes the wait for the next retry from that count.
Using `(retry + 1) * 100` produces a linear series where the first retry waits
100 milliseconds, the second waits 200 milliseconds, and so on.

With `Effect.retry`, the first update attempt runs immediately. The schedule is
consulted only after a typed failure. The `while` predicate keeps the retry
boundary explicit by allowing only conflicts to consume the schedule.

## Code

```ts
import { Data, Duration, Effect, Schedule } from "effect"

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

interface AccountPatch {
  readonly accountId: string
  readonly expectedVersion: number
  readonly balanceDelta: number
}

interface Account {
  readonly id: string
  readonly version: number
  readonly balance: number
}

declare const updateAccountBalance: (
  patch: AccountPatch
) => Effect.Effect<Account, UpdateError>

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
  Schedule.addDelay((retry) => Effect.succeed(Duration.millis((retry + 1) * 100)))
)

const program = updateAccountBalance({
  accountId: "acct_123",
  expectedVersion: 41,
  balanceDelta: -250
}).pipe(
  Effect.retry({
    schedule: updateConflictBackoff,
    while: isContention
  })
)
```

`program` retries only `RowConflict`. A missing row or invalid patch is returned
immediately. If every permitted retry still sees a conflict, `Effect.retry`
returns the last `RowConflict`.

## Variants

For queue lease acquisition, use the same schedule around the lease claim
effect and retry only the typed "already leased" failure.

```ts
class LeaseAlreadyHeld extends Data.TaggedError("LeaseAlreadyHeld")<{
  readonly jobId: string
}> {}

declare const claimLease: (jobId: string) => Effect.Effect<void, LeaseAlreadyHeld>

const leaseBackoff = Schedule.recurs(4).pipe(
  Schedule.addDelay((retry) => Effect.succeed(Duration.millis((retry + 1) * 50)))
)

const claimJob = claimLease("job-456").pipe(
  Effect.retry(leaseBackoff)
)
```

For a busier shared resource, keep the linear shape but add jitter after the
base delay is correct:

```ts
const jitteredUpdateConflictBackoff = updateConflictBackoff.pipe(
  Schedule.jittered
)
```

For a user-facing request, reduce the retry budget before increasing delays.
The caller usually cares more about a quick answer than about waiting through a
long contention window.

## Notes and caveats

`Schedule.addDelay` adds delay to the schedule's next recurrence; it does not
delay the original attempt.

`Schedule.recurs(5)` means five retries after the original attempt, not five
total executions.

The retry predicate sees typed failures from the error channel. Defects and
fiber interruptions are not retried as typed failures.

If each retry must use a freshly loaded version number, put that read inside the
retried effect. A schedule can control timing and limits, but it should not hide
the domain logic that makes a retry correct.
