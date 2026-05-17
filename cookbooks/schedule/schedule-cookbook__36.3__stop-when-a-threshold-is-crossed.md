---
book: Effect `Schedule` Cookbook
section_number: "36.3"
section_title: "Stop when a threshold is crossed"
part_title: "Part VIII — Stop Conditions and Termination Policies"
chapter_title: "36. Stop on Output Conditions"
status: "draft"
code_included: true
---

# 36.3 Stop when a threshold is crossed

Some polling loops are looking for a number to move past a boundary: queue
depth below a drain target, replication lag under a tolerance, progress above a
minimum percentage, or available capacity above a release threshold. Model that
as an output condition. The poll produces a successful observation, the schedule
keeps that observation as its output, and `Schedule.while` decides whether one
more poll should run.

## Problem

A rollout monitor should return the sample that first reaches the required
percentage, or a backlog monitor should return the sample that first falls under
the drain target.

The first poll should run immediately. Later polls should be spaced. The final
value should be the observation that crossed the threshold, not an internal
counter from the timing schedule.

## When to use it

Use this when the successful value from each poll contains a comparable number
and crossing the threshold means the workflow can continue.

Good examples include waiting for a materialized view to reach a version,
waiting for a deployment rollout percentage to reach a minimum, or waiting for a
backlog to drain below an operational limit.

## When not to use it

Do not use this to retry failed metric reads. `Effect.repeat` only consults the
schedule after success; a failed poll remains a failure unless you handle it
before repeating.

Do not use a threshold predicate when the domain has terminal states. For
example, a job status of `"failed"` should usually be represented explicitly
rather than encoded as a progress value that never reaches 100.

Do not compare values unless the domain defines the ordering. Opaque cursors,
timestamps from different clocks, and string ids are not safe threshold values
unless the producer specifies how to compare them.

## Schedule shape

Preserve the successful poll value as the schedule output, combine it with a
cadence, and continue only while the output is still below the threshold.
`Schedule.while` reads the latest output and allows another recurrence only
while the threshold has not been crossed.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

interface ProgressSample {
  readonly jobId: string
  readonly percentComplete: number
}

type ProgressReadError = {
  readonly _tag: "ProgressReadError"
  readonly jobId: string
}

const samples: ReadonlyArray<ProgressSample> = [
  { jobId: "export-1", percentComplete: 35 },
  { jobId: "export-1", percentComplete: 70 },
  { jobId: "export-1", percentComplete: 100 }
]

let reads = 0

const readProgress = (
  jobId: string
): Effect.Effect<ProgressSample, ProgressReadError> =>
  Effect.gen(function*() {
    const index = yield* Effect.sync(() => {
      const current = reads
      reads += 1
      return current
    })
    const sample = samples[index] ?? samples[samples.length - 1]!

    yield* Console.log(`${jobId} progress: ${sample.percentComplete}%`)
    return sample
  })

const hasReached = (sample: ProgressSample, threshold: number): boolean =>
  sample.percentComplete >= threshold

const pollUntilProgressAtLeast = (threshold: number) =>
  Schedule.identity<ProgressSample>().pipe(
    Schedule.bothLeft(Schedule.spaced("100 millis")),
    Schedule.while(({ output }) => !hasReached(output, threshold))
  )

const waitForProgress = (
  jobId: string,
  threshold: number
): Effect.Effect<ProgressSample, ProgressReadError> =>
  readProgress(jobId).pipe(
    Effect.repeat(pollUntilProgressAtLeast(threshold))
  )

const program = waitForProgress("export-1", 90).pipe(
  Effect.flatMap((sample) =>
    Console.log(`threshold crossed at ${sample.percentComplete}%`)
  )
)

Effect.runPromise(program)
```

`readProgress` runs once immediately. If the first successful sample is already
at or above the threshold, the schedule stops and that sample is returned. If
the sample is below the threshold, the schedule waits before the next poll. The
runnable example uses a short delay; a production poller can use a longer
cadence.

The repeat returns the final schedule output. Because the schedule uses
`Schedule.identity<ProgressSample>()`, that output is the `ProgressSample` that
made the `Schedule.while` predicate return `false`.

## Variants

Add a maximum number of recurrences when the caller needs a bounded wait. With a
cap in place, the repeat may stop because the recurrence limit was reached
rather than because the progress threshold was crossed. Check the final sample
and translate that case into a domain error.

For a draining threshold, invert the predicate: continue while the backlog is
still at or above the limit, and stop on the first successful sample below the
limit.

## Notes and caveats

`Schedule.while` receives schedule metadata after the timing schedule has been
stepped. In this recipe the important field is `output`, because the schedule
preserves the latest successful poll value.

`Effect.repeat` feeds successful values into the schedule. Failures from
`readProgress` do not reach the threshold predicate.

The first poll is not delayed by the schedule. Spacing applies only before later
recurrences.

Without a cap, timeout, or external interruption, a threshold that is never
crossed can poll forever. Add a recurrence limit or time budget when the caller
needs a definite answer.
