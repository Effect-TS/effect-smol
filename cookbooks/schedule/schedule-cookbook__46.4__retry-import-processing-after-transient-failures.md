---
book: Effect `Schedule` Cookbook
section_number: "46.4"
section_title: "Retry import processing after transient failures"
part_title: "Part X — Real-World Recipes"
chapter_title: "46. Data and Batch Recipes"
status: "draft"
code_included: true
---

# 46.4 Retry import processing after transient failures

Import retry policies belong around one idempotent processing step. They should
show the retry cadence, the retry budget, and the failure classifier without
hiding permanent data problems.

## Problem

An import worker is processing one batch from object storage into a staging
database and an enrichment service. Storage timeouts or temporary database
unavailability may clear on another attempt; invalid CSV structure or a
violated domain rule should stop immediately.

The retry policy needs to be local to the idempotent processing step. Do not
wrap the whole worker loop in a retry if only the batch write or enrichment call
is transient. Retrying too much work can duplicate side effects, hide a bad
record, or keep an unhealthy dependency under pressure.

## When to use it

Use this recipe when a single import batch can be safely attempted more than
once. That usually means the processor uses a stable import id, deduplicates
records, writes through upserts or transactions, and can resume without creating
duplicate rows or duplicate external events.

It fits batch imports from files, queue-backed import jobs, and ETL staging
steps where operational failures are expected but should remain bounded.

## When not to use it

Do not retry malformed input. A missing required column, invalid encoding,
failed schema validation, or rejected business rule will usually fail again
after the delay.

Do not retry processing that is not idempotent. If a retry can insert the same
customer twice, send the same notification twice, or publish the same accounting
event twice, fix that boundary first with an idempotency key, unique constraint,
transactional write, or outbox.

Do not use a retry schedule as a queue visibility timeout or leasing mechanism.
Let the queue or job coordinator own claiming and redelivery. Use `Schedule` for
the local decision to reattempt one failed effect.

## Schedule shape

Use `Effect.retry` around the idempotent import step. With retry, the original
attempt runs immediately; the schedule controls only follow-up attempts after
typed failures.

For transient import failures, a small exponential backoff is a better default
than a fixed interval because it backs away from overloaded storage, databases,
or enrichment services. `Schedule.exponential` keeps increasing the delay and
does not stop by itself, so combine it with `Schedule.recurs`. Add
`Schedule.jittered` when many workers may retry similar imports at the same
time.

Keep retry eligibility in an error predicate. The schedule describes timing and
limits; the predicate decides whether the typed failure is transient enough to
retry.

## Code

```ts
import { Console, Data, Effect, Schedule } from "effect"

class StorageTimeout extends Data.TaggedError("StorageTimeout")<{
  readonly importId: string
}> {}

class StagingDatabaseUnavailable
  extends Data.TaggedError("StagingDatabaseUnavailable")<{
    readonly importId: string
  }>
{}

class InvalidImportFile extends Data.TaggedError("InvalidImportFile")<{
  readonly importId: string
  readonly reason: string
}> {}

class DuplicateExternalEventRisk
  extends Data.TaggedError("DuplicateExternalEventRisk")<{
    readonly importId: string
  }>
{}

type ImportError =
  | StorageTimeout
  | StagingDatabaseUnavailable
  | InvalidImportFile
  | DuplicateExternalEventRisk

interface ImportBatch {
  readonly importId: string
  readonly sourceUri: string
}

const batch: ImportBatch = {
  importId: "import-2026-05-17",
  sourceUri: "s3://imports/customers.csv"
}

let attempts = 0

const processImportBatch: (batch: ImportBatch) => Effect.Effect<void, ImportError> =
  Effect.fnUntraced(function*(batch: ImportBatch) {
    attempts += 1
    yield* Console.log(`import attempt ${attempts}: ${batch.sourceUri}`)

    if (attempts === 1) {
      return yield* Effect.fail(new StorageTimeout({ importId: batch.importId }))
    }
    if (attempts === 2) {
      return yield* Effect.fail(new StagingDatabaseUnavailable({ importId: batch.importId }))
    }

    yield* Console.log(`imported batch ${batch.importId}`)
  })

const isTransientImportError = (error: ImportError): boolean => {
  switch (error._tag) {
    case "StorageTimeout":
    case "StagingDatabaseUnavailable":
      return true
    case "InvalidImportFile":
    case "DuplicateExternalEventRisk":
      return false
  }
}

const retryTransientImportFailure = Schedule.exponential("10 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5))
)

const program = processImportBatch(batch).pipe(
  Effect.retry({
    schedule: retryTransientImportFailure,
    while: isTransientImportError
  }),
  Effect.flatMap(() => Console.log("import finished")),
  Effect.catch((error: ImportError) => Console.log(`import failed: ${error._tag}`))
)

void Effect.runPromise(program)
```

`program` processes the batch once immediately. If object storage times out or
the staging database is temporarily unavailable, the retry policy uses jittered
exponential backoff for at most five retries after the original attempt. If the
file is invalid, or the processor detects that retrying could duplicate an
external event, retrying stops immediately and the typed error is propagated.

The example assumes `processImportBatch` is idempotent for the retryable cases:
it uses `importId` as the stable identity for writes, can observe already
imported records, and does not emit irreversible side effects until the
transactional import state says it is safe.

## Variants

For a short interactive import preview, keep the budget smaller. For a
background import worker, use a slower base delay and `Schedule.tapInput` to log
each retry input.

For a dependency that exposes a precise `Retry-After` value, keep that timing
near the adapter and make the schedule responsible for the maximum number of
reattempts. Do not mix retry-after handling with validation or idempotency
checks.

## Notes and caveats

`Effect.retry` feeds typed failures into the schedule. That is why
`Schedule.tapInput` can observe an `ImportError` in the background-worker
variant. `Effect.repeat` is the wrong tool for this recipe because it feeds
successful values into the schedule and stops on failure unless the failure is
handled separately.

`Schedule.recurs(5)` means five retries after the original attempt, not five
total executions. Because `Schedule.exponential` is unbounded, keep an explicit
limit on import retries unless another operational budget is enforcing a
stricter bound.

A retry policy cannot make an unsafe import safe. Make idempotency part of the
processor contract, and treat any uncertainty about duplicate side effects as a
non-retryable typed failure.
