---
book: Effect `Schedule` Cookbook
section_number: "23.1"
section_title: "Increase delay gradually"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "23. Linear Backoff Recipes"
status: "draft"
code_included: true
---

# 23.1 Increase delay gradually

Linear backoff increases each retry delay by the same amount. It is useful when
immediate retries are too noisy but exponential backoff would slow a short
recovery window too quickly.

Effect does not expose a `Schedule.linear` constructor. Build the shape with
`Schedule.unfold`, then use `Schedule.addDelay` to convert the step number into
a delay.

## Problem

A dependency usually recovers within a few seconds. Configure retries so the
first retry waits one step, the next waits two steps, and so on:

```text
250ms, 500ms, 750ms, 1000ms, ...
```

The original effect still runs immediately. The schedule controls only the wait
before later attempts.

## Schedule shape

`Schedule.unfold(1, ...)` emits `1`, then `2`, then `3`. Starting at `1` makes
the first retry wait one full interval instead of retrying immediately.

`Schedule.addDelay` receives each emitted step. Multiplying the step by the base
interval turns the sequence into a linear delay series. Add `Schedule.take` or
`Schedule.recurs` so the policy is finite unless an unbounded retry loop is
intentional.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class SearchIndexUnavailable extends Data.TaggedError("SearchIndexUnavailable")<{
  readonly shard: string
}> {}

let attempts = 0

const updateSearchIndex = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`index attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(
      new SearchIndexUnavailable({ shard: "products-1" })
    )
  }

  return `indexed products-1 on attempt ${attempts}`
})

const retryWithGradualDelay = Schedule.unfold(1, (step) =>
  Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(Duration.millis(step * 25))),
  Schedule.take(5)
)

const program = Effect.gen(function*() {
  const result = yield* updateSearchIndex.pipe(
    Effect.retry(retryWithGradualDelay)
  )
  yield* Console.log(result)
}).pipe(
  Effect.catch((error) =>
    Console.log(`indexing failed after retries: ${error._tag}`)
  )
)

Effect.runPromise(program)
```

The example uses 25 millisecond steps so it terminates quickly:

```text
25ms, 50ms, 75ms, ...
```

In production, use the same schedule shape with the interval that matches the
dependency and user-visible latency budget.

## When to use it

Use gradual delay for short-lived contention, internal service warmup, local
coordination, and interactive work where a few retries can help but long waits
would be hard to justify.

It is often easier to review than a hand-written loop because the retry count,
state progression, and delay calculation are all expressed as one `Schedule`.

## Variants

Increase the base interval to make the ramp slower. Add `Schedule.jittered` when
many callers may retry at the same time. For a hard maximum delay, clamp the
duration returned from `Schedule.addDelay` or use a capped-delay recipe.

## Notes and caveats

`Schedule.addDelay` adds to the delay produced by the schedule it wraps.
`Schedule.unfold` has no delay of its own, so the added duration is the effective
wait here.

`Effect.retry` feeds typed failures into the schedule. Use a retry predicate or
an error type split when only some failures are safe to retry.
