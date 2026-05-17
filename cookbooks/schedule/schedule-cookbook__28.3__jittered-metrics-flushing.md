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

Use jittered repetition when many service instances flush telemetry to the same
collector on a shared cadence.

## Problem

Each instance should flush buffered counters, gauges, histograms, or spans about
every ten seconds. The first flush should happen immediately. Later flushes
should drift enough that a deploy does not create one synchronized collector
burst.

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
  readonly counters: ReadonlyArray<readonly [string, number]>
  readonly gauges: ReadonlyArray<readonly [string, number]>
}

let flush = 0

const drainMetrics = Effect.sync((): MetricsBatch => {
  flush += 1
  return {
    counters: [["requests_total", flush * 10]],
    gauges: [["queue_depth", 4 - flush]]
  }
})

const sendMetrics = (batch: MetricsBatch) =>
  Effect.sync(() => {
    console.log(
      `flushed counters=${batch.counters.length} gauges=${batch.gauges.length}`
    )
  })

const flushMetrics = drainMetrics.pipe(
  Effect.flatMap(sendMetrics)
)

const demoFlushSchedule = Schedule.spaced("20 millis").pipe(
  Schedule.jittered,
  Schedule.take(3)
)

const program = flushMetrics.pipe(
  Effect.repeat(demoFlushSchedule),
  Effect.tap(() => Effect.sync(() => console.log("metrics loop stopped")))
)

Effect.runPromise(program)
```

The sample uses a short interval and a recurrence limit so it visibly finishes.
Replace the demo interval with the production flush cadence and interrupt the
background fiber during shutdown.

## Variants

Use a longer cadence for low-volume services or expensive collectors. Use
`Schedule.tapOutput` to observe the repeat count produced by `Schedule.spaced`.

If a failed export should be retried briefly, keep that retry policy separate
from the periodic repeat policy: short jittered retries for a failed flush, and
longer jittered repetition for normal successful flushing.

## Notes and caveats

`Schedule.jittered` uses fixed bounds in Effect. It adjusts each recurrence
delay between 80% and 120% of the original delay.

`Effect.repeat` feeds successful values into the schedule. `Effect.retry` feeds
failures into the schedule. For metrics flushing, jitter usually belongs on the
repeat schedule because the goal is to spread normal successful export traffic.

`Schedule.spaced` measures the delay after the previous flush completes. If a
flush takes two seconds and the jittered delay is eleven seconds, the next flush
starts about thirteen seconds after the previous flush started.
