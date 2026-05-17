---
book: Effect `Schedule` Cookbook
section_number: "30.2"
section_title: "Process a batch with gaps between items"
part_title: "Part VII — Spacing, Throttling, and Load Smoothing"
chapter_title: "30. Space Requests Intentionally"
status: "draft"
code_included: true
---

# 30.2 Process a batch with gaps between items

Use `Schedule.spaced` when a finite batch should move one item at a time with a
visible pause between successful sends.

## Problem

An import worker may call a partner API, write to a rate-limited database,
publish messages to a broker, or invalidate cache keys. Each item can be
processed independently, but processing all items back-to-back would create a
short spike in connections, locks, queue depth, or remote requests.

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

The central shape is:

```ts
Schedule.spaced("250 millis").pipe(
  Schedule.satisfiesInputType<number>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input > 0)
)
```

The repeated effect returns the number of items remaining after the item it just
processed. `Schedule.while` sees that successful value as `input`. If more items
remain, the schedule waits 250 milliseconds and allows the next recurrence. If
no items remain, the repeat stops immediately.

Use `Schedule.spaced` rather than `Schedule.fixed` when you want the gap to be
measured after each item completes. If an item takes 100 milliseconds to send and
the spacing is 250 milliseconds, the next item starts about 350 milliseconds
after the previous item started.

## Code

```ts
import { Effect, Option, Ref, Schedule } from "effect"

type BatchItem = {
  readonly id: string
  readonly payload: string
}

type DependencyError = {
  readonly _tag: "DependencyError"
  readonly itemId: string
}

declare const sendToDependency: (
  item: BatchItem
) => Effect.Effect<void, DependencyError>

const gapBetweenItems = Schedule.spaced("250 millis").pipe(
  Schedule.satisfiesInputType<number>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input > 0)
)

export const processBatch = (items: ReadonlyArray<BatchItem>) =>
  Effect.gen(function*() {
    const remaining = yield* Ref.make(items)

    const processNext = Effect.gen(function*() {
      const next = yield* Ref.modify(remaining, (items) => {
        const [item, ...rest] = items

        return [
          item === undefined
            ? Option.none()
            : Option.some([item, rest.length] as const),
          rest
        ] as const
      })

      if (Option.isNone(next)) {
        return 0
      }

      const [item, remainingAfter] = next.value

      yield* sendToDependency(item)

      return remainingAfter
    })

    return yield* processNext.pipe(
      Effect.repeat(gapBetweenItems)
    )
  })
```

`processBatch` sends the first item immediately. If more items remain after that
successful send, the schedule waits 250 milliseconds before sending the next
item. After the last item succeeds, `processNext` returns `0`, so the schedule
stops without adding another gap.

The returned effect succeeds with the final schedule output. Because
`Schedule.passthrough` is used here, that final output is the last remaining
count, which is `0` when the batch has been fully processed.

## Variants

Use a longer gap when the downstream dependency shows pressure through rising
latency, lock waits, queue depth, rate-limit responses, or connection pool
exhaustion.

Use a shorter gap when each item is cheap and the dependency has enough spare
capacity. Keep the chosen duration visible in a named schedule so operators can
tune it without reverse-engineering a loop.

If many workers may start batches at the same time, add jitter after choosing
the base spacing:

```ts
const jitteredGapBetweenItems = Schedule.spaced("250 millis").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<number>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input > 0)
)
```

Jitter reduces synchronized pressure across workers, but it does not bound total
throughput by itself. Pair it with worker concurrency limits or a dependency
rate limiter when the dependency has a hard quota.

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
