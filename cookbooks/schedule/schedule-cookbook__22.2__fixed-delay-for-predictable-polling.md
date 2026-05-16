---
book: Effect `Schedule` Cookbook
section_number: "22.2"
section_title: "Fixed delay for predictable polling"
part_title: "Part V — Backoff and Delay Strategies"
chapter_title: "22. Constant Delay Recipes"
status: "draft"
code_included: true
---

# 22.2 Fixed delay for predictable polling

Use a fixed delay when a polling loop should be easy to reason about: check the
status, and if the status is still non-terminal, wait the same amount of time
before checking again. This is a good default for status endpoints where
precision is less important than predictable load and readable operational
behavior.

In Effect, polling with `Effect.repeat` is driven by successful values. A status
such as `"running"` is not a failure; it is a successful observation that tells
the schedule whether another observation is needed.

## Problem

You have a status endpoint for a submitted operation. The endpoint can report a
terminal state, or it can report that the operation is still running.

You want the first check to happen immediately, then every later check to be
spaced by a fixed delay while the operation remains non-terminal.

## When to use it

Use this when each successful status response gives enough information to
decide whether to continue polling.

This fits background jobs, exports, payment settlement checks, deployment
rollouts, and provisioning APIs where `"queued"` or `"running"` means "wait and
look again", not "the effect failed".

## When not to use it

Do not use this as a retry policy for a failing status endpoint. With
`Effect.repeat`, a failure from the status-check effect stops the repeat. If
transport or decoding failures should be retried, apply `Effect.retry` to the
status check separately.

Do not use a fixed delay when many clients or workers will poll the same
dependency in sync. In that case, consider adding jitter after choosing the base
cadence.

## Schedule shape

Use `Schedule.spaced` for a constant pause after each successful non-terminal
observation:

```ts
Schedule.spaced("3 seconds").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running")
)
```

`Schedule.spaced("3 seconds")` waits three seconds before each recurrence.
`Schedule.passthrough` keeps the latest successful `Status` as the schedule
output. `Schedule.while` stops as soon as the latest successful status is
terminal.

This is fixed delay polling, not fixed wall-clock cadence. If a status request
takes 700 milliseconds, the next request starts roughly three seconds after
that request completes.

## Code

```ts
import { Effect, Schedule } from "effect"

type Status =
  | { readonly state: "running"; readonly jobId: string }
  | { readonly state: "completed"; readonly jobId: string; readonly artifactId: string }
  | { readonly state: "failed"; readonly jobId: string; readonly reason: string }

type StatusReadError = {
  readonly _tag: "StatusReadError"
  readonly message: string
}

const isRunning = (status: Status): boolean => status.state === "running"

declare const readStatus: (
  jobId: string
) => Effect.Effect<Status, StatusReadError>

const pollEvery3SecondsWhileRunning = Schedule.spaced("3 seconds").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isRunning(input))
)

const pollStatus = (jobId: string) =>
  readStatus(jobId).pipe(
    Effect.repeat(pollEvery3SecondsWhileRunning)
  )
```

`pollStatus` performs the first status read immediately. If that read returns
`"completed"` or `"failed"`, the repeat stops and returns that terminal status.
If it returns `"running"`, the schedule waits three seconds and reads again.

The returned effect succeeds with the final observed `Status`. It fails with
`StatusReadError` only when `readStatus` itself fails.

## Variants

Add a time budget when the caller should stop waiting even if the operation is
still running:

```ts
const pollEvery3SecondsForUpTo1Minute = Schedule.spaced("3 seconds").pipe(
  Schedule.satisfiesInputType<Status>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => isRunning(input)),
  Schedule.bothLeft(
    Schedule.during("1 minute").pipe(Schedule.satisfiesInputType<Status>())
  )
)
```

With this variant, the final value may be terminal, or it may be the last
`"running"` status observed before the schedule-side budget ended.

Use `Schedule.fixed("3 seconds")` only when you want a fixed wall-clock cadence
instead of a fixed pause after each status read completes.

## Notes and caveats

`Effect.repeat` feeds successful values into the schedule. That is why the
`Schedule.while` predicate reads `metadata.input`: it is looking at the latest
successful `Status`, not at an error.

The first status check is not delayed. The schedule controls only decisions
after a successful check.

Terminal domain statuses such as `"completed"` and `"failed"` are ordinary
successful observations in this recipe. Decide after polling whether a terminal
`"failed"` status should become an application error for your caller.
