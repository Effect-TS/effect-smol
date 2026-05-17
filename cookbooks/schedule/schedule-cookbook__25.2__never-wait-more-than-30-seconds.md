---
book: Effect `Schedule` Cookbook
section_number: "25.2"
section_title: "Never wait more than 30 seconds"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "25. Delay Capping Recipes"
status: "draft"
code_included: true
---

# 25.2 Never wait more than 30 seconds

Use this for service or background work that should back off under failure but
must never schedule a wait longer than 30 seconds.

## Problem

Background retries often need to continue longer than user-facing retries. They
still need an operational bound: during an incident, "try less often" is useful,
but "wait arbitrarily long" makes recovery and observation harder.

## When to use it

Use it for reconnect loops, shard processors, background sync, lease renewal,
cache warming, and service-to-service calls where a dependency may recover on
its own. The cap gives operators a clear maximum delay between attempts.

## When not to use it

Avoid this cap on interactive paths unless the product can tolerate it.
User-facing flows usually need smaller caps, fewer attempts, and an elapsed-time
budget.

The cap is not a stopping rule. Combine it with `Schedule.recurs`,
`Schedule.take`, `Schedule.during`, or another terminating condition when the
retry policy must end.

## Schedule shape

Choose the backoff curve, optionally jitter it, and apply the hard cap last. A
typical pipeline is `Schedule.exponential("250 millis")`, then
`Schedule.jittered`, then `Schedule.modifyDelay` with
`Duration.min(delay, Duration.seconds(30))`.

`Schedule.jittered` adjusts each delay to a random value between 80% and 120% of
the incoming delay. Capping after jitter keeps the final scheduled wait at or
below 30 seconds.

## Code

```ts
import { Console, Duration, Effect, Schedule } from "effect"

type ServiceError =
  | { readonly _tag: "Unavailable"; readonly attempt: number }
  | { readonly _tag: "Timeout"; readonly attempt: number }

let attempts = 0

const refreshServiceState = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`refresh attempt ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail<ServiceError>({
      _tag: "Unavailable",
      attempt: attempts
    })
  }
  if (attempts === 2) {
    return yield* Effect.fail<ServiceError>({
      _tag: "Timeout",
      attempt: attempts
    })
  }

  yield* Console.log("service state refreshed")
})

const retryWithThirtySecondDelayCap = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(30)))
  ),
  Schedule.both(Schedule.recurs(20))
)

const program = refreshServiceState.pipe(
  Effect.retry(retryWithThirtySecondDelayCap)
)

Effect.runPromise(program)
```

The example succeeds quickly, but the policy has the same shape you would use
for longer-running background work: exponential backoff, jitter, a final
30-second cap, and a recurrence limit.

## Variants

For service-lifetime reconnect loops, remove the retry count only when error
classification is strict and shutdown is handled elsewhere. For user-facing
paths, use a smaller cap and a shorter elapsed budget. For polling successful
values, use `Effect.repeat`; the same delay cap works, but the schedule input is
the successful value rather than the failure.

## Notes and caveats

The cap applies to schedule delays, not to the runtime of the effect being
retried. If one attempt can hang for a long time, add an effect-level timeout
separately.

`Schedule.both` combines schedules with intersection semantics: recurrence
continues only while both schedules continue. Its delay is the larger of the two
delays, so pairing capped backoff with `Schedule.recurs(20)` keeps the cadence
and adds a retry limit.
