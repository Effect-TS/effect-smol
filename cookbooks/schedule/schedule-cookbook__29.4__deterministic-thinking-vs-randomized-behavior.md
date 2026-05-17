---
book: Effect `Schedule` Cookbook
section_number: "29.4"
section_title: "Deterministic thinking vs randomized behavior"
part_title: "Part VI — Jitter Recipes"
chapter_title: "29. Jitter Tradeoffs"
status: "draft"
code_included: true
---

# 29.4 Deterministic thinking vs randomized behavior

Jitter is easiest to reason about when it is added to an explicit base schedule.
The cadence and stopping rule stay visible; only each computed delay becomes a
bounded random value.

## Problem

You may need to spread retries from many clients, workers, or fibers without
making the retry contract vague. Operators still need answers such as:

- How many times can this retry?
- What is the base backoff shape?
- What range can the next delay fall into?
- Does jitter change the stop condition?

The schedule should answer those questions directly. Randomness should be a
small, bounded modifier, not a hidden sleep inside the effect being retried.

## When to use it

Use this approach when a deterministic policy is easy to describe, but many
instances may run that policy at the same time. Common examples include service
reconnects, remote API retries, queue consumers, cache lookups, and polling
loops after a shared outage.

It is especially useful when you want predictable bounds rather than exact
timestamps. For example, a 500 millisecond base delay becomes a delay somewhere
from 400 to 600 milliseconds. The exact value is random, but the operational
range is deterministic.

## When not to use it

Do not add jitter when exact wall-clock timing is part of the requirement. A
cron-like job, a precisely timed heartbeat, or a test that asserts exact sleeps
should keep a deterministic schedule or assert delay bounds instead of exact
values.

Do not use jitter as a retry limit, a timeout, or a safety check for unsafe
operations. `Schedule.jittered` only adjusts delays. It does not decide whether
an operation is idempotent, which failures are retryable, or when the workflow
must stop.

## Schedule shape

Build the deterministic part first: the base delay, the backoff shape, and the
stop condition. Then add `Schedule.jittered` to the delay-producing cadence. A
policy that combines `Schedule.exponential("250 millis")`,
`Schedule.jittered`, and `Schedule.both(Schedule.recurs(5))` still permits at
most five retries after the original attempt. Only each wait is randomized
within Effect's fixed 80%-120% range:

| Base delay | Possible jittered delay |
| ---------- | ----------------------- |
| 250 ms     | 200-300 ms              |
| 500 ms     | 400-600 ms              |
| 1 s        | 800 ms-1.2 s            |
| 2 s        | 1.6-2.4 s               |

That is the core reasoning model: deterministic policy shape, randomized delay
selection inside known bounds.

## Code

```ts
import { Console, Data, Effect, Random, Ref, Schedule } from "effect"

class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly status: number
  readonly attempt: number
}> {}

const isRetryable = (error: ServiceUnavailable) =>
  error.status === 429 || error.status >= 500

const retryPolicy = Schedule.exponential("25 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
  Schedule.while(({ input }) => isRetryable(input))
)

const program = Effect.gen(function*() {
  const attempts = yield* Ref.make(0)

  const refreshRemoteState = Effect.gen(function*() {
    const attempt = yield* Ref.updateAndGet(attempts, (n) => n + 1)
    yield* Console.log(`refresh attempt ${attempt}`)

    if (attempt < 4) {
      return yield* Effect.fail(
        new ServiceUnavailable({ status: 503, attempt })
      )
    }

    return "remote state refreshed"
  })

  const result = yield* refreshRemoteState.pipe(
    Effect.retry(retryPolicy),
    Random.withSeed("deterministic-shape-demo")
  )

  yield* Console.log(result)
})

Effect.runPromise(program)
```

`program` keeps the deterministic pieces visible: exponential backoff, a retry
limit, and an error predicate. The random part is limited to the delay selected
between retry attempts.

## Variants

For user-facing work, keep the deterministic envelope small: short base delay,
low retry count, and a narrow elapsed budget. For background work, pair jitter
with an elapsed budget such as `Schedule.both(Schedule.during("2 minutes"))` so
the exact sleeps vary but the maximum retry window stays explicit.

## Notes and caveats

`Schedule.jittered` is not configurable in this API. It adjusts each recurrence
delay between 80% and 120% of the original delay.

Jitter preserves the wrapped schedule's output. If the wrapped schedule outputs
the exponential delay, the jittered schedule still has that output; the random
adjustment affects the sleep between recurrences.

Place jitter where you want the randomization to happen. If you want to jitter
the exponential backoff itself, apply `Schedule.jittered` after
`Schedule.exponential(...)` and before adding unrelated observation or naming
concerns. Keep count limits, elapsed budgets, and retry predicates explicit so
readers can separate deterministic decisions from randomized delay selection.
