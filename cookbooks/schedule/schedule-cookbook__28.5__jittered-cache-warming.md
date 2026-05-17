---
book: Effect `Schedule` Cookbook
section_number: "28.5"
section_title: "Jittered cache warming"
part_title: "Part VI — Jitter Recipes"
chapter_title: "28. Jitter for Repeat and Polling"
status: "draft"
code_included: true
---

# 28.5 Jittered cache warming

Cache warming is successful background work that repeats on a cadence; it is
not a retry simply because it runs again. This recipe adds jitter to the repeat
schedule while keeping the warming interval recognizable.

## Problem

Every instance should run its first warming pass when the process starts and
then refresh important cache entries roughly every thirty seconds. In a fleet,
later passes should drift enough that instances do not all read the same backing
services at once.

## When to use it

Use this when many service instances, workers, or pods run the same cache
warming loop against the same backing store, database, object store, or
downstream API.

It fits background warming for product catalogs, feature snapshots, permission
lookups, pricing tables, routing data, and other data that should remain hot
but does not need to refresh on an exact wall-clock boundary.

Use it when "roughly every thirty seconds" is acceptable and a steadier load
profile matters more than every instance refreshing at the same moment.

## When not to use it

Do not use jitter when cache entries must be refreshed at exact wall-clock
boundaries, such as a report cache rebuilt at the top of every hour.

Do not use jitter as the only overload control for expensive warming work.
Limit concurrency inside the warming effect, use downstream rate limits, and
bound the number of keys each pass warms.

Do not use the repeat schedule to classify warming failures. With
`Effect.repeat`, the schedule sees successful warming results. If a single
warming pass can fail transiently, retry that pass separately before repeating
it on the long-running cadence.

## Schedule shape

Start with the intended warming interval and add jitter:

```ts
Schedule.spaced("30 seconds").pipe(
  Schedule.jittered
)
```

`Schedule.spaced("30 seconds")` waits thirty seconds after a successful warming
pass completes. `Schedule.jittered` randomly adjusts each recurrence delay
between 80% and 120% of the original delay, so a thirty-second interval becomes
a delay between 24 and 36 seconds.

The first warming pass is not delayed by the schedule. It runs when the effect
starts. The schedule controls only the recurrences after successful warming
passes.

## Code

```ts
import { Effect, Schedule } from "effect"

type CacheKey = string

type CacheWarmError = {
  readonly _tag: "CacheWarmError"
  readonly key: CacheKey
  readonly message: string
}

const hotKeys: ReadonlyArray<CacheKey> = [
  "catalog:featured",
  "pricing:default",
  "permissions:public"
]

declare const warmCacheEntry: (
  key: CacheKey
) => Effect.Effect<void, CacheWarmError>

const warmCacheOnce = Effect.forEach(
  hotKeys,
  warmCacheEntry,
  { concurrency: 4 }
).pipe(
  Effect.asVoid
)

const warmEveryThirtySecondsWithJitter = Schedule.spaced("30 seconds").pipe(
  Schedule.jittered
)

export const cacheWarmingLoop = warmCacheOnce.pipe(
  Effect.repeat(warmEveryThirtySecondsWithJitter)
)
```

`cacheWarmingLoop` warms the selected keys immediately. After a successful pass,
it waits for a jittered delay around thirty seconds before warming them again.

Across a fleet, each instance chooses its own adjusted delay on every
recurrence. Even if many instances start together after a deployment, their
later warming passes are less likely to remain aligned.

## Variants

Retry transient failures inside one warming pass, then repeat the recovered
warming pass on the longer jittered cadence:

```ts
const retryWarmingFailure = Schedule.spaced("1 second").pipe(
  Schedule.jittered,
  Schedule.take(3)
)

const resilientWarmCacheOnce = warmCacheOnce.pipe(
  Effect.retry(retryWarmingFailure)
)

export const resilientCacheWarmingLoop = resilientWarmCacheOnce.pipe(
  Effect.repeat(warmEveryThirtySecondsWithJitter)
)
```

This keeps two policies separate: a short retry policy for a failed warming
attempt, and a long repeat policy for normal cache warming.

Use a longer base interval for expensive data or large fleets:

```ts
const conservativeCacheWarming = Schedule.spaced("5 minutes").pipe(
  Schedule.jittered
)
```

The jitter range follows the base delay. A five-minute interval becomes a delay
between four and six minutes.

## Notes and caveats

`Schedule.jittered` does not expose configurable bounds. In Effect, it adjusts
each recurrence delay between 80% and 120% of the original delay.

`Effect.retry` feeds failures into a schedule. `Effect.repeat` feeds successful
values into a schedule. Cache warming usually uses jitter on the repeat
schedule because the goal is to spread normal successful background traffic.

`Schedule.spaced` measures the delay after the previous warming pass completes.
If warming a large key set takes ten seconds, the next pass starts after that
work completes and the jittered delay has elapsed.
