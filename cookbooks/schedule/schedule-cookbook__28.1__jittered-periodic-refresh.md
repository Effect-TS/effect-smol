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

Periodic refresh loops keep local state current without requiring exact
wall-clock timing. This recipe adds jitter to a regular repeat cadence while
leaving the refresh interval recognizable.

## Problem

Each service instance should refresh cached configuration every minute in a
background fiber. The first refresh should run when the loop starts, while later
refreshes should drift enough that the configuration service does not receive a
synchronized request from every instance at the same second.

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

```ts
Schedule.spaced("1 minute").pipe(
  Schedule.jittered
)
```

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
  readonly featureFlags: ReadonlySet<string>
}

type ConfigRefreshError = {
  readonly _tag: "ConfigRefreshError"
  readonly message: string
}

declare const loadConfig: Effect.Effect<Config, ConfigRefreshError>
declare const replaceCachedConfig: (config: Config) => Effect.Effect<void>

const refreshCachedConfig = loadConfig.pipe(
  Effect.flatMap(replaceCachedConfig)
)

const refreshEveryMinuteWithJitter = Schedule.spaced("1 minute").pipe(
  Schedule.jittered
)

export const configRefreshLoop = refreshCachedConfig.pipe(
  Effect.repeat(refreshEveryMinuteWithJitter)
)
```

`configRefreshLoop` loads configuration immediately and writes it into the local
cache. After a successful refresh, it waits for a jittered delay around one
minute before refreshing again.

Across a fleet, each instance chooses its own adjusted delay on every
recurrence. Even if many instances start together after a deploy, later refresh
requests are less likely to stay aligned.

## Variants

Use a longer interval when stale configuration is acceptable and the
configuration service is shared by many callers:

```ts
const conservativeRefresh = Schedule.spaced("5 minutes").pipe(
  Schedule.jittered
)
```

Use `Schedule.tapOutput` when you want to observe the repeat count produced by
`Schedule.spaced`:

```ts
const observedRefresh = Schedule.spaced("1 minute").pipe(
  Schedule.jittered,
  Schedule.tapOutput((refreshCount) =>
    Effect.logDebug(`completed config refresh ${refreshCount + 1}`)
  )
)
```

If refresh failures should be retried briefly before the loop stops, retry the
single refresh operation and then repeat the recovered operation:

```ts
const retryTransientRefreshFailure = Schedule.spaced("2 seconds").pipe(
  Schedule.jittered,
  Schedule.take(3)
)

const resilientRefreshCachedConfig = refreshCachedConfig.pipe(
  Effect.retry(retryTransientRefreshFailure)
)

export const resilientConfigRefreshLoop = resilientRefreshCachedConfig.pipe(
  Effect.repeat(refreshEveryMinuteWithJitter)
)
```

This keeps two different policies visible: a short jittered retry policy for a
failed refresh attempt, and a longer jittered repeat policy for the normal
periodic refresh loop.

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
