---
book: Effect `Schedule` Cookbook
section_number: "48.5"
section_title: "Measure schedule effectiveness"
part_title: "Part XI — Observability and Testing"
chapter_title: "48. Observability, Logging, and Diagnostics"
status: "draft"
code_included: true
---

# 48.5 Measure schedule effectiveness

A retry or polling schedule is only helpful when it improves the outcome more
than it increases latency and load.

## Problem

You have a retry or polling policy that looks reasonable in code, but you need
evidence that it is helping. A backoff that recovers transient failures is useful.
A backoff that mostly delays inevitable failures, hides a dependency outage, or
keeps a struggling service busy is hurting the system.

The schedule is a good place to emit recurrence metrics because `Effect.retry`
feeds failures into the schedule and `Effect.repeat` feeds successful values
into the schedule. That gives you a direct view of the decisions made after the
initial attempt, without burying counters in hand-written loops.

## When to use it

Use this when a retry or polling policy affects user latency, infrastructure
load, downstream quotas, incident diagnosis, or operational cost. It is
especially useful for remote API calls, startup dependency checks, queue or
object-storage operations, background job polling, and fleet-wide periodic work.

The most useful metrics usually answer these questions:

- How many retries or polls are scheduled per completed operation?
- What percentage of operations succeed only after at least one retry?
- How often does the policy still end in failure after spending its budget?
- How much extra latency does the policy add before success or final failure?
- What base delays are being chosen, and where jitter or caps are applied?
- Does downstream error rate, rate limiting, backlog, or saturation rise while
  the schedule is active?

## When not to use it

Do not measure retries as a substitute for classifying errors. Validation
failures, authorization failures, malformed requests, and unsafe non-idempotent
writes should be excluded before the schedule is applied. Counting them as
"retry failures" makes the policy look worse and can hide the real bug.

Do not optimize only for retry success rate. A policy can increase the number of
eventual successes while also making the system worse by adding too much latency
or by keeping pressure on a dependency that needs time to recover.

## Schedule shape

Start with metrics that match the schedule decisions:

- A counter for scheduled retries or polls.
- A histogram for the computed delay.
- A counter for final outcomes, measured around the operation using the policy.
- A latency measurement for the whole operation, not only the individual attempt.

`Schedule.tapInput` observes the value fed into the schedule. With
`Effect.retry`, that input is the failure that is about to be retried. With
`Effect.repeat`, that input is the successful value that is about to be followed
by another recurrence.

`Schedule.tapOutput` observes the schedule output. For `Schedule.exponential`,
the output is the current duration. If you later compose the schedule with
`Schedule.both`, the output shape changes to a tuple, so keep instrumentation
near the schedule whose output you want to measure.

## Code

```ts
import { Duration, Effect, Metric, Schedule } from "effect"

type InventoryError = {
  readonly _tag: "Timeout" | "Unavailable" | "BadRequest"
}

declare const fetchInventory: Effect.Effect<readonly string[], InventoryError>

const retryScheduled = Metric.counter("inventory_retry_scheduled_total", {
  description: "Retries scheduled by the inventory retry policy"
})

const retryDelayMillis = Metric.histogram("inventory_retry_delay_millis", {
  description: "Base exponential retry delay before jitter",
  boundaries: [100, 250, 500, 1_000, 2_500, 5_000, 10_000]
})

const inventoryRetryPolicy = Schedule.exponential("200 millis").pipe(
  Schedule.tapOutput((delay) =>
    Metric.update(retryDelayMillis, Duration.toMillis(delay))
  ),
  Schedule.jittered,
  Schedule.take(5),
  Schedule.tapInput((error: InventoryError) =>
    Metric.update(retryScheduled, 1).pipe(
      Effect.zipRight(Effect.log(`scheduling inventory retry after ${error._tag}`))
    )
  )
)

export const program = fetchInventory.pipe(
  Effect.retry({
    schedule: inventoryRetryPolicy,
    while: (error) => error._tag !== "BadRequest"
  })
)
```

The counter records retry decisions, not total attempts. The first
`fetchInventory` attempt still runs immediately and is not scheduled by
`Schedule`.

The delay histogram is attached before `Schedule.jittered`, so it records the
base exponential delay. `Schedule.jittered` modifies the recurrence delay while
preserving the schedule output, so `tapOutput` still observes the original
duration value rather than the randomized delay.

## Variants

For polling, use the same shape but rename the metrics around polling pressure:
polls scheduled, poll delay, terminal success rate, terminal timeout rate, and
elapsed time until the desired state appears. A polling policy is helping when
it finds real state transitions promptly without producing a large number of
empty observations.

For fleet-wide retries, compare retry scheduling with downstream saturation
signals. If retry counters rise at the same time as rate-limit responses,
connection pool exhaustion, or queue depth, the policy may need stronger jitter,
a larger base delay, a cap on concurrent callers, or a shorter budget.

For user-facing paths, separate "success after retry" from "success without
retry". The first number shows recovered transients. The second number protects
you from accepting a slow path as normal. If most successful requests require
retries, the schedule is masking an availability problem.

## Notes and caveats

Measure both benefit and cost. Useful benefit metrics include success after
retry, terminal success rate for polling, and reduced visible failure rate.
Useful cost metrics include added latency, retries per operation, downstream
429/503 rates, queue depth, connection usage, and timeout rate after the retry
budget is spent.

A retry policy that improves a dashboard while making incidents harder to see is
not effective. Keep final failures visible, and alert on exhaustion of retry
budgets as well as on raw operation failures.

Schedule metrics describe recurrence decisions. They do not replace attempt
metrics around the effect itself, and they do not interrupt in-flight work. Use
operation-level metrics to measure total latency and final outcome, and use the
schedule-level metrics to explain how much recurrence behavior contributed to
that outcome.
