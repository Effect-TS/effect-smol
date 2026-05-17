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

Reconciliation jobs need two policies: one for spacing successful records and
one for retrying a single idempotent record after a transient database failure.

## Problem

A stale-record backlog can turn a read, write, mark loop into sustained database
pressure. Each record may touch indexes, locks, or derived tables. Retrying a
failing write without a limit can make that pressure worse.

Keep the decisions separate: how long to wait between records, and how many
times to retry the same record when the database reports a transient error.

## When to use it

Use this for projection repair, denormalized view updates, search-index
catch-up, and similar workers that process records one at a time.

It fits idempotent steps: an `upsert`, compare-and-set, or version-guarded write
can be repeated without creating duplicate business effects.

## When not to use it

Do not retry non-idempotent writes such as payments, emails, or audit events
unless that boundary has its own deduplication guarantee.

Do not bury permanent record errors. Invalid input or missing required data
should become terminal reconciliation outcomes, not transient failures.

## Schedule shape

Use `Schedule.spaced` for the outer worker cadence. It waits after one record
finishes before the next record is loaded.

Use `Schedule.exponential` plus `Schedule.recurs` for record-local retry.
`Schedule.jittered` is useful when several workers may retry at the same time;
it randomizes each delay between 80% and 120% of the original delay.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

type RecordId = string

interface StaleRecord {
  readonly id: RecordId
  readonly version: number
  readonly valid: boolean
}

class DatabaseUnavailable extends Data.TaggedError("DatabaseUnavailable")<{
  readonly recordId: RecordId
  readonly attempt: number
}> {}

class InvalidRecord extends Data.TaggedError("InvalidRecord")<{
  readonly recordId: RecordId
  readonly reason: string
}> {}

const staleRecords: Array<StaleRecord> = [
  { id: "record-a", version: 1, valid: true },
  { id: "record-b", version: 3, valid: true },
  { id: "record-c", version: 2, valid: false }
]

const attempts = new Map<RecordId, number>()

const loadNextStaleRecord = Effect.sync(() => staleRecords.shift()).pipe(
  Effect.tap((record) =>
    record === undefined
      ? Console.log("no stale records remain")
      : Console.log(`loaded ${record.id}`)
  )
)

const upsertProjection = (record: StaleRecord) =>
  Effect.gen(function*() {
    if (!record.valid) {
      return yield* Effect.fail(
        new InvalidRecord({ recordId: record.id, reason: "missing required field" })
      )
    }

    const attempt = (attempts.get(record.id) ?? 0) + 1
    attempts.set(record.id, attempt)

    if (record.id === "record-b" && attempt === 1) {
      yield* Console.log(`database unavailable for ${record.id}`)
      return yield* Effect.fail(new DatabaseUnavailable({ recordId: record.id, attempt }))
    }

    yield* Console.log(`upserted projection for ${record.id} at version ${record.version}`)
  })

const markReconciled = (id: RecordId) =>
  Console.log(`marked ${id} reconciled`)

const markInvalid = (id: RecordId, reason: string) =>
  Console.log(`marked ${id} invalid: ${reason}`)

const retryTransientDatabaseErrors = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(2))
)

const betweenRecords = Schedule.spaced("15 millis").pipe(
  Schedule.both(Schedule.recurs(10))
)

const reconcileRecord = Effect.fnUntraced(function*(record: StaleRecord) {
  const result = yield* Effect.result(upsertProjection(record))

  if (result._tag === "Failure") {
    const error = result.failure
    if (error._tag === "InvalidRecord") {
      yield* markInvalid(error.recordId, error.reason)
      return "invalid" as const
    }
    return yield* Effect.fail(error)
  }

  yield* markReconciled(record.id)
  return "reconciled" as const
})

const reconcileNextRecord = Effect.gen(function*() {
  const record = yield* loadNextStaleRecord

  if (record === undefined) {
    return "idle" as const
  }

  return yield* Effect.retry(reconcileRecord(record), {
    schedule: retryTransientDatabaseErrors,
    while: (error) => error._tag === "DatabaseUnavailable"
  })
})

const program = reconcileNextRecord.pipe(
  Effect.repeat({
    schedule: betweenRecords,
    while: (status) => status !== "idle"
  })
)

Effect.runPromise(program)
```

The demo retries `record-b` once, marks `record-c` invalid without retrying it,
and spaces each successful worker iteration. Production values should come from
database capacity and service-level objectives, not from the small demo delays.

## Variants

For heavier reconciliation, increase spacing before adding workers. More
workers multiply reads, writes, lock contention, and retry traffic.

For a short catch-up job, lower the recurrence count. For a long-running worker,
keep the same spacing policy and add backlog metrics so operators can see
whether the queue is shrinking.

## Notes and caveats

`Effect.repeat` is success-driven; it spaces completed worker iterations.
`Effect.retry` is failure-driven; it handles transient failures for one record.

Keep the retry schedule local to the idempotent record operation. A broad retry
around the whole worker can hide classification bugs and repeat unrelated
database reads.
