---
book: Effect `Schedule` Cookbook
section_number: "35.5"
section_title: "Balance responsiveness and persistence"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "35. Stop After a Time Budget"
status: "draft"
code_included: true
---

# 35.5 Balance responsiveness and persistence

User-facing workflows often need two different retry budgets. The request path
should retry briefly so the user gets quick feedback. The background path can be
more persistent, but it still needs a visible upper bound so failures do not
retry forever by accident.

Model those as two schedules instead of one overloaded loop. The foreground
schedule answers, "How long may this request wait before we return a useful
status?" The background schedule answers, "How long may the system keep trying
after the user is no longer waiting?"

## Problem

You want to make a best effort while the caller is waiting, then continue from a
queue, durable job, or workflow when the operation is still likely to recover.

For example, a profile update might call a remote CRM. The HTTP handler should
not hold the user for minutes during an outage, but the update should not be
dropped after the first transient failure either.

## When to use it

Use this when the first caller needs a prompt answer and the business operation
is safe to continue later. It is a good fit for idempotent writes, cache fills,
notifications, webhook delivery, synchronization jobs, and "accepted for
processing" workflows.

The useful split is operational, not technical: short foreground persistence for
responsiveness, longer background persistence for eventual completion.

## When not to use it

Do not use a background retry budget for errors that are known to be permanent.
Validation failures, authorization failures, malformed payloads, and rejected
business rules should be returned or recorded directly.

Also avoid this split when the operation cannot be retried safely. If a second
attempt could charge a customer twice, send duplicate messages, or overwrite
newer state, make the operation idempotent before adding a retry schedule.

## Schedule shape

Use a short foreground schedule and a separate longer background schedule:

```ts
const foregroundRetry = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.during("2 seconds"))
)

const backgroundRetry = Schedule.exponential("1 second").pipe(
  Schedule.both(Schedule.during("10 minutes")),
  Schedule.jittered
)
```

`Schedule.exponential` increases the delay after each failed attempt.
`Schedule.during` keeps recurrence decisions inside an elapsed-time budget.
`Schedule.both` gives intersection semantics: the combined schedule recurs only
while both the cadence and the time budget still allow another recurrence.

Add `Schedule.jittered` to the background policy when many workers may retry the
same dependency. In `Schedule.ts`, jitter adjusts each delay to a random value
between 80% and 120% of the original delay, which helps avoid synchronized
retry waves.

## Code

```ts
import { Effect, Schedule } from "effect"

type CrmError = {
  readonly _tag: "CrmError"
  readonly message: string
}

type UpdateResult =
  | { readonly _tag: "Updated" }
  | { readonly _tag: "AcceptedForBackgroundRetry" }

declare const updateCrm: Effect.Effect<void, CrmError>
declare const enqueueCrmUpdate: Effect.Effect<void>
declare const processQueuedCrmUpdate: Effect.Effect<void, CrmError>

const foregroundRetry = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.during("2 seconds"))
)

const backgroundRetry = Schedule.exponential("1 second").pipe(
  Schedule.both(Schedule.during("10 minutes")),
  Schedule.jittered
)

export const handleRequest: Effect.Effect<UpdateResult, never> = updateCrm.pipe(
  Effect.retry(foregroundRetry),
  Effect.as({ _tag: "Updated" as const }),
  Effect.catchAll(() =>
    enqueueCrmUpdate.pipe(
      Effect.as({ _tag: "AcceptedForBackgroundRetry" as const })
    )
  )
)

export const backgroundWorker: Effect.Effect<void, CrmError> =
  processQueuedCrmUpdate.pipe(
    Effect.retry(backgroundRetry)
  )
```

`handleRequest` tries the CRM update immediately, then retries only inside the
short foreground budget. If that budget is exhausted, it records the work for
later and returns a value the caller can render as "accepted" or "pending".

`backgroundWorker` uses a longer retry budget with jitter. It can be persistent
without tying up the original request, and it still has a clear stop condition
for alerting, dead-lettering, or operator review.

## Variants

For stricter user-facing latency, shorten the foreground budget or use
`Schedule.spaced` with a small fixed delay. A fixed cadence is easier to reason
about when the goal is "try a few quick times and answer".

For background jobs, tune the base delay and budget to the dependency. A
database failover might merit minutes. A partner API outage might merit a longer
workflow-level policy, but the schedule should still make the maximum retry
window visible.

If the background retry should stop after either a time budget or a count budget
is exhausted, compose the cadence with both limits:

```ts
const boundedBackgroundRetry = Schedule.exponential("1 second").pipe(
  Schedule.both(Schedule.during("10 minutes")),
  Schedule.both(Schedule.recurs(20)),
  Schedule.jittered
)
```

## Notes and caveats

`Schedule.during` is evaluated at schedule decision points, after an attempt has
finished. It does not interrupt an in-flight request. If each attempt also needs
a hard bound, add an Effect timeout around the operation being retried.

`Effect.retry` feeds failures into the schedule. The foreground and background
examples above should only receive transient `CrmError` values. Classify
permanent failures before applying either schedule.

Keep the foreground and background policies named separately. A single
"retryPolicy" name tends to hide the product decision that matters most here:
how long the user waits versus how long the system keeps trying on their behalf.
