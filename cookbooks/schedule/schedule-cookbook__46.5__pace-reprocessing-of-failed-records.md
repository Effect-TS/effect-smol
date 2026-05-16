---
book: Effect `Schedule` Cookbook
section_number: "46.5"
section_title: "Pace reprocessing of failed records"
part_title: "Part X — Real-World Recipes"
chapter_title: "46. Data and Batch Recipes"
status: "draft"
code_included: true
---

# 46.5 Pace reprocessing of failed records

Failed-record reprocessing is usually a background repair path, not an urgent
request path. The worker should make progress, but it should not turn one bad
deployment, one unavailable dependency, or one poison record into continuous
database pressure.

Use a `Schedule` to make that pacing explicit. The reprocessing effect performs
one bounded pass over the failed-record table. The schedule decides when another
pass is allowed.

## Problem

You have records marked as failed in a database table. A worker should pick up a
small batch, re-run the operation, and mark each record as completed or still
failed. Without a schedule, it is easy to accidentally build a tight loop that
keeps scanning the same rows, contends with foreground traffic, and repeatedly
writes failure metadata for records that cannot yet succeed.

The recurrence policy needs to answer three operational questions:

- how much time is left between reprocessing passes
- how many follow-up passes the worker will run
- whether each pass is safe to repeat when the same record is seen again

## Solution

Model one reprocessing pass as an `Effect`, then repeat that pass with
`Schedule.spaced`. `Schedule.spaced("30 seconds")` waits for thirty seconds
after a pass completes before the next pass starts. That is usually the right
shape for database repair work because a slow pass naturally reduces the rate of
future database reads and writes.

Limit the schedule with `Schedule.take` when the worker is invoked as a bounded
job. A daemon can use the same base cadence with a larger limit, a longer
interval, or an outer supervisor that starts the worker again.

## Code

```ts
import { Effect, Schedule } from "effect"

type FailedRecord = {
  readonly id: string
  readonly payload: unknown
}

type ReprocessError = {
  readonly _tag: "ReprocessError"
  readonly recordId: string
}

declare const loadFailedRecords: Effect.Effect<ReadonlyArray<FailedRecord>>
declare const reprocessRecord: (
  record: FailedRecord
) => Effect.Effect<void, ReprocessError>
declare const markRecordProcessed: (id: string) => Effect.Effect<void>
declare const markRecordStillFailed: (
  id: string,
  error: ReprocessError
) => Effect.Effect<void>

const reprocessFailedRecord = (record: FailedRecord) =>
  reprocessRecord(record).pipe(
    Effect.andThen(markRecordProcessed(record.id)),
    Effect.catchTag("ReprocessError", (error) =>
      markRecordStillFailed(record.id, error)
    )
  )

const reprocessFailedBatch = Effect.gen(function*() {
  const records = yield* loadFailedRecords

  yield* Effect.forEach(records, reprocessFailedRecord, {
    concurrency: 4
  })
})

const reprocessingCadence = Schedule.spaced("30 seconds").pipe(
  Schedule.take(20)
)

export const program = Effect.repeat(
  reprocessFailedBatch,
  reprocessingCadence
)
```

## Why spaced

`Schedule.spaced` recurs continuously with the specified duration from the last
run. In this recipe, that means the worker does not start the next database scan
until the previous batch has finished and the spacing delay has elapsed.

That behavior is different from `Schedule.fixed`. A fixed schedule targets a
wall-clock interval. If a pass takes longer than the interval, the next pass may
start immediately. That is useful for heartbeats and sampling, but it is often
too aggressive for failed-record repair because slow database work is already a
signal to back off.

## Idempotency

The record operation must be safe to run more than once. A failed-record table
can contain stale rows, workers can be restarted, and a previous pass can succeed
after writing only part of its bookkeeping. Use stable record identifiers,
idempotency keys, unique constraints, or compare-and-set updates so repeating
`reprocessRecord(record)` does not duplicate external writes.

Keep classification outside the schedule. Permanent failures such as invalid
payloads should be marked as terminal or moved to a dead-letter workflow before
the scheduled repair loop sees them. The schedule controls timing; it should not
be the only thing preventing bad records from being retried forever.

## Database pressure

The batch size, concurrency, and spacing are one policy. Increasing concurrency
without increasing the spacing can still overload the database because each pass
can issue more reads, writes, locks, and index updates. Start with a small batch
and a conservative concurrency value, then tune from observed queue depth and
database latency.

For a fleet of workers, avoid making every instance wake at the same time. Once
the base cadence is correct, use `Schedule.jittered` to spread reprocessing
passes across the interval. Jitter reduces synchronized scans while preserving
the same reader-facing policy: failed records are retried gradually, not in a
burst.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule. In this recipe the
batch effect handles individual record failures and succeeds after recording
their status, so the schedule controls the cadence of completed batch passes.

If a whole batch fails because the database is unavailable, let that failure
escape and use a separate retry policy around the worker startup path. Mixing
record-level repair and infrastructure retry in one schedule makes the database
load profile harder to reason about.
