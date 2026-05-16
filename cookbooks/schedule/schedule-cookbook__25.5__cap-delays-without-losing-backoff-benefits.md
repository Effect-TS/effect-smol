---
book: Effect `Schedule` Cookbook
section_number: "25.5"
section_title: "Cap delays without losing backoff benefits"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "25. Delay Capping Recipes"
status: "draft"
code_included: true
---

# 25.5 Cap delays without losing backoff benefits

An exponential backoff is useful because the first few retries stay close to the original failure while later retries back away from the dependency. Left uncapped, however, the same curve can eventually produce waits that are too long for the workflow you are protecting. Capping the delay keeps the early exponential shape and replaces only the late tail with a maximum wait.

## Problem

You want retries to start at `250 millis`, then grow to `500 millis`, `1 second`, `2 seconds`, and so on, because that spacing quickly reduces pressure on a struggling dependency. You do not want the same policy to drift into waits such as 16, 32, or 64 seconds when the caller, worker, or operator expects a bounded recovery loop.

The recurrence policy should say both things explicitly: grow like a backoff while the computed delay is small, then never sleep longer than the chosen cap.

## When to use it

Use this recipe for retry or reconnect loops where short early retries are helpful but long tail delays are not. It fits control-plane calls, service startup probes, worker reconnects, and idempotent remote operations where transient failures often clear quickly, but the workflow still needs an operational maximum per wait.

It is also useful when the maximum single delay is part of the contract. Reviewers can look at the schedule and see that the policy backs off exponentially without ever waiting more than, for example, 5 seconds between attempts.

## When not to use it

Do not use a capped backoff to make permanent failures look transient. Validation errors, authorization failures, malformed requests, and unsafe non-idempotent writes should be classified before `Effect.retry` applies the schedule.

Also avoid this pattern when a fixed cadence is the real requirement. If every retry should wait exactly 5 seconds, use `Schedule.spaced("5 seconds")` instead of building an exponential schedule and clamping most of its values.

## Schedule shape

Build the policy in two steps:

- start with `Schedule.exponential`, which outputs the computed delay and uses that delay before the next recurrence
- apply `Schedule.modifyDelay` with `Duration.min` so the delay used by the schedule is never larger than the cap

The important detail is that the cap does not flatten the whole policy. With a base of `250 millis` and a cap of `5 seconds`, the first delays are still `250 millis`, `500 millis`, `1 second`, `2 seconds`, and `4 seconds`. Only computed delays above `5 seconds` are replaced by `5 seconds`.

Combine the capped cadence with a stopping condition such as `Schedule.recurs` so the retry volume is bounded as well as the per-attempt wait.

## Code

```ts
import { Duration, Effect, Schedule } from "effect"

type RemoteError = { readonly _tag: "RemoteError" }

declare const callControlPlane: Effect.Effect<string, RemoteError>

const cappedCadence = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(Duration.min(delay, Duration.seconds(5)))
  )
)

const retryPolicy = cappedCadence.pipe(
  Schedule.both(Schedule.recurs(8))
)

export const program = Effect.retry(callControlPlane, retryPolicy)
```

`Schedule.exponential("250 millis")` supplies the backoff curve. `Schedule.modifyDelay` receives each computed delay and returns the smaller of that delay and `Duration.seconds(5)`. Delays below the cap pass through unchanged, so the policy still gets the early benefit of exponential spacing. Delays above the cap are limited, so the late retry loop cannot become quieter than the workflow allows.

`Schedule.recurs(8)` bounds the number of recurrences. `Schedule.both` combines that limit with the capped cadence, so the retry policy stops when the count limit stops.

## Variants

For a gentler curve, pass a smaller factor to `Schedule.exponential`, such as `Schedule.exponential("250 millis", 1.5)`. The same cap still applies; it just takes more recurrences to reach it.

For a user-facing path, reduce the cap and recurrence count so the caller receives a clear answer quickly. For a background worker, a larger cap may be acceptable, but keep the cap visible at the schedule definition.

For many instances using the same retry policy, apply `Schedule.jittered` after the cap if spreading retry traffic matters more than exact delay values. Jitter changes the actual waits, so keep tests and metrics aware that the delay is no longer deterministic.

## Notes and caveats

`Schedule.modifyDelay` changes the delay used between recurrences; it does not change the schedule output. In the example, the cadence still outputs the exponential delay value, while the actual sleep is capped. If downstream logging needs to report the capped delay exactly, compute and log the same capped value in the schedule pipeline instead of assuming the raw exponential output is the wait.

`Effect.retry` feeds failures into the schedule. `Effect.repeat` feeds successful values into the schedule. That distinction matters if you later add predicates or observation hooks such as `Schedule.tapInput`.
