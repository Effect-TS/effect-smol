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

You need to poll a metric until the latest successful observation crosses a
threshold.

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

Start with the polling cadence, preserve the successful poll value as the
schedule output, and continue only while the output is still below the
threshold:

```ts
const pollUntilThreshold = (threshold: number) =>
  Schedule.spaced("500 millis").pipe(
    Schedule.satisfiesInputType<ProgressSample>(),
    Schedule.passthrough,
    Schedule.while(({ output }) => output.percentComplete < threshold)
  )
```

`Schedule.spaced("500 millis")` supplies the delay before later polls.
`Schedule.satisfiesInputType<ProgressSample>()` constrains the timing schedule
so it can be stepped with successful `ProgressSample` values.
`Schedule.passthrough` changes the schedule output to the latest successful
poll result. `Schedule.while` then reads `metadata.output` and allows another
recurrence only while the threshold has not been crossed.

## Code

```ts
import { Effect, Schedule } from "effect"

interface ProgressSample {
  readonly jobId: string
  readonly percentComplete: number
}

type ProgressReadError = {
  readonly _tag: "ProgressReadError"
  readonly jobId: string
}

declare const readProgress: (
  jobId: string
) => Effect.Effect<ProgressSample, ProgressReadError>

const hasReached = (sample: ProgressSample, threshold: number): boolean =>
  sample.percentComplete >= threshold

const pollUntilProgressAtLeast = (threshold: number) =>
  Schedule.spaced("500 millis").pipe(
    Schedule.satisfiesInputType<ProgressSample>(),
    Schedule.passthrough,
    Schedule.while(({ output }) => !hasReached(output, threshold))
  )

const waitForProgress = (
  jobId: string,
  threshold: number
): Effect.Effect<ProgressSample, ProgressReadError> =>
  readProgress(jobId).pipe(
    Effect.repeat(pollUntilProgressAtLeast(threshold))
  )
```

`readProgress` runs once immediately. If the first successful sample is already
at or above the threshold, the schedule stops and that sample is returned. If
the sample is below the threshold, the schedule waits 500 milliseconds before
the next poll.

The repeat returns the final schedule output. Because the schedule uses
`Schedule.passthrough`, that output is the `ProgressSample` that made the
`Schedule.while` predicate return `false`.

## Variants

Add a maximum number of recurrences when the caller needs a bounded wait:

```ts
type WaitForProgressError =
  | ProgressReadError
  | {
    readonly _tag: "ProgressThresholdNotReached"
    readonly jobId: string
    readonly threshold: number
    readonly lastPercentComplete: number
  }

const pollUntilProgressAtLeastAtMostTwentyTimes = (threshold: number) =>
  pollUntilProgressAtLeast(threshold).pipe(
    Schedule.bothLeft(
      Schedule.recurs(20).pipe(
        Schedule.satisfiesInputType<ProgressSample>()
      )
    )
  )

const waitForProgressAtMostTwentyTimes = (
  jobId: string,
  threshold: number
): Effect.Effect<ProgressSample, WaitForProgressError> =>
  readProgress(jobId).pipe(
    Effect.repeat(pollUntilProgressAtLeastAtMostTwentyTimes(threshold)),
    Effect.flatMap((sample) =>
      hasReached(sample, threshold)
        ? Effect.succeed(sample)
        : Effect.fail({
          _tag: "ProgressThresholdNotReached",
          jobId,
          threshold,
          lastPercentComplete: sample.percentComplete
        })
    )
  )
```

With the cap in place, the repeat may stop because the recurrence limit was
reached rather than because the progress threshold was crossed. Check the final
sample and translate that case into a domain error.

For a draining threshold, invert the predicate:

```ts
interface BacklogSample {
  readonly queueName: string
  readonly pendingMessages: number
}

const pollUntilBacklogBelow = (limit: number) =>
  Schedule.spaced("1 second").pipe(
    Schedule.satisfiesInputType<BacklogSample>(),
    Schedule.passthrough,
    Schedule.while(({ output }) => output.pendingMessages >= limit)
  )
```

This schedule continues while the backlog is still at or above the limit and
stops on the first successful sample below the limit.

## Notes and caveats

`Schedule.while` receives schedule metadata after the timing schedule has been
stepped. In this recipe the important field is `output`, because
`Schedule.passthrough` makes the output equal to the latest successful poll
value.

`Effect.repeat` feeds successful values into the schedule. Failures from
`readProgress` do not reach the threshold predicate.

The first poll is not delayed by the schedule. Spacing applies only before later
recurrences.

Without a cap, timeout, or external interruption, a threshold that is never
crossed can poll forever. Add a recurrence limit or time budget when the caller
needs a definite answer.
