---
book: Effect `Schedule` Cookbook
section_number: "31.1"
section_title: "Drain a queue slowly"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "31. Throttle Internal Work"
status: "draft"
code_included: true
---

# 31.1 Drain a queue slowly

A queue drain is often successful work, not retry work. The worker takes one
available item, processes it, observes whether more items remain, and only then
decides whether to continue. `Schedule` is a good fit for the continuation
policy: it can put a deliberate gap after each processed item and make the stop
conditions visible in one value.

This recipe drains a local queue one item at a time with controlled spacing. It
stops when the queue is empty, and it also has a per-run cap so one drain
invocation cannot monopolize the process forever.

## Problem

You have a queue with work already buffered. Processing every available item in
a tight loop would create a burst against a database, API, or other shared
dependency. You want to keep making progress, but with a clear pause between
items and a clear point where this drain pass stops.

The empty-queue case matters. `Queue.take` waits when no item is available, so a
slow drain should observe whether work exists before taking. The schedule should
then repeat only while the successful drain step says more work remains.

## When to use it

Use this when a single worker is draining local or already-acquired work and the
main operational goal is smoothing load. The repeated effect should advance the
drain by processing one item or one small batch, and its successful output
should report whether another iteration is useful.

This is a good fit for maintenance queues, reprocessing backlogs, outbox
dispatchers, and local buffers where empty means "this drain pass is done",
not "wait here for the next item forever".

## When not to use it

Do not use this as a long-lived consumer that should block waiting for future
messages. In that case, a normal queue consumer loop can call `Queue.take` and
let the queue provide backpressure.

Do not use the schedule to recover from processing failures. With
`Effect.repeat`, failures from the repeated effect stop the repeat. If processing
an item can fail transiently, give that item-processing effect its own retry
policy and keep the queue-drain schedule focused on successful drain steps.

Do not rely on `Queue.size` as a global truth in a multi-consumer queue. It is
fine for a single drain worker deciding whether to take more local work, but it
is not a transactional reservation.

## Schedule shape

Drain again only when the last successful step processed an item and still saw
work remaining:

```ts
Schedule.spaced("250 millis").pipe(
  Schedule.satisfiesInputType<DrainStep>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => shouldContinueDraining(input)),
  Schedule.bothLeft(
    Schedule.recurs(99).pipe(Schedule.satisfiesInputType<DrainStep>())
  )
)
```

`Schedule.spaced("250 millis")` waits after each completed drain step before the
next one starts. `Schedule.passthrough` keeps the latest `DrainStep` as the
schedule output, so `Effect.repeat` returns the final drain observation.
`Schedule.while` stops when the queue is empty. `Schedule.recurs(99)` adds a
count limit: the first drain step runs immediately, and the schedule can permit
up to 99 more, for at most 100 steps in this drain pass.

## Code

```ts
import { Effect, Queue, Schedule } from "effect"

type WorkItem = {
  readonly id: string
  readonly payload: string
}

type ProcessError = {
  readonly _tag: "ProcessError"
  readonly itemId: string
}

type DrainStep =
  | {
    readonly _tag: "Processed"
    readonly item: WorkItem
    readonly remaining: number
  }
  | {
    readonly _tag: "Drained"
  }

declare const processItem: (item: WorkItem) => Effect.Effect<void, ProcessError>

const drainOneAvailableItem = Effect.fnUntraced(function*(
  queue: Queue.Queue<WorkItem>
) {
  const queued = yield* Queue.size(queue)

  if (queued === 0) {
    return { _tag: "Drained" } as const
  }

  const item = yield* Queue.take(queue)
  yield* processItem(item)

  const remaining = yield* Queue.size(queue)

  return { _tag: "Processed", item, remaining } as const
})

const shouldContinueDraining = (step: DrainStep): boolean =>
  step._tag === "Processed" && step.remaining > 0

const slowDrainPolicy = Schedule.spaced("250 millis").pipe(
  Schedule.satisfiesInputType<DrainStep>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => shouldContinueDraining(input)),
  Schedule.bothLeft(
    Schedule.recurs(99).pipe(Schedule.satisfiesInputType<DrainStep>())
  )
)

export const drainQueueSlowly = (
  queue: Queue.Queue<WorkItem>
): Effect.Effect<DrainStep, ProcessError> =>
  drainOneAvailableItem(queue).pipe(
    Effect.repeat(slowDrainPolicy)
  )
```

The first drain step runs immediately. If the queue is empty, it returns
`"Drained"` and the schedule stops without sleeping. If an item is processed and
more work remains, the schedule waits 250 milliseconds before the next take. If
the pass reaches the recurrence cap first, the repeat also stops and returns the
last processed step.

## Variants

For a gentler background drain, increase the spacing:

```ts
const slowBackgroundDrain = slowDrainPolicy.pipe(
  Schedule.addDelay(() => Effect.succeed("750 millis"))
)
```

For batch drains, change the repeated effect to take and process a small batch,
then keep the same shape: return `"Drained"` when no work is available, return
`"Processed"` with `remaining`, and repeat only while `remaining > 0`.

For a queue shared by several consumers, prefer a design where each worker owns
its reservation semantics. The schedule can still pace successful work, but the
queue operation should not depend on `size` being stable across workers.

## Notes and caveats

`Effect.repeat` feeds successful `DrainStep` values into the schedule. It does
not feed failures into the schedule. A `ProcessError` from `processItem` stops
the drain immediately.

`Schedule.spaced` waits after a successful iteration completes. It is different
from `Schedule.fixed`, which follows wall-clock interval boundaries and may run
again immediately if work took longer than the interval.

The count limit is a guardrail, not the empty-queue condition. Keep both: the
empty check says the drain is complete, while the recurrence cap keeps one pass
bounded under a large backlog.
