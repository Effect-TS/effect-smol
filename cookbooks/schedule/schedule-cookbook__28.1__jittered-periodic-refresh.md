---
book: Effect `Schedule` Cookbook
section_number: "28.1"
section_title: "Jittered periodic refresh"
part_title: "Part VI — Jitter Recipes"
chapter_title: "28. Jitter for Repeat and Polling"
status: "draft"
code_included: true
---

# 28.1 Jittered periodic refresh

Use jittered repetition when a refresh loop should run on a recognizable cadence
without making every instance hit the same dependency at the same moment.

## Problem

Each service instance refreshes cached configuration in the background. The
first refresh should run immediately. Later refreshes should stay near the
chosen interval while drifting enough to avoid synchronized requests across the
fleet.

## When to use it

Use this when many independent processes, fibers, clients, or browser sessions
repeat the same successful operation on a regular cadence.

It fits refresh loops for cached configuration, feature flags, service
discovery data, quota snapshots, and other state that should stay reasonably
fresh but does not need to update on an exact wall-clock boundary.

Use it when the base interval is still the operational contract. A one-minute
refresh remains a one-minute refresh in spirit, but individual recurrences are
spread around that value.

## When not to use it

Do not use jitter when the refresh must happen at exact wall-clock boundaries,
such as a report that must run at the top of every hour.

Do not use jitter as the only protection for an overloaded dependency. Jitter
reduces synchronization; it does not enforce quotas, backpressure, admission
control, or a maximum number of concurrent refreshes.

Do not use this schedule to recover from refresh failures. With
`Effect.repeat`, the schedule sees successful refresh results. If loading
configuration can fail transiently, give the refresh effect its own retry
policy before repeating it.

## Schedule shape

Start with the intended refresh cadence and apply jitter to that cadence:

`Schedule.spaced("1 minute")` waits one minute after each successful refresh
before starting the next one. `Schedule.jittered` randomly adjusts each
recurrence delay between 80% and 120% of the original delay, so a one-minute
interval becomes a delay between 48 and 72 seconds.

The first refresh is not delayed by the schedule. It runs when the effect
starts. The schedule controls only the recurrences after successful refreshes.

## Code

```ts
import { Effect, Schedule } from "effect"

type Config = {
  readonly version: string
  readonly cacheTtlMillis: number
  readonly featureFlags: ReadonlyArray<string>
}

let version = 0

const loadConfig = Effect.sync((): Config => {
  version += 1
  console.log(`loaded config version ${version}`)
  return {
    version: `v${version}`,
    cacheTtlMillis: 60_000,
    featureFlags: ["search", "checkout"]
  }
})

const replaceCachedConfig = (config: Config) =>
  Effect.sync(() => {
    console.log(`cached ${config.version}`)
  })

const refreshCachedConfig = loadConfig.pipe(
  Effect.flatMap(replaceCachedConfig)
)

const demoRefreshSchedule = Schedule.spaced("20 millis").pipe(
  Schedule.jittered,
  Schedule.take(3)
)

const program = refreshCachedConfig.pipe(
  Effect.repeat(demoRefreshSchedule),
  Effect.tap(() => Effect.sync(() => console.log("refresh loop stopped")))
)

Effect.runPromise(program)
```

The sample uses a short interval and `Schedule.take(3)` so it terminates
quickly. For a real background fiber, use the operational interval, such as one
minute, and tie interruption to the process lifecycle.

## Variants

Use a longer interval when stale configuration is acceptable and the shared
configuration service is expensive. Use `Schedule.tapOutput` when you want
telemetry for the repeat count.

If a refresh can fail transiently, retry the single refresh operation with its
own short policy, then repeat the recovered operation on the longer refresh
cadence. That keeps failure recovery separate from normal periodic repetition.

## Notes and caveats

`Schedule.jittered` does not expose configurable bounds. In Effect, it adjusts
each recurrence delay between 80% and 120% of the original delay.

`Effect.retry` feeds failures into a schedule. `Effect.repeat` feeds successful
values into a schedule. For periodic refresh, jitter usually belongs on the
repeat schedule because the goal is to spread normal successful polling or
refresh traffic.

`Schedule.spaced` measures the delay after the previous refresh completes. If
the refresh itself takes several seconds, the next refresh starts after the
work completes and the jittered delay has elapsed.
