---
book: Effect `Schedule` Cookbook
section_number: "20.4"
section_title: "Poll until replication catches up"
part_title: "Part IV — Polling Recipes"
chapter_title: "20. Poll Until a Desired Output Appears"
status: "draft"
code_included: true
---

# 20.4 Poll until replication catches up

Replication-aware polling asks a lagging view one narrow question: has it
observed at least the version the caller already knows exists? The schedule
keeps the repeated reads focused on that comparable position.

## Problem

You have written data to a primary system and received a required version,
watermark, or cursor. A follower, read model, replica, or search index may lag
behind that point for a short time.

The polling loop should:

- read the current replicated position
- continue only while the observed position is behind the required position
- return the first observation that has caught up
- keep failed reads separate from ordinary replication lag

## When to use it

Use this when the caller has a concrete target position and the downstream view
can report its latest observed position.

This is a good fit after commands that return a stream version, writes that
publish a projection watermark, indexing pipelines that expose a sequence
number, or read models that can say which event cursor they have processed.

## When not to use it

Do not use this when the follower cannot report a comparable position. Polling
for "maybe the data is visible now" without a required version is a different
recipe.

Do not use this to hide failed replica reads. A timeout, authorization error,
decode failure, or unavailable read model should remain an effect failure unless
your domain has explicitly translated it into a successful observation.

Do not use this for generic cache-miss polling. A cache miss is not the same as
a replica proving it has or has not reached a known committed position.

## Schedule shape

Poll again only while the latest successful observation is still behind the
required version:

```ts
const pollUntilVersion = (requiredVersion: number) =>
  Schedule.spaced("250 millis").pipe(
    Schedule.satisfiesInputType<ReplicaObservation>(),
    Schedule.passthrough,
    Schedule.while(({ input }) => input.observedVersion < requiredVersion)
  )
```

`Schedule.spaced("250 millis")` supplies the delay between later reads.
`Schedule.satisfiesInputType<ReplicaObservation>()` constrains the timing
schedule before `Schedule.while` reads `metadata.input`.
`Schedule.passthrough` keeps the latest `ReplicaObservation` as the schedule
output, so `Effect.repeat` returns the final observed position.

The schedule stops when the observation has reached or passed the required
version.

## Code

```ts
import { Effect, Schedule } from "effect"

interface ReplicaObservation {
  readonly replica: "follower" | "read-model" | "search-index"
  readonly observedVersion: number
}

type ReplicaReadError = {
  readonly _tag: "ReplicaReadError"
  readonly message: string
}

declare const readReplicaWatermark: (
  streamName: string
) => Effect.Effect<ReplicaObservation, ReplicaReadError>

const hasCaughtUp = (
  observation: ReplicaObservation,
  requiredVersion: number
): boolean => observation.observedVersion >= requiredVersion

const pollUntilVersion = (requiredVersion: number) =>
  Schedule.spaced("250 millis").pipe(
    Schedule.satisfiesInputType<ReplicaObservation>(),
    Schedule.passthrough,
    Schedule.while(({ input }) => !hasCaughtUp(input, requiredVersion))
  )

const waitForReplicaVersion = (
  streamName: string,
  requiredVersion: number
): Effect.Effect<ReplicaObservation, ReplicaReadError> =>
  readReplicaWatermark(streamName).pipe(
    Effect.repeat(pollUntilVersion(requiredVersion)),
    Effect.flatMap((observation) =>
      hasCaughtUp(observation, requiredVersion)
        ? Effect.succeed(observation)
        : Effect.never
    )
  )
```

The first replica read runs immediately. If the replica reports a lower version,
the schedule waits 250 milliseconds before reading again. If the first or any
later observation is already at or beyond the required version, the schedule
stops and the caught-up observation is returned.

The `Effect.never` branch is unreachable for the unbounded schedule because
`pollUntilVersion` stops only after the observation has caught up. It becomes
relevant when you add a limit, because a bounded schedule can stop with the last
behind observation.

## Variants

Add a recurrence cap when the caller needs a bounded wait:

```ts
type WaitForReplicaError =
  | ReplicaReadError
  | {
    readonly _tag: "ReplicaDidNotCatchUp"
    readonly requiredVersion: number
    readonly observedVersion: number
  }

const pollUntilVersionAtMostFortyTimes = (requiredVersion: number) =>
  pollUntilVersion(requiredVersion).pipe(
    Schedule.bothLeft(
      Schedule.recurs(40).pipe(
        Schedule.satisfiesInputType<ReplicaObservation>()
      )
    )
  )

const waitForReplicaVersionAtMostFortyTimes = (
  streamName: string,
  requiredVersion: number
): Effect.Effect<ReplicaObservation, WaitForReplicaError> =>
  readReplicaWatermark(streamName).pipe(
    Effect.repeat(pollUntilVersionAtMostFortyTimes(requiredVersion)),
    Effect.flatMap((observation) =>
      hasCaughtUp(observation, requiredVersion)
        ? Effect.succeed(observation)
        : Effect.fail({
          _tag: "ReplicaDidNotCatchUp",
          requiredVersion,
          observedVersion: observation.observedVersion
        })
    )
  )
```

With a cap, the final observation may still be behind because the recurrence
limit stopped the schedule before replication caught up. Interpret that case
explicitly instead of returning stale data as if it were current.

When many clients may wait on the same replica, add jitter to avoid aligned
read bursts:

```ts
const jitteredPollUntilVersion = (requiredVersion: number) =>
  pollUntilVersion(requiredVersion).pipe(
    Schedule.jittered
  )
```

`Schedule.jittered` randomly adjusts each delay to between 80% and 120% of the
original delay.

If the follower reports an opaque cursor instead of a number, keep the same
shape but replace the numeric comparison with a domain comparison that knows
whether an observed cursor has reached the required cursor. Do not compare
opaque cursor strings lexicographically unless the producer defines that order.

## Notes and caveats

`Schedule.while` sees successful replica observations only. It does not inspect
failures from `readReplicaWatermark`.

`Effect.repeat` repeats after success. A failed replica read stops the repeat
unless the read effect handles that failure before the repeat.

The first replica read is not delayed by the schedule. Delays apply only before
later recurrences.

Use a target that came from the write path or another authoritative source. If
the target version is guessed, polling can report "caught up" to the wrong
point.
