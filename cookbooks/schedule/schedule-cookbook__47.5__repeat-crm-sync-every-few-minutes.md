---
book: Effect `Schedule` Cookbook
section_number: "47.5"
section_title: "Repeat CRM sync every few minutes"
part_title: "Part X — Real-World Recipes"
chapter_title: "47. Product and Business Workflow Recipes"
status: "draft"
code_included: true
---

# 47.5 Repeat CRM sync every few minutes

A CRM sync is a background product workflow with externally visible side effects:
contacts, companies, lead scores, lifecycle stages, and activity history may be
read from one system and written into another. The schedule should make the
recurrence policy explicit so readers can see whether the next sync is measured
from the previous start time or from the previous completion time.

For most CRM sync workers, the safer default is a spaced repeat. Run one sync,
let it finish, then wait a few minutes before starting the next sync. That shape
avoids overlapping sync passes and leaves room for rate limits, database load,
and remote API consistency delays.

## Problem

You need to keep CRM data fresh by running a sync every few minutes, but the
sync may take variable time and may touch the same records more than once. A
hidden loop with sleeps makes it hard to review spacing, overlap behavior, and
idempotency assumptions.

The first sync should start when the worker starts. After a successful sync, the
schedule controls when the next successful recurrence is allowed to run.

## When to use it

Use `Effect.repeat` with `Schedule.spaced("5 minutes")` when each sync pass
should complete before the quiet period begins.

This is a good fit for pull-based CRM integrations that periodically reconcile
changes from a cursor, page token, or updated-at window. The spacing is part of
the operational contract: each successful pass is followed by a fixed pause, so
slow syncs naturally reduce the start rate.

## When not to use it

Do not use this as a retry policy for failed CRM requests. `Effect.repeat`
repeats successful effects. If a sync fails, the repeated program fails unless
the sync effect handles or retries that failure internally.

Do not use this shape when the business requirement is a wall-clock cadence such
as "start every five minutes regardless of how long the previous run took." Use
`Schedule.fixed("5 minutes")` for that cadence, and still keep the sync effect
single-run and idempotent.

Do not rely on scheduling alone to make writes safe. A CRM sync should use stable
external identifiers, cursors, upserts, idempotency keys, or version checks so
that repeated observations do not create duplicate contacts, duplicate notes, or
out-of-order updates.

## Schedule shape

The central shape is:

```ts
Schedule.spaced("5 minutes")
```

With `Effect.repeat`, that means:

1. Run the CRM sync once immediately.
2. If it succeeds, wait five minutes.
3. Run the next sync.
4. Repeat the same wait-after-success pattern.

The spacing is measured after the previous successful run completes. If a sync
takes two minutes and the schedule is `Schedule.spaced("5 minutes")`, the next
sync starts about seven minutes after the previous one started.

This is different from `Schedule.fixed("5 minutes")`, which keeps a fixed
interval cadence. If a fixed-interval action takes longer than the interval, the
next action runs immediately when the previous one completes, but missed runs do
not pile up.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

type CrmSyncError = {
  readonly _tag: "CrmSyncError"
  readonly message: string
}

type SyncSummary = {
  readonly cursor: string
  readonly contactsUpserted: number
  readonly companiesUpserted: number
}

declare const syncCrmOnce: Effect.Effect<SyncSummary, CrmSyncError>

const crmSyncSpacing = Schedule.spaced("5 minutes")

export const program = syncCrmOnce.pipe(
  Effect.tap((summary) =>
    Console.log(
      `CRM sync finished at cursor ${summary.cursor}: ` +
        `${summary.contactsUpserted} contacts, ` +
        `${summary.companiesUpserted} companies`
    )
  ),
  Effect.repeat(crmSyncSpacing)
)
```

`syncCrmOnce` runs immediately when `program` starts. After each successful
summary, the schedule waits five minutes before allowing the next sync pass.
The schedule itself does not create concurrent runs.

## Variants

Use a fixed cadence when the sync must stay aligned to a regular interval:

```ts
import { Schedule } from "effect"

const everyFiveMinutes = Schedule.fixed("5 minutes")
```

With `Schedule.fixed`, a slow sync can cause the next sync to start immediately
after the slow one finishes, but the schedule will not launch a backlog of
missed executions. Use this only when clock cadence matters more than a quiet
gap after each CRM pass.

Use a longer spaced interval for expensive full reconciliations:

```ts
import { Schedule } from "effect"

const fullReconciliationSpacing = Schedule.spaced("30 minutes")
```

Use a shorter spaced interval for small cursor-based incremental syncs, provided
the CRM API, database, and downstream automations can tolerate the load.

## Notes and caveats

The first CRM sync is not delayed. The schedule controls recurrences after the
first successful evaluation.

`Schedule.spaced` is unbounded by itself. In a long-running worker, scope the
repeated workflow to the service lifetime and make shutdown behavior explicit in
the surrounding application.

Failures are not retried by this repeat schedule. If transient CRM transport
failures should be retried within a sync pass, keep that retry policy inside
`syncCrmOnce` so the outer schedule still describes successful periodic syncs.

Avoid overlap at the deployment level too. If multiple worker instances can run
the same CRM sync, use a lease, partition ownership, advisory lock, queue
assignment, or another coordination mechanism. A local `Schedule` prevents one
fiber from starting its next repeat before the previous run completes; it does
not coordinate separate processes.

Make the sync idempotent. Repeated passes should upsert by stable CRM ids, keep
cursor advancement transactional with processed data, and tolerate replaying the
same page or time window after a worker restart.
