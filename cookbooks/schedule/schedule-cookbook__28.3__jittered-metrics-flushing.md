---
book: Effect `Schedule` Cookbook
section_number: "28.3"
section_title: "Jittered metrics flushing"
part_title: "Part VI — Jitter Recipes"
chapter_title: "28. Jitter for Repeat and Polling"
status: "draft"
code_included: true
---

# 28.3 Jittered metrics flushing

Metrics flushing is usually successful background work: each service instance
periodically sends local counters, gauges, histograms, or spans to a collector.
This recipe adds jitter to the repeat schedule while keeping the flush interval
recognizable.

## Problem

Every service instance should flush buffered metrics about every ten seconds.
The first flush should happen as soon as the background loop starts, while later
flushes should drift enough that a deploy does not make the collector receive a
burst from every instance at the same instant.

## When to use it

Use this when many processes, pods, workers, or clients flush metrics to the
same backend on the same cadence.

It fits application metrics, telemetry batches, local aggregation buffers, and
other periodic export loops where exact wall-clock alignment is not important.

Use it when the interval is still the operational contract. A ten-second flush
loop remains a ten-second flush loop, but each follow-up delay is randomly
spread around that value.

## When not to use it

Do not use jitter when the collector requires writes on exact reporting
boundaries, such as a strict top-of-minute aggregation protocol.

Do not use jitter as the only protection for an overloaded metrics backend. It
reduces synchronized bursts, but it does not replace batching limits,
backpressure, local dropping policy, or collector-side admission control.

Do not use the repeat schedule to classify export failures. With
`Effect.repeat`, the schedule observes successful flush results. If flushing can
fail transiently, retry the single flush operation first, then repeat the
recovered operation on the longer periodic schedule.

## Schedule shape

Start with the intended flush cadence:

```ts
Schedule.spaced("10 seconds")
```

Then apply jitter to the recurrence delay:

```ts
Schedule.spaced("10 seconds").pipe(
  Schedule.jittered
)
```

`Schedule.spaced("10 seconds")` waits ten seconds after a successful flush
completes before starting the next one. `Schedule.jittered` randomly adjusts
each recurrence delay between 80% and 120% of the original delay, so a
ten-second interval becomes a delay between eight and twelve seconds.

The first flush is not delayed by the schedule. It runs when the effect starts.
The schedule controls only the repeated flushes after successful completions.

## Code

```ts
import { Effect, Schedule } from "effect"

type MetricsBatch = {
  readonly counters: ReadonlyMap<string, number>
  readonly gauges: ReadonlyMap<string, number>
}

type MetricsFlushError = {
  readonly _tag: "MetricsFlushError"
  readonly message: string
}

declare const drainMetrics: Effect.Effect<MetricsBatch>
declare const sendMetrics: (
  batch: MetricsBatch
) => Effect.Effect<void, MetricsFlushError>

const flushMetrics = drainMetrics.pipe(
  Effect.flatMap(sendMetrics)
)

const flushEveryTenSecondsWithJitter = Schedule.spaced("10 seconds").pipe(
  Schedule.jittered
)

export const metricsFlushingLoop = flushMetrics.pipe(
  Effect.repeat(flushEveryTenSecondsWithJitter)
)
```

`metricsFlushingLoop` drains the local metrics buffer immediately and sends the
batch to the collector. After a successful send, it waits for a jittered delay
around ten seconds before flushing again.

Across many service instances, each loop samples a new adjusted delay on every
recurrence. Instances that start together can still flush at the same time once,
but later flushes are less likely to remain synchronized.

## Variants

Use a longer cadence for low-volume services or expensive collectors:

```ts
const lowVolumeFlush = Schedule.spaced("1 minute").pipe(
  Schedule.jittered
)
```

Use `Schedule.tapOutput` to observe the repeat count produced by
`Schedule.spaced`:

```ts
const observedFlush = Schedule.spaced("10 seconds").pipe(
  Schedule.jittered,
  Schedule.tapOutput((flushCount) =>
    Effect.logDebug(`completed metrics flush ${flushCount + 1}`)
  )
)
```

If a failed export should be retried briefly, keep that retry policy separate
from the periodic repeat policy:

```ts
const retryFlushFailure = Schedule.spaced("500 millis").pipe(
  Schedule.jittered,
  Schedule.take(3)
)

const resilientFlushMetrics = flushMetrics.pipe(
  Effect.retry(retryFlushFailure)
)

export const resilientMetricsFlushingLoop = resilientFlushMetrics.pipe(
  Effect.repeat(flushEveryTenSecondsWithJitter)
)
```

This makes the two timing decisions explicit: short jittered retries for a
failed flush attempt, and longer jittered repetition for normal successful
metrics flushing.

## Notes and caveats

`Schedule.jittered` uses fixed bounds in Effect. It adjusts each recurrence
delay between 80% and 120% of the original delay.

`Effect.repeat` feeds successful values into the schedule. `Effect.retry` feeds
failures into the schedule. For metrics flushing, jitter usually belongs on the
repeat schedule because the goal is to spread normal successful export traffic.

`Schedule.spaced` measures the delay after the previous flush completes. If a
flush takes two seconds and the jittered delay is eleven seconds, the next flush
starts about thirteen seconds after the previous flush started.
