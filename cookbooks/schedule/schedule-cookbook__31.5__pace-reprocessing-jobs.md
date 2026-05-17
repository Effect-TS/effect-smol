---
book: Effect `Schedule` Cookbook
section_number: "31.5"
section_title: "Pace reprocessing jobs"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "31. Throttle Internal Work"
status: "draft"
code_included: true
---

# 31.5 Pace reprocessing jobs

Failed-record reprocessing should make progress without turning a repair queue
into high-priority live traffic. A schedule keeps the claim cadence explicit.

## Problem

A failed-record table or dead-letter queue can keep a worker busy indefinitely.
The goal is predictable repair pressure: claim one record, reprocess it, store
the outcome, and pause before claiming another.

Without an explicit schedule, reprocessing often becomes a tight loop that
competes with live traffic for connections, locks, indexes, and downstream
capacity.

## When to use it

Use this when failed records are durable and can be reprocessed one at a time:
dead-letter drains, background repair loops, and low-priority reconciliation
work.

The reprocessing operation should be idempotent. If a worker is interrupted
after applying the business effect but before marking the record complete,
running the same record again must be safe.

## When not to use it

Do not use pacing to hide permanent data errors. Malformed payloads, deleted
accounts, authorization failures, and schema mismatches should move to an
operator-visible state.

Do not reprocess non-idempotent writes unless the write has a stable
deduplication key.

## Schedule shape

Start with `Schedule.spaced` when the rule is "wait after each record." Add
`Schedule.take` or `Schedule.recurs` when one invocation should have a bounded
amount of follow-up work. Use `Schedule.tapInput` for lightweight observation
of each successful reprocessing result.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type FailedRecord = {
  readonly id: string
  readonly alreadyFixed: boolean
}

type ReprocessResult =
  | { readonly _tag: "Reprocessed"; readonly recordId: string }
  | { readonly _tag: "AlreadyProcessed"; readonly recordId: string }
  | { readonly _tag: "NoFailedRecordAvailable" }

const failedRecords: Array<FailedRecord> = [
  { id: "failed-1", alreadyFixed: false },
  { id: "failed-2", alreadyFixed: true },
  { id: "failed-3", alreadyFixed: false }
]

const claimAndReprocessOneFailedRecord = Effect.gen(function*() {
  const record = failedRecords.shift()

  if (record === undefined) {
    yield* Console.log("no failed records available")
    return { _tag: "NoFailedRecordAvailable" } as const
  }

  if (record.alreadyFixed) {
    yield* Console.log(`${record.id} was already processed`)
    return { _tag: "AlreadyProcessed", recordId: record.id } as const
  }

  yield* Console.log(`reprocessed ${record.id}`)
  return { _tag: "Reprocessed", recordId: record.id } as const
})

const reprocessingCadence = Schedule.spaced("15 millis").pipe(
  Schedule.take(10),
  Schedule.tapInput((result: ReprocessResult) =>
    Console.log(`completed step: ${result._tag}`)
  )
)

const program = claimAndReprocessOneFailedRecord.pipe(
  Effect.repeat({
    schedule: reprocessingCadence,
    while: (result) => result._tag !== "NoFailedRecordAvailable"
  })
)

Effect.runPromise(program)
```

The demo claims one record at a time and stops once the queue is empty. A real
worker would store each outcome transactionally with the claim or completion
state.

## Variants

For higher database pressure, increase spacing before adding workers. More
workers multiply claims, updates, and index scans.

For a fleet that starts together, add `Schedule.jittered` after the base cadence
so instances do not claim rows at the same moments.

For empty queues, decide outside the claim effect whether the surrounding
worker should stop, sleep longer, or keep polling.

## Notes and caveats

`Schedule.tapInput` observes successful `ReprocessResult` values. If the claim
or reprocess step fails, the repeat fails unless that effect handles or retries
the error itself.

The schedule controls pace. It does not make duplicate processing safe; that
comes from stable record identifiers, transactional progress, and idempotent
business operations.
