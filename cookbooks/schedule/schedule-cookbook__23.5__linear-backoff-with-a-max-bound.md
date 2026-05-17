---
book: Effect `Schedule` Cookbook
section_number: "23.5"
section_title: "Linear backoff with a max bound"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "23. Linear Backoff Recipes"
status: "draft"
code_included: true
---

# 23.5 Linear backoff with a max bound

Capped linear backoff grows by a fixed increment until it reaches a maximum
delay, then stays at that maximum. The cap keeps the tail predictable without
losing the gentle ramp at the start.

## Problem

You want retry delays like this:

```text
250ms, 500ms, 750ms, 1000ms, 1000ms, ...
```

The cap is the maximum delay between attempts. It is not a total time budget; a
policy with many retries can still run for much longer overall.

## When to use it

Use capped linear backoff for local worker retries, lightweight reconnect loops,
and maintenance tasks where each failure should slow the caller down gradually
but the operation should still make steady progress.

## When not to use it

Do not use a schedule to turn permanent failures into transient ones. Validate
requests, credentials, resource identifiers, and idempotency before applying
retry.

For high-volume shared dependencies, add jitter after the capped delay is
correct so callers do not synchronize on the cap.

## Schedule shape

Use `Schedule.unfold` for the step number and `Schedule.addDelay` for the
duration. Clamp the computed duration with `Duration.min` before returning it.
Add the retry limit separately so "how long to wait" and "how many times to try"
remain independent.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class SearchIndexUnavailable extends Data.TaggedError("SearchIndexUnavailable")<{
  readonly shard: string
}> {}

const maxDelay = Duration.millis(80)

const delayForStep = (step: number) =>
  Duration.min(Duration.millis(step * 25), maxDelay)

const previewDelays = [1, 2, 3, 4, 5].map((step) =>
  `${Duration.toMillis(delayForStep(step))}ms`
)

let attempts = 0

const refreshSearchIndex = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`refresh attempt ${attempts}`)

  if (attempts < 5) {
    return yield* Effect.fail(
      new SearchIndexUnavailable({ shard: "products-1" })
    )
  }

  return "refresh complete"
})

const linearBackoff = Schedule.unfold(1, (step) =>
  Effect.succeed(step + 1)
).pipe(
  Schedule.addDelay((step) => Effect.succeed(delayForStep(step))),
  Schedule.both(Schedule.recurs(8))
)

const program = Effect.gen(function*() {
  yield* Console.log(`configured delays: ${previewDelays.join(", ")}`)
  const result = yield* refreshSearchIndex.pipe(
    Effect.retry(linearBackoff)
  )
  yield* Console.log(result)
}).pipe(
  Effect.catch((error) => Console.log(`refresh failed: ${error._tag}`))
)

Effect.runPromise(program)
```

The example uses a small cap so it terminates quickly. In production, the same
shape can use a 250 millisecond step and a 1 second cap.

## Variants

For an interactive request, use a smaller cap and fewer retries. For a
background worker, increase the step size, cap, and retry limit. For a fleet,
apply `Schedule.jittered` after the capped delay policy.

## Notes and caveats

`Schedule.addDelay` adds to the schedule's existing delay. Here the base
schedule is `Schedule.unfold`, whose own delay is zero, so the added duration is
the full retry delay.

If you need to observe the actual delays for logging or tests, wrap the finished
policy with `Schedule.delays`.
