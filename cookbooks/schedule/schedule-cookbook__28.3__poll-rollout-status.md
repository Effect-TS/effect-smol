---
book: "Effect `Schedule` Cookbook"
section_number: "28.3"
section_title: "Poll rollout status"
part_title: "Part VII — Real-World Recipes"
chapter_title: "28. Infrastructure and Platform Recipes"
status: "draft"
code_included: true
---

# 28.3 Poll rollout status

Rollout polling turns an external deployment's progress into a bounded wait.
The status endpoint reports domain states as successful responses, so the
schedule should inspect those values rather than treat unfinished work as an
error.

## Problem

A deploy controller has a rollout id and needs one final outcome: succeeded,
failed, or still running when the polling budget expires. While the latest
status is `"running"`, it should wait and read again.

Keep read failures separate from rollout failures. A timeout or malformed
response from the status endpoint belongs in the Effect error channel. A rollout
status of `"failed"` is a successful read that stops polling just like
`"succeeded"` does.

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

Do not use this as a retry policy for failed status reads. With `Effect.repeat`,
a failed read stops the repeat before the schedule can inspect a status. If
transient reads should be retried, add a separate `Effect.retry` around the
single status read.

Do not encode a rollout's terminal `"failed"` status as an Effect failure just
to stop polling. Keep it as a successful status value, stop the schedule, and
decide what it means after polling completes.

Do not leave a fleet-wide polling policy unbounded. Add an elapsed budget,
recurrence limit, or owner fiber that can interrupt the poller.

## Schedule shape

Start with a cadence, add jitter for fleet-wide polling, pass the latest status
through as the schedule output, and continue only while the latest status is
running. Add a count or elapsed budget so a rollout that never becomes terminal
does not poll forever.

## Code

```ts
import { Console, Effect, Schedule } from "effect"

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

const statuses: ReadonlyArray<RolloutStatus> = [
  {
    state: "running",
    rolloutId: "rollout-42",
    completedInstances: 1,
    totalInstances: 3
  },
  {
    state: "running",
    rolloutId: "rollout-42",
    completedInstances: 2,
    totalInstances: 3
  },
  {
    state: "succeeded",
    rolloutId: "rollout-42",
    version: "2026.05.17"
  }
]

let reads = 0

const readRolloutStatus: (rolloutId: string) => Effect.Effect<RolloutStatus, StatusReadError> =
  Effect.fnUntraced(function*(rolloutId: string) {
    const status = statuses[Math.min(reads, statuses.length - 1)]
    reads += 1
    yield* Console.log(`rollout read ${reads} for ${rolloutId}: ${status.state}`)
    return status
  })

const pollRolloutStatus = Schedule.spaced("10 millis").pipe(
  Schedule.jittered,
  Schedule.satisfiesInputType<RolloutStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running"),
  Schedule.bothLeft(Schedule.during("200 millis")),
  Schedule.bothLeft(Schedule.recurs(5))
)

const waitForRollout = (rolloutId: string) =>
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

const program = waitForRollout("rollout-42").pipe(
  Effect.flatMap((status) =>
    Console.log(`rollout ${status.rolloutId} finished on ${status.version}`)
  ),
  Effect.catch((error: RolloutFailed | RolloutTimedOut | StatusReadError) =>
    Console.log(`rollout stopped: ${error._tag}`)
  )
)

void Effect.runPromise(program)
```

`waitForRollout` reads immediately. If the first result is `"succeeded"` or
`"failed"`, there is no delay and no second request. If the result is
`"running"`, the schedule waits, applies jitter, and reads again.

The repeat returns the last observed `RolloutStatus`. The final `flatMap` keeps
the three outcomes separate: success returns the succeeded status, rollout
failure becomes `RolloutFailed`, and exhausting the polling budget while still
running becomes `RolloutTimedOut`.

## Variants

For a command-line tool, use a smaller budget. For a background reconciler, use
a slower cadence and a recurrence cap when each read already has its own request
timeout. For transient status-read failures, retry the read itself and then
repeat successful statuses:

```ts
import { Console, Effect, Schedule } from "effect"

type StatusReadError = { readonly _tag: "StatusReadError" }
type RolloutStatus = { readonly state: "running" | "succeeded" }

let attempts = 0

const readStatus = Effect.gen(function*() {
  attempts += 1
  yield* Console.log(`status read attempt ${attempts}`)
  if (attempts === 1) {
    return yield* Effect.fail({ _tag: "StatusReadError" } satisfies StatusReadError)
  }
  return { state: attempts < 3 ? "running" : "succeeded" } satisfies RolloutStatus
})

const readRetry = Schedule.exponential("10 millis").pipe(
  Schedule.both(Schedule.recurs(2))
)

const pollStatus = Schedule.spaced("10 millis").pipe(
  Schedule.satisfiesInputType<RolloutStatus>(),
  Schedule.passthrough,
  Schedule.while(({ input }) => input.state === "running"),
  Schedule.bothLeft(Schedule.recurs(4))
)

const program = readStatus.pipe(
  Effect.retry(readRetry),
  Effect.repeat(pollStatus),
  Effect.flatMap((status) => Console.log(`final status: ${status.state}`)),
  Effect.catch((error: StatusReadError) =>
    Console.log(`status read failed: ${error._tag}`)
  )
)

void Effect.runPromise(program)
```

The retry schedule sees status-read errors. The repeat schedule sees successful
`RolloutStatus` values.

## Notes and caveats

The first status read is not delayed. Schedule delays apply only before later
recurrences.

`Schedule.while` is evaluated after a successful status read. It does not cancel
a read that is already in progress.

`Schedule.during` limits recurrence decisions. If the budget is exhausted before
a terminal status is observed, `Effect.repeat` still returns the last successful
status, which can be `"running"`.

Use `Schedule.passthrough` when the caller needs the final domain status. If you
omit it, the repeat returns the timing schedule's output instead of the rollout
status.
