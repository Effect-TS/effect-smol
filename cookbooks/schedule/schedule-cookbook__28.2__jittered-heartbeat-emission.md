---
book: Effect `Schedule` Cookbook
section_number: "28.2"
section_title: "Jittered heartbeat emission"
part_title: "Part VI — Jitter Recipes"
chapter_title: "28. Jitter for Repeat and Polling"
status: "draft"
code_included: true
---

# 28.2 Jittered heartbeat emission

Use jittered repetition for heartbeat loops that need a stable cadence, not
exact alignment across every instance.

## Problem

Every running instance should emit a heartbeat regularly to the same
coordinator, registry, or monitoring endpoint. The heartbeat still runs as a
successful repeat: send one heartbeat, then decide whether and when to send the
next one.

Jitter belongs in the schedule, so the emission effect stays focused on one
heartbeat and the recurrence policy stays visible.

## When to use it

Use this when many independent processes, workers, browser sessions, or fibers
emit the same lightweight signal on a shared cadence.

It is a good fit for service liveness pings, worker lease refreshes, instance
presence updates, and other successful periodic writes where exact wall-clock
alignment is not required.

Use it when the base cadence still matters operationally, but each instance can
drift slightly around that cadence to avoid synchronized bursts.

## When not to use it

Do not use jitter to make an overloaded heartbeat endpoint safe by itself. It
smooths recurrence timing, but it does not replace admission control, batching,
backpressure, quotas, or server-side load shedding.

Do not use this when heartbeats must happen on exact wall-clock boundaries. A
jittered schedule intentionally moves each delay away from the original value.

Do not use `Effect.repeat` to recover from failed heartbeat writes. If a failed
heartbeat should be retried before the periodic loop continues, handle that
retry inside the heartbeat effect, then repeat the recovered effect.

## Schedule shape

Start with the intended gap between successful heartbeats, then apply jitter:

`Schedule.spaced("30 seconds")` supplies the base delay between successful
heartbeats. `Schedule.jittered` randomly adjusts each recurrence delay between
80% and 120% of that delay, so a thirty-second heartbeat waits between
twenty-four and thirty-six seconds before the next emission.

The first heartbeat is not delayed by the schedule. `Effect.repeat` runs the
effect once, and only after a success does the schedule decide the next delay.

## Code

```ts
import { Effect, Schedule } from "effect"

type Heartbeat = {
  readonly instanceId: string
  readonly generation: number
}

let generation = 0

const nextHeartbeat = Effect.sync((): Heartbeat => {
  generation += 1
  return {
    instanceId: "worker-a",
    generation
  }
})

const emitHeartbeat = (heartbeat: Heartbeat) =>
  Effect.sync(() => {
    console.log(
      `heartbeat ${heartbeat.instanceId} generation ${heartbeat.generation}`
    )
  })

const sendHeartbeat = nextHeartbeat.pipe(
  Effect.flatMap(emitHeartbeat)
)

const demoHeartbeatSchedule = Schedule.spaced("20 millis").pipe(
  Schedule.jittered,
  Schedule.take(3)
)

const program = sendHeartbeat.pipe(
  Effect.repeat(demoHeartbeatSchedule),
  Effect.tap(() => Effect.sync(() => console.log("heartbeat loop stopped")))
)

Effect.runPromise(program)
```

The sample emits the initial heartbeat plus three scheduled recurrences. For a
real heartbeat loop, use the production interval and interrupt the fiber when
the process shuts down.

## Variants

For a short-lived process or test fixture, keep a recurrence limit with
`Schedule.take`. The initial execution is not counted as one of the scheduled
recurrences.

For a lower-cost liveness signal, shorten the base interval. A ten-second base
interval becomes a jittered delay between eight and twelve seconds.

For an expensive coordinator write or a very large fleet, lengthen the base
interval first. Jitter spreads traffic around the chosen interval; it does not
reduce the average number of heartbeats your system emits.

## Notes and caveats

`Schedule.jittered` has fixed bounds in Effect. It adjusts each recurrence delay
between 80% and 120% of the original delay.

`Effect.repeat` feeds successful heartbeat results into the schedule. A failure
from `emitHeartbeat` stops the repeat unless the heartbeat effect handles that
failure itself.

Use `Schedule.spaced` for heartbeats that should wait after the previous
heartbeat completes. Use a different schedule only when the operational contract
really is different from "wait this long after a successful emission."
