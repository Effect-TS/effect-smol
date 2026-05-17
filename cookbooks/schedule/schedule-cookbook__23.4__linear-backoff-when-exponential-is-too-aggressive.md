---
book: Effect `Schedule` Cookbook
section_number: "23.4"
section_title: "Linear backoff when exponential is too aggressive"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "23. Linear Backoff Recipes"
status: "draft"
code_included: true
---

# 23.4 Linear backoff when exponential is too aggressive

Exponential backoff is useful when callers should quickly reduce pressure. Its
curve can be too steep for short recovery windows, interactive work, or local
contention.

Linear backoff adds the same delay after each failure. Use it when retries
should become more conservative without jumping to multi-second waits after only
a few failures.

## Problem

Compare the retry delays for a 250 millisecond base:

| Retry decision | Linear delay | Exponential delay |
| -------------- | ------------ | ----------------- |
| 1              | 250 ms       | 250 ms            |
| 2              | 500 ms       | 500 ms            |
| 3              | 750 ms       | 1000 ms           |
| 4              | 1000 ms      | 2000 ms           |
| 5              | 1250 ms      | 4000 ms           |

Both policies slow the caller down. The difference is the growth curve:
linear backoff adds one fixed increment, while
`Schedule.exponential("250 millis")` multiplies later delays by the factor
`2` unless you pass a different factor.

## When to use it

Use linear backoff when failures should reduce pressure gradually, but later
attempts still need to stay close enough to catch a quick recovery. It fits
short internal disruptions, local resource contention, reconnects, and
background jobs where exponential backoff would make the workflow appear
stalled.

It is also easier to explain operationally: "wait 250 milliseconds more after
each failure, up to five retries" is a concrete contract.

## When not to use it

Do not retry validation failures, authorization failures, malformed requests, or
non-idempotent writes without duplicate protection. For overload that may last a
long time or affect many clients at once, exponential backoff, caps, jitter, and
admission control are usually more appropriate.

Do not leave a linear policy unbounded unless an external supervisor is expected
to own the lifetime of the work.

## Schedule shape

Start with a schedule that emits the retry step:
`Schedule.unfold(1, (step) => Effect.succeed(step + 1))`.

Then use `Schedule.addDelay` to turn that step into a delay. Because the unfold
schedule has no delay of its own, the added duration is the retry delay. Add
`Schedule.take` or `Schedule.recurs` to keep the operation finite.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class SearchIndexUnavailable extends Data.TaggedError("SearchIndexUnavailable")<{
  readonly shard: string
}> {}

let attempts = 0

const refreshSearchIndex = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`refresh attempt ${attempts}`)

  if (attempts < 5) {
    return yield* Effect.fail(
      new SearchIndexUnavailable({ shard: "products-1" })
    )
  }

  return "search index refreshed"
})

const refreshBackoff = Schedule.unfold(1, (step) =>
  Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 25))),
  Schedule.take(5)
)

const program = Effect.gen(function*() {
  const result = yield* refreshSearchIndex.pipe(
    Effect.retry(refreshBackoff)
  )
  yield* Console.log(result)
}).pipe(
  Effect.catch((error) => Console.log(`refresh failed: ${error._tag}`))
)

Effect.runPromise(program)
```

The example waits `25ms`, `50ms`, `75ms`, and `100ms` before succeeding. With a
250 millisecond production step, the same shape would wait ten times longer.

## Variants

If you still want a curve but the default doubling is too abrupt, pass a smaller
factor to `Schedule.exponential`, for example `1.5`.

If many fibers or processes may fail together, apply `Schedule.jittered` after
the base linear shape is correct.

## Notes and caveats

`Schedule.exponential(base)` and the hand-built linear policy are both unbounded
until you add `Schedule.take`, `Schedule.recurs`, `Schedule.during`, or another
stopping condition.

Changing the initial unfold state changes the first delay. Starting at `0` makes
the first added delay zero; start at `1` when the first retry should wait one
full increment.
