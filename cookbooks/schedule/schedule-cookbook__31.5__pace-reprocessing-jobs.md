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

Failed-record reprocessing is usually safe to run in the background, but it can
still become a production incident if every worker drains the failure table as
fast as possible. Use a `Schedule` to make the pacing policy explicit: each
record is claimed and handled normally, then the schedule decides whether to
wait before the next record.

The goal is not to make broken records disappear quickly. The goal is to keep
database pressure predictable while giving transient failures a steady path back
through the system.

## Problem

You have a table or queue of failed records. A worker should claim one failed
record, reprocess it, store the outcome, and then pause before claiming another
one. Without an explicit schedule, it is easy to create a tight loop that
competes with live traffic for database connections, row locks, indexes, and
downstream capacity.

The first reprocessing attempt happens immediately. `Schedule.spaced` controls
the recurrences after that attempt, spacing each repetition from the last run.

## When to use it

Use this recipe when failed records are stored durably and can be reprocessed
one at a time. It is a good fit for background repair loops, dead-letter table
drains, and low-priority reconciliation work where steady progress matters more
than immediate throughput.

The reprocessing operation should be idempotent. A worker may be interrupted
after applying the business effect but before marking the failed record as
reprocessed. Re-running the same record must either produce the same final state
or detect that the work already happened.

## When not to use it

Do not use pacing to hide permanent data errors. Malformed payloads, deleted
accounts, authorization failures, and schema mismatches should be classified and
moved to an operator-visible state instead of being reprocessed forever.

Avoid this pattern for non-idempotent writes unless the write has a stable
deduplication key. If reprocessing can charge a customer twice, send a duplicate
email, or create a second external resource, fix that contract before adding a
schedule.

## Schedule shape

Start with `Schedule.spaced` when the important rule is "wait after each
record." This keeps the database from seeing a burst of immediate claims after a
slow record finishes. Add `Schedule.take` when a single worker invocation should
have a bounded amount of follow-up work.

Prefer a small, named policy. Operators should be able to answer: how long do we
wait between records, and how many scheduled recurrences can this invocation
perform?

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type ReprocessError = {
  readonly _tag: "DatabaseUnavailable" | "DownstreamUnavailable"
}

type ReprocessResult =
  | { readonly _tag: "Reprocessed"; readonly recordId: string }
  | { readonly _tag: "AlreadyProcessed"; readonly recordId: string }
  | { readonly _tag: "NoFailedRecordAvailable" }

declare const claimAndReprocessOneFailedRecord: Effect.Effect<
  ReprocessResult,
  ReprocessError
>

const reprocessingCadence = Schedule.spaced("10 seconds").pipe(
  Schedule.take(100),
  Schedule.tapInput((result: ReprocessResult) =>
    Console.log(`finished reprocessing step: ${result._tag}`)
  )
)

export const program = Effect.repeat(
  claimAndReprocessOneFailedRecord,
  reprocessingCadence
)
```

## Variants

- For higher database pressure, increase the spacing before adding more workers.
  More workers multiply claims, updates, and index scans.
- For a large backlog, run more worker invocations with the same conservative
  cadence instead of removing the delay entirely.
- For a fleet of workers that start together, consider `Schedule.jittered` after
  the base cadence is correct so all instances do not claim rows at the same
  moments.
- For empty queues, make `claimAndReprocessOneFailedRecord` return
  `NoFailedRecordAvailable` and decide separately whether the surrounding worker
  should stop, sleep longer, or keep polling.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule, so
`Schedule.tapInput` in this recipe observes each `ReprocessResult`. If
`claimAndReprocessOneFailedRecord` fails with `DatabaseUnavailable` or
`DownstreamUnavailable`, the repeat fails unless you handle or retry that error
inside the effect.

Keep idempotency close to the database operation: claim with a stable record
identifier, write progress in a transaction when possible, and make the final
marking step tolerate records that were already completed. The schedule controls
pace; it does not make duplicate processing safe by itself.
