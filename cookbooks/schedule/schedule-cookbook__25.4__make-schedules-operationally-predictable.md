---
book: Effect `Schedule` Cookbook
section_number: "25.4"
section_title: "Make schedules operationally predictable"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "25. Delay Capping Recipes"
status: "draft"
code_included: true
---

# 25.4 Make schedules operationally predictable

Use this to make a retry, reconnect, or polling policy reviewable: name the
cadence, cap, stop conditions, and observation hooks near the call site.

## Problem

Raw backoff helpers hide important production behavior. Reviewers need to know
the maximum single wait, retry volume, elapsed budget, and what gets logged or
measured. A schedule buried behind `retryWithBackoff` often forces readers to
infer those guarantees from implementation details.

## When to use it

Use it for service startup checks, control-plane calls, background worker
reconnects, and dependency probes. It is especially useful for shared policies:
named pieces such as `retryCadence`, `retryLimit`, and `elapsedBudget` are easier
to review than a raw `Schedule.exponential("250 millis")`.

## When not to use it

Do not use a more elaborate schedule to compensate for missing error
classification. Permanent errors should be filtered before the schedule is
applied.

Avoid polling when a queue acknowledgement, callback, subscription, or domain
event can report completion directly. A tidy polling schedule is still polling.

## Schedule shape

Start with the smallest set of bounds that make the behavior reviewable:

- a cadence, such as `Schedule.exponential`, for normal retry spacing
- a per-delay cap, using `Schedule.modifyDelay`, so no individual wait grows
  beyond an operationally acceptable value
- a count limit, using `Schedule.recurs`, so the retry volume is bounded
- an elapsed budget, using `Schedule.during`, when wall-clock time matters more
  than attempt count
- observation hooks, such as `Schedule.tapInput` or `Schedule.tapOutput`, when
  failures or schedule outputs should appear in logs or metrics

`Schedule.both` is useful for combining independent bounds because the combined
schedule recurs only while both sides recur. Its delay is the maximum delay
selected by the two schedules, which makes it a conservative way to combine a
cadence with a limit.

## Code

```ts
import { Console, Duration, Effect, Schedule } from "effect"

type RemoteError =
  | { readonly _tag: "Timeout"; readonly attempt: number }
  | { readonly _tag: "Unavailable"; readonly attempt: number }

let attempts = 0

const callControlPlane = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`control-plane attempt ${attempts}`)

  if (attempts === 1) {
    return yield* Effect.fail<RemoteError>({ _tag: "Timeout", attempt: attempts })
  }
  if (attempts === 2) {
    return yield* Effect.fail<RemoteError>({
      _tag: "Unavailable",
      attempt: attempts
    })
  }

  return "control plane responded"
})

const capAt5Seconds = (delay: Duration.Duration) =>
  Duration.min(delay, Duration.seconds(5))

const retryCadence = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay((_, delay) => Effect.succeed(capAt5Seconds(delay)))
)

const retryLimit = Schedule.recurs(8)
const elapsedBudget = Schedule.during("30 seconds")

const operationalRetryPolicy = retryCadence.pipe(
  Schedule.both(retryLimit),
  Schedule.both(elapsedBudget),
  Schedule.tapInput((error: RemoteError) =>
    Console.log(`retrying after ${error._tag} on attempt ${error.attempt}`)
  ),
  Schedule.tapOutput(([[delay, retryCount], elapsed]) =>
    Console.log(
      `raw delay: ${Duration.format(delay)}, capped delay: ${
        Duration.format(capAt5Seconds(delay))
      }, retries so far: ${retryCount}, elapsed: ${Duration.format(elapsed)}`
    )
  )
)

const program = callControlPlane.pipe(
  Effect.retry(operationalRetryPolicy),
  Effect.flatMap((message) => Console.log(`result: ${message}`))
)

Effect.runPromise(program)
```

This policy exposes its contract: the effective delay is capped at 5 seconds,
the retry count is bounded, and the elapsed schedule stops the policy once the
30-second budget is exhausted. The logs show both the failed input and the
schedule output.

## Variants

For a user-facing path, prefer a short elapsed budget and a small retry count.
For a background worker, the budget can be larger, but observation matters more.
For many instances using the same policy, add `Schedule.jittered` before the
final cap and keep the non-jittered bounds easy to explain.

## Notes and caveats

`Effect.retry` feeds failures into the schedule, which is why
`Schedule.tapInput` sees `RemoteError` in the example. `Effect.repeat` feeds
successful values into the schedule instead. That distinction matters for
observability and for predicates that inspect schedule input.

Keep review clarity ahead of clever composition. If one pipeline is hard to
read, split it into named pieces such as `retryCadence`, `retryLimit`,
`elapsedBudget`, and `operationalRetryPolicy`.
