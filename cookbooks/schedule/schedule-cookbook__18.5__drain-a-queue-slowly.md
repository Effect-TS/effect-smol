---
book: "Effect `Schedule` Cookbook"
section_number: "18.5"
section_title: "Drain a queue slowly"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "18. Spacing and Throttling"
status: "draft"
code_included: true
---

# 18.5 Drain a queue slowly

A queue drain is repeat work, not retry work. Run one item, decide whether more
work remains, and let a schedule add the pause before the next item.

## Problem

A local queue already contains work. Processing everything in a tight loop can
burst against a database, API, or shared worker pool. The drain should make
steady progress, stop when the queue is empty, and cap how much one invocation
can do.

`Queue.take` waits when the queue is empty, so the drain step should check for
available work before taking. The successful step result can then tell
`Effect.repeat` whether another scheduled pass is useful.

## When to use it

Use this for local buffers, outbox dispatchers, maintenance queues, and
reprocessing backlogs where empty means "this drain pass is done." The repeated
effect should process one item or one small batch and return whether more work
is likely.

## When not to use it

Do not use this as a long-lived consumer that should block for future messages.
A normal consumer loop can call `Queue.take` and let the queue provide
backpressure.

Do not use the drain schedule to recover from item-processing failures.
`Effect.repeat` schedules successful values. If processing can fail
transiently, retry that item-processing effect separately.

Do not treat `Queue.size` as a transactional reservation in a multi-consumer
queue. It is fine for a single drain worker deciding whether to keep going, but
another consumer can change the size at any time.

## Schedule shape

Use `Schedule.spaced` for the pause between successful drain steps and combine
it with a recurrence limit such as `Schedule.recurs(99)`. Put the empty-queue
stop condition in `Effect.repeat({ while })`, where it can inspect the
`DrainStep` returned by the effect.

The first item is processed immediately. The schedule controls only the
follow-up drain steps.

## Code

```ts
import { Console, Effect, Queue, Schedule } from "effect"

type WorkItem = {
  readonly id: number
  readonly payload: string
}

type DrainStep =
  | { readonly _tag: "Processed"; readonly item: WorkItem; readonly remaining: number }
  | { readonly _tag: "Drained" }

const processItem = (item: WorkItem) =>
  Console.log(`processed item ${item.id}: ${item.payload}`)

const drainOneAvailableItem = Effect.fnUntraced(function*(queue: Queue.Queue<WorkItem>) {
  const queued = yield* Queue.size(queue)

  if (queued === 0) {
    yield* Console.log("queue is empty")
    return { _tag: "Drained" } as const
  }

  const item = yield* Queue.take(queue)
  yield* processItem(item)

  const remaining = yield* Queue.size(queue)
  yield* Console.log(`${remaining} item(s) remain`)

  return { _tag: "Processed", item, remaining } as const
})

const slowDrainPolicy = Schedule.spaced("10 millis").pipe(
  Schedule.both(Schedule.recurs(9))
)

const shouldContinue = (step: DrainStep) =>
  step._tag === "Processed" && step.remaining > 0

const program = Effect.gen(function*() {
  const queue = yield* Queue.unbounded<WorkItem>()
  yield* Queue.offerAll(queue, [
    { id: 1, payload: "refresh-search-index" },
    { id: 2, payload: "publish-outbox-event" },
    { id: 3, payload: "expire-cache-entry" }
  ])

  yield* drainOneAvailableItem(queue).pipe(
    Effect.repeat({
      schedule: slowDrainPolicy,
      while: shouldContinue
    })
  )

  yield* Console.log("drain pass finished")
})

Effect.runPromise(program)
```

The demo uses `10 millis` so it terminates quickly. In production, choose a gap
from the dependency you are protecting, such as a database write budget or API
quota.

## Variants

For batch drains, process a small batch and return the remaining count. Keep
the same schedule shape: a spacing policy, a count limit, and a stop condition
based on the successful drain result.

For shared queues, move reservation semantics into the queue or database claim
operation. The schedule can pace successful work, but it cannot make `size`
stable across workers.

## Notes and caveats

`Effect.repeat` feeds successful `DrainStep` values into the repeat decision.
Failures from `processItem` stop the drain unless the processing effect has its
own retry policy.

`Schedule.spaced` waits after a successful iteration completes. `Schedule.fixed`
is different: it follows interval boundaries and may run again immediately if a
previous iteration took longer than the interval.
