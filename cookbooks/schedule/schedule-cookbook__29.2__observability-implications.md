---
book: Effect `Schedule` Cookbook
section_number: "29.2"
section_title: "Observability implications"
part_title: "Part VI — Jitter Recipes"
chapter_title: "29. Jitter Tradeoffs"
status: "draft"
code_included: true
---

# 29.2 Observability implications

Jitter makes recurrence timing intentionally approximate. Logs and metrics need
to explain that variance as part of the policy, not as accidental drift.

## Problem

After a production path adds jitter to retries or polling, logs, metrics,
dashboards, and incident notes still need to explain what happened. Without
clear observability, random-looking waits can be mistaken for timer drift,
event-loop stalls, queue latency, downstream slowness, or a broken retry policy.

## When to use it

Use this framing whenever jittered schedules appear in production paths that are
debugged from logs or metrics. It is especially useful for reconnect loops,
HTTP retries, cache refreshes, dashboard polling, broker consumers, and startup
checks that run from many clients or service instances at once.

The observable contract should say "about this cadence, spread by jitter", not
"exactly this cadence". Operators should be able to answer how many attempts ran,
what base schedule was used, what range of delay was expected, and why a
particular retry did not happen at the nominal interval.

## When not to use it

Do not add jitter where exact timing is part of the product or protocol contract.
For example, a billing deadline, a user-visible countdown, or a lease renewal
with narrow timing requirements should not become random just to smooth logs.

Also avoid using jitter to explain away a deeper overload problem. If every
attempt is failing, a jittered schedule may spread the load, but it does not make
the dependency healthy or the request safe to repeat.

## Schedule shape

Choose the base cadence first, then apply `Schedule.jittered`. That keeps the
policy explainable: "exponential backoff starting at 200 milliseconds, capped by
the retry limit, with each delay randomized to 80%-120% of the computed delay."

For observability, log or measure the final delay after jitter has been applied.
If you only record the base delay, the next attempt will appear early or late
even though the schedule is behaving correctly.

## Code

```ts
import { Duration, Effect, Schedule } from "effect"

type ApiError = { readonly _tag: "Timeout" | "Unavailable" }

declare const callApi: Effect.Effect<void, ApiError>

const apiRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.jittered,
  Schedule.modifyDelay((baseDelay, jitteredDelay) =>
    Effect.log(
      `retry delay: base=${Duration.format(baseDelay)} actual=${Duration.format(jitteredDelay)}`
    ).pipe(Effect.as(jitteredDelay))
  ),
  Schedule.both(Schedule.recurs(5))
)

export const program = Effect.retry(callApi, apiRetryPolicy)
```

## Variants

For logs, include attempt number, error class, and the final computed delay. Avoid
alerting on exact gaps such as "retry did not happen after 1 second" when jitter
is enabled; alert on exhausted budgets, sustained failure rate, or unexpectedly
large elapsed time instead.

For metrics, expect bucketed delay histograms to widen. A 1 second delay can land
from roughly 800 milliseconds to 1.2 seconds after `Schedule.jittered`. With
exponential backoff, every computed delay gets its own 80%-120% spread, so the
tail of the retry timeline is a range, not a single line.

For incident analysis, write timelines in ranges. If the base policy is
`200ms, 400ms, 800ms`, the jittered waits are expected to fall around
`160ms-240ms`, `320ms-480ms`, and `640ms-960ms`. That distinction helps separate
normal randomization from scheduler starvation, network latency, or a stuck
dependency.

## Notes and caveats

`Schedule.jittered` changes recurrence delays, not the meaning of the input. With
`Effect.retry`, failures are still what drive the schedule. With `Effect.repeat`,
successful values are still what drive it. Keep that distinction in log fields
and metric names so retry telemetry does not get mixed with polling telemetry.

Jitter also changes delay expectations, not the first attempt. The initial effect
still runs normally; the randomized delay applies to the next recurrence decision
made by the schedule. During incidents, treat jittered timing as expected
variance first, then investigate values outside the documented range.
