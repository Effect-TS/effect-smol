---
book: "Effect `Schedule` Cookbook"
section_number: "18.2"
section_title: "Process a batch with gaps between items"
part_title: "Part V — Delay, Backoff, and Load Control"
chapter_title: "18. Spacing and Throttling"
status: "draft"
code_included: true
---

# 18.2 Process a batch with gaps between items

Use `Schedule.spaced` when a finite batch should move one item at a time with a
visible pause between successful sends.

## Problem

An import worker may call a partner API, write to a rate-limited database, or
publish messages to a broker. Each item can be processed independently, but a
back-to-back batch can create a short spike in connections, locks, queue depth,
or remote requests.

## When to use it

Use this when the important rule is "after a successful item, wait before
starting the next item."

`Schedule.spaced(duration)` is the direct fit for dependency pressure caused by
successful work. It waits after the previous item finishes, so the dependency
gets a quiet period before the next item starts.

This is appropriate for small to moderate batches where sequential processing is
acceptable and the gap is part of the operational contract.

## When not to use it

Do not use this to retry a failed item by itself. With `Effect.repeat`, failures
stop the repeat. If an item should be retried, apply an explicit retry policy
around the item processor before returning success to the batch loop.

Do not use spacing as the only protection for a heavily shared dependency. Gaps
reduce pressure from one worker, but they do not replace concurrency limits,
rate-limit headers, bulkheads, queue backpressure, or admission control.

Do not use this when the batch must complete as quickly as possible and the
dependency can safely absorb the burst. In that case a plain sequential
`Effect.forEach` may be clearer.

## Schedule shape

The repeated effect returns the number of items remaining after the item it just
processed. `Schedule.while` sees that successful value as `input`. If more items
remain, the schedule waits and allows the next recurrence. If no items remain,
the repeat stops immediately.

Use `Schedule.spaced` rather than `Schedule.fixed` when you want the gap to be
measured after each item completes. If an item takes 100 milliseconds to send and
the spacing is 250 milliseconds, the next item starts about 350 milliseconds
after the previous item started.

## Code

```ts
import { Console, Effect, Ref, Schedule } from "effect"

type BatchItem = {
  readonly id: string
  readonly payload: string
}

type DependencyError = {
  readonly _tag: "DependencyError"
  readonly itemId: string
}

const items: ReadonlyArray<BatchItem> = [
  { id: "a", payload: "alpha" },
  { id: "b", payload: "bravo" },
  { id: "c", payload: "charlie" }
]

const gapBetweenItems = Schedule.spaced("50 millis").pipe(
  Schedule.satisfiesInputType<number>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input > 0)
)

const program = Effect.gen(function*() {
  const remaining = yield* Ref.make(items)

  const sendToDependency = (
    item: BatchItem
  ): Effect.Effect<void, DependencyError> =>
    Console.log(`sent ${item.id}: ${item.payload}`)

  const processNext = Effect.gen(function*() {
    const item = yield* Ref.modify(remaining, (items) => [
      items[0],
      items.slice(1)
    ] as const)

    if (item === undefined) {
      return 0
    }

    yield* sendToDependency(item)

    const left = yield* Ref.get(remaining)
    yield* Console.log(`${left.length} item(s) left`)

    return left.length
  })

  const finalRemaining = yield* processNext.pipe(
    Effect.repeat(gapBetweenItems)
  )

  yield* Console.log(`batch complete; remaining=${finalRemaining}`)
})

Effect.runPromise(program)
```

The first item is sent immediately. If more items remain, the schedule waits
before processing the next item. After the last item succeeds, `processNext`
returns `0`, so the schedule stops without adding another gap. The snippet uses
a short gap so it finishes quickly in a scratchpad.

## Variants

Use a longer gap when the downstream dependency shows pressure through rising
latency, lock waits, queue depth, rate-limit responses, or connection pool
exhaustion.

Use a shorter gap when each item is cheap and the dependency has enough spare
capacity. Keep the chosen duration visible in a named schedule so operators can
tune it without reverse-engineering a loop.

If many workers may start batches at the same time, add `Schedule.jittered`
after choosing the base spacing. Jitter reduces synchronized pressure across
workers, but it does not bound total throughput by itself. Pair it with worker
concurrency limits or a dependency rate limiter when the dependency has a hard
quota.

## Notes and caveats

The schedule does not delay the first item. It controls only recurrences after a
successful item has been processed.

`Effect.repeat` feeds successful values into the schedule. In this recipe, the
successful value is the remaining item count, and `Schedule.while` uses it to
decide whether another recurrence is needed.

If `sendToDependency` fails, the batch stops with that failure. Add item-level
classification and retry separately if transient failures should be retried.

`Schedule.spaced` measures the delay after the previous item completes. That is
usually what you want for dependency pressure, because slow items naturally
reduce the start rate of later items.
