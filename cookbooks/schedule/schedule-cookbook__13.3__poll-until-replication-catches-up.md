---
book: "Effect `Schedule` Cookbook"
section_number: "13.3"
section_title: "Poll until replication catches up"
part_title: "Part IV — Polling Recipes"
chapter_title: "13. Poll for Resource State"
status: "draft"
code_included: true
---

# 13.3 Poll until replication catches up

Replication-aware polling should ask a narrow question: has the lagging view
observed at least the version the caller already knows exists?

## Problem

After writing to a primary system, the caller may receive a version, watermark,
or cursor. A follower, read model, replica, or search index can lag behind that
position for a short time.

Poll the replicated view until its observed position reaches the required
position. Treat "behind" as a successful observation, not as a failed read.

## When to use it

Use this when the caller has a concrete target position and the downstream view
can report a comparable observed position.

This fits event stream versions, projection watermarks, indexing sequence
numbers, and read models that expose the cursor they have processed.

## When not to use it

Do not use this when the follower cannot report a comparable position. Polling
for "maybe visible now" is a different shape.

Do not hide failed replica reads. Timeouts, authorization errors, decode
failures, and unavailable read models should remain effect failures unless your
domain explicitly recovers them.

Do not compare opaque cursor strings lexicographically unless the producer
defines that order.

## Schedule shape

Use `Schedule.spaced` for the read interval, `Schedule.passthrough` to keep the
latest observation, and `Schedule.while` to continue only while the observed
version is below the required version.

If you add a bound, handle the final behind observation as "did not catch up in
time" instead of returning stale data.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

interface ReplicaObservation {
  readonly replica: "read-model"
  readonly observedVersion: number
}

type WaitForReplicaError = {
  readonly _tag: "ReplicaDidNotCatchUp"
  readonly requiredVersion: number
  readonly observedVersion: number
}

const scriptedObservations: ReadonlyArray<ReplicaObservation> = [
  { replica: "read-model", observedVersion: 41 },
  { replica: "read-model", observedVersion: 43 },
  { replica: "read-model", observedVersion: 45 }
]

let readIndex = 0

const hasCaughtUp = (
  observation: ReplicaObservation,
  requiredVersion: number
): boolean => observation.observedVersion >= requiredVersion

const readReplicaWatermark = (
  streamName: string
): Effect.Effect<ReplicaObservation> =>
  Effect.sync(() => {
    const observation = scriptedObservations[
      Math.min(readIndex, scriptedObservations.length - 1)
    ]!
    readIndex += 1
    return observation
  }).pipe(
    Effect.tap((observation) =>
      Console.log(
        `[${streamName}] ${observation.replica} at ${observation.observedVersion}`
      )
    )
  )

const pollUntilVersion = (requiredVersion: number) =>
  Schedule.spaced("10 millis").pipe(
    Schedule.satisfiesInputType<ReplicaObservation>(),
    Schedule.passthrough,
    Schedule.while(({ input }) => !hasCaughtUp(input, requiredVersion)),
    Schedule.take(10)
  )

const requireCaughtUp = (
  requiredVersion: number,
  observation: ReplicaObservation
): Effect.Effect<ReplicaObservation, WaitForReplicaError> =>
  hasCaughtUp(observation, requiredVersion)
    ? Effect.succeed(observation)
    : Effect.fail({
      _tag: "ReplicaDidNotCatchUp",
      requiredVersion,
      observedVersion: observation.observedVersion
    })

const requiredVersion = 45

const program = readReplicaWatermark("orders").pipe(
  Effect.repeat(pollUntilVersion(requiredVersion)),
  Effect.flatMap((observation) => requireCaughtUp(requiredVersion, observation)),
  Effect.tap((observation) =>
    Console.log(`caught up at ${observation.observedVersion}`)
  )
)

Effect.runPromise(program).then((observation) => {
  console.log("result:", observation)
})
```

The first read runs immediately. Behind observations wait before the next read.
Once the replica reports the required version or later, the schedule stops.

## Variants

Add `Schedule.jittered` when many clients may wait on the same replica and
aligned read bursts would add load.

For opaque cursors, keep the same schedule shape but replace the numeric
comparison with a domain comparison that knows whether the observed cursor has
reached the required cursor.

Use a target position from the write path or another authoritative source. A
guessed target can make polling report success for the wrong point in history.

## Notes and caveats

`Schedule.while` sees successful replica observations only. It does not inspect
read failures.

`Effect.repeat` repeats successes. Retry transient failed reads separately when
that is appropriate.

The first read is not delayed by the schedule.
