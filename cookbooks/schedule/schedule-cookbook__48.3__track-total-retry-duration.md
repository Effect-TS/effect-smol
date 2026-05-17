---
book: Effect `Schedule` Cookbook
section_number: "48.3"
section_title: "Track total retry duration"
part_title: "Part XI — Observability and Testing"
chapter_title: "48. Observability, Logging, and Diagnostics"
status: "draft"
code_included: true
---

# 48.3 Track total retry duration

Retry count says how many follow-up attempts were scheduled. It does not say
how much time the caller spent inside the retry window.

## Problem

You need logs or metrics that show total elapsed retry time, not only the next
delay. The elapsed value helps explain user latency and how much of the retry
budget has already been consumed.

## When to use it

Use this for dependency calls, queue publication, webhook delivery, startup
checks, and background workers where retry latency is part of the service
contract.

## When not to use it

Do not use `Schedule.elapsed` as the whole policy. It observes elapsed schedule
time; it does not provide spacing or a stopping condition by itself.

## Schedule shape

Combine the real retry cadence with `Schedule.elapsed`. The cadence still owns
delays and limits; elapsed time is additional output for observability.

## Code

```ts
import { Console, Duration, Effect, Schedule } from "effect"

type DependencyError = {
  readonly _tag: "DependencyError"
  readonly status: number
}

let attempts = 0

const callDependency = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`dependency attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail({
      _tag: "DependencyError",
      status: 503
    } as const)
  }

  return "ok"
})

const isRetryable = (error: DependencyError) =>
  error.status === 408 || error.status === 429 || error.status >= 500

const retryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.satisfiesInputType<DependencyError>(),
  Schedule.both(Schedule.recurs(5)),
  Schedule.bothWith(
    Schedule.elapsed,
    ([nextDelay, retryIndex], elapsed) => ({
      elapsed,
      nextDelay,
      retryIndex
    })
  ),
  Schedule.tapOutput(({ elapsed, nextDelay, retryIndex }) =>
    Console.log(
      `retry=${retryIndex + 1} elapsed=${Duration.toMillis(elapsed)}ms ` +
        `next=${Duration.toMillis(nextDelay)}ms`
    )
  )
)

const program = callDependency.pipe(
  Effect.retry({
    schedule: retryPolicy,
    while: isRetryable
  }),
  Effect.flatMap((value) => Console.log(`dependency result: ${value}`))
)

Effect.runPromise(program)
```

The next delay explains immediate pressure on the dependency. The elapsed value
explains how long the retry window has been active.

## Variants

For user-facing paths, keep the elapsed budget small and the retry count low.
For background work, use a slower base delay and a wider budget, but still log
elapsed retry time separately from the final operation outcome.

## Notes and caveats

`Schedule.during` and `Schedule.elapsed` are about recurrence windows. They do
not interrupt an already-running attempt; add an Effect timeout around the
operation when each attempt needs a hard deadline.
