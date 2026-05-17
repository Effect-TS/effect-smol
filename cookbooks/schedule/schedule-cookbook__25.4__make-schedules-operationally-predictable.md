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

Use this recipe to make a retry, reconnect, or polling schedule reviewable by
naming its cadence, caps, stop conditions, and observation hooks in one policy.

## Problem

An exponential backoff without a cap is easy to write and hard to reason about later. The first few delays may look harmless, but the tail can become too long for a user-facing request, too quiet for incident response, or too vague for a reviewer to know the worst case. A schedule that is buried inside a helper such as `retryWithBackoff` has the same problem: the operational contract exists, but readers have to infer it from implementation details.

You need a policy whose upper bounds and signals are visible at the call site.

## When to use it

Use this recipe when a retry, reconnect, or polling loop has to be defended in production. It fits service startup checks, control-plane calls, background worker reconnects, and dependency probes where reviewers need concrete answers about maximum delay, retry count, elapsed budget, and logging or metrics hooks.

It is especially useful when the schedule will be reused. Naming a bounded and observed policy is clearer than passing around a raw `Schedule.exponential("250 millis")` and relying on every caller to remember the missing guardrails.

## When not to use it

Do not use a more elaborate schedule to compensate for missing error classification. Validation failures, authorization failures, malformed requests, and unsafe non-idempotent writes should be filtered before the schedule is applied.

Also avoid this pattern when a recurrence policy is not the right operational model. If a queue acknowledgement, callback, subscription, or domain event can report completion directly, polling with a tidy schedule is still polling.

## Schedule shape

Start with the smallest set of bounds that make the behavior reviewable:

- a cadence, such as `Schedule.exponential`, for normal retry spacing
- a per-delay cap, using `Schedule.modifyDelay`, so no individual wait grows beyond an operationally acceptable value
- a count limit, using `Schedule.recurs`, so the retry volume is bounded
- an elapsed budget, using `Schedule.during`, when wall-clock time matters more than attempt count
- observation hooks, such as `Schedule.tapInput` or `Schedule.tapOutput`, when failures, decisions, or next-delay values should appear in logs or metrics

`Schedule.both` is useful for combining independent bounds because the combined schedule recurs only while both sides recur. Its delay is the maximum delay selected by the two schedules, which makes it a conservative way to combine a cadence with a limit.

## Code

```ts
import { Duration, Effect, Schedule } from "effect"

type RemoteError =
  | { readonly _tag: "Timeout" }
  | { readonly _tag: "Unavailable" }

declare const callControlPlane: Effect.Effect<string, RemoteError>

const retryCadence = Schedule.exponential("250 millis").pipe(
  Schedule.modifyDelay((_, delay) =>
    Effect.succeed(
      Duration.min(Duration.fromInputUnsafe(delay), Duration.seconds(5))
    )
  )
)

const retryLimit = Schedule.recurs(8)
const elapsedBudget = Schedule.during("30 seconds")

const operationalRetryPolicy = retryCadence.pipe(
  Schedule.both(retryLimit),
  Schedule.both(elapsedBudget),
  Schedule.tapInput((error: RemoteError) =>
    Effect.log(`retrying control-plane call after ${error._tag}`)
  ),
  Schedule.tapOutput(([[delay, retryCount], elapsed]) =>
    Effect.log(
      `next delay: ${Duration.format(delay)}, retries so far: ${retryCount}, elapsed: ${Duration.format(elapsed)}`
    )
  )
)

export const program = Effect.retry(callControlPlane, operationalRetryPolicy)
```

This policy has explicit upper bounds: no computed delay exceeds 5 seconds, no more than 8 recurrences are allowed by the count limit, and the elapsed schedule stops the policy once the 30 second budget is exhausted. The logs also show the failed input and the schedule output, so operators can distinguish a healthy transient retry from a policy that is repeatedly burning its budget.

## Variants

For a user-facing path, prefer a short elapsed budget and a small retry count. The caller should receive a clear failure while the request is still relevant.

For a background worker, the count and elapsed budget can be larger, but the cap and observation become more important. Long-running workers should make their retry state visible instead of disappearing into a quiet backoff tail.

For many instances using the same policy, add `Schedule.jittered` after the base cadence is correct. Jitter improves fleet behavior by spreading retries, but it also makes exact delay values less deterministic in logs and tests, so keep the non-jittered bounds easy to explain first.

## Notes and caveats

`Effect.retry` feeds failures into the schedule, which is why `Schedule.tapInput` sees `RemoteError` in the example. `Effect.repeat` feeds successful values into the schedule instead. That distinction matters for observability and for predicates that inspect schedule input.

Keep review clarity ahead of clever composition. A production schedule should make its promises obvious: maximum single wait, maximum retry volume, elapsed budget, whether jitter is present, and what gets logged or measured. If a single pipeline is hard to read, split it into named pieces such as `retryCadence`, `retryLimit`, `elapsedBudget`, and `observedPolicy`.
