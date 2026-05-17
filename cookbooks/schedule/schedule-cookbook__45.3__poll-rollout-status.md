---
book: Effect `Schedule` Cookbook
section_number: "45.3"
section_title: "Poll rollout status"
part_title: "Part X — Real-World Recipes"
chapter_title: "45. Infrastructure and Platform Recipes"
status: "draft"
code_included: true
---

# 45.3 Poll rollout status

Rollout polling turns an external deployment's progress into a bounded wait.
The status endpoint reports domain states as successful responses, so the
schedule should inspect those values rather than treat unfinished work as an
error.

## Problem

A deploy controller has a rollout id and needs one final outcome: succeeded,
failed, or still running when the polling budget expires. While the latest
status is `"running"`, it should wait and read again.

The important boundary is between read failures and rollout failures. A timeout
or malformed response from the status endpoint belongs in the Effect error
channel. A rollout status of `"failed"` is a successful status read and should
stop polling just like `"succeeded"` does.

## When to use it

Use this recipe when the rollout API exposes terminal domain states and callers
need to distinguish all three outcomes:

- the rollout is still `"running"` when the polling budget is exhausted
- the rollout finished with `"succeeded"`
- the rollout finished with `"failed"`

This is a good fit for deployment controllers, progressive delivery systems,
schema migrations, feature-flag rollouts, and infrastructure provisioning where
the operation continues outside the current process.

## When not to use it

Do not use this as a retry policy for failed status reads. With
`Effect.repeat`, a failed read stops the repeat before the schedule can inspect
a status. If transient read failures should be retried, add a separate
`Effect.retry` around the single status read.

Do not encode a rollout's terminal `"failed"` status as an Effect failure just
to stop polling. Keep it as a successful status value, stop the schedule, and
decide what it means after polling completes.

Do not leave a fleet-wide polling policy unbounded. Add an elapsed budget,
recurrence limit, or owner fiber that can interrupt the poller.

## Schedule shape

Start with a cadence, add jitter for fleet-wide polling, pass the latest status
through as the schedule output, and continue only while the latest status is
running:

```ts
Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<RolloutStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running")
)
```

`Schedule.spaced("5 seconds")` waits between successful status reads.
`Schedule.jittered` adjusts each delay so many instances do not poll at the
same instant. `Schedule.passthrough` makes the schedule output the latest
successful status, and `Schedule.while` uses that status to decide whether
another poll is needed.

Returning `true` from the predicate allows another poll. Returning `false`
stops the repeat and returns the latest status.

## Code

```ts
import { Effect, Schedule } from "effect"

type RolloutStatus =
  | {
    readonly state: "running"
    readonly rolloutId: string
    readonly completedInstances: number
    readonly totalInstances: number
  }
  | {
    readonly state: "succeeded"
    readonly rolloutId: string
    readonly version: string
  }
  | {
    readonly state: "failed"
    readonly rolloutId: string
    readonly reason: string
  }

type StatusReadError = {
  readonly _tag: "StatusReadError"
  readonly rolloutId: string
}

type RolloutTimedOut = {
  readonly _tag: "RolloutTimedOut"
  readonly lastStatus: Extract<RolloutStatus, { readonly state: "running" }>
}

type RolloutFailed = {
  readonly _tag: "RolloutFailed"
  readonly rolloutId: string
  readonly reason: string
}

declare const readRolloutStatus: (
  rolloutId: string
) => Effect.Effect<RolloutStatus, StatusReadError>

const pollRolloutStatus = Schedule.spaced("5 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<RolloutStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running"),
  Schedule.bothLeft(
    Schedule.during("3 minutes").pipe(
      Schedule.satisfiesInputType<RolloutStatus>()
    )
  )
)

export const waitForRollout = (rolloutId: string) =>
  readRolloutStatus(rolloutId).pipe(
    Effect.repeat(pollRolloutStatus),
    Effect.flatMap((status) => {
      switch (status.state) {
        case "succeeded":
          return Effect.succeed(status)
        case "failed":
          return Effect.fail({
            _tag: "RolloutFailed",
            rolloutId: status.rolloutId,
            reason: status.reason
          } satisfies RolloutFailed)
        case "running":
          return Effect.fail({
            _tag: "RolloutTimedOut",
            lastStatus: status
          } satisfies RolloutTimedOut)
      }
    })
  )
```

`waitForRollout` reads the rollout status immediately. If the first result is
`"succeeded"` or `"failed"`, there is no delay and no second request. If the
result is `"running"`, the schedule waits about five seconds, with jitter, and
then reads again.

The repeat returns the last observed `RolloutStatus`. The final
`Effect.flatMap` keeps the three cases separate: success returns the succeeded
status, a terminal rollout failure becomes `RolloutFailed`, and exhausting the
three-minute polling budget while still running becomes `RolloutTimedOut`.

## Variants

For a command-line tool where users expect a quicker answer, use a smaller
budget:

```ts
const cliRolloutPolling = Schedule.spaced("2 seconds").pipe(
  Schedule.satisfiesInputType<RolloutStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running"),
  Schedule.bothLeft(
    Schedule.during("30 seconds").pipe(
      Schedule.satisfiesInputType<RolloutStatus>()
    )
  )
)
```

For a background reconciler, prefer a recurrence cap when each read may already
have its own request timeout:

```ts
const reconcilerRolloutPolling = Schedule.spaced("15 seconds").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<RolloutStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running"),
  Schedule.bothLeft(
    Schedule.recurs(40).pipe(
      Schedule.satisfiesInputType<RolloutStatus>()
    )
  )
)
```

For transient status-read failures, retry the read itself and then repeat the
successful statuses:

```ts
const readWithRetry = (rolloutId: string) =>
  readRolloutStatus(rolloutId).pipe(
    Effect.retry(Schedule.exponential("100 millis").pipe(
      Schedule.jittered,
      Schedule.both(Schedule.recurs(3))
    ))
  )

const program = (rolloutId: string) =>
  readWithRetry(rolloutId).pipe(
    Effect.repeat(pollRolloutStatus)
  )
```

The retry schedule sees status-read errors. The repeat schedule sees successful
`RolloutStatus` values.

## Notes and caveats

The first status read is not delayed. Schedule delays apply only before later
recurrences.

`Schedule.while` is evaluated after a successful status read. It does not
cancel a read that is already in progress.

`Schedule.during("3 minutes")` limits the recurrence policy. If that budget is
exhausted before a terminal status is observed, `Effect.repeat` still returns
the last successful status, which can be `"running"`.

Use `Schedule.passthrough` when the caller needs the final domain status. If
you omit it, the repeat returns the timing schedule's output instead of the
rollout status.
