---
book: Effect `Schedule` Cookbook
section_number: "12.5"
section_title: "Repeat while work remains to be done"
part_title: "Part III — Core Repeat Recipes"
chapter_title: "12. Repeat a Successful Effect"
status: "draft"
code_included: true
---

# 12.5 Repeat while work remains to be done

`Effect.repeat` can keep draining work while each successful result says more work
remains. This recipe focuses on continuation signals such as remaining counts, cursors,
or `hasMore` flags.

## Problem

The repeated effect should advance one unit of work and return the signal that
decides whether another run is needed. A queue drain may process one batch and
return the number of remaining messages; a paginated import may fetch one page
and return whether there is another page.

## When to use it

Use this when each successful run advances external state and returns a continuation signal such as `remaining > 0`, `hasMore: true`, or `nextCursor !== undefined`.

This shape fits queue drains, local backlog processing, batch cleanup, and page-by-page ingestion where every run should ask the work source for the next unit.

## When not to use it

Do not use this to recover from failures. `Effect.repeat` repeats after success; if the effect fails, repetition stops with that failure. Use `Effect.retry` when failures should trigger another attempt.

Do not use this when there is no natural work-complete signal in the successful result. If the loop is meant to run for the lifetime of a process, use an explicitly long-lived repeat policy instead.

Do not use this as a deep periodic polling recipe. This section is about draining known work until the successful output says the drain is complete.

## Schedule shape

The central shape is an unbounded schedule guarded by the latest successful output:

```ts
Schedule.forever.pipe(
  Schedule.satisfiesInputType<{ readonly hasMore: boolean }>(),
  Schedule.while(({ input }) => input.hasMore)
)
```

With `Effect.repeat(schedule)`, the successful value produced by the effect becomes the schedule input. `Schedule.while` receives schedule metadata, so `metadata.input` is the latest successful result.

If the predicate returns `true`, the schedule allows another recurrence. If it returns `false`, the repeat stops.

## Code

```ts
import { Effect, Schedule } from "effect"

interface QueueDrainResult {
  readonly processed: number
  readonly remaining: number
}

declare const drainOneBatch: Effect.Effect<QueueDrainResult, "queue-error">

const whileQueueHasWork = Schedule.forever.pipe(
  Schedule.satisfiesInputType<QueueDrainResult>(),
  Schedule.while(({ input }) => input.remaining > 0)
)

const drainQueue = drainOneBatch.pipe(
  Effect.repeat(whileQueueHasWork)
)
```

`drainOneBatch` runs once immediately. If it succeeds with `remaining > 0`, the schedule permits another batch drain. When a successful batch reports `remaining === 0`, the schedule stops and `drainQueue` completes.

The repeated program succeeds with the schedule output, not with the last `QueueDrainResult`. With `Schedule.forever`, that output is the recurrence count.

## Variants

Add a small pause between successful batches when the downstream system needs breathing room:

```ts
import { Effect, Schedule } from "effect"

interface PageResult {
  readonly imported: number
  readonly hasMore: boolean
}

declare const importNextPage: Effect.Effect<PageResult, "import-error">

const whilePagesRemain = Schedule.spaced("100 millis").pipe(
  Schedule.satisfiesInputType<PageResult>(),
  Schedule.while(({ input }) => input.hasMore)
)

const importAllAvailablePages = importNextPage.pipe(
  Effect.repeat(whilePagesRemain)
)
```

Use `Schedule.forever.pipe(Schedule.satisfiesInputType<T>(), Schedule.while(...))` when the next run should start immediately and the predicate reads the successful output. Use `Schedule.spaced(duration).pipe(Schedule.satisfiesInputType<T>(), Schedule.while(...))` when each successful run should leave a deliberate pause before the next unit of work.

If you also need a hard safety limit, combine the continuation predicate with a bounded schedule:

```ts
import { Schedule } from "effect"

interface QueueDrainResult {
  readonly processed: number
  readonly remaining: number
}

const atMostOneHundredMoreBatches = Schedule.recurs(100).pipe(
  Schedule.satisfiesInputType<QueueDrainResult>(),
  Schedule.while(({ input }) => input.remaining > 0)
)
```

This still stops when the queue reports no remaining work, but it also stops after one hundred scheduled recurrences even if the result keeps saying that work remains.

## Notes and caveats

The first run is not controlled by the schedule. `Effect.repeat` evaluates the effect once, then passes that successful output to the schedule to decide whether to run again.

The predicate sees successful outputs only. Failures do not become schedule inputs for `Effect.repeat`; a failure from the repeated effect stops the repeat.

Make sure the repeated effect advances the drain. If every successful run returns the same `remaining` or `hasMore` value without consuming work, the schedule can keep recurring forever.

When you care about the final business result, model that explicitly in the repeated effect or surrounding workflow. The raw `Effect.repeat(schedule)` result is the schedule's final output.
