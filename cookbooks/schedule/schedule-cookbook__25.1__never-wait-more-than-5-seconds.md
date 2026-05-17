---
book: Effect `Schedule` Cookbook
section_number: "25.1"
section_title: "Never wait more than 5 seconds"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "25. Delay Capping Recipes"
status: "draft"
code_included: true
---

# 25.1 Never wait more than 5 seconds

Use this when the delay between attempts may grow, but no single scheduled wait
may exceed 5 seconds. The cap is per delay; it is not a total timeout.

## Problem

Exponential backoff protects an unhealthy dependency by spacing out retries.
Without a cap, the same policy can drift into waits that are too long for a
request, reconnect loop, lease-based worker, or status check.

## When to use it

Use it for idempotent remote calls, reconnects, queue consumers, cache refreshes,
control-plane calls, and polling loops where the first retries should back off
quickly but the next attempt must remain near enough to observe.

## When not to use it

Do not use a cap to make permanent failures retryable. Validation errors,
authorization failures, malformed requests, and unsafe non-idempotent writes
should be classified before retrying.

Do not treat the cap as an elapsed-time budget. A policy capped at 5 seconds can
still run much longer overall if it has many recurrences or slow attempts. Add
`Schedule.recurs`, `Schedule.during`, or an effect-level timeout when the whole
operation needs a deadline.

## Schedule shape

Start with the natural delay curve, then rewrite each computed delay before it
is used. In practice, this is `Schedule.exponential("100 millis")` followed by
`Schedule.modifyDelay((_, delay) => Effect.succeed(Duration.min(delay,
Duration.seconds(5))))`.

`Schedule.modifyDelay` receives the schedule output and the next delay. The
`Duration.min` expression preserves smaller delays and clamps larger delays to 5
seconds. If you also use jitter, put `Schedule.jittered` before the final cap;
jitter can increase a delay by up to 20%.

## Code

```ts
import { Console, Data, Duration, Effect, Schedule } from "effect"

class RemoteError extends Data.TaggedError("RemoteError")<{
  readonly attempt: number
}> {}

let attempts = 0

const callControlPlane = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`attempt ${attempts}`)

  if (attempts < 4) {
    return yield* Effect.fail(new RemoteError({ attempt: attempts }))
  }

  return "control plane ready"
})

const capAt5Seconds = (delay: Duration.Duration) =>
  Duration.min(delay, Duration.seconds(5))

const cappedBackoff = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay((_, delay) => Effect.succeed(capAt5Seconds(delay))),
  Schedule.tapInput((error: RemoteError) =>
    Console.log(`retrying after failed attempt ${error.attempt}`)
  ),
  Schedule.both(Schedule.recurs(8))
)

const program = callControlPlane.pipe(
  Effect.retry(cappedBackoff),
  Effect.flatMap((message) => Console.log(`result: ${message}`))
)

Effect.runPromise(program)
```

The first attempt runs immediately. Failures are retried with exponential
backoff, and every computed delay is clamped by `capAt5Seconds` before the next
retry sleeps.

## Variants

Use a smaller base delay and retry count for interactive work. Use a slower base
delay and larger retry count for background work. For fleet-wide retries, add
`Schedule.jittered` before the final `Schedule.modifyDelay` cap.

## Notes and caveats

`Schedule.modifyDelay` changes the delay used for the next recurrence. It does
not change the schedule output. For `Schedule.exponential`, the output remains
the uncapped exponential duration.

`Schedule.recurs(8)` means eight retries after the original attempt, not eight
total attempts. With `Effect.retry`, only typed failures are retried; defects
and interruptions are not converted into retryable errors.
