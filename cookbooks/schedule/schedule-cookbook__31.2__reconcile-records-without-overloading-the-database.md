---
book: Effect `Schedule` Cookbook
section_number: "31.2"
section_title: "Reconcile records without overloading the database"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "31. Throttle Internal Work"
status: "draft"
code_included: true
---

# 31.2 Reconcile records without overloading the database

Database reconciliation jobs often start as a simple loop: read the next stale row,
write the derived state, mark the row reconciled, and immediately ask for more
work. That is fine for a handful of records, but it becomes a bursty database
client when a backlog appears.

Use one schedule for the worker cadence and another, much smaller schedule for
retrying a single record. The cadence protects the database from an unbounded
scan loop. The retry policy protects one idempotent reconciliation step from
short-lived database errors without turning permanent data problems into hidden
load.

## Problem

You need to reconcile many records, but each record may touch several tables or
indexes. Running the next record immediately after every successful write can
turn a recovery backlog into sustained write pressure. Retrying failed writes
without a limit can make the problem worse.

The schedule should make two different decisions visible:

- how much space to leave between records
- how many times it is safe to retry the same record after a transient failure

## When to use it

Use this recipe for background reconciliation, projection repair, denormalized
view updates, search-index catch-up, or any internal worker that processes
database records one at a time.

It works best when each reconciliation step is idempotent. For example, an
`upsert`, compare-and-set, or write guarded by a reconciliation version is safe
to retry because repeating the same record does not create duplicate side
effects.

## When not to use it

Do not put non-idempotent writes behind this retry policy. If retrying a record
can create a duplicate payment, duplicate email, or duplicate audit event, fix
that boundary before adding a schedule.

Also avoid using the schedule to bury permanent record errors. Invalid input,
missing required foreign keys, or authorization decisions should be recorded as
terminal reconciliation outcomes, not retried as if the database were briefly
unavailable.

## Schedule shape

Use `Schedule.spaced` for the worker loop because it waits after each record is
processed before the next repetition. Use `Schedule.exponential` plus
`Schedule.recurs` for the per-record retry so transient failures get a few
increasing delays and then stop. `Schedule.jittered` is useful when several
workers may retry at the same time; according to `Schedule.ts`, it adjusts each
delay to a random value between 80% and 120% of the original delay.

## Code

```ts
import { Data, Effect, Schedule } from "effect"

type RecordId = string

interface StaleRecord {
  readonly id: RecordId
  readonly version: number
}

class DatabaseUnavailable extends Data.TaggedError("DatabaseUnavailable")<{}> {}
class WriteConflict extends Data.TaggedError("WriteConflict")<{}> {}
class InvalidRecord extends Data.TaggedError("InvalidRecord")<{
  readonly id: RecordId
  readonly reason: string
}> {}

declare const loadNextStaleRecord: Effect.Effect<
  StaleRecord | undefined,
  DatabaseUnavailable
>

declare const upsertProjection: (
  record: StaleRecord
) => Effect.Effect<void, DatabaseUnavailable | WriteConflict | InvalidRecord>

declare const markReconciled: (
  id: RecordId
) => Effect.Effect<void, DatabaseUnavailable>

declare const markInvalid: (
  id: RecordId,
  reason: string
) => Effect.Effect<void, DatabaseUnavailable>

const retryTransientDatabaseErrors = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(3))
)

const betweenRecords = Schedule.spaced("250 millis").pipe(
  Schedule.recurs(1_000)
)

const reconcileRecord = Effect.fnUntraced(function*(record: StaleRecord) {
  const result = yield* Effect.result(upsertProjection(record))

  if (result._tag === "Failure") {
    if (result.error._tag === "InvalidRecord") {
      yield* markInvalid(result.error.id, result.error.reason)
      return
    }

    return yield* Effect.fail(result.error)
  }

  yield* markReconciled(record.id)
})

const reconcileNextRecord = Effect.gen(function*() {
  const record = yield* loadNextStaleRecord

  if (record === undefined) {
    return "idle" as const
  }

  yield* Effect.retry(
    reconcileRecord(record),
    retryTransientDatabaseErrors
  )

  return "reconciled" as const
})

export const program = Effect.repeat(reconcileNextRecord, betweenRecords)
```

## Why this works

`Effect.repeat` feeds successful values into the outer schedule, so the worker
waits 250 milliseconds after each completed iteration before asking the database
for another stale record. That gives the database predictable breathing room
even when there is a large backlog.

`Effect.retry` feeds failures into the inner schedule. Only failures that remain
after the record-level classification reach the retry policy. The `InvalidRecord`
case is handled once and marked as terminal, while database availability and
write conflict failures get up to three retry recurrences with jittered
exponential spacing.

## Variants

For a heavier reconciliation step, increase `betweenRecords` before increasing
parallelism. A wider gap is usually easier for the database to absorb than many
workers retrying at once.

For a small catch-up job, replace `Schedule.recurs(1_000)` with a lower bound so
the worker exits after a known number of records. For a long-running service,
keep the same spacing policy but pair it with queue metrics so operators can see
whether the backlog is shrinking.

## Notes and caveats

`Schedule.spaced("250 millis")` spaces repetitions from the last run rather than
anchoring them to a wall-clock interval. That is the right default for database
load smoothing because slow records naturally reduce throughput.

The retry schedule is intentionally local to one record. Do not wrap the whole
worker in a broad retry unless you want every failure, including classification
bugs, to restart the loop.
