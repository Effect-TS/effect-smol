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

A retry or polling schedule is useful only when it improves outcomes more than
it increases latency and load. Measure both sides.

## Problem

You have a retry policy that looks reasonable, but you need evidence that it is
helping. Count scheduled recurrences, record chosen delays, and measure final
outcomes outside the schedule.

## When to use it

Use this when retry or polling affects user latency, infrastructure load,
downstream quotas, incident diagnosis, or operational cost.

## When not to use it

Do not measure retries as a substitute for classifying errors. Validation,
authorization, malformed requests, and unsafe non-idempotent writes should be
excluded before the schedule is applied.

## Schedule shape

Use `Schedule.tapInput` for recurrence inputs and `Schedule.tapOutput` for
schedule outputs. Keep operation-level success and failure metrics around the
effect that uses the policy.

## Code

```ts
import { Console, Duration, Effect, Metric, Schedule } from "effect"

type InventoryError = {
  readonly _tag: "Timeout" | "Unavailable" | "BadRequest"
}

let attempts = 0

const fetchInventory = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`inventory attempt ${attempts}`)

  if (attempts < 3) {
    return yield* Effect.fail({ _tag: "Unavailable" } as const)
  }

  return ["sku-1", "sku-2", "sku-3"]
})

const retryScheduled = Metric.counter("inventory_retry_scheduled_total", {
  description: "Retries scheduled by the inventory retry policy"
})

const retryDelayMillis = Metric.histogram("inventory_retry_delay_millis", {
  description: "Base retry delay before jitter",
  boundaries: [10, 20, 50, 100]
})

const inventoryRetryPolicy = Schedule.exponential("10 millis").pipe(
  Schedule.satisfiesInputType<InventoryError>(),
  Schedule.tapOutput((delay) =>
    Effect.gen(function*() {
      yield* Metric.update(retryDelayMillis, Duration.toMillis(delay))
      yield* Console.log(`observed retry delay ${Duration.toMillis(delay)}ms`)
    })
  ),
  Schedule.jittered,
  Schedule.take(5),
  Schedule.tapInput((error) =>
    Effect.gen(function*() {
      yield* Metric.update(retryScheduled, 1)
      yield* Console.log(`scheduled retry after ${error._tag}`)
    })
  )
)

const program = fetchInventory.pipe(
  Effect.retry({
    schedule: inventoryRetryPolicy,
    while: (error) => error._tag !== "BadRequest"
  }),
  Effect.flatMap((items) =>
    Console.log(`inventory loaded after retry: ${items.length} items`)
  )
)

Effect.runPromise(program)
```

The counter records scheduled retries, not the initial attempt. The histogram
records the base delay before jitter. Final success is measured around the
operation, outside the schedule.

## Variants

For polling, count scheduled polls, terminal success, terminal timeout, and
elapsed time until the desired state appears. For fleet-wide retries, compare
retry counters with downstream saturation signals such as 429s, 503s, queue
depth, and connection pool usage.

## Notes and caveats

Measure benefit and cost together. A policy that increases eventual success
while hiding an outage or adding too much latency is not effective.
