---
book: "Effect `Schedule` Cookbook"
section_number: "30.5"
section_title: "Repeat CRM sync every few minutes"
part_title: "Part VII — Real-World Recipes"
chapter_title: "30. Product and Business Workflow Recipes"
status: "draft"
code_included: true
---

# 30.5 Repeat CRM sync every few minutes

A CRM sync is a successful background workflow repeated over time. The schedule
should describe the cadence between completed sync passes; the sync itself
should handle idempotent writes and transient request retries internally.

## Problem

You need to keep CRM data fresh by running a sync every few minutes, but a
hidden loop with sleeps makes spacing, overlap, and shutdown behavior hard to
review.

## When to use it

Use `Effect.repeat` with `Schedule.spaced` when each sync pass should complete
before the quiet period begins. This fits cursor-based or updated-at-window CRM
integrations.

## When not to use it

Do not use this as a retry policy for failed CRM requests. `Effect.repeat`
repeats successes and stops on failure. Keep transient retries inside the
single sync pass. Do not rely on scheduling to make writes idempotent.

## Schedule shape

`Schedule.spaced("5 minutes")` waits after each successful sync before the next
run. The first sync starts immediately.

## Example

```ts
import { Console, Effect, Schedule } from "effect"

type SyncSummary = {
  readonly cursor: string
  readonly contactsUpserted: number
  readonly companiesUpserted: number
}

let pass = 0

const syncCrmOnce = Effect.gen(function*() {
  pass += 1
  const summary = {
    cursor: `cursor-${pass}`,
    contactsUpserted: pass * 3,
    companiesUpserted: pass
  }
  yield* Console.log(
    `CRM sync ${pass}: ${summary.contactsUpserted} contacts, ` +
      `${summary.companiesUpserted} companies`
  )
  return summary
})

const demoCadence = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<SyncSummary>(),
  Schedule.passthrough,
  Schedule.take(2)
)

const program = syncCrmOnce.pipe(
  Effect.repeat(demoCadence),
  Effect.flatMap((summary) =>
    Console.log(`last cursor written: ${summary.cursor}`)
  )
)

Effect.runPromise(program)
```

The demo runs the first sync immediately and then two scheduled recurrences. In
production, use the real interval and tie the repeated fiber to service
lifetime.

## Variants

Use `Schedule.fixed` only when wall-clock alignment matters more than a quiet
gap after completion. Add jitter when many instances run the same sync cadence.

## Notes and caveats

Avoid overlap outside the local fiber too. If several processes can run the same
CRM sync, use a lease, partition ownership, advisory lock, queue assignment, or
another coordination mechanism.
